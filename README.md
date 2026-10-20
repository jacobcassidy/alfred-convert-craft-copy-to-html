# Convert Craft Copy to HTML

An Alfred workflow that converts rich text copied from Craft into HTML for pasting into Anki.

## Build

Run `npm run build:workflow` after the development setup below to create `dist/convert-craft-copy-to-html.alfredworkflow`. The build reads the workflow version from `workflow/info.plist` and packages the files in `workflow/` at the archive root for Alfred.

## Development

Install Node.js/npm and [uv](https://docs.astral.sh/uv/getting-started/installation/), then run these commands from the repository root:

```sh
npm ci
npm run py:setup
npm run hook:install
```

uv manages Python 3.11 or later and installs Ruff in `.venv/` using the committed `uv.lock`. Keep both `npm` and `uv` available on PATH, including for Git hooks run from an editor. Manual virtual-environment activation is unnecessary.

| Task                               | Command                   |
| ---------------------------------- | ------------------------- |
| Install the shared environment     | `npm run py:setup`        |
| Check Python lint rules            | `npm run lint:py`         |
| Apply available lint fixes         | `npm run lint:py:fix`     |
| Format Python files                | `npm run format:py`       |
| Check Python formatting            | `npm run format:py:check` |
| Run conversion and workflow checks | `npm run test:py`         |
| Build the Alfred workflow bundle   | `npm run build:workflow`  |

The conversion checks require macOS (`/usr/bin/osascript` and AppKit) and run without changing the clipboard. The RTF fixtures are in `tests/fixtures/`.

The pre-commit hook runs Ruff lint fixes followed by formatting on staged Python files and stages the fixes. Existing JavaScript, Markdown, and Prettier hooks remain enabled. Use `npm run check` and `npm run lint:docs` for project formatting and documentation checks.

See [Python development setup](docs/python-setup.md) for installation, dependency updates, configuration, and verification commands.

## Project layout

- `workflow/` contains the Alfred workflow source files.
- `scripts/` contains the bundle build script.
- `tests/` contains conversion checks and RTF fixtures.
- `docs/` contains feature notes.
- `CHANGELOG.md` records project changes.
