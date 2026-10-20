# Features

## Copy HTML source from Craft

Select formatted text in the native Craft app and press Control-Command-C. One nonconcurrent Alfred action checks Craft's bundle identity, shows “Conversion started.”, waits for modifier release, sends Command-C, and requires a fresh RTF copy. The same Craft process must remain frontmost before Copy, after Copy, and before writing output. The hotkey is restricted to Craft in Alfred's Related Apps configuration.

The result is one HTML string, explicitly published as the only representation of one clipboard item: `public.utf8-plain-text`. Paste displays literal HTML tags in a text editor. Successful writing posts a separate “HTML copy is ready to paste.” notification; failures post a separate notification with the reason. A bundled background app supplies a registered macOS notification source and uses the workflow icon for its banners. Started and the result use distinct identifiers so both can appear as banners without taking focus. Allow the app named Craft HTML Notifications when prompted.

## Formatting

| Craft content                   | HTML source                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Ordinary text                   | Escaped text inside an outer `<div>`                                                           |
| Bold, italic, underline, strike | `<strong>`, `<em>`, `<u>`, `<s>`, with deterministic combination order                         |
| Heading-sized text              | `<h1>` through `<h4>`, selected by copied font size                                            |
| Monospace fonts                 | Bare `<code>` tags, including when combined with other styles                                  |
| HTTP, HTTPS, and mail links     | Escaped `<a href="…">`; other destinations retain visible text only                            |
| CRLF, CR, and LF line endings   | Normalized `<br>` elements on separate indented source lines                                   |
| Bullet markers and indentation  | Nested `<ul>`/`<li>`; monospace marker-prefixed lines remain code                              |
| Craft toggle markers            | Keep `+` and its text without leading indentation; heading-sized toggle text becomes a heading |
| Emoji and combining sequences   | Preserved graphemes, using the first character's style at a boundary                           |

Supported bullet prefixes are `-`, `•`, `◦`, `▪`, and `‣`, followed by spaces, tabs, or nonbreaking spaces. Tabs count as four spaces for list indentation. Nested block elements use new lines and two spaces of source indentation per level; empty generated blocks are omitted, and inline markup stays with its text. Code whitespace remains in the HTML source; visual whitespace behavior is controlled by the receiving application's rendering rules.

## Failure handling and limits

Each run copies afresh. Held modifiers, copy permission errors, copy timeouts, changed focus, missing/invalid/empty RTF, conversion failures, and clipboard revision changes produce specific errors. Input and preparation failures do not clear the fresh clipboard. A newer clipboard revision is preserved. A write failure after the final clear can leave the clipboard empty; the action reports failure and never publishes fallback types or a ready notification.

Numbered lists, task states, images, attachments, tables, font colors, syntax highlighting, and exact Craft layout are outside this release. Heading levels are inferred from copied font sizes (24 pt and up for h1, 20 for h2, 17 for h3, and 15 for h4); this is a best-effort mapping because Craft does not expose semantic heading levels in the RTF input. Inputs come only from the fresh Craft RTF copy. The workflow uses built-in macOS JXA and AppKit and requires Alfred Powerpack.

See the [installation and permission instructions](../README.md), [validation evidence](validation.md), and [historical feature inventory](reference/v0.1.0/previous-features.md). The previous implementation remains under [reference/v0.1.0/](reference/v0.1.0/).
