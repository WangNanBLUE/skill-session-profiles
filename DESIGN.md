---
name: Skill Session Profiles
description: A compact command deck for controlling Codex skill configuration.
colors:
  command-blue: "#1f5f9d"
  focus-blue: "#2563a6"
  canvas: "#f7f7f8"
  surface: "#ffffff"
  ink: "#18181b"
  ink-secondary: "#52525b"
  ink-muted: "#71717a"
  border: "#d4d4d8"
  divider: "#e4e4e7"
  surface-subtle: "#f1f1f3"
  danger: "#9b2828"
  danger-surface: "#fff5f5"
  pending-surface: "#f1f6fd"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "5px"
  md: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.command-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 14px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "42px"
    padding: "0 12px"
  container:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px"
---

# Design System: Skill Session Profiles

## Overview

**Creative North Star: "Command Deck"**

The interface behaves like a focused macOS command surface: immediate,
keyboard-oriented, and dense enough for repeated configuration work. It borrows
Raycast's confidence and economy without copying its visual treatment.

The system rejects marketing-page composition, nested cards, decorative motion,
browser-admin chrome, and any styling that hides pending, conflicting,
read-only, or failed states.

**Key Characteristics:**

- Compact controls with predictable placement.
- One blue accent reserved for action, selection, and focus.
- Flat surfaces separated by tone, spacing, and precise 1px borders.
- Visible state and complete keyboard paths.
- Native macOS typography and familiar control behavior.

## Colors

The palette is a cool zinc neutral field with a single restrained blue command
accent and explicit semantic error surfaces.

### Primary

- **Command Blue:** Primary actions and committed selections only.
- **Focus Blue:** Keyboard focus rings and selected outlines.

### Neutral

- **Zinc Canvas:** Main application background.
- **Clear Surface:** Toolbars, editors, lists, and control fills.
- **Graphite Ink:** Primary labels and headings.
- **Secondary Graphite:** Supporting status text.
- **Muted Zinc:** Metadata and tertiary labels.
- **Precision Border:** Control outlines and structural boundaries.
- **Quiet Divider:** Row separation and low-emphasis boundaries.
- **Subtle Surface:** Table headers and selected step backgrounds.

### Named Rules

**The One Command Color Rule.** Blue is used only for primary action, current
selection, or focus. It never decorates inactive content.

**The State Must Speak Rule.** Errors, conflicts, pending state, and read-only
state require text or icons in addition to color.

## Typography

**Display Font:** macOS system sans with Segoe UI fallback
**Body Font:** macOS system sans with Segoe UI fallback
**Label/Mono Font:** SFMono-Regular with monospace fallback

**Character:** One native system family keeps the tool fast and familiar.
Hierarchy comes from weight and compact fixed sizes, never display typography.

### Hierarchy

- **Display** (600, 22px, 1.3): Application title only.
- **Headline** (600, 18px, 1.3): Primary view headings.
- **Title** (600, 13px, 1.35): Row titles and selected object names.
- **Body** (400, 13px, 1.45): Explanations, notices, and action labels.
- **Label** (500, 12px, 1.35): Metadata, tabs, table headers, and compact controls.

### Named Rules

**The Fixed Scale Rule.** Product typography never scales with viewport width.
Dense desktop tools need stable visual rhythm.

## Elevation

The system is flat by default. Depth comes from surface tone, borders, and
inset selection outlines. Floating shadows are prohibited for normal content;
native window elevation belongs to macOS and Electron.

### Shadow Vocabulary

- **Selected inset** (`inset 0 0 0 1px #2563a6`): Reinforces a selected
  profile without changing its dimensions.

### Named Rules

**The Flat Until Floating Rule.** Only menus, popovers, dialogs, and native
window surfaces may use external elevation.

## Components

### Buttons

- **Shape:** Compact corners (5px) and one-line labels.
- **Primary:** Command Blue fill, white text, and 9px by 14px padding.
- **Hover / Focus:** Tonal darkening on hover, 2px Focus Blue outline on
  keyboard focus, and 1px downward press feedback.
- **Secondary:** Clear Surface with a Precision Border and Graphite Ink.
- **Danger:** Clear Surface with danger text and a muted red border.

### Cards / Containers

- **Corner Style:** Slightly curved (6px).
- **Background:** Clear Surface.
- **Shadow Strategy:** No external shadow.
- **Border:** Precision Border where grouping is necessary.
- **Internal Padding:** 14px for editors; rows use 9px by 14px.

### Inputs / Fields

- **Style:** Clear Surface, 1px Precision Border, 5px corners.
- **Focus:** 2px Focus Blue outline with 2px offset.
- **Error / Disabled:** Error text and border accompany color; disabled
  controls remain legible and non-interactive.

### Navigation

The desktop app uses the approved command-bar and two-pane workbench: task
mode and saved profiles stay in the left pane, while the selected Skill
configuration owns the right pane. The plugin panel collapses the same
structure rather than maintaining a second interaction model. Stable 12–13px
labels, explicit selection, and visible keyboard focus apply in both surfaces.

### Skill State Control

Each skill exposes inherit, enabled, and disabled as mutually exclusive states.
Bulk actions declare the visible result count and affect only the current
filter result.

## Do's and Don'ts

### Do:

- **Do** keep primary workflows visible and keyboard reachable.
- **Do** use Command Blue only for action, selection, and focus.
- **Do** show pending, conflicting, read-only, failed, loading, and empty states.
- **Do** use 5–6px corners and stable 12–13px product labels.
- **Do** preserve native macOS expectations for focus, menus, and window behavior.

### Don't:

- **Don't** use marketing-page composition with oversized headlines or
  promotional copy.
- **Don't** build card-heavy dashboards or nested containers.
- **Don't** add decorative animation or visual effects that slow task completion.
- **Don't** imitate browser-admin styling or hide primary actions in dense chrome.
- **Don't** obscure pending, conflicting, read-only, or failed states.
- **Don't** use gradients, glassmorphism, oversized radii, or multiple accent colors.
