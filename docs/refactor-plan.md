# Refactor plan: Craft copy to plain-text HTML

Status: proposed implementation plan. This document and the [previous feature inventory](previous-features.md) do not change the existing workflow runtime.

## Goal and output contract

Build a small Alfred workflow from scratch with one job: read rich text copied from Craft, convert it to HTML source, and replace the clipboard with that source as plain text.

“Plain-text HTML” means literal HTML markup that a text editor can paste and display. It does not mean stripping tags out of HTML. For example, a Craft selection containing bold “Hello” and ordinary “world” produces:

```html
<div><strong>Hello</strong> world</div>
```

The clipboard must contain exactly one item with one explicitly published representation: `NSPasteboardTypeString` (`public.utf8-plain-text`). Its value is the HTML string. Do not publish `NSPasteboardTypeHTML`, RTF, the original unformatted text, alternate output flavors, or additional clipboard items. The receiving application chooses how to use the literal source.

The conversion function returns one HTML string. Original text may exist temporarily while parsing input, but it is neither an alternate result nor an output clipboard representation. There are no output-mode flags or compatibility switches.

## One user flow

1. Select content in Craft and copy it with Command-C.
2. Invoke Alfred and run the argument-free keyword `crafthtml`.
3. The workflow reads the current clipboard's RTF, converts it, and replaces the clipboard with the HTML source as plain text.
4. A notification says “HTML source copied to clipboard.” Paste with Command-V wherever the source is needed.

Use one keyword, one script action, and one notification. This plan deliberately chooses manual copying to keep the new workflow focused on conversion. Remove the existing automatic-copy hotkey and `--copy` path, including modifier polling, application-focus checks, and System Events automation. The replacement needs no copy-automation permissions.

Input comes from the current system clipboard. Require RTF; do not add HTML, Markdown, plain-text, file, or clipboard-history input fallbacks. RTF from another application can be processed by the same contract, but Craft is the documented source and must be used for manual acceptance testing.

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

1. **Read input:** capture the pasteboard revision and RTF data without changing the clipboard.
2. **Parse input:** decode RTF into an attributed string and extract text, styles, and line/list structure. Reject unreadable or empty input before writing anything.
3. **Serialize:** convert the parsed content into one escaped HTML string. The serializer does not access the clipboard or Alfred.
4. **Write output:** prepare one item containing the HTML string under `NSPasteboardTypeString`, check the captured revision, clear the clipboard, and write that item.
5. **Report status:** send a short success or failure message to Alfred's notification. Status messages never become clipboard contents.

The writer should accept a pasteboard object so tests can use an isolated named pasteboard. Production passes `NSPasteboard.generalPasteboard`. Keep fixture execution in a separate test harness rather than retaining a file-path mode in the production entry point.

Follow `AGENTS.md` for JavaScript documentation, declaration keywords, spacing, and commits. Reuse the repository's linting, formatting, Python environment, and packaging tools.

### Clipboard failures

- Missing RTF: report “Copy formatted text from Craft first.” Leave the clipboard unchanged.
- Unreadable or empty RTF: report a conversion failure. Leave the clipboard unchanged.
- Conversion failure: report the error before any clipboard mutation.
- Clipboard revision changed during conversion: report “Clipboard changed. Copy from Craft and try again.” Preserve the newer copy.
- Failure to prepare the output item: stop before clearing the pasteboard.
- Failure to write after clearing: report the failure explicitly. Do not report success or publish original-text/RTF fallback representations. The clear/write API sequence is not atomic, so this failure can leave the clipboard empty.

Once conversion succeeds, a second invocation sees only plain-text HTML and therefore reports missing RTF without changing it. It must not escape the generated HTML a second time or create another output variant.

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
- Remove `copyFromCraft()`, `--copy`, production file arguments, and Anki-specific status text.

### 3. Replace Alfred wiring

- Rebuild `workflow/info.plist` with the `crafthtml` keyword, one nonconcurrent conversion action, and one notification.
- Wire `keyword → convert → notify`, using `/usr/bin/osascript -l JavaScript "./convert.js"` without runtime arguments.
- Remove the `copy-hotkey` and `copy-convert` objects, their connections, and their canvas entries.
- Update the description, keyword labels, notification text, and embedded readme to say HTML source is copied as plain text.
- Keep the existing bundle identifier so importing the rebuilt package updates the installed workflow. The internal identifier is retained for upgrade identity; user-facing text should describe the new purpose.
- Increment the workflow version for the behavior change when implementing and releasing it.

### 4. Replace tests with checks of the new contract

Use the existing Python test entry point and a JXA test harness. Replace obsolete expectations about `{ html, plain }`, the hotkey, `--copy`, and exact legacy wrapper layout.

| Check                  | Required evidence                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML conversion        | Fixtures cover escaping, style combinations, underline, strike, code whitespace, allowed/disallowed links, nested bullets, ordinary text around lists, Unicode, and all supported line endings.                                          |
| Output value           | The only published string equals the generated HTML, including tags; it is not the original plain text.                                                                                                                                  |
| Output representations | Seed an isolated pasteboard with rich-text input and additional types, run the writer, and inspect the resulting item. Assert one item and exactly the explicitly declared plain-text type, with no HTML or RTF representation retained. |
| Failure preservation   | Missing/invalid/empty RTF and conversion failures do not change the seeded clipboard. A revision change before writing preserves the newer contents.                                                                                     |
| Write failure          | A controlled failed-write case returns an error rather than a success notification.                                                                                                                                                      |
| Repeated invocation    | Running against the successful plain-text result leaves it unchanged and reports missing RTF.                                                                                                                                            |
| Workflow graph         | The keyword takes no argument, there is one conversion action and one notification, all connections are valid, and no automatic-copy path remains.                                                                                       |
| Package contents       | The built archive contains the replacement runtime and current metadata/readme at its root, without legacy runtime files or an alternate workflow.                                                                                       |

Automated checks must use fixture files and isolated pasteboards so they do not overwrite the developer's general clipboard. Account for any system-synthesized pasteboard aliases separately from the one type explicitly published by the workflow.

### 5. Update documentation and package

- Rewrite `README.md`, `workflow/README.txt`, and the embedded plist readme around manual Copy, `crafthtml`, and pasting literal HTML source.
- Replace `docs/FEATURES.md` with the implemented single-output behavior and accurate formatting limits. Link to the historical inventory instead of presenting old features as current.
- Remove Anki formatted-paste instructions, hotkey setup, and copy-automation permission guidance from current usage documentation.
- Record the keyword change, removed hotkey, single plain-text clipboard representation, and lost formatted-paste behavior in `CHANGELOG.md`.
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

Import the rebuilt workflow into Alfred and verify a fresh Craft copy through `crafthtml`. Paste into a plain-text editor and confirm that literal HTML tags appear. Inspect the pasteboard to confirm that the workflow publishes only the HTML source as plain text. Verify that no old hotkey or `craftanki` action remains after updating an existing installation.

The refactor is complete when this single path works, the output contract and error checks pass, current documentation matches the shipped workflow, and the completed changes are committed. There should be no remaining output mode to select and no separately preserved original-text, RTF, or rich-HTML copy.
