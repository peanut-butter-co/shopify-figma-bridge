---
description: Propose which sections and blocks from the theme become Figma components
---

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

Use this scope choice when evaluating sections in Step 1. Sections that serve only secondary page types should be excluded when the user picks "Core only", but included when they pick "Core + secondary". Reusable sections (hero, media-with-content, carousels, etc.) and structural sections (header, footer) are always included regardless of scope — they appear across all page types.

Store the chosen scope in the manifest under `components.scope` (`"core"` or `"core+secondary"`).

---

# Phase A: Select Components

## Step 1: Scan All Sections

Read every `.liquid` file in `sections/` (excluding JSON group files). For each section:

1. **Parse the `{% schema %}` JSON block** at the bottom. Extract:
   - `name`: human-readable section name
   - `settings`: section-level settings (look for `color_scheme`, layout/alignment options, padding)
   - `blocks`: block type definitions the section accepts
   - `presets`: default configurations

2. **Classify the section's purpose** (for reference — classification does NOT determine inclusion):
   - **Page-specific sections** (`main-*`): The primary content section for a specific page type (e.g., main-collection, main-cart). These are essential components — `/compose-page` will need them to assemble page templates.
   - **Reusable sections**: Can appear on any page via the theme editor (hero, product-list, etc.)
   - **Structural sections**: Header, footer, announcements — always present

   **Important:** All three types are valid candidates for Figma components. To decide whether a section belongs in the design system, evaluate it against these criteria:

   **Include** if the section:
   - Represents a core shopping experience (browsing, product detail, cart, blog)
   - Contains reusable layout patterns that designers will iterate on
   - Is part of the store's primary navigation flow (header, footer)
   - Will be assembled into page compositions via `/compose-page`

   **Skip** if the section:
   - Is an internal rendering helper or developer tool (no fixed visual layout)
   - Represents a rarely-touched, low-design-value page (e.g., password gates, error pages with minimal layout)
   - Is a dynamic overlay or ephemeral UI state (e.g., predictive search)
   - Duplicates another section's purpose without meaningful visual differences

   The goal is a focused, maintainable design system — not an exhaustive 1:1 mirror of every Liquid file in the theme.

Also read `sections/header-group.json` and `sections/footer-group.json` to understand the structural section groups.

## Step 2: Scan All Blocks

Read every `.liquid` file in `blocks/`. For each block:

1. **Parse the `{% schema %}` JSON block.** Extract name, settings, and which sections accept it.
2. **Build a usage map:** `{ blockType: [sectionType1, sectionType2, ...] }` by cross-referencing which sections list each block type in their schema.

## Step 3: Classify Blocks

### Universal blocks (→ standalone components on Blocks page)
A block is **universal** if it appears in **2 or more different section types**.

### Section-specific blocks (→ integrated into their parent section)
A block is **section-specific** if it only appears inside one section type. These do NOT become standalone components.

## Step 4: Identify Atoms

Scan section and block code for UI primitives that should become reusable Figma components:
- **Buttons** (primary/secondary variants)
- **Inputs** (text fields, search)
- **Badges** (sale, sold out)
- **Icons**, **Dividers**, **Checkboxes** — only if widely used

### Mandatory Atom Checklist

These atoms should be proposed if they exist in the theme. Search `snippets/`, `blocks/`, and `sections/` for each:

| Atom | Variants | When required |
|------|----------|---------------|
| Button | Primary, Secondary | Always |
| Input Field | Default | Always |
| Checkbox | Checked, Unchecked | Always |
| Text Link | Default, Accent | Always |
| Tab | Active, Inactive | If theme has tabs/accordions |
| Arrow Button | Left, Right | If theme has carousels |
| Badge | (per theme — e.g., Sale, Sold Out) | If theme has products |
| Variant Swatch | Default, Selected | If theme has product variants |
| Product Card | Per image ratio | If theme has products |
| Blog Card | Default | If theme has blog |
| Collection Card | Below Image, On Image | If theme has collections |
| Quantity Selector | Default | If theme has cart |
| Spacer | Small, Medium, Large | Always |
| Divider | Horizontal, Vertical | Always |
| Icon | Default | Always |

