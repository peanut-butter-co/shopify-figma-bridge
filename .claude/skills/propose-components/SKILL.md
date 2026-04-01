---
name: propose-components
description: >
  Use when: planning which sections/blocks become Figma components
user-invocable: true
context: inline
allowed-tools: [Read, Write, Glob, Grep]
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
6. **Load theme profile recommendations:** If `manifest.theme.hasProfile` is true, read `.claude/figma-sync/theme-profiles/{slug}.json` and extract `recommendations.components`, `recommendations.organization`, and `recommendations.templates`. Store as `profileRecs` for use in subsequent steps. If absent or null, `profileRecs = null` — all recommendation-aware steps simply skip their recommendation logic.

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

3. **Apply profile recommendations (if `profileRecs` exists):**
   - If the section slug appears in `profileRecs.components.prioritySections`, mark it as `[recommended]` and record the reason.
   - If the section slug appears in `profileRecs.components.skipSections`, pre-mark it as skipped with the provided reason. The user can still override during confirmation.
   - `prioritySections` supports two formats: flat strings (`"hero"`) or rich objects (`{ "slug": "hero", ... }`). Check if the first element is a string or object to detect which format.

Also read `sections/header-group.json` and `sections/footer-group.json` for structural section groups.

## Step 2: Scan All Blocks

Read every `.liquid` file in `blocks/`. Parse schemas and build a usage map: `{ blockType: [sectionType1, sectionType2, ...] }`.

## Step 3: Classify Blocks

- **Universal blocks** (2+ section types) → standalone components on Blocks page
- **Section-specific blocks** (1 section type only) → integrated into their parent section

## Step 4: Identify Atoms

See `.claude/skills/propose-components/reference/mandatory-atoms.md` for the mandatory atom checklist and identification procedure.

If `profileRecs.components.additionalAtoms` exists, append each to the proposal with its `reason` field. These are theme-specific atoms beyond the standard 15.

## Step 5: Present Selection Proposal

Show the user a structured proposal with clear recommended/skipped lists.

If `profileRecs` exists, enhance the presentation:
- **Recommended sections** appear first, marked with `[recommended]` and their `reason` from the profile
- **Detected sections** (found by scanning but not in profile) appear after, marked with `[detected]`
- **Skipped sections** show the profile's skip reason if available, or the generic reason otherwise
- If `profileRecs.components.blockGrouping` exists, show the suggested block grouping for the Figma Blocks page

**Wait for user confirmation before proceeding to Phase B.**

---

# Phase B: Propose Variants & Instance Properties

## Important: Desktop and Mobile

Desktop and Mobile are **separate components**, NOT variants of the same component:
- `Hero` = desktop component at `config.desktopWidth`
- `Hero / Mobile` = separate component at `config.mobileWidth`

Each independently has its own variant properties.

## Step 6: Analyze Section Settings — Classify into Three Buckets

For each section, read its `{% schema %}` settings and classify each `select` setting into one of three categories. See `.claude/skills/propose-components/reference/variant-analysis.md` for the full procedure.

**The three buckets:**
1. **Variants** (Tier 1-2) — Structural/compositional changes → Figma component variants
2. **Instance properties** (Tier 3) — Container/dimensional settings → Figma component properties (enum/boolean)
3. **Variable properties** — `color_scheme` and foundation-mapped settings → Figma variable modes

**Merging with profile recommendations:** If `profileRecs.components.prioritySections` contains a rich object for this section, merge both `variants` and `instanceProperties`:

1. **Start with profile recommendations** (both `variants` and `instanceProperties`) as the baseline.
2. **Run generic `select` setting analysis** on the actual `{% schema %}` as normal.
3. **For each detected setting:**
   - If it matches a profile `variants` entry → adopt the profile's tier and reason.
   - If it matches a profile `instanceProperties` entry → classify as instance property with the profile's reason.
   - If it's a new setting NOT in the profile → classify using generic tier rules and mark as `[detected]`.
4. **Stale entries:** If a profile recommends a setting ID that doesn't exist in the actual schema → warn and drop.
5. **Result:** A merged list with `[recommended]` entries first, then `[detected]`.

If `profileRecs` is null or the section has no profile entry, run the generic analysis only (current behavior).

## Step 7: Present Variant & Instance Property Proposal

For each section, show all three buckets clearly:

**Variants** (create separate component variants):
- Variant names and values, with source indicator: `[recommended]` or `[detected]`
- The `reason` field from profile recommendations where available
- Total combination count per viewport

**Instance properties** (Figma component properties, adjustable per-instance):
- Property name, type (enum/boolean), values, and default
- `reason` explaining why this is a property and not a variant

**Variable properties** (Figma variable modes):
- `color_scheme` and any other foundation-mapped settings

Include the Template Coverage Plan — scan `templates/` and present standard Shopify templates grouped by priority. If `profileRecs.templates.coverage` exists, use those priorities (P1/P2/P3) instead of generic grouping.

**Wait for user confirmation.**

---

## Step 8: Write to Manifest

Once both phases are confirmed, update the manifest with the full `components` object including atoms, blocks, sections (with both `variants` and `instanceProperties` per section), skippedSections, and scope.

Note: Desktop/Mobile is NOT in the variants object — it's handled by creating separate components during `/build-components`.

---

## Step 9: Summary

```
Component inventory confirmed.

Atoms:    {N} components
Blocks:   {N} standalone components
Sections: {N} sections x 2 viewports (desktop + mobile)
          {N} total variant combinations
          {N} instance properties across all sections

Skipped:  {N} sections (not included)

Next step: Run /build-components to create these in Figma.
```

---

## Notes

### Theme-wide, not template-specific
This skill analyzes the entire theme. Which components appear on which page is determined later by `/compose-page`.

### What "integrated" means
Section-specific blocks don't get their own component — they're built inline as part of their parent section's Figma frame hierarchy.

### Theme profile recommendations
If `.claude/figma-sync/theme-profiles/{theme}.json` exists and contains a `recommendations` key, it provides curated guidance that is loaded in Pre-flight step 6 and consumed throughout Phase A and Phase B. Recommendations are suggestions — the generic analysis always runs, and the user always confirms. See `theme-profiles/README.md` for the full schema.
