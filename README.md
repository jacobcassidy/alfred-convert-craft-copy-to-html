# Convert Craft Copy to HTML

An Alfred workflow that copies the selected rich text from the native Craft app and converts it into literal HTML source on the clipboard.

## Install and use

1. Import [the workflow bundle](dist/convert-craft-copy-to-html.alfredworkflow) into Alfred. Alfred Powerpack is required.
2. Select formatted text in Craft and press **Control-Command-C** (Ctrl+Cmd+C, ⌃⌘C).
3. Release the keys and keep Craft active. A “Conversion started.” notification appears, followed by a separate “HTML copy is ready to paste.” notification after the write succeeds, or a separate failure notification.
4. Press Command-V wherever you need HTML source.

For example, bold “Hello” followed by ordinary “world” becomes the clipboard string:

```html
<div><strong>Hello</strong> world</div>
```

The clipboard contains one item explicitly publishing only `public.utf8-plain-text`. The string includes the HTML tags. The workflow does not publish rich HTML, original unformatted text, or RTF, and does not paste automatically.

The shortcut is active only while Craft has focus. If Alfred clears the binding on import or reports a conflict, reassign it in the Hotkey object and keep **Related Apps → only active when the following apps have focus → Craft**. Runtime checks require the same Craft process before sending Copy. Once a fresh Craft copy arrives, conversion can finish if you switch apps; a clipboard change before the result is written cancels the write. The Craft browser app is outside the workflow's scope.

## Permissions and failures

Allow Alfred under macOS **System Settings → Privacy & Security → Accessibility**, and allow control of **System Events** under **Automation** if prompted. Allow **Craft HTML Notifications** in **System Settings → Notifications** and its initial permission prompt. Enable banners and account for Focus settings to see status updates. Notifications do not take keyboard focus. Started and ready or failure are separate notifications, so completion can show a new banner.

The action shows progress before waiting for the shortcut modifiers to be released. A bundled background notification app uses AppKit with separate notification identifiers for progress and the result. The helper provides the registered app identity that macOS requires for visible banners. The action is nonconcurrent, so repeated shortcuts during a run do not start competing conversions.

Every run makes a fresh Craft copy and requires RTF. Missing, unreadable, or empty rich text and conversion failures preserve the contents present after copying. Switching apps after Command-C is sent does not stop conversion; a clipboard change before writing preserves the newer contents. Focus changes before Copy stop the run. Modifier release times out after three seconds; a fresh copy must arrive within 2.5 seconds. Copying itself replaces the previous clipboard. The final clear/write operation is not atomic; a failed write can leave the clipboard empty and is reported as a failure.

See [current features and limits](docs/FEATURES.md), [validation evidence](docs/validation.md), and the [previous feature inventory](docs/reference/v0.1.0/previous-features.md).

## Build and development

For building from source, install Apple’s Xcode Command Line Tools (`xcode-select --install`), Node.js/npm, and [uv](https://docs.astral.sh/uv/getting-started/installation/), then run from the repository root:

```sh
npm ci
npm run py:setup
npm run hook:install
```

uv manages Python 3.11 or later and installs Ruff in `.venv/` using `uv.lock`. Keep `npm` and `uv` on PATH, including for Git hooks. Manual environment activation is unnecessary. Runtime uses built-in macOS JXA and AppKit with no third-party dependencies or network calls.

| Task                       | Command                  |
| -------------------------- | ------------------------ |
| Set up Python              | `npm run py:setup`       |
| Lint JavaScript            | `npm run lint:scripts`   |
| Lint Python                | `npm run lint:py`        |
| Fix Python lint            | `npm run lint:py:fix`    |
| Format Python              | `npm run format:py`      |
| Check Python formatting    | `npm run check:py`       |
| Run native workflow checks | `npm run test:py`        |
| Check project formatting   | `npm run check`          |
| Lint documentation         | `npm run lint:docs`      |
| Build the Alfred bundle    | `npm run build:workflow` |

Tests require macOS and access to its pasteboard service. They use named pasteboards, RTF fixtures, simulated copy operations, and recording notifications; they never modify the general clipboard, send real keystrokes, or display notifications. They also check Alfred wiring and build an isolated package for inspection.

The build reads `workflow/info.plist`, compiles `workflow/notify.m` into a native background app for Apple silicon and Intel using `xcrun clang`, and applies a local ad-hoc signature with `codesign`. The native host has no script-app startup dialog, including while Control is held. Installing the prebuilt bundle does not require developer tools. It packages the converter, notification host source and app, metadata, readme, and icon in `dist/convert-craft-copy-to-html.alfredworkflow`. The pre-commit hook applies JavaScript, Markdown, Prettier, and Ruff checks to staged files. See [Python development setup](docs/python-setup.md).

## Project layout

- `workflow/` contains the current Alfred sources.
- `scripts/` contains the bundle builder.
- `tests/` contains the Python runner, JXA harness, and RTF fixtures.
- `docs/reference/v0.1.0/` preserves the previous implementation for reference.
- `docs/refactor-plan.md` records the replacement specification.
- `CHANGELOG.md` records project changes.
