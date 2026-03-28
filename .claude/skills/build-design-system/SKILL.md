---
name: build-design-system
description: >
  Use when: running the full pipeline end-to-end
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, mcp__figma__get_metadata, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__fill, mcp__chrome-devtools__click, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/build-design-system/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Build Design System

You are running the complete Shopify-to-Figma design system pipeline. This skill orchestrates the individual skills in sequence, checking progress and resuming from where the pipeline left off.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Template:** `$ARGUMENTS` (defaults to `index` if not specified — used in the compose-page phase)

---

## How This Works

This skill does NOT call other skills. Instead, it runs each phase by **reading and following the corresponding skill file's instructions directly**. The skill files are the single source of truth — this orchestrator just manages the sequence, resume logic, and checkpoints between phases.

---

## Step 1: Determine Current Progress

Read `.claude/figma-sync/manifest.json` (if it exists) and determine which phase to start from:

| Condition | Resume from |
|---|---|
| Manifest doesn't exist | Phase 1: Setup |
| Manifest exists but `foundations` is null | Phase 2: Analyze Theme |
| `foundations` exists but `buildStatus.foundations` !== `"complete"` | Phase 3: Build Foundations |
| `buildStatus.foundations` === `"complete"` but `components` is null | Phase 4: Propose Components |
| `components.status` === `"confirmed"` but `buildStatus.atoms` !== `"complete"` | Phase 5: Build Components (atoms) |
| `buildStatus.atoms` === `"complete"` but `buildStatus.blocks` !== `"complete"` | Phase 5: Build Components (blocks) |
| `buildStatus.blocks` === `"complete"` but `buildStatus["sections-desktop"]` !== `"complete"` | Phase 5: Build Components (sections-desktop) |
| `buildStatus["sections-desktop"]` === `"complete"` but `buildStatus["sections-mobile"]` !== `"complete"` | Phase 5: Build Components (sections-mobile) |
| `buildStatus["sections-mobile"]` === `"complete"` but `buildStatus["composition-{template}"]` !== `"complete"` | Phase 6: Compose Page |
| `buildStatus["composition-{template}"]` === `"complete"` | All done! |

Tell the user where you're resuming from.

---

## Phase 1: Setup

**Read and follow:** `.claude/skills/setup/SKILL.md`

Execute all steps. When setup is complete (manifest written), proceed to checkpoint.

### Checkpoint

```
Phase 1: Setup complete
  Store: {storeUrl}
  Figma: {figmaFileName}
  Theme: {themeName} v{version}

Next: Phase 2 — Analyze Theme
Continue? (yes / stop)
```

Wait for user confirmation. If "stop", end here — re-run later to resume.

---

## Phase 2: Analyze Theme

**Read and follow:** `.claude/skills/analyze-theme/SKILL.md`

Execute all steps. When foundations are saved to manifest, proceed to checkpoint.

### Checkpoint

```
Phase 2: Analyze Theme complete
  Colors:     {N} schemes, {N} unique colors
  Typography: {N} font roles, {N} presets
  Spacing:    {N} radii, {N}-step scale

Next: Phase 3 — Build Foundations
Continue? (yes / stop)
```

---

## Phase 3: Build Foundations

**Read and follow:** `.claude/skills/build-foundations/SKILL.md`

Execute all steps. When complete (buildStatus.foundations = "complete"), proceed.

### Checkpoint

Take a screenshot of the Foundations page in Figma and show to user.

```
Phase 3: Build Foundations complete
  Variable collections: Theme Colors, Grey Scale, Color Schemas, Typography, Spacing & Layout
  Text styles: {N} styles
  Style guide: created on Foundations page

Next: Phase 4 — Propose Components
Continue? (yes / stop)
```

---

## Phase 4: Propose Components

**Read and follow:** `.claude/skills/propose-components/SKILL.md`

Execute all steps (both Phase A and Phase B). When component inventory is confirmed, proceed.

### Checkpoint

```
Phase 4: Propose Components complete
  Atoms:    {N} components
  Blocks:   {N} standalone components
  Sections: {N} sections x 2 viewports

Next: Phase 5 — Build Components (longest phase)
Continue? (yes / stop)
```

---

## Phase 5: Build Components

**Read and follow:** `.claude/skills/build-components/SKILL.md`

Run with `$ARGUMENTS = all`. If interrupted mid-build, determine which sub-phase to resume from based on `buildStatus`.

### Checkpoint (after all sub-phases)

Take screenshots of the Atoms, Blocks, and Sections pages.

```
Phase 5: Build Components complete
  Atoms:          {N} built
  Blocks:         {N} built
  Sections (DT):  {N} built
  Sections (MB):  {N} built

Next: Phase 6 — Compose Page ("{template}")
Continue? (yes / stop)
```

---

## Phase 6: Compose Page

**Read and follow:** `.claude/skills/compose-page/SKILL.md`

Use the template from `$ARGUMENTS` (default: `index`).

### Final Summary

Take screenshots of both desktop and mobile compositions.

```
Phase 6: Compose Page complete

==================================
  Design system build complete!
==================================

Template: {template}
Desktop:  {PageName} / Desktop ({desktopWidth}px)
Mobile:   {PageName} / Mobile ({mobileWidth}px)

Pipeline status:
  Setup
  Analyze Theme
  Build Foundations
  Propose Components
  Build Components
  Compose Page ({template})

What's next:
  - /compose-page {other-template} — build another page
  - /sync-colors — sync color changes
  - /build-design-system {other-template} — full pipeline for another template
```

---

## Error Handling

If any phase fails:

1. **Figma not accessible:** Stop and ask the user to check Figma
2. **Store not accessible:** Stop and ask the user to start dev server or check URL
3. **`figma` global undefined:** Stop and ask to open/close any Figma plugin once
4. **Phase-specific error:** Follow the error handling in the individual skill file

**Never skip a phase or work around an error.**

---

## Notes

- Each individual skill file is the authoritative reference for how that phase works.
- The `/sync-colors` skill is NOT part of this pipeline — it's a separate maintenance tool.
- If the user passes a template argument and the pipeline is already complete for that template, ask if they want to recompose.
