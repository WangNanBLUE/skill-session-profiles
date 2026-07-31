# Skill Session Profiles Desktop App

The standalone app stores profiles and audit data at:

```text
~/.codex/skill-session-profiles
```

## Requirements

- macOS on Apple Silicon or Windows x64
- Codex CLI installed and available through `PATH`, nvm, Volta, asdf, mise,
  Homebrew, or `CODEX_BINARY`

## Local Development

```bash
npm install
npm run desktop
```

Useful verification commands:

```bash
npm test
npm run test:e2e
npm run test:electron
```

## Build Artifacts

```bash
npm run pack:mac
npm run dist:mac
npm run pack:win
npm run dist:win
```

Artifacts are written under `output/`. The first release is intentionally
unsigned; macOS builds are not notarized. On another Mac, open it through Finder's
contextual **Open** action if Gatekeeper blocks the first launch.

## Desktop Security

- Renderer `nodeIntegration` is disabled.
- Context isolation and renderer sandboxing are enabled.
- The preload bridge exposes only allowlisted profile operations, directory
  selection, and JSON export.
- Navigation and new windows are blocked.
- The renderer uses a restrictive Content Security Policy.
