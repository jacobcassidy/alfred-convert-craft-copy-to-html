# Convert Craft Copy to HTML

> [!NOTE]
> This project is archived. The features have be integrated into the [Anki Global Kit add-on](https://github.com/jacobcassidy/anki-global-kit-addon).

## INSTALL

Open convert-craft-copy-to-html.alfredworkflow and import/update it in Alfred (Powerpack required).
The included hotkey is Option-Command-C (Alt-Cmd-C). If Alfred clears it on import or reports a conflict, double-click the Hotkey object and assign your preferred combination.

## USE

Select text in the native Craft app, release other keys, and press Option-Command-C. After the notification, switch to Anki and paste with Command-V. The workflow sends Copy to Craft, waits for fresh clipboard content, and converts monospace runs into HTML code tags. It does not paste automatically.
The existing craftanki keyword still converts text you have already copied.

## PERMISSIONS

For the hotkey to send Command-C, macOS may require Alfred in System Settings > Privacy & Security > Accessibility and permission to control System Events under Automation. The workflow reports a copy timeout or permission error instead of converting old clipboard text.

## FORMATTING

HTML block elements use new lines without indentation; inline tags stay with their text. A div containing one block child shares its opening and closing lines. A div with multiple block children uses separate boundary lines. Outer blocks use normal whitespace so source indentation does not create visible blank lines. Code keeps pre-wrap whitespace.
Bullet paragraphs become HTML ul/li lists, including nested indentation. Inline code remains inside each list item. Monospace lines starting with a dash remain code.
Preserves bold, italic, underline, strikethrough, web/mail links, and line breaks. Retains plain text and original RTF alongside HTML. Font colors, sizes, and exact layout are omitted. Any monospace text is treated as code. Uses the current clipboard, not Alfred history.
Enable formatted paste in Anki. If code styling disappears, inspect the field HTML with </>.

## DEVELOPMENT

Runtime uses built-in macOS osascript and AppKit; no downloads or network calls.
Run python3 test.py to check conversion and workflow wiring without changing the clipboard.
Run python3 build.py to rebuild the importable workflow.
