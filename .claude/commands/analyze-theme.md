---
description: Analyze a Shopify theme and propose design system foundations (colors, typography, spacing)
---

# Analyze Theme

You are analyzing a Shopify theme's configuration files to extract design tokens and propose which ones should become part of the Figma design system. This skill extracts **global theme settings only** — it does NOT analyze templates, sections, or blocks (that happens in `/propose-components`).

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`. If it doesn't exist, tell the user: "Run `/setup` first to configure the pipeline."
2. Verify `config` section exists with `storeUrl` and `figmaFileKey`.
3. Check if `theme.hasProfile` is true. If so, read the theme profile from `.claude/figma-sync/theme-profiles/{theme_name_lowercase}.json` and use its `recommendations.foundations` to guide which settings to prioritize.

---

## Step 1: Read Theme Configuration

Read these files from the theme codebase:

1. **`config/settings_schema.json`** — Full schema defining all available settings, their types, defaults, and organization
2. **`config/settings_data.json`** → `current` — Actual values in use
3. **`locales/en.default.schema.json`** — Translation keys to resolve `t:names.*`, `t:settings.*`, `t:options.*` labels to human-readable names

---

## Step 2: Extract Design Tokens

Parse the settings and extract the following categories. For each category, build a structured data object.

### 2a. Color Schemes

**Source:** `settings_schema.json` → find the entry with `type: "color_scheme_group"` inside the colors group. Its `definition` array lists all semantic color properties.

**Extract:**
1. Parse the `definition` array. Entries with `type: "header"` are group dividers — use their `content` (resolved via locales) as the group name. Color entries before the first header belong to the "Essential" group.
2. From `settings_data.json` → `current.color_schemes`, extract all scheme objects. Each scheme key is its identifier (e.g., `scheme-1`, `scheme-{uuid}`).
3. For each scheme, extract all color values (hex, hex+alpha, or rgba format).
4. Build a list of all **unique colors** across all schemes:
   - Separate greys (R=G=B within tolerance 0.01) from non-greys
   - Group alpha variants of the same base color together
5. Build the semantic groups array with their variables.

**Output structure:**
```json
{
  "colorSchemes": {
    "<scheme-key>": {
      "name": "<human-friendly name or key>",
      "colors": {
        "<field-id>": "<hex-value>",
        ...
      }
    }
  },
  "semanticGroups": [
    {
      "name": "Essential",
      "variables": ["background", "foreground_heading", "foreground", "primary", "primary_hover", "border", "shadow"]
    },
    {
      "name": "Primary button",
      "variables": ["primary_button_background", "primary_button_text", ...]
    }
  ],
  "uniqueColors": {
    "themeColors": [
      { "name": "<semantic-group>/<shade>", "hex": "#rrggbb", "opacity": 1.0 }
    ],
    "greyScale": [
      { "name": "Grey/<shade>", "hex": "#rrggbb", "opacity": 1.0 }
    ]
  }
}
```

### 2b. Typography

**Source:** `settings_schema.json` → find the typography group. Look for `font_picker` entries and heading-level settings.

**Extract:**
1. **Font roles:** Find all `font_picker` entries. Common IDs: `type_body_font`, `type_heading_font`, `type_subheading_font`, `type_accent_font`. Read actual values from `settings_data.json` (format: `{family}_{style}`, e.g., `inter_n7` = Inter Bold/700).
2. **Heading presets:** For each heading level (h1-h6) + paragraph, extract:
   - `type_font_h{N}` → which font role (body, heading, subheading, accent)
   - `type_size_h{N}` → font size in px
   - `type_line_height_h{N}` → line height preset name
   - `type_letter_spacing_h{N}` → letter spacing preset (if present)
   - `type_case_h{N}` → text transform (none, uppercase, etc.)
3. **Resolve font names:** Decode Shopify's font format:
   - `inter_n4` → Inter Normal 400
   - `inter_n7` → Inter Bold 700
   - `abril_fatface_n4` → Abril Fatface Normal 400
   - Pattern: `{family}_{style}{weight}` where `n`=normal, `i`=italic, weight is single digit (4=400, 7=700, etc.)
4. **Resolve line heights:** Map preset names to percentage values. Common Shopify patterns:
   - `display-tight` → ~110%
   - `display-normal` → ~120%
   - `display-loose` → ~140%
   - `body-tight` → ~130%
   - `body-normal` → ~150%
   - `body-loose` → ~170%

   If the theme's `docs/horizon-design-system.md` exists, check it for exact line-height mappings. Otherwise, read the theme's CSS/Liquid to find the actual values (search for these preset names in `assets/` or `snippets/`).

**Output structure:**
```json
{
  "fontRoles": {
    "body": { "family": "Inter", "weight": 400, "style": "normal", "raw": "inter_n4" },
    "heading": { "family": "Inter", "weight": 700, "style": "normal", "raw": "inter_n7" },
    "subheading": { "family": "Inter", "weight": 500, "style": "normal", "raw": "inter_n5" },
    "accent": { "family": "Abril Fatface", "weight": 400, "style": "normal", "raw": "abril_fatface_n4" }
  },
  "presets": {
    "h1": { "fontRole": "accent", "size": 56, "lineHeight": 110, "letterSpacing": "normal", "case": "none" },
    "h2": { "fontRole": "heading", "size": 48, "lineHeight": 110, "letterSpacing": "normal", "case": "none" },
    "paragraph": { "fontRole": "body", "size": 14, "lineHeight": 170, "letterSpacing": "normal", "case": "none" }
  }
}
```

### 2c. Spacing, Layout & Radii

**Source:** `settings_data.json` → `current`, and `settings_schema.json` for context.

**Extract:**
1. **Page width:** Look for `page_width` setting — resolve the selected option to a pixel value (check the schema's `select` options or the theme docs)
2. **Border radii:** Scan for all settings containing `radius`, `border_radius`, or `corner_radius`:
   - Button radii (primary, secondary)
   - Input radius
   - Badge radius
   - Card radius
   - Popover radius
   - Product corner radius
   - Any other radius settings
3. **Border widths:** Scan for settings containing `border_width`:
   - Primary button border width
   - Secondary button border width
   - Input border width
   - Variant button border width
4. **Spacing scale:** If `docs/horizon-design-system.md` exists, read the spacing scale from it. Otherwise, common values can be inferred from section padding settings. Note: spacing scale is often not in theme settings but in CSS custom properties — check `assets/` for `--spacing-*` or similar patterns.

**Output structure:**
```json
{
  "layout": {
    "pageWidth": { "setting": "narrow", "value": 1440 }
  },
  "radii": {
    "button-primary": 14,
    "button-secondary": 14,
    "input": 4,
    "badge": 100,
    "card": 4,
    "product": 0,
    "popover": 14
  },
  "borderWidths": {
    "button-primary": 0,
    "button-secondary": 1,
    "input": 1
  },
  "spacing": [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120, 160]
}
```

### 2d. Additional Tokens (scan for relevance)

Scan the remaining settings groups and extract anything that affects visual styling:
- **Button typography:** font role and text case for primary/secondary buttons
- **Badge styling:** position, font, text transform
- **Variant picker styling:** swatch dimensions, button width mode

Only include tokens that are relevant for the design system. Skip functional settings (cart type, currency display, search behavior, etc.).

### 2e. Mobile Typography Variance

For each heading preset (h1-h6) and paragraph, check if there are separate mobile size settings:
- Look for `type_size_h{N}_mobile` or `mobile_type_size_h{N}` in settings_schema.json
- If mobile sizes exist, extract them alongside desktop sizes
- If not, note which presets share desktop/mobile sizes

This determines whether the Figma system needs separate Desktop/Mobile text styles (our standard: YES — always create both, even if sizes match, for future flexibility).

**Output addition to typography:**
```json
{
  "presets": {
    "h1": {
      "fontRole": "heading",
      "desktop": { "size": 72, "lineHeight": 120 },
      "mobile": { "size": 56, "lineHeight": 120 }
    }
  }
}
```

### 2f. Required Atom Inventory

Regardless of theme, these atoms MUST be identified or created:

| Atom | Source | Priority |
|------|--------|----------|
| Button (Primary/Secondary) | `snippets/button.liquid` or `blocks/button.liquid` | Required |
| Input Field | CSS `.input` class or `blocks/contact-form.liquid` | Required |
| Checkbox (Checked/Unchecked) | Form elements in blocks | Required |
| Text Link (Default/Accent) | Link styling in CSS | Required |
| Tab (Active/Inactive) | Tab/accordion patterns | Required |
| Arrow Button (Left/Right) | Carousel/slideshow navigation | Required |
| Badge (Sale/Sold Out) | `snippets/product-card.liquid` | Required |
| Variant Swatch (Default/Selected) | `snippets/swatch.liquid` | Required |
| Blog Card | `blocks/_featured-blog-posts-card.liquid` | Required |
| Collection Card | `blocks/collection-card.liquid` | Required |
| Product Card | `blocks/_product-card.liquid` | Required |
| Quantity Selector | Quantity input patterns | Required |
| Spacer | `blocks/spacer.liquid` | Required |
| Divider | `blocks/_divider.liquid` | Required |
| Icon | `blocks/icon.liquid` | Required |

Scan the theme for each. If a source file exists, note it. If not, mark as "create from patterns". These atoms will be built FIRST in `/build-components` before any composites or sections.

---

## Step 3: Propose Foundations

Present the extracted data to the user in a readable format. Organize by category:

```markdown
## Proposed Design System Foundations

