# Changelog for Convert Craft Copy to HTML - Alfred Workflow

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [UNRELEASED]

### Added

- Added a complete inventory of the existing workflow in `docs/previous-features.md` and a from-scratch implementation plan in `docs/refactor-plan.md` for copying HTML source as the clipboard's only plain-text representation.
- Added a uv-managed Python development environment with committed `pyproject.toml` and `uv.lock`, Ruff lint and format configuration, npm commands for Python setup, checks, and workflow builds, and staged Python fixes through Lefthook.
- Added `docs/python-setup.md` with the planned uv and Ruff installation, configuration, npm script aliases for checking the project root, development commands, and Lefthook integration.

### Changed

- Changed the planned shortcut to Control-Command-C (Ctrl+Cmd+C) to avoid Craft's Option-Command-C Copy Format shortcut.
- Restricted the planned shortcut to the active native Craft app, with bundle-identifier validation and runtime focus checks before copying and writing output.
- Updated the refactor plan to use one shortcut that copies and converts the Craft selection, with no Alfred keywords.
- Changed bold and italic HTML output to use `<strong>` and `<em>` instead of `<b>` and `<i>`.
- Documented uv's default installation path, PATH verification, and how to avoid temporary installation directories.
- Renamed the Python npm script aliases to use `py` and updated the documented commands.
- Updated the README and Python setup guide to document the implemented development environment and commands.
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
