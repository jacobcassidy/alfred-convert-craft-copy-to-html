# Refactor plan: Craft copy to plain-text HTML

Status: proposed implementation plan. This document and the [previous feature inventory](previous-features.md) do not change the existing workflow runtime.

## Goal and output contract

Build a small Alfred workflow from scratch with one job: use a keyboard shortcut to copy the selected rich text from Craft, convert it to HTML source, and replace the clipboard with that source as plain text.

“Plain-text HTML” means literal HTML markup that a text editor can paste and display. It does not mean stripping tags out of HTML. For example, a Craft selection containing bold “Hello” and ordinary “world” produces:

```html
<div><strong>Hello</strong> world</div>
```

The clipboard must contain exactly one item with one explicitly published representation: `NSPasteboardTypeString` (`public.utf8-plain-text`). Its value is the HTML string. Do not publish `NSPasteboardTypeHTML`, RTF, the original unformatted text, alternate output flavors, or additional clipboard items. The receiving application chooses how to use the literal source.

The conversion function returns one HTML string. Original text may exist temporarily while parsing input, but it is neither an alternate result nor an output clipboard representation. There are no output-mode flags or compatibility switches.

## One user flow

1. Select content in the native Craft app.
2. Press Option-Command-C and release the shortcut keys.
3. The workflow sends Command-C to Craft, waits for a fresh copy, reads its RTF, converts it, and replaces the clipboard with the HTML source as plain text.
4. A notification says “HTML source copied to clipboard.” Paste with Command-V wherever the source is needed.

Use one Alfred hotkey trigger, one script action, and one notification. Option-Command-C is the default shortcut; it can be reassigned in Alfred if it conflicts or is cleared on import. Do not include any Alfred keyword objects, keyword aliases, or a separate convert-existing-clipboard action. The script's sole production path copies from Craft and converts the fresh result, without a `--copy` mode switch. It does not paste automatically.

### Craft must be the active app

Configure the Alfred hotkey's Related Apps restriction to allow the shortcut only when the native Craft app is frontmost. The shortcut must remain available to other apps for their own commands without triggering this workflow. Do not activate Craft automatically or treat a running background instance as sufficient.

Identify Craft by its bundle identifier, `com.lukilabs.lukiapp`, verified from the installed app's `Contents/Info.plist`. Use that identity for both the Alfred app restriction and runtime validation instead of matching the display name alone. The browser version of Craft is outside this workflow's scope.

The runtime must independently verify the frontmost bundle identifier at entry and retain that process identifier. Check that the same Craft process is still active immediately before sending Copy, after the fresh copy arrives, and immediately before replacing the clipboard with HTML source. If focus changes, stop further processing without writing converted output. These checks cover focus changes during execution and direct invocation of the script even when Alfred's trigger restriction is bypassed.

Copy automation uses System Events and may require Alfred's Accessibility permission and permission to control System Events under macOS Automation settings. Require Craft to remain frontmost while copying. Wait up to three seconds for shortcut modifiers to be released, confirm the frontmost process is unchanged, then send Command-C. Poll for a clipboard revision change for up to 2.5 seconds and check focus again before conversion. Report permission, modifier-release, focus, and copy-timeout failures instead of converting stale clipboard contents. A revision change alone cannot prove which application authored the copy.

Input comes only from the fresh copy made by the shortcut. Require RTF; do not add HTML, Markdown, plain-text, file, existing-clipboard, or clipboard-history input fallbacks. Use Craft for manual acceptance testing.

## Conversion scope

Keep the currently implemented semantic formatting as the baseline for the new serializer. This preserves useful Craft content while changing how the result is copied. Reimplement the contract independently of the old Anki-specific clipboard and automation code.

| Input content                   | Single HTML output                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary text                   | Escape HTML-sensitive characters and place the result in an outer `<div>`.                                                                                                         |
| Bold, italic, underline, strike | Use `<strong>`, `<em>`, `<u>`, and `<s>`; support combinations with deterministic nesting.                                                                                         |
| Monospace text                  | Use `<code>` with `white-space:pre-wrap` and a monospace font style so spaces and line breaks remain meaningful. Retain the existing monospace trait/font-name detection baseline. |
| Web and mail links              | Use escaped `<a href="…">` destinations for `http:`, `https:`, and `mailto:` only. Unsupported destinations retain visible text.                                                   |
| Line breaks                     | Normalize CRLF and CR to LF internally, retaining corresponding style offsets correctly, and serialize text line breaks as `<br>`.                                                 |
| Bullet prefixes and indentation | Recognize the existing bullet markers and whitespace rules, remove their prefixes, and emit nested `<ul>`/`<li>` structures. Keep a monospace dash-prefixed line as code.          |
| Unicode text                    | Preserve characters, including emoji and combining sequences, without splitting or duplicating them at style boundaries.                                                           |