If the theme profile includes `recommendations.components.mandatoryAtoms`, cross-reference with that list for theme-specific additions.

If the theme scan doesn't find a source file for an atom, note it as "create from common patterns" — do NOT skip it.

## Step 5: Present Selection Proposal

Show the user a structured proposal with clear recommended/skipped lists:

```markdown
## Proposed Component Inventory

### Atoms ({N})
| Component | Notes |
|-----------|-------|
| Button | Primary/Secondary, used across {N} sections |
| ... | ... |

### Blocks ({N} standalone)
| Component | Used in |
|-----------|---------|
| Product Card | Product List, Recommendations |
| ... | ... |

### Sections — Recommended ({N})
| Component | Type | Key blocks |
|-----------|------|------------|
| Hero | hero | text, button |
| ... | ... | ... |

### Sections — Skipped
Sections that don't earn a place in the design system:
- `custom-liquid` — developer tool, no fixed layout
- `section-rendering-product-card` — internal rendering helper
- `password` — rarely touched, low design iteration value
- ...

Want to adjust? Remove or add from either list.
```

**Wait for user confirmation before proceeding to Phase B.**

---

# Phase B: Propose Variants

After the user confirms the component selection, analyze each selected section's settings to propose which ones become Figma component **variant properties**.

## Important: Desktop and Mobile

Desktop and Mobile are **separate components**, NOT variants of the same component:
- `Hero` = desktop component at `config.desktopWidth`
- `Hero / Mobile` = separate component at `config.mobileWidth`

Each independently has its own variant properties (Position, Alignment, etc.). The variant proposal below applies to both the desktop and mobile versions.

## Step 6: Analyze Section Settings for Variants

For each selected section, read its `{% schema %}` settings and identify settings that should become Figma component variant properties.

### How to identify variant-worthy settings

Don't rely on setting `id` names alone — they vary wildly between themes (e.g., `content_position` vs `vertical_alignment_flex_direction_column`). Instead, analyze each setting holistically:

1. **Check the setting's `type`**: Must be `select` with 2-5 discrete options (not `range`, `checkbox`, `text`, `image_picker`, etc.)
2. **Check what the options represent**: Look at the option `value` and `label` fields. Settings whose options describe spatial positions (top/center/bottom, left/right, flex-start/flex-end), layout modes (grid/carousel/editorial), or structural changes (column/row, wide/narrow) are strong candidates.
3. **Ask: "Would switching this option produce a visually distinct layout?"** If yes → variant. If it's a subtle tweak → skip.

### Priority tiers (highest → lowest):

**Tier 1 — Almost always variants** (these change the fundamental composition):
- **Content position/alignment**: Settings whose options map to spatial placement (top/center/bottom, left/center/right, flex-start/center/flex-end). Look for labels like `t:settings.alignment`, `t:settings.position`, `t:options.left`, `t:options.top`, etc.
- **Layout mode**: Settings that switch between fundamentally different visual treatments (grid/carousel/editorial/bento, column/row)
- **Media/content direction**: Settings that flip which side content appears on (left/right, media-left/media-right)

**Tier 2 — Often variants** (meaningful visual change, case by case):
- **Content width/proportion**: Settings that change how much space content occupies (wide/medium/narrow, full-width/centered)
- **Column count**: When limited to 2-3 options that change the grid visibly

**Tier 3 — Rarely variants** (skip unless the section has no Tier 1/2 options):
- **Section width** (page-width/full-width) — minor container change
- **Section height** (small/medium/large) — unless it's the primary visual differentiator

