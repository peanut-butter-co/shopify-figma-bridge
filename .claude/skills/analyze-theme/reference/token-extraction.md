# Token Extraction Procedures

Detailed procedures for extracting each category of design tokens from Shopify theme settings.

---

## 2a. Color Schemes

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
        "<field-id>": "<hex-value>"
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
      "variables": ["primary_button_background", "primary_button_text"]
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

---

## 2b. Typography

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

---

## 2c. Spacing, Layout & Radii

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

---

## 2d. Additional Tokens (scan for relevance)

Scan the remaining settings groups and extract anything that affects visual styling:
- **Button typography:** font role and text case for primary/secondary buttons
- **Badge styling:** position, font, text transform
- **Variant picker styling:** swatch dimensions, button width mode

Only include tokens that are relevant for the design system. Skip functional settings (cart type, currency display, search behavior, etc.).

---

## 2e. Mobile Typography Variance

For each heading preset (h1-h6) and paragraph, check if there are separate mobile size settings:
- Look for `type_size_h{N}_mobile` or `mobile_type_size_h{N}` in settings_schema.json
- Also check theme CSS for `clamp()` or `@media` rules that scale typography — if sizing is purely CSS-driven with no separate mobile settings, that means no mobile presets

**Set `hasMobilePresets` flag:**
- If ANY preset has a distinct mobile size setting in `settings_schema.json` → `hasMobilePresets: true`
- If NO presets have mobile size settings (e.g., theme uses CSS `clamp()`) → `hasMobilePresets: false`

**When `hasMobilePresets` is true**, use nested preset structure:

```json
{
  "hasMobilePresets": true,
  "createMobileStyles": true,
  "presets": {
    "h1": {
      "fontRole": "heading",
      "desktop": { "size": 72, "lineHeight": 120 },
      "mobile": { "size": 56, "lineHeight": 120 }
    }
  }
}
```

**When `hasMobilePresets` is false**, use flat preset structure:

```json
{
  "hasMobilePresets": false,
  "createMobileStyles": false,
  "presets": {
    "h1": { "fontRole": "accent", "size": 56, "lineHeight": 110, "letterSpacing": "normal", "case": "none" }
  }
}
```

The `createMobileStyles` flag is set by the user during Step 3 (see analyze-theme SKILL.md). Even when `hasMobilePresets` is false, the user can choose to create mobile styles for manual customization — in that case, desktop values are duplicated.

Do NOT create a nested `desktop`/`mobile` structure with identical values. When `hasMobilePresets` is false, keep the flat format regardless of the user's `createMobileStyles` choice.

---

## 2f. Required Atom Inventory

Every Shopify design system needs a core set of UI atoms. Scan the theme for each of these — search `snippets/`, `blocks/`, and `sections/` for matching patterns:

| Atom | Where to look | When required |
|------|--------------|---------------|
| Button (Primary/Secondary) | Search for button snippets, button blocks, or `.btn` CSS classes | Always |
| Input Field | Search for form inputs, `.input` CSS class, contact form blocks | Always |
| Checkbox (Checked/Unchecked) | Search for form elements, checkbox patterns in blocks | Always |
| Text Link (Default/Accent) | Search for link styling in CSS, underlined text patterns | Always |
| Tab (Active/Inactive) | Search for tab or accordion patterns in sections/blocks | If theme has tabs/accordions |
| Arrow Button (Left/Right) | Search for carousel/slideshow navigation arrows | If theme has carousels |
| Badge (Sale/Sold Out) | Search for badge/label patterns in product cards | If theme has products |
| Variant Swatch (Default/Selected) | Search for swatch or color picker patterns | If theme has product variants |
| Product Card | Search for product card snippets or blocks | If theme has products |
| Blog Card | Search for blog post card patterns in blocks | If theme has blog |
| Collection Card | Search for collection card or list patterns | If theme has collections |
| Quantity Selector | Search for quantity input/stepper patterns | If theme has cart |
| Spacer | Search for spacer blocks or spacing utility sections | Always |
| Divider | Search for divider/separator blocks or snippets | Always |
| Icon | Search for SVG icons in `assets/`, icon blocks or snippets | Always |

For each atom found, note its source file. For atoms not found in theme code, mark as "create from common patterns". If the theme profile includes `recommendations.components.mandatoryAtoms`, cross-reference with that list for theme-specific additions.

These atoms will be built FIRST in `/build-components` before any composites or sections.
