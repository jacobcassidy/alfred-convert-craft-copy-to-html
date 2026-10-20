# Python development setup

This document describes the planned setup for the project's Python build script and conversion checks. Use uv to manage the environment and Ruff to lint and format Python files. Run commands from the repository root.

## 1. Install uv

Install uv on macOS using Astral's standalone installer:

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Open a new terminal so the installer's PATH changes take effect, then verify the installation:

```sh
uv --version
```

Ensure `uv` is also available on the PATH used by Git hooks, including when committing from an editor. See the [uv installation instructions](https://docs.astral.sh/uv/getting-started/installation/).

## 2. Add pyproject.toml

Create `pyproject.toml` in the repository root with this content:

```toml
[project]
name = "convert-craft-copy-to-html"
version = "0.1.0"
description = "Python development tools for the Convert Craft Copy to HTML Alfred workflow"
requires-python = ">=3.11"
dependencies = []

[dependency-groups]
dev = ["ruff"]

[tool.uv]
package = false

[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E4", "E7", "E9", "F", "I"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "auto"
```

The proposed development baseline is Python 3.11 or later. `package = false` configures this as a collection of scripts and development dependencies. The existing Python scripts use standard-library modules, so `dependencies` is empty. Ruff belongs in the `dev` group, which uv installs by default. See [uv project configuration](https://docs.astral.sh/uv/concepts/projects/config/) and [development dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/#development-dependencies).

The Ruff settings retain the existing 88-character formatting style, double quotes, and space indentation. The selected lint rules check common syntax and import errors, unused names, and import ordering. See [Ruff configuration](https://docs.astral.sh/ruff/configuration/) and [Ruff rules](https://docs.astral.sh/ruff/rules/).

Commands will use npm script aliases that invoke `uv run`. npm provides the shortcuts, while uv manages Python and Ruff. Both `npm` and `uv` must be available on PATH.

## 3. Install Ruff and lock the environment

After creating `pyproject.toml`, resolve the dependencies and install them:

```sh
uv lock
uv sync --locked
uv run --locked ruff --version
```

uv creates a local `.venv/` and installs Ruff there. `uv.lock` records the resolved versions. Commit `pyproject.toml` and `uv.lock` so other contributors can reproduce the setup with `uv sync --locked`. See [uv locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/).

Add these entries to `.gitignore`:

```gitignore
/.venv/
/.ruff_cache/
```

## 4. Add npm script aliases

Merge these entries into the existing `scripts` object in `package.json`:

```json
{
  "scripts": {
    "python:setup": "uv sync --locked",
    "lint:python": "uv run --locked ruff check scripts tests",
    "lint:python:fix": "uv run --locked ruff check --fix scripts tests",
    "format:python": "uv run --locked ruff format scripts tests",
    "format:python:check": "uv run --locked ruff format --check scripts tests",
    "test:python": "uv run --locked python tests/test_conversion.py",
    "build:workflow": "uv run --locked python scripts/build.py"
  }
}
```

Keep the existing npm scripts, including `check`, `format`, and `test`. The Python aliases use the project's uv environment; Ruff remains a Python development dependency. See [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/).

| Task                               | Command                       |
| ---------------------------------- | ----------------------------- |
| Install the shared environment     | `npm run python:setup`        |
| Check Python lint rules            | `npm run lint:python`         |
| Apply available lint fixes         | `npm run lint:python:fix`     |
| Format Python files                | `npm run format:python`       |
| Check Python formatting            | `npm run format:python:check` |
| Run conversion and workflow checks | `npm run test:python`         |
| Build the Alfred workflow bundle   | `npm run build:workflow`      |

`uv run` prepares the project environment before running each command; manual virtual-environment activation is unnecessary. `--locked` reports an error if the manifest and lockfile disagree. See [running commands with uv](https://docs.astral.sh/uv/concepts/projects/run/).

The conversion checks require macOS because they invoke `/usr/bin/osascript` and AppKit. The build command creates `dist/convert-craft-copy-to-html.alfredworkflow` using the version in `workflow/info.plist`.

## 5. Add Ruff to lefthook.yml

Keep the existing commands and append the two Ruff entries. The complete proposed `pre-commit` configuration is:

```yaml
pre-commit:
  parallel: false
  commands:
    eslint:
      priority: 1
      glob: "**/*.js"
      run: npx eslint {staged_files} --fix
      stage_fixed: true
    markdownlint:
      priority: 2
      glob: "**/*.md"
      run: npx markdownlint-cli2 {staged_files} --fix
      stage_fixed: true
    prettier:
      priority: 3
      glob:
        - "**/*.{astro,elm,hbs,svelte,vue}"
        - "**/*.css"
        - "**/*.html"
        - "**/*.js"
        - "**/*.{json,jsonc}"
        - "**/*.md"
        - "**/*.{yaml,yml}"
      run: npx prettier {staged_files} --write
      stage_fixed: true
    ruff-lint:
      priority: 4
      glob: "**/*.py"
      run: uv run --locked ruff check --fix {staged_files}
      stage_fixed: true
    ruff-format:
      priority: 5
      glob: "**/*.py"
      run: uv run --locked ruff format {staged_files}
      stage_fixed: true
```

With `parallel: false`, the priorities put lint fixes before formatting. The Python globs restrict Ruff to staged Python files. `stage_fixed: true` stages the resulting edits automatically; lint errors that remain will block the commit. See Lefthook's [priority](https://lefthook.dev/configuration/priority/) and [stage_fixed](https://lefthook.dev/configuration/stage_fixed/) documentation.

The hooks call uv directly to pass exactly `{staged_files}`. The npm lint and format aliases above always target all files in `scripts` and `tests`, so use those for manual project checks.

For a fresh checkout, install the existing Node tools and Git hooks as well:

```sh
npm ci
npm run python:setup
npm run hook:install
```

## 6. Verify and share the setup

Apply lint fixes before formatting, then run the checks:

```sh
npm run lint:python:fix
npm run format:python
npm run lint:python
npm run format:python:check
npm run test:python
npm run check
npm run lint:docs
```

Review any Python edits and commit them with `pyproject.toml`, `uv.lock`, `.gitignore`, `package.json`, and `lefthook.yml`. Keep both `package-lock.json` and `uv.lock` under version control; each records its ecosystem's dependency versions. Update the README's development commands to match the table above when implementing the setup.
