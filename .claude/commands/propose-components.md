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

# Phase A: Select Components

## Step 1: Scan All Sections

Read every `.liquid` file in `sections/` (excluding JSON group files). For each section:

1. **Parse the `{% schema %}` JSON block** at the bottom. Extract:
   - `name`: human-readable section name
   - `settings`: section-level settings (look for `color_scheme`, layout/alignment options, padding)
   - `blocks`: block type definitions the section accepts
   - `presets`: default configurations

2. **Classify the section's purpose:**
   - **Page-specific sections** (`main-*`): Only used on specific page types (main-collection, main-product, etc.)
   - **Reusable sections**: Can appear on any page (hero, product-list, collection-list, etc.)
   - **Structural sections**: Header, footer, announcements — always present

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

Regardless of what the theme scan finds, these atoms MUST be proposed. They are foundational to every design system:

| Atom | Variants | Required |
|------|----------|----------|
| Button | Primary, Secondary | Always |
| Input Field | Default | Always |
| Checkbox | Checked, Unchecked | Always |
| Text Link | Default, Accent | Always |
| Tab | Active, Inactive | Always |
| Arrow Button | Left, Right | Always |
| Badge | (per theme — typically Sale, Sold Out) | Always |
| Variant Swatch | Default, Selected | If theme has variants |
| Blog Card | Default | If theme has blog |
| Collection Card | Below Image, On Image | If theme has collections |
| Product Card | Per image ratio | Always |
| Quantity Selector | Default | If theme has cart |
| Spacer | Small, Medium, Large | Always |
| Divider | Horizontal, Vertical | Always |
| Icon | Default | Always |

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
- `main-404` — utility page
- `custom-liquid` — developer tool
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

For each selected section, read its `{% schema %}` settings and identify settings that:

1. **Change the visual layout significantly** when switched (e.g., alignment moves content blocks around)
2. **Have a small number of options** (2-5 values — not infinite ranges)
3. **Are useful for a designer** to preview different configurations

### What SHOULD become variants:
- **Content alignment/position** (left/center/right, top/center/bottom) — creates a visible layout change
- **Layout direction** (media-left/media-right) — flips the composition
- **Column count** (3 vs 4 columns) — changes grid structure
- **Display mode** (grid/carousel/editorial) — different visual treatment

### What should NOT become variants:
- `color_scheme` — handled via Figma variable modes, not component variants
- Padding/spacing ranges — too many values, minor visual impact
- Font overrides — handled by text styles
- Show/hide toggles for minor elements
- Content settings (text, images, URLs)

## Step 7: Present Variant Proposal

For each section, show the proposed variant properties:

```markdown
## Proposed Variants per Section

### Hero
- **Position:** Top, Center, Bottom (from `content_position` setting)
- **Alignment:** Left, Center, Right (from `content_alignment` setting)
→ Creates a 3×3 matrix = 9 variants per viewport (desktop + mobile)

### Media with Content
- **Media position:** Left, Right (from `media_position` setting)
→ 2 variants per viewport

### Product List
- **Layout:** Grid, Carousel (from `layout_type` setting)
→ 2 variants per viewport

### Header
- No variants recommended (layout is fixed)

### Footer
- No variants recommended (layout is fixed)

...

**Total components to build: {N} desktop + {N} mobile = {N} total**
(including variant matrices)

Want to adjust? Add or remove variant properties for any section.
```

**Wait for user confirmation.**

### Template Coverage Plan

Present the complete template coverage that `/compose-page` will build:

```
Templates to build (desktop + mobile pairs):
- Homepage (index.json)
- Product Page (product.json)
- Collection Page (collection.json)
- Cart Page (cart.json)
- Search Results (search.json)
- Blog Listing (blog.json)
- Blog Article (article.json)
- 404 Page (404.json)
- Generic Page (page.json)
- Contact Page (page.contact.json)
- All Collections (list-collections.json)
- Password Page (password.json)
- Gift Card (gift_card.liquid)
- Policy Page (custom — legal/policy content)

Total: 14 desktop + 14 mobile = 28 template frames
```

Each template will be composed entirely from component instances. Desktop and mobile will be paired side by side in the Templates section.

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
        "blocks": ["text", "button"],
        "integratedBlocks": ["_slide", "_carousel-content"]
      }
    ],
    "skippedSections": ["main-404", "custom-liquid", "password", "password-footer"],
    "templateCoverage": ["index", "product", "collection", "cart", "search", "blog", "article", "404", "page", "page.contact", "list-collections", "password", "gift_card", "policy"],
    "mandatoryAtoms": ["Button", "Input Field", "Checkbox", "Text Link", "Tab", "Arrow Button", "Badge", "Variant Swatch", "Product Card", "Quantity", "Spacer", "Divider", "Icon"]
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
