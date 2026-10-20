# Features

## Copy HTML source from Craft

Select formatted text in the native Craft app and press Control-Command-C. One nonconcurrent Alfred action checks Craft's bundle identity, shows “Conversion started.”, waits for modifier release, sends Command-C, and requires a fresh RTF copy. The same Craft process must remain frontmost before Copy, after Copy, and before writing output. The hotkey is restricted to Craft in Alfred's Related Apps configuration.

The result is one HTML string, explicitly published as the only representation of one clipboard item: `public.utf8-plain-text`. Paste displays literal HTML tags in a text editor. Successful writing replaces the progress notification with “HTML copy is ready to paste.”; failures replace it with the reason. A stable notification identifier provides replacement without stealing focus.

## Formatting

| Craft content                   | HTML source                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| Ordinary text                   | Escaped text inside an outer `<div>`                                   |
| Bold, italic, underline, strike | `<strong>`, `<em>`, `<u>`, `<s>`, with deterministic combination order |
| Monospace fonts                 | Bare `<code>` tags, including when combined with other styles          |
| HTTP, HTTPS, and mail links     | Escaped `<a href="…">`; other destinations retain visible text only    |
| CRLF, CR, and LF line endings   | Normalized line breaks rendered as `<br>` with style offsets retained  |
| Bullet markers and indentation  | Nested `<ul>`/`<li>`; monospace marker-prefixed lines remain code      |
| Emoji and combining sequences   | Preserved graphemes, using the first character's style at a boundary   |

Supported bullet prefixes are `-`, `•`, `◦`, `▪`, and `‣`, followed by spaces, tabs, or nonbreaking spaces. Tabs count as four spaces for list indentation. Block boundaries use newlines without indentation; inline markup stays with its text. Code whitespace remains in the HTML source; visual whitespace behavior is controlled by the receiving application's rendering rules.

## Failure handling and limits

Each run copies afresh. Held modifiers, copy permission errors, copy timeouts, changed focus, missing/invalid/empty RTF, conversion failures, and clipboard revision changes produce specific errors. Input and preparation failures do not clear the fresh clipboard. A newer clipboard revision is preserved. A write failure after the final clear can leave the clipboard empty; the action reports failure and never publishes fallback types or a ready notification.

Headings, numbered lists, task states, images, attachments, tables, font colors, font sizes, syntax highlighting, and exact Craft layout are outside this release. Inputs come only from the fresh Craft RTF copy. The workflow uses built-in macOS JXA and AppKit and requires Alfred Powerpack.

See the [installation and permission instructions](../README.md), [validation evidence](validation.md), and [historical feature inventory](reference/v0.1.0/previous-features.md). The previous implementation remains under [reference/v0.1.0/](reference/v0.1.0/).
