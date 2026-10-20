# Previous workflow features

This inventory records the workflow before the proposed plain-text HTML refactor. It describes the implementation at commit `25fe223`, workflow version `0.1.0`. The source files are now archived in [reference/v0.1.0/](reference/v0.1.0/) with unchanged runtime behavior. Source paths below are relative to that archive; development configuration and `dist/` remain at the repository root.

## Purpose and execution

The workflow prepares rich text copied from Craft for formatted pasting into Anki. It generates HTML while keeping the original text and RTF available to applications that prefer those clipboard representations.

| Feature              | How it is implemented                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native macOS runtime | Alfred runs `/usr/bin/osascript -l JavaScript "./convert.js"`. `workflow/convert.js` imports AppKit through the JavaScript for Automation Objective-C bridge.                                                                                      |
| Local conversion     | AppKit parses RTF into `NSAttributedString`. The script builds HTML itself; it does not call a service, download software, or use a third-party runtime library.                                                                                   |
| Alfred integration   | `workflow/info.plist` defines the keyword, hotkey, two script actions, notification, graph connections, and canvas positions. The workflow includes `workflow/icon.png`. Import requires Alfred Powerpack, as documented in `workflow/README.txt`. |
| Workflow identity    | The name is “Convert Craft Copy to HTML”; the bundle identifier is `local.jacob.craft-to-anki`. The description and action labels refer to Anki.                                                                                                   |

## Ways to invoke the workflow

### Convert an existing copy

The `craftanki` keyword accepts no argument and runs the `convert` script action without `--copy`. It processes RTF on the current system clipboard, regardless of which application provided it. It does not read Alfred clipboard history or require Craft to be frontmost.

The connection is `keyword → convert → notify`. The script action has concurrent execution disabled.

### Copy a Craft selection and convert it

Option-Command-C runs the `copy-hotkey → copy-convert → notify` path. The hotkey uses key code `8` and modifier value `1572864`; its script action invokes the same converter with `--copy` and disables concurrent execution.

`copyFromCraft()` implements the copy automation:

1. Require the frontmost application's localized name to match `Craft`, case-insensitively, and record its process identifier.
2. Wait up to three seconds for the Command, Option, Control, and Shift modifiers to be released, polling every 25 milliseconds.
3. Confirm that the same application is still frontmost.
4. Record the clipboard's `changeCount` and send Command-C using System Events key code `8`.
5. Wait up to 2.5 seconds for the clipboard revision to change, polling every 25 milliseconds.
6. Confirm that focus has remained on the recorded process before converting.

This path reports modifier-release, focus, copy-permission, and copy-timeout problems. A timeout does not convert the previous clipboard contents. It detects a clipboard revision change; it does not prove that Craft authored that change or that a nonempty selection was copied.

The installation notes explain hotkey reassignment when Alfred clears a shortcut or detects a conflict. They also describe the possible Accessibility and System Events Automation permissions required to send Copy. The workflow never sends Paste automatically.

## Conversion rules

`convert(data)` decodes RTF using `NSAttributedString.alloc.initWithRTFDocumentAttributes(data, null)`. It reads the decoded string and attributes at each UTF-16 character index, builds style records, and groups adjacent characters whose style records match. Its return value contains both `html` and the original decoded `plain` string.

### Inline content

