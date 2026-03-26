---
description: Run the full design system pipeline end-to-end (setup → analyze → build foundations → propose components → build components → compose page)
argument-hint: [template-name, e.g. "index" for homepage]
---

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

Tell the user where you're resuming from:
- If starting fresh: "Starting the full design system pipeline from scratch."
- If resuming: "Foundations are already built. Resuming from **Phase 4: Propose Components**."

---

## Phase 1: Setup

**Read and follow:** `.claude/commands/setup.md`

Execute all steps in that skill file. When setup is complete (manifest written), proceed to the checkpoint.

### Checkpoint

```
✓ Phase 1: Setup complete
  Store: {storeUrl}
  Figma: {figmaFileName}
  Theme: {themeName} v{version}

Next: Phase 2 — Analyze Theme (extract design tokens from theme config)
Continue? (yes / stop)
```

Wait for user confirmation. If they say "stop", end here — they can re-run `/build-design-system` later to resume.

---

## Phase 2: Analyze Theme

**Read and follow:** `.claude/commands/analyze-theme.md`

Execute all steps. When the user has confirmed the proposed foundations and they're saved to the manifest, proceed to the checkpoint.

### Checkpoint

```
✓ Phase 2: Analyze Theme complete
  Colors:     {N} schemes, {N} unique colors
  Typography: {N} font roles, {N} presets
  Spacing:    {N} radii, {N}-step scale

Next: Phase 3 — Build Foundations (create variables, styles, and style guide in Figma)
Continue? (yes / stop)
```

---

## Phase 3: Build Foundations

**Read and follow:** `.claude/commands/build-foundations.md`

Execute all steps. This is the first phase that modifies the Figma file. When complete (buildStatus.foundations = "complete"), proceed to the checkpoint.

### Checkpoint

Take a screenshot of the Foundations page in Figma and show it to the user.

```
✓ Phase 3: Build Foundations complete
  Variable collections: Theme Colors, Grey Scale, Color Schemas, Typography, Spacing & Layout
  Text styles: {N} styles
  Style guide: created on Foundations page

Next: Phase 4 — Propose Components (analyze sections/blocks and propose component inventory)
Continue? (yes / stop)
```

---

## Phase 4: Propose Components

**Read and follow:** `.claude/commands/propose-components.md`

Execute all steps (both Phase A: Selection and Phase B: Variants). When the user has confirmed the component inventory and it's saved to the manifest, proceed to the checkpoint.

### Checkpoint

```
✓ Phase 4: Propose Components complete
  Atoms:    {N} components
  Blocks:   {N} standalone components
  Sections: {N} sections × 2 viewports

Next: Phase 5 — Build Components (construct all components in Figma)
This is the longest phase — it builds atoms, blocks, desktop sections, and mobile sections sequentially.
Continue? (yes / stop)
```

---

## Phase 5: Build Components

**Read and follow:** `.claude/commands/build-components.md`

Run with `$ARGUMENTS = all`. This will execute atoms → blocks → sections-desktop → sections-mobile in sequence.

**Important:** This phase has internal sub-phases. The build-components skill already handles the `buildStatus` updates for each sub-phase (atoms, blocks, sections-desktop, sections-mobile). If the pipeline was interrupted mid-build, determine which sub-phase to resume from based on `buildStatus` and pass the appropriate argument (e.g., `blocks` if atoms are already done).

### Checkpoint (after all sub-phases)

Take screenshots of the Atoms, Blocks, and Sections pages.

```
✓ Phase 5: Build Components complete
  Atoms:          {N} built
  Blocks:         {N} built
  Sections (DT):  {N} built
  Sections (MB):  {N} built

Next: Phase 6 — Compose Page (assemble "{template}" page from section instances)
Continue? (yes / stop)
```

---

## Phase 6: Compose Page

**Read and follow:** `.claude/commands/compose-page.md`

Use the template from `$ARGUMENTS` (default: `index`).

### Final Summary

Take screenshots of both desktop and mobile compositions.

```
✓ Phase 6: Compose Page complete

══════════════════════════════════
  Design system build complete!
══════════════════════════════════

Template: {template}
Desktop:  {PageName} / Desktop ({desktopWidth}px)
Mobile:   {PageName} / Mobile ({mobileWidth}px)

Pipeline status:
  ✓ Setup
  ✓ Analyze Theme
  ✓ Build Foundations
  ✓ Propose Components
  ✓ Build Components
  ✓ Compose Page ({template})

What's next:
  - /compose-page {other-template} — build another page
  - /sync-colors — sync color changes between Figma and Shopify
  - /build-design-system {other-template} — full pipeline for another template
```

---

## Error Handling

If any phase fails:

1. **Figma not accessible:** Stop and ask the user to check that Figma is open and the file is loaded
2. **Store not accessible:** Stop and ask the user to start the dev server or check the URL
3. **`figma` global undefined:** Stop and ask the user to open and close any Figma plugin once
4. **Phase-specific error:** Follow the error handling / rollback instructions in the individual skill file

**Never skip a phase or work around an error.** Each phase depends on the previous one completing successfully.

---

## Notes

- Each individual skill file (`.claude/commands/*.md`) is the authoritative reference for how that phase works. This orchestrator only manages the sequence and checkpoints.
- The `/sync-colors` skill is NOT part of this pipeline — it's a separate, ongoing maintenance tool.
- If the user passes a template argument and the pipeline is already past the compose-page phase for that template, ask if they want to recompose or if everything is done.
