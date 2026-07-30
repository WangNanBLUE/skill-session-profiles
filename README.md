<p align="center">
  <img src="assets/logo.png" width="96" alt="Skill Session Profiles logo">
</p>

# Skill Session Profiles

[简体中文](README.zh-CN.md)

A macOS app and Codex plugin for managing global and project-specific skill
defaults, reusable profiles, and the persistent configuration used by
subsequently opened Codex tasks.

## Download

Download the latest Apple Silicon build from
[GitHub Releases](https://github.com/blueroy00/skill-session-profiles/releases/latest).
The app is currently unsigned and not notarized.

## Screenshots

### Task configuration

[![Task configuration](docs/images/task-configuration-en.png)](docs/images/task-configuration-en.png)

### Profile editor in Task Configuration

[![Reusable profile editor](docs/images/profile-editor-en.png)](docs/images/profile-editor-en.png)

### Dark theme

[![Dark theme](docs/images/dark-theme-en.png)](docs/images/dark-theme-en.png)

## Features

- Browse installed Codex skills and filter them by name or source.
- Enable or disable all skills in the current filtered result.
- Select, create, edit, copy, delete, import, and export reusable profiles
  directly from Task Configuration.
- Save profiles as reusable templates, then explicitly apply one on top of
  global defaults for subsequently opened tasks.
- Save project-specific overrides to the selected project's `.codex/config.toml`.
- Select local projects in the same order as the Codex project sidebar.
- Edit global skill defaults through the Codex App Server contract.
- Switch between Chinese and English, light and dark themes.
- Share profile data between the standalone app and Codex plugin.

## How It Works

The standalone Electron app and MCP panel use the same backend and data store.
Configuration writes go through Codex App Server APIs; the project does not
edit `~/.codex/config.toml` directly.

Saving a profile only updates the reusable template. Selecting and applying it
from Task Configuration writes its explicit overrides to the user-level
configuration; editing the template later does not silently reapply it.

Project configurations contain explicit overrides only. The app updates those
tables through the Codex App Server filesystem API while preserving unrelated
TOML and comments. Skills without a project override continue to inherit the
global default. A session-start hook converts the saved project layer into an
authoritative task policy, so project settings remain effective on Codex
versions that parse project-scoped `skills.config` but do not apply it during
skill discovery.

User data is stored locally at:

```text
~/.codex/skill-session-profiles
```

The app currently targets macOS on Apple Silicon. Builds are unsigned and not
notarized.

## Requirements

- macOS on Apple Silicon
- Node.js 22.22.2
- Codex CLI installed and available in `PATH`

## Development

```bash
npm ci
npm run desktop
```

Useful commands:

```bash
npm run build
npm test
npm run test:e2e
npm run test:codex-integration
npm run test:electron
npm run dist:mac
```

`test:codex-integration` launches a real Codex app-server process.
`test:electron` launches the real desktop app. Both commands require a working
local Codex installation. The GitHub CI workflow runs only the portable build,
unit, and browser E2E checks.

## Build Artifacts

```bash
npm run dist:mac
```

The `.app` bundle and DMG are written to `output/`. Release artifacts are not
committed to the repository.

## Plugin Development

The plugin entry point is `.codex-plugin/plugin.json`. The bundled MCP server,
hook, panel, and skill live in `.mcp.json`, `hooks/`, `src/`, and `skills/`.

After changing plugin code, build the project before installing the plugin so
that `dist/server/index.js` and the bundled panel are current.

## Security

Please report vulnerabilities through GitHub's private security advisory
feature. See [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## License

Licensed under the [MIT License](LICENSE).