| Feature             | Detection and generated HTML                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text escaping       | `escapeHTML()` replaces `&`, `<`, `>`, and double quotes with HTML entities. It is used for content and link attribute values.                                                                                                      |
| Bold                | Font trait bit `2` produces `<strong>…</strong>`.                                                                                                                                                                                   |
| Italic              | Font trait bit `1` produces `<em>…</em>`.                                                                                                                                                                                           |
| Underline           | A nonzero `NSUnderlineStyleAttributeName` produces `<u>…</u>`.                                                                                                                                                                      |
| Strikethrough       | A nonzero `NSStrikethroughStyleAttributeName` produces `<s>…</s>`.                                                                                                                                                                  |
| Inline code         | Font trait bit `1024`, or a font name matching `mono`, `menlo`, `courier`, or `consolas`, produces `<code style="font-family:monospace;white-space:pre-wrap">…</code>`. Any matching monospace text is treated as code.             |
| Links               | `NSLinkAttributeName` supplies the destination. Only destinations beginning with `http:`, `https:`, or `mailto:`, case-insensitively, receive an `<a href="…">` wrapper. Other destinations keep their text without a link wrapper. |
| Combined formatting | `flush()` wraps escaped text in code, strong, emphasis, underline, strike, and link tags in that order, with the link outermost when present.                                                                                       |
| Line breaks         | CRLF, CR, and LF become `<br>` when rendering text ranges. The original decoded text remains unchanged in the separate plain-text result.                                                                                           |

The converter uses attributed text, rather than parsing incoming HTML or translating CSS declarations. Font colors, font sizes, general font families, and exact source layout are omitted, apart from the explicit monospace code style. There is no dedicated fenced-code or `<pre>` block conversion.

### Bullet lists and surrounding text

`recordLine()` splits the decoded text into lines and recognizes an optional run of spaces, tabs, or nonbreaking spaces followed by `-`, `•`, `◦`, `▪`, or `‣` and at least one whitespace character.

- A marker whose style is monospace is treated as literal code, so a line such as `- keep this code` remains code.
- Each tab counts as four spaces when calculating indentation; spaces and nonbreaking spaces count individually.
- `renderList()` groups consecutive bullet lines at the same indentation into `<ul>` and `<li>` elements. Greater indentation recursively creates nested lists inside the preceding list item.
- The bullet prefix and indentation are removed from the HTML item content. Inline styles are preserved within each item. The separate original plain text still includes the prefixes and tabs.
- When any bullet is present, consecutive nonbullet lines become `<div>` blocks joined internally with `<br>`. A group containing only empty strings is omitted.
- When no bullets are present, the entire text is rendered as one range, with line breaks represented by `<br>`.
- An outer `<div>` wraps every result.

List recognition is based on visible text prefixes, not native list metadata. There is no dedicated support for numbered lists, task states, or continuation paragraphs within an item.

### HTML source layout

`formatBlocks()` tokenizes the generated `div`, `ul`, and `li` tags into a small tree and serializes it again. Inline markup stays on the same line as its text. Block children are separated with newlines without source indentation. A `div` containing exactly one block child shares that child's opening and closing boundary lines; blocks with multiple children use separate boundaries.

Outer blocks use normal HTML whitespace behavior. The code element's `white-space:pre-wrap` style preserves whitespace inside code without making source formatting add visible gaps throughout the document.

## Clipboard representations and protection

`main()` reads `NSPasteboard.generalPasteboard`, records its revision, and requests `NSPasteboardTypeRTF`. Missing RTF returns an instruction to copy formatted text and leaves the clipboard unchanged. Invalid RTF raises a conversion error before the clipboard is cleared.

After conversion, it prepares one `NSPasteboardItem` with three representations:

| Pasteboard type          | Value                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `NSPasteboardTypeHTML`   | Generated HTML source, advertised as HTML so a receiving application can paste formatted content. |
| `NSPasteboardTypeString` | Original decoded text, without the generated HTML tags.                                           |
| `NSPasteboardTypeRTF`    | Original RTF data.                                                                                |

The script compares the clipboard revision again before clearing it. If another copy occurred during conversion, it stops without overwriting that newer clipboard. Otherwise it clears the pasteboard and writes the prepared item. Other original clipboard representations are not retained.

The revision check precedes the clear/write operations; those operations are not an atomic transaction. A write failure raises an error after clearing, with no restoration of the previous clipboard.

## Notifications and errors

