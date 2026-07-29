# Contributing

Thank you for contributing to Skill Session Profiles.

## Before You Start

- Search existing issues before opening a new one.
- Keep changes focused on one behavior or problem.
- Do not include personal Codex configuration, profile data, logs, or absolute
  home-directory paths in issues, fixtures, or commits.

## Local Setup

```bash
npm ci
npm run build
npm test
npm run test:e2e
```

Run `npm run test:electron` on macOS when changing Electron integration,
preload APIs, app-server discovery, or desktop layout. This check requires a
working local Codex installation.

## Pull Requests

- Explain the user-visible behavior and why the change is needed.
- Add or update tests for behavioral changes.
- Update both READMEs when public usage changes.
- Keep generated `dist/`, `output/`, screenshots, and local data out of commits.
- Confirm which checks were run and disclose anything skipped.

By contributing, you agree that your contribution is licensed under the MIT
License.
