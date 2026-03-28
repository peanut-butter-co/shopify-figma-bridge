---
name: propose-components
description: >
  Use when: planning which sections/blocks become Figma components
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/propose-components/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Propose Components

You are analyzing ALL sections and blocks in the Shopify theme to propose which ones should become Figma components. This is a **two-phase** process:

1. **Phase A — Select components:** Propose which sections/blocks to include, get user confirmation
2. **Phase B — Propose variants:** For each selected section, analyze its settings and propose which become Figma component variants

This is a theme-wide analysis — not tied to any specific template. The template-specific assembly happens later in `/compose-page`.

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify `config` exists. If not → "Run `/setup` first."
3. Verify `foundations` is not null. If null → "Run `/analyze-theme` first."
4. Verify `buildStatus.foundations === "complete"`. If not → "Run `/build-foundations` first."
5. If `components` is not null → warn: "Components were already proposed. Re-running will overwrite. Proceed?"

---

## Scope Selection

Before scanning, ask the user what scope they want for the design system:

> **What scope do you want for the design system?**
>
> 1. **Core pages only** — The essential transactional pages of an e-commerce store: home, product detail, collection/category, and cart. Plus structural sections (header, footer) and reusable content sections that appear across these pages.
>
> 2. **Core + secondary pages** — Everything above, plus supporting pages like blog, articles, generic content pages, error pages, etc.
>
> _(Default: 1 — you can always expand later)_

**Wait for the user's answer before proceeding.**

Store the chosen scope in the manifest under `components.scope` (`"core"` or `"core+secondary"`).

---

# Phase A: Select Components

## Step 1: Scan All Sections

Read every `.liquid` file in `sections/` (excluding JSON group files). For each section:

1. **Parse the `{% schema %}` JSON block** at the bottom. Extract name, settings, blocks, presets.
2. **Classify the section's purpose** (for reference — classification does NOT determine inclusion):
   - **Page-specific sections** (`main-*`): The primary content section for a specific page type
   - **Reusable sections**: Can appear on any page via the theme editor
   - **Structural sections**: Header, footer, announcements — always present

   **Include** if the section: represents a core shopping experience, contains reusable layout patterns, is part of primary navigation, or will be assembled into page compositions.

   **Skip** if the section: is an internal rendering helper, represents a rarely-touched low-design-value page, is a dynamic overlay or ephemeral UI state, or duplicates another section's purpose.

Also read `sections/header-group.json` and `sections/footer-group.json` for structural section groups.

## Step 2: Scan All Blocks

Read every `.liquid` file in `blocks/`. Parse schemas and build a usage map: `{ blockType: [sectionType1, sectionType2, ...] }`.

## Step 3: Classify Blocks

- **Universal blocks** (2+ section types) → standalone components on Blocks page
- **Section-specific blocks** (1 section type only) → integrated into their parent section

## Step 4: Identify Atoms

See `.claude/skills/propose-components/reference/mandatory-atoms.md` for the mandatory atom checklist and identification procedure.

## Step 5: Present Selection Proposal

Show the user a structured proposal with clear recommended/skipped lists. **Wait for user confirmation before proceeding to Phase B.**

---

# Phase B: Propose Variants

## Important: Desktop and Mobile

Desktop and Mobile are **separate components**, NOT variants of the same component:
- `Hero` = desktop component at `config.desktopWidth`
- `Hero / Mobile` = separate component at `config.mobileWidth`

Each independently has its own variant properties.

## Step 6: Analyze Section Settings for Variants

See `.claude/skills/propose-components/reference/variant-analysis.md` for the detailed procedure on identifying variant-worthy settings, priority tiers, and what should NOT become variants.

## Step 7: Present Variant Proposal

For each section, show the proposed variant properties including:
- Variant names and values
- Total combination count per viewport
- Variable properties (e.g., `color_scheme`) that are NOT variants but are applied via Figma variable modes

Include the Template Coverage Plan — scan `templates/` and present standard Shopify templates grouped by priority (P1-P3).

**Wait for user confirmation.**

---

## Step 8: Write to Manifest

Once both phases are confirmed, update the manifest with the full `components` object including atoms, blocks, sections, skippedSections, and scope.

Note: Desktop/Mobile is NOT in the variants object — it's handled by creating separate components during `/build-components`.

---

## Step 9: Summary

```
Component inventory confirmed.

Atoms:    {N} components
Blocks:   {N} standalone components
Sections: {N} sections x 2 viewports (desktop + mobile)
          {N} total variant combinations

Skipped:  {N} sections (not included)

Next step: Run /build-components to create these in Figma.
```

---

## Notes

### Theme-wide, not template-specific
This skill analyzes the entire theme. Which components appear on which page is determined later by `/compose-page`.

### What "integrated" means
Section-specific blocks don't get their own component — they're built inline as part of their parent section's Figma frame hierarchy.

### Theme profiles
If `.claude/figma-sync/theme-profiles/{theme}.json` exists, use its `recommendations.components` to pre-filter sections and suggest variants.
