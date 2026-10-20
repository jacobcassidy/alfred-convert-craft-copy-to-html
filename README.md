# Convert Craft Copy to HTML

An Alfred workflow that converts rich text copied from Craft into HTML for pasting into Anki.

## Build

Run `python3 scripts/build.py` to create `convert-craft-copy-to-html.alfredworkflow` in the project root. The build reads the workflow version from `workflow/info.plist` and packages the files in `workflow/` at the archive root for Alfred.

## Checks

Run `python3 tests/test_conversion.py` to check conversion output and workflow wiring without changing the clipboard. The RTF fixtures are in `tests/fixtures/`.

## Project layout

- `workflow/` contains the Alfred workflow source files.
- `scripts/` contains the bundle build script.
- `tests/` contains conversion checks and RTF fixtures.
- `docs/` contains feature notes.
- `CHANGELOG.md` records project changes.
