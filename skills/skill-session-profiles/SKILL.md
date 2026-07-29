---
name: skill-session-profiles
description: Open and use the Skill Session Profiles panel to manage global Codex skill defaults, reusable skill profiles, or the persistent configuration used by subsequently opened tasks. Use when the user asks which skills should be enabled for tasks, wants to save or apply a skill configuration, or wants to change global skill defaults.
---

# Skill Session Profiles

Call `open_skill_session_profiles` with the active task's absolute working directory as `cwd`.
Let the panel perform profile, configuration, import, export, and recovery operations.

After the user applies a profile:

1. Confirm that the panel applied the selected configuration.
2. Explain that subsequently opened, resumed, or forked Codex tasks will use it.
3. Explain that applying another configuration or changing global defaults replaces it.

Do not create, fork, navigate, or restart a task on the user's behalf. Do not claim that an
already loaded task can hot-switch skills. Explain that existing tasks pick up the configuration
only when they are reopened or derived and start a new session.

If the panel reports a pending conflict, keep normal profile writes blocked and use the panel's
recovery action. Never edit Codex configuration files as a fallback.