### Colors
- **{N} color schemes** found: {list scheme names}
- **{N} unique theme colors** (non-grey)
- **{N} grey scale colors**
- **{N} semantic variables** per scheme, organized in {N} groups:
  {list group names with variable count each}

### Typography
- **Font families:**
  - Body: {family} ({weight})
  - Heading: {family} ({weight})
  - Subheading: {family} ({weight})
  - Accent: {family} ({weight})
- **{N} text presets:** {list h1-h6 + paragraph with size}

### Spacing & Layout
- **Page width:** {value}px ({setting name})
- **Border radii:** {list each with value}
- **Border widths:** {list each with value}
- **Spacing scale:** {list values if found, or "not found in settings — will use theme CSS"}

### Additional Tokens
- {list any additional tokens found}

### Required Atoms
- **{N} atoms identified** from theme code
- **{N} atoms to create** from common patterns
- Priority build order: Button → Input → Checkbox → Text Link → Tab → Arrow → Badge → Swatch → Cards → Quantity → Spacer → Divider → Icon

---

**Do you want to adjust anything?**
- Remove color schemes you don't use
- Add or remove token categories
- Change how tokens are named or grouped
```

**Wait for user confirmation before proceeding.**

---

## Step 4: Write to Manifest

Once the user confirms, update `.claude/figma-sync/manifest.json`:

1. Read the existing manifest
2. Set `foundations` to the complete extracted data:

```json
{
  "foundations": {
    "colors": {
      "schemes": { ... },
      "semanticGroups": [ ... ],
      "uniqueColors": {
        "themeColors": [ ... ],
        "greyScale": [ ... ]
      }
    },
    "typography": {
      "fontRoles": { ... },
      "presets": { ... }
    },
    "spacing": {
      "layout": { ... },
      "radii": { ... },
      "borderWidths": { ... },
      "scale": [ ... ]
    },
    "additionalTokens": { ... }
  }
}
```

3. Write the updated manifest back to disk

---

## Step 5: Summary

Show the user a summary of what was saved:

```
Foundations extracted and saved to manifest.

