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
3. **Check for theme profile:** Look for `.claude/figma-sync/theme-profiles/{theme_slug}.json` (e.g., `horizon.json`, `dawn.json`). If found, read it — it contains pre-loaded knowledge about how this theme structures typography, colors, spacing, etc. Use it to:
   - Know where to find font roles and how many to expect (e.g., Horizon has 4 font roles in settings; other themes may hardcode fonts)
   - Know the color scheme structure (e.g., Horizon has 6+ schemes with 35+ semantic roles; others may have fewer or none)
   - Know which values are settings-driven vs CSS-hardcoded (e.g., Horizon spacing is CSS-hardcoded, radii are in settings)
   - Know about theme-specific quirks (e.g., Horizon uses semantic line-height presets like "display-tight" that need conversion to percentages)
   - Set `theme.hasProfile = true` in the manifest. If no profile exists, set `theme.hasProfile = false` and fall back to generic heuristics for all extraction.

---

## Step 1: Read Theme Configuration

Read these files from the theme codebase:

1. **`config/settings_schema.json`** — Full schema defining all available settings, their types, defaults, and organization
2. **`config/settings_data.json`** → `current` — Actual values in use
3. **`locales/en.default.schema.json`** — Translation keys to resolve `t:names.*`, `t:settings.*`, `t:options.*` labels to human-readable names

---

## Step 1.5: Validate Theme Profile (if found)

**Skip this step if no profile was found in pre-flight step 3.**

A theme profile contains pre-loaded knowledge about a base theme (e.g., Horizon). But the actual theme may be a customized fork — a developer may have added typography presets, changed color scheme structure, or modified settings. **The profile is a starting hint, not ground truth.** Always validate it against the real files before relying on it.

### Validation checks

After reading the theme configuration files, compare the profile's claims against reality:

**Typography:**
1. Count the font role settings in `settings_schema.json` (settings with `type: "font_picker"` or that match the profile's `typography.fontRoles.roles[*].settingKey`)
2. Compare count against `profile.typography.fontRoles.count`
3. Count the heading presets — look for all `type_{level}_size` settings. Compare against what the profile expects.
4. Check for unexpected typography settings not in the profile (e.g., mobile-specific presets like `type_h1_size_mobile`)

**Color schemes:**
1. Count semantic color roles in the `color_scheme_group` definition array
2. Compare against the number of roles in `profile.colorSchemes.semanticGroups`
3. Count the number of actual schemes in `settings_data.json`

**Spacing:**
1. Check if spacing values exist in `settings_schema.json` (the profile may say "CSS-hardcoded" but the fork may have added settings)
2. Verify radii and border-width settings match the profile

**Sections (light check):**
1. List all `.liquid` files in `sections/` — do unexpected ones exist that the profile doesn't account for?

### How to handle divergences

For each check, classify the result:

- **Match** — profile claim matches reality. Use the profile's guidance confidently.
- **Minor divergence** — e.g., 7 schemes instead of 6, or one extra border-radius setting. Note it but proceed with the profile as a baseline, supplementing with detected values.
- **Major divergence** — e.g., 8 font roles instead of 4, mobile-specific typography presets, or a completely different color scheme structure. **The profile is unreliable for this area.**

Report divergences to the user:

```
Theme profile validation: Horizon

Typography:    DIVERGED — found 14 presets (profile expects 7).
               Detected mobile-specific presets: type_h1_size_mobile,
               type_h2_size_mobile, etc. Using detected values.
Color schemes: OK — 8 schemes, 35 roles per scheme (matches profile)
Spacing:       OK — hardcoded scale, settings-driven radii (matches)
Sections:      MINOR — 2 custom sections not in standard Horizon

Using profile guidance for: color schemes, spacing
Using detected values for: typography
```

**Rules:**
- Where the profile matches → use its `figmaMapping` guidance to inform how you build foundations
- Where it diverges → fall back to generic heuristics, using only the detected data
- **NEVER blindly trust the profile** — always validate first
- Store `theme.profileValidation` in the manifest with the results so downstream skills know which parts of the profile are reliable

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
