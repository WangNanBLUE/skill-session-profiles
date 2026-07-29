# Product

## Register

product

## Users

Developers who use Codex frequently on macOS and need to manage a growing set
of skills without entering a task first. They expect keyboard-first operation,
fast state inspection, and predictable configuration changes.

## Product Purpose

Skill Session Profiles is a standalone macOS utility for managing global Codex
skill defaults, maintaining reusable skill profiles, and choosing persistent
skill overrides for subsequently opened Codex tasks. Success means users can
understand the active configuration, make a deliberate change, and verify what
will happen next without editing Codex configuration files manually.

## Brand Personality

Fast, restrained, and precise. The interaction standard is Raycast: compact,
direct, keyboard-oriented, and confident without decorative complexity.

## Anti-references

- Marketing-page composition with oversized headlines or promotional copy.
- Card-heavy dashboards and nested containers.
- Decorative animation or visual effects that slow task completion.
- Browser-admin styling that hides primary actions in dense chrome.
- Interfaces that obscure pending, conflicting, read-only, or failed states.

## Design Principles

1. Keyboard paths are first-class, not a secondary accessibility layer.
2. Every configuration change shows its scope and resulting state immediately.
3. Common actions stay visible and require the fewest deliberate steps.
4. Destructive or externally conflicting changes are explicit and recoverable.
5. The interface uses Codex terminology consistently and never edits around
   the supported Codex App Server contract.

## Accessibility & Inclusion

Target WCAG AA contrast and interaction semantics. Support complete keyboard
operation, visible focus, light and dark appearance, reduced motion, scalable
text, and status communication that does not rely on color alone.

## Platform

The first release targets macOS only. Electron is the desktop runtime so the
application can reuse the existing React interface and Node-based Codex App
Server client.