Colors:     {N} schemes, {N} theme colors, {N} greys, {N} semantic variables
Typography: {N} font roles, {N} presets (h1-h6 + paragraph)
Spacing:    {N} radii, {N} border widths, {N}-step spacing scale
Layout:     {pageWidth}px page width

Next step: Run /build-foundations to create these in Figma.
```

---

## Notes

### Theme-agnostic parsing

This skill must work with ANY Shopify theme, not just Horizon. The key universal patterns:

- **Color schemes:** All Shopify themes use `color_scheme_group` in `settings_schema.json`. The `definition` array structure with `type: "header"` dividers and `type: "color"` entries is standard.
- **Typography:** All themes use `font_picker` for font selection. Heading-level settings (`type_font_h{N}`, `type_size_h{N}`, etc.) are a common convention.
- **Settings format:** Shopify font format (`{family}_{style}{weight}`) is universal. Color formats (hex, hex+alpha, rgba) are universal.
- **Settings data:** `current` key in `settings_data.json` always holds the active values.

### What to do if a setting type is unexpected

If the theme uses settings patterns you don't recognize:
- Don't skip them silently — mention them to the user: "I found setting `{id}` of type `{type}` that I don't have a parser for. Should I include it?"
- The user can decide whether it's relevant.

### Handling missing settings

Not all themes have all setting types. For example:
- Some themes don't have `type_accent_font` — they may only have body and heading fonts
- Some themes don't have variant picker styling
- Spacing scales are often in CSS, not in settings

When a category has no settings, note it in the proposal: "No spacing scale found in theme settings. You may want to define one manually, or I can try to extract it from the theme's CSS files."

### If foundations already exist in manifest

If `manifest.foundations` is not null when this skill runs:
1. Warn the user: "Foundations have already been extracted. Re-running will overwrite the existing data."
2. If `buildStatus.foundations === "complete"`, warn additionally: "Foundations have already been built in Figma. Re-extracting won't update Figma — you'll need to run `/build-foundations` again."
3. Proceed only with user confirmation.
