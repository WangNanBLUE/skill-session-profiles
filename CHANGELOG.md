# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