Return one deterministic HTML fragment, without a document shell, stylesheet, or alternate compact/pretty formats. Keep inline tags with their text and use a single block-newline convention without indentation. Do not recreate the old formatter's special boundary-sharing rules; preserve semantic behavior rather than every previous source-layout snapshot.

Heading inference, numbered lists, task states, images, attachments, tables, syntax highlighting, font colors, font sizes, and exact Craft layout are outside this initial implementation. In particular, do not implement heading detection merely because the old feature notes claim it exists.

## Implementation design

Use the built-in macOS JXA and AppKit runtime, with no new runtime dependencies. Create a fresh implementation in `workflow/convert.js` rather than adding another output mode to the existing converter.

Keep responsibilities small and explicit:

1. **Copy selection:** verify the frontmost app's Craft bundle identifier and record its process identifier, wait for shortcut modifiers to be released, recheck focus, send Command-C, and require a fresh clipboard revision within the timeout.
2. **Read input:** capture the fresh pasteboard revision and RTF data without further clipboard changes.
3. **Parse input:** decode RTF into an attributed string and extract text, styles, and line/list structure. Reject unreadable or empty input before writing converted output.
4. **Serialize:** convert the parsed content into one escaped HTML string. The serializer does not access the clipboard or Alfred.
5. **Write output:** prepare one item containing the HTML string under `NSPasteboardTypeString`, confirm that the original Craft process remains frontmost, check the captured revision, clear the clipboard, and write that item.
6. **Report status:** send a short success or failure message to Alfred's notification. Status messages never become clipboard contents.

The writer should accept a pasteboard object so tests can use an isolated named pasteboard. Production passes `NSPasteboard.generalPasteboard`. Isolate copy automation behind testable operations for focus, modifier state, time, and sending Copy so automated tests need not send real keystrokes. Keep fixture execution in a separate test harness rather than retaining a file-path mode in the production entry point.

Follow `AGENTS.md` for JavaScript documentation, declaration keywords, spacing, and commits. Reuse the repository's linting, formatting, Python environment, and packaging tools.

### Copy and clipboard failures

- Outside Craft: Alfred must not trigger the workflow. If the script is invoked directly while another app is active, reject it before sending Copy or changing the clipboard.
- Shortcut modifiers remain held, focus changes, Copy is denied, or no fresh copy arrives: report the specific problem and stop further processing without writing converted output.
- Missing RTF in the fresh copy: report “Select formatted text in Craft and try the shortcut again.” Leave the freshly copied contents unchanged.
- Unreadable or empty RTF: report a conversion failure. Leave the freshly copied contents unchanged.
- Conversion failure: report the error before writing converted output.
- Clipboard revision changed during conversion: report “Clipboard changed. Select text in Craft and try the shortcut again.” Preserve the newer copy.
- Failure to prepare the output item: stop before clearing the pasteboard.
- Failure to write after clearing: report the failure explicitly. Do not report success or publish original-text/RTF fallback representations. The clear/write API sequence is not atomic, so this failure can leave the clipboard empty.

Copying from Craft itself replaces the previous clipboard. Failure preservation applies to the contents present when conversion begins, not restoration of the clipboard from before the shortcut. Do not add backup clipboard representations or a restoration mode.

Every shortcut invocation must make a fresh Craft copy before conversion, including when the clipboard already contains a previous HTML result. Never reuse or escape that previous result as input after a failed copy.

## Changes to make

### 1. Establish the new baseline

- Keep [previous-features.md](previous-features.md) as the record of the old behavior.
- Use the output contract above as the specification for the new implementation and tests.
- Retain the existing RTF fixtures as conversion examples. Capture additional representative Craft copies for formatting combinations, links, underline, Unicode, and line endings.
- Remove the old runtime implementation when the replacement is ready; do not ship an old/new selector or parallel legacy workflow.

### 2. Build the converter and single clipboard writer

- Implement attributed-text parsing and the HTML serializer from the conversion scope.
- Return a string instead of the existing `{ html, plain }` result object.
- Implement input validation, the clipboard revision check, and a writer that declares only `NSPasteboardTypeString` with the generated HTML value.
- Remove all output writes of `NSPasteboardTypeHTML` and `NSPasteboardTypeRTF`, and the write of the original plain text.
- Implement the guarded Craft-copy operation as the required first step of the sole production path. Retain the useful focus, modifier-release, and fresh-copy safeguards from the old workflow without retaining its optional copy mode.
- Replace display-name matching with Craft's bundle identifier and validate the original frontmost process before Copy, after Copy, and before the output write.
- Remove `--copy`, production file arguments, and Anki-specific status text.

### 3. Replace Alfred wiring

