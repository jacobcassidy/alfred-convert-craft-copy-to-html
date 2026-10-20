Convert Craft Copy to HTML

INSTALL AND USE
Import convert-craft-copy-to-html.alfredworkflow into Alfred (Powerpack required).
Select formatted content in the native Craft app and press Control-Command-C (Ctrl+Cmd+C, ⌃⌘C). Release the shortcut keys and keep Craft active until conversion finishes. Paste with Command-V wherever you need literal HTML source.
If Alfred clears the shortcut or reports a conflict, assign a preferred combination in the Hotkey object. Keep Related Apps set to “only active when the following apps have focus” with Craft selected.

STATUS AND PERMISSIONS
“Conversion started.” appears as soon as Craft is validated, before waiting for the keys to be released. A separate “HTML copy is ready to paste.” notification appears after the clipboard write, or a separate notification reports the specific failure. Notifications do not take focus. Started and ready or failure have distinct identifiers so the result can show a new banner. Repeated shortcuts during an active action do not start another conversion.
Allow Craft HTML Notifications in macOS System Settings > Notifications and its initial permission prompt. Notification banners and Focus settings control visibility. A bundled background app supplies a registered notification source and uses distinct NSUserNotification identifiers for started and the result. It receives only status text and an identifier, never Craft contents or clipboard data. It cannot copy again when its notification is opened.
Copy automation may require Alfred in System Settings > Privacy & Security > Accessibility, and permission to control System Events under Automation. An automation denial or copy timeout is reported instead of converting stale clipboard contents.

OUTPUT
The clipboard contains one item explicitly publishing only public.utf8-plain-text. Its value is the generated HTML source, including literal tags. For example: <div><strong>Hello</strong> world</div>
The result is intended for pasting as source. Applications no longer receive a rich-HTML representation, original unformatted text, or retained RTF.

FORMATTING
Preserves bold, italic, underline, strike, safe http/https/mailto links, line breaks, Unicode, and nested bullet lists. Monospace text uses bare <code> tags with no attributes. Dash prefixes inside monospace text remain code. HTML-sensitive text and link attributes are escaped.
Nested block elements use new lines and two spaces of source indentation per level. Each `<br>` is followed by the next content or break on its own indented source line. Inline tags stay with their text. Code whitespace is retained in the source; rendering whitespace is controlled by the receiving application.
Craft toggle lines keep their `+` marker and remove whitespace copied before it. A toggle with heading-sized text becomes a heading and drops the `+` marker.
Heading-sized text is mapped to `<h1>` through `<h4>` from its copied font size (24, 20, 17, and 15 pt thresholds). Numbered lists, task states, images, attachments, tables, colors, and exact Craft layout are outside the conversion scope.

FAILURES
Every invocation makes a fresh Craft copy and requires RTF. Keep the original Craft process active until completion. Held modifiers time out after three seconds; copying times out after 2.5 seconds.
Missing, invalid, or empty RTF and conversion failures leave the fresh copy unchanged. A changed clipboard revision preserves the newer copy. Copying itself replaces the contents from before the shortcut. The final clear/write sequence is not atomic: a write failure after clearing can leave the clipboard empty and is reported explicitly.

DEVELOPMENT
Uses built-in macOS JXA and AppKit with no third-party runtime dependencies or network calls.
From the repository root, run npm run test:py for fixture, isolated-pasteboard, simulated-copy, notification-ordering, wiring, and package checks. Automated tests never change the general clipboard, send keys, or display notifications.
Run npm run build:workflow to build dist/convert-craft-copy-to-html.alfredworkflow. Building from source requires Apple’s Xcode Command Line Tools. The builder uses xcrun clang and codesign to compile and locally sign the native background notification app for Apple silicon and Intel; no signing account or third-party runtime is required. The prebuilt bundle needs no developer tools. The native host has no script-app startup dialog while Control is held.
