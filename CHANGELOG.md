# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Re-license the project from MIT to GPL-3.0-only.

## [0.3.3] - 2026-08-01

### Fixed

- Discover Windows Codex CLI installations from npm and the Codex desktop
  cache when the Electron process receives an incomplete `PATH`.
- Accept Windows drive-letter and UNC working directories in backend requests.
- Preserve npm `.cmd` shim paths containing spaces when starting app-server.

## [0.3.2] - 2026-07-31

### Fixed

- Skip unsupported directory `fsync` calls on Windows after atomic profile writes.
- Keep the Windows release gate focused on platform-specific command launching;
  the portable and macOS jobs continue to run the complete test suite.

## [0.3.1] - 2026-07-31

### Added

- Add Windows x64 directory and NSIS installer packaging commands.
- Build and publish Windows installers from tagged GitHub releases.
- Discover and launch Windows Codex CLI executables and npm command shims.

## [0.3.0] - 2026-07-31

### Added

- Discover local Codex projects for project-specific Skill policies.
- Include plugin-provided Skills in the configurable inventory while filtering
  Codex built-in and curated Skills.
- Show the last successfully applied task profile with a persistent "In use"
  marker.

### Changed

- Write project-specific Skill policy to a managed `AGENTS.md` or
  `AGENTS.override.md` block while preserving existing project guidance.
- Keep task profile application persistent without relying on a lifecycle hook.
- Hide plugin and MCP controls until their project-scoped behavior is reliable.
- Improve project switching so the current workbench remains visible while the
  next project loads.

### Removed

- Remove the Codex plugin, MCP panel, packaged Skill, lifecycle hook, and legacy
  one-time pending configuration transaction.

## [0.2.1] - 2026-07-30

### Added

- Public repository documentation and GitHub contribution workflows.

### Changed

- Replace the application icon with the white-surface Skill Graph and Switch design.

### Fixed

- Keep the real Codex app-server integration test out of portable GitHub CI.
- Save project configuration through the Codex App Server filesystem API
  instead of the user-only `config/batchWrite` endpoint.
- Enforce saved project skill configuration through the session-start hook when
  Codex skill discovery ignores the parsed project layer.
- Accept and preserve Codex skill configuration selected by skill name as well
  as by absolute path.

## [0.1.0] - 2026-07-29

### Added

- macOS desktop app and Codex plugin panel.
- Global skill default management.
- Reusable skill profiles with per-skill overrides.
- Persistent configuration for subsequently opened Codex tasks.
- Name and source filtering with bulk enable and disable actions.
- Chinese and English interface modes.
- Light and dark themes.
- Local profile import and export.