- Rebuild `workflow/info.plist` with one Option-Command-C hotkey trigger, one nonconcurrent copy-and-convert action, and one notification.
- Restrict the hotkey to Craft using Alfred's Related Apps configuration and the verified bundle identifier. Preserve this app restriction in the packaged plist and when the shortcut is reassigned.
- Wire `copy-hotkey → convert → notify`, using `/usr/bin/osascript -l JavaScript "./convert.js"` without runtime arguments. The action always performs the guarded copy before conversion.
- Remove every keyword object and its connections and canvas entries, including the existing `craftanki` keyword. Do not introduce `crafthtml` or any other keyword. Consolidate the old two script actions into the single action.
- Update the description, shortcut labels, notification text, and embedded readme to say the shortcut copies the Craft selection as plain-text HTML source.
- Keep the existing bundle identifier so importing the rebuilt package updates the installed workflow. The internal identifier is retained for upgrade identity; user-facing text should describe the new purpose.
- Increment the workflow version for the behavior change when implementing and releasing it.

### 4. Replace tests with checks of the new contract

Use the existing Python test entry point and a JXA test harness. Replace obsolete expectations about `{ html, plain }`, dual invocation paths, `--copy`, and exact legacy wrapper layout. Keep checks for the default hotkey binding.

| Check                  | Required evidence                                                                                                                                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML conversion        | Fixtures cover escaping, style combinations, underline, strike, code whitespace, allowed/disallowed links, nested bullets, ordinary text around lists, Unicode, and all supported line endings.                                                     |
| Output value           | The only published string equals the generated HTML, including tags; it is not the original plain text.                                                                                                                                             |
| Output representations | Seed an isolated pasteboard with rich-text input and additional types, run the writer, and inspect the resulting item. Assert one item and exactly the explicitly declared plain-text type, with no HTML or RTF representation retained.            |
| Failure preservation   | Missing/invalid/empty RTF and conversion failures do not change the seeded clipboard. A revision change before writing preserves the newer contents.                                                                                                |
| Write failure          | A controlled failed-write case returns an error rather than a success notification.                                                                                                                                                                 |
| Copy safeguards        | Simulated focus, modifier, permission, and timeout failures stop conversion. A stale clipboard is never used, and conversion starts only after a fresh copy and focus validation.                                                                   |
| Craft-only execution   | Reject a non-Craft bundle identifier even if its display name is Craft. Direct invocation outside Craft sends no keystrokes and changes no clipboard contents. A focus change before Copy, after Copy, or before writing prevents the output write. |
| Repeated invocation    | Each invocation requests a fresh Craft copy. A failed subsequent copy does not convert the previous HTML result.                                                                                                                                    |
| Workflow graph         | Exactly one hotkey trigger has the default binding and a Craft-only app restriction; one action leads to one notification; every connection is valid. No keyword objects or alternate invocation paths exist.                                       |
| Package contents       | The built archive contains the replacement runtime and current metadata/readme at its root, without legacy runtime files or an alternate workflow.                                                                                                  |

Automated checks must use fixture files, isolated pasteboards, and simulated copy operations so they do not overwrite the developer's general clipboard or send real keystrokes. Account for any system-synthesized pasteboard aliases separately from the one type explicitly published by the workflow.

### 5. Update documentation and package

- Rewrite `README.md`, `workflow/README.txt`, and the embedded plist readme around selecting text in Craft, pressing Option-Command-C, and pasting literal HTML source. Document that Craft must be active, shortcut reassignment must retain the Craft restriction, and copy automation requires the relevant permissions.
- Replace `docs/FEATURES.md` with the implemented single-output behavior and accurate formatting limits. Link to the historical inventory instead of presenting old features as current.
- Remove Anki formatted-paste instructions and all keyword usage instructions from current documentation.
- Record the shortcut-only flow, removed keyword path, single plain-text clipboard representation, and lost formatted-paste behavior in `CHANGELOG.md`.
- Retain the build script and existing development setup. Correct references to the Python formatting check command to use the actual `npm run check:py` alias when editing those instructions.
- Build `dist/convert-craft-copy-to-html.alfredworkflow` and inspect its contents. Commit the completed implementation and relevant documentation following the repository's commit style.

## Validation and completion

Run the repository's relevant checks after implementing the replacement:

```sh
npm run lint:scripts
npm run lint:docs
npm run check
npm run lint:py
npm run check:py
npm run test:py
npm run build:workflow
```

Import the rebuilt workflow into Alfred, select text in Craft, and press Option-Command-C to verify copying and conversion in one shortcut. Paste into a plain-text editor and confirm that literal HTML tags appear. Inspect the pasteboard to confirm that the workflow publishes only the HTML source as plain text. Verify shortcut reassignment, permission-error reporting, modifier-release handling, focus changes, and copy timeouts manually. Confirm that exactly one shortcut path and no Alfred keywords remain after updating an existing installation.

With Craft running in the background, make another app active and press the shortcut. Confirm that the workflow does not launch, send Copy, show its notification, or alter the clipboard. Repeat after shortcut reassignment and after importing an update. Switch away from Craft during a run and confirm that the runtime guard prevents writing HTML output.

The refactor is complete when this single path works, the output contract and error checks pass, current documentation matches the shipped workflow, and the completed changes are committed. There should be no remaining output mode to select and no separately preserved original-text, RTF, or rich-HTML copy.
