# Changelog for Convert Craft Copy to HTML - Alfred Workflow

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UNRELEASED]

### Added

- Added `docs/python-setup.md` with the planned uv and Ruff installation, configuration, npm script aliases for checking the project root, development commands, and Lefthook integration.

### Changed

- Updated JavaScript declarations, JSDoc documentation, and spacing to follow `AGENTS.md` code rules.
- Configured ESLint for the macOS JavaScript for Automation workflow runtime.
- Organized Alfred sources under `workflow/`, conversion checks and RTF fixtures under `tests/`, and the build script under `scripts/`.
- Added a root `README.md` with build and development instructions.
- Moved the generated Alfred bundle into `dist/`.

## [v0.1.0] - 2026-10-20

### Added

- Alfred workflow package at `dist/convert-craft-copy-to-html.alfredworkflow`, built with `python3 scripts/build.py`.
- Option-Command-C hotkey for copying selected text from Craft, converting it, and notifying when it is ready to paste into Anki.
- `craftanki` keyword for converting rich text already on the clipboard.
- HTML conversion for bold, italic, underline, strikethrough, web and mail links, line breaks, inline monospace code, and nested bullet lists.
- Plain text and original RTF retained on the clipboard alongside generated HTML.
- macOS `osascript` and AppKit runtime, with no external dependencies or network calls.
- RTF fixtures and `python3 tests/test_conversion.py` checks for conversion output and Alfred workflow wiring.