### What should NOT become variants:
- `color_scheme` — handled via Figma variable modes (see "Variable properties" below)
- `range` type settings (padding, spacing, gap, border-width) — infinite values
- Font/typography overrides — handled by text styles
- Show/hide toggles (`checkbox` type) — minor visual impact
- Content settings (text, images, URLs, video pickers)
- Settings gated by `visible_if` that depend on another setting's value — these are conditional sub-settings, not independent variants. However, the **parent setting they depend on** may itself be a variant (e.g., `content_direction: column|row` is a variant; the alignment settings that change based on it are not separate variants — they describe what alignment means within each direction)

### Variable properties (not variants — controlled via Figma variable modes)

Some settings are NOT component variants but are still important to document because they are applied to components through **Figma variable modes** at the instance level. Identify these for each section:

- **`color_scheme`**: Present in almost every section. In Figma, the component instance is placed inside a frame that applies the corresponding color scheme variable mode. The component itself doesn't need variants for this — the variable modes switch all bound colors automatically.
- Any other settings that map directly to Figma variables defined in `/build-foundations` (e.g., spacing tokens if the theme uses them as settings).

For each section, note which `color_scheme`-type settings exist (some sections have multiple, e.g., header has `color_scheme_top`, `color_scheme_bottom`, `color_scheme_transparent`). These will be listed in the proposal alongside variants so the user sees the full picture of how the component is configured.

## Step 7: Present Variant Proposal

For each section, show the proposed variant properties:

```markdown
## Proposed Variants per Section

### Hero
**Variants:**
- **Position:** Top, Center, Bottom
- **Alignment:** Left, Center, Right
→ 3 × 3 = 9 variants per viewport

**Variable properties:** `color_scheme`

### Media with Content
**Variants:**
- **Media position:** Left, Right
→ 2 variants per viewport

**Variable properties:** `color_scheme`

### Header
**Variants:** None (layout is fixed)
**Variable properties:** `color_scheme_top`, `color_scheme_bottom`, `color_scheme_transparent`

...

**Total components to build: {N} desktop + {N} mobile = {N} total**
(including variant matrices)

Want to adjust? Add or remove variant properties for any section.
```

**Wait for user confirmation.**

### Template Coverage Plan

Scan the `templates/` directory to discover all available page types. Present them grouped by priority:

- **P1 (core):** index, product, collection, cart — always included
- **P2 (secondary):** search, blog, article, page, 404 — included if user chose "Core + secondary" scope
- **P3 (tertiary):** any remaining templates found — propose but let user decide

If the theme profile includes `recommendations.templates.coverage`, use its priority assignments instead of the defaults above.

Each template will be composed as a desktop + mobile pair, side by side in the Templates section.

---

## Step 8: Write to Manifest

Once both phases are confirmed, update the manifest:

```json
{
  "components": {
    "status": "confirmed",
    "atoms": [
      {
        "name": "Button",
        "variants": {
          "Style": ["Primary", "Secondary"],
          "State": ["Default", "Hover"]
        },
        "usedInSections": ["hero", "product-list", "footer"]
      }
    ],
    "blocks": [
      {
        "name": "Product Card",
        "sourceBlocks": ["_product-card", "_product-card-gallery"],
        "usedInSections": ["product-list", "product-recommendations"],
        "variants": null
      }
    ],
    "sections": [
      {
        "name": "Hero",
        "type": "hero",
        "file": "sections/hero.liquid",
        "variants": {
          "Position": ["Top", "Center", "Bottom"],
          "Alignment": ["Left", "Center", "Right"]
        },
        "variableProperties": ["color_scheme"],
        "blocks": ["text", "button"],
        "integratedBlocks": ["_slide", "_carousel-content"]
      }
    ],
    "skippedSections": ["custom-liquid", "section-rendering-product-card"]
  }
}
```

Note: Desktop/Mobile is NOT in the variants object — it's handled by creating separate components during `/build-components` (e.g., "Hero" at 1440px and "Hero / Mobile" at 390px).

---

## Step 9: Summary

```
Component inventory confirmed.

Atoms:    {N} components
Blocks:   {N} standalone components
Sections: {N} sections × 2 viewports (desktop + mobile)
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