Both action paths send their returned text to one Alfred notification object. Its title is “Convert Craft Copy to HTML,” and its body is `{query}`; it is shown only for a populated query.

Successful clipboard conversion returns “Ready! Paste into Anki with Command-V.” `run(argv)` catches thrown errors and prefixes their messages with “Convert Craft Copy to HTML:”. Other expected problems return explanatory messages directly, including missing RTF and a clipboard change during conversion.

## Testing and packaging

| Feature                             | How it is implemented                                                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversion without clipboard access | Passing a file path to the script reads RTF using `NSData.dataWithContentsOfFile()` and returns JSON containing `html` and `plain`. This test path does not read or write the clipboard.                                                                          |
| Formatting regression coverage      | `tests/test_conversion.py` invokes `osascript` on `formatting.rtf` and checks emphasis, strong, strike, code, escaping, a line break, and the decoded plain-text value.                                                                                           |
| List regression coverage            | `bullets.rtf` and `nested.rtf` exercise list counts, inline code, removal of bullet indentation from HTML, nesting, surrounding text, and preservation of a dash inside code.                                                                                     |
| Source-layout checks                | Tests assert line counts and exact block-boundary examples. They also inject a test `run()` entry point to call `formatBlocks()` directly.                                                                                                                        |
| Alfred wiring checks                | Tests inspect `info.plist` for the hotkey values, the hotkey-to-action connection, the presence or absence of `--copy`, and valid connection destinations.                                                                                                        |
| Importable workflow archive         | `scripts/build.py` reads the version from `workflow/info.plist` and creates `dist/convert-craft-copy-to-html.alfredworkflow` as a ZIP containing `info.plist`, `convert.js`, `README.txt`, and `icon.png` at the archive root. It does not increment the version. |
| Installation guidance               | `workflow/README.txt` and the embedded `info.plist` readme explain installation, triggers, permissions, formatting, Anki formatted paste, and checking a field's HTML.                                                                                            |

The existing suite requires macOS and AppKit. It does not exercise actual clipboard writes, copy automation, permission failures, or paste behavior in Anki. Underline and link conversion are implemented but do not have dedicated assertions in the current fixtures.

## Development support

- `package.json` and `package-lock.json` provide the Node development tools: ESLint, Prettier, markdownlint, and Lefthook. The default `npm test` runs `node --test`; the explicit conversion suite is `npm run test:py`.
- `eslint.config.js` configures the workflow files as scripts and declares the JXA globals `$`, `Application`, `ObjC`, and `delay`.
- `prettier.config.js`, `.prettierignore`, `.editorconfig`, and `.markdownlint-cli2.jsonc` define formatting and documentation checks. Build artifacts and lockfiles have relevant formatting exclusions.
- `pyproject.toml` and `uv.lock` define Python 3.11 or later with Ruff as a development dependency. Python scripts use standard-library modules; `.venv/` and `.ruff_cache/` are ignored.
- npm exposes Python environment setup, linting, formatting, conversion tests, and workflow packaging through uv. The actual Python formatting check alias in `package.json` is `check:py`.
- `lefthook.yml` runs staged JavaScript lint fixes, Markdown lint fixes, Prettier, Ruff lint fixes, and Ruff formatting sequentially, automatically staging their fixes.
- `.vscode/` provides editor recommendations and Python environment settings, including disabling automatic terminal environment activation.
- `README.md`, `docs/python-setup.md`, and `CHANGELOG.md` document development, builds, and changes. The repository includes an MIT license.

## Documentation claims that exceed the implementation

`docs/FEATURES.md` says headings are converted from bold text to `<h1>` through `<h6>`. The current converter has no heading recognition, font-size classification, or heading serialization. Bold text becomes `<strong>` regardless of heading intent. Heading conversion is therefore a documented claim, not an implemented feature.

The same notes describe converting inline CSS styles to tags. The implemented behavior instead reads font traits and attributed-string properties from RTF. No general HTML/CSS input conversion exists.
