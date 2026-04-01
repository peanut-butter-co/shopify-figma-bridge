# Variant Analysis Procedure

For each selected section, read its `{% schema %}` settings and identify settings that should become Figma component variant properties.

## How to identify variant-worthy settings

Don't rely on setting `id` names alone — they vary wildly between themes. Instead, analyze each setting holistically:

1. **Check the setting's `type`**: Must be `select` with 2-5 discrete options (not `range`, `checkbox`, `text`, `image_picker`, etc.)
2. **Check what the options represent**: Look at the option `value` and `label` fields. Settings whose options describe spatial positions, layout modes, or structural changes are strong candidates.
3. **Ask: "Would switching this option produce a visually distinct layout?"** If yes → variant. If it's a subtle tweak → skip.

## Priority tiers (highest to lowest)

### Tier 1 — Almost always variants (change the fundamental composition):
- **Content position/alignment**: Options map to spatial placement (top/center/bottom, left/center/right, flex-start/center/flex-end). Look for labels like `t:settings.alignment`, `t:settings.position`, etc.
- **Layout mode**: Fundamentally different visual treatments (grid/carousel/editorial/bento, column/row)
- **Media/content direction**: Flip which side content appears on (left/right, media-left/media-right)

### Tier 2 — Often variants (meaningful visual change, case by case):
- **Content width/proportion**: How much space content occupies (wide/medium/narrow, full-width/centered)
- **Column count**: When limited to 2-3 options that change the grid visibly

### Tier 3 — Instance properties (not variants — see Instance Properties section below):
- **Section width** (page-width/full-width) — container change, repeats across many sections
- **Section height** (small/medium/large) — dimensional adjustment, many options
- **Media height** — same: dimensional, not compositional

## What should NOT become variants

- `color_scheme` — handled via Figma variable modes (see Variable Properties below)
- `range` type settings (padding, spacing, gap, border-width) — infinite values
- Font/typography overrides — handled by text styles
- Show/hide toggles (`checkbox` type) — minor visual impact
- Content settings (text, images, URLs, video pickers)
- Settings gated by `condition` — these are conditional sub-settings, not independent variants. However, the **parent setting they depend on** may itself be a variant.
- **Tier 3 settings** (section width, section/media height) — these are instance properties, not variants (see below)

## Instance properties (not variants — Figma component properties)

Some settings have discrete options but should NOT create separate variants. Instead, they become **Figma component properties** (enum or boolean) that the designer adjusts per-instance.

### When to classify as instance property instead of variant

- **Container/dimensional settings**: Section width (page/full), section height, media height — they change size/containment but not the fundamental layout composition
- **High option count (4+)**: Settings like height with 5+ options would multiply variant combinations without meaningful structural difference
- **Repeating pattern**: Settings like `section_width` appear in nearly every section with the same values. Making them variants would duplicate the pattern across every section; as an instance property, the behavior is consistent and lightweight
- **Rule of thumb**: If switching the option doesn't change where elements are positioned relative to each other, it's an instance property

### Figma implementation

- **Enum property**: For `select` settings with 2-5 string options (e.g., section_width: page/full)
- **Boolean property**: For settings that are effectively on/off (e.g., full-width: true/false)
- The component is built at the **default value** — the designer switches the property on the instance when needed

### Examples

| Setting | Values | Why instance property |
|---------|--------|----------------------|
| `section_width` | page, full | Container change, no compositional shift, repeats everywhere |
| `media_height` | auto, small, medium, large, full-screen | 5 options, dimensional only |
| `section_height` | auto, small, medium, large, full-screen, custom | 6 options, dimensional only |
| `slide_height` | auto, small, medium, large | Dimensional only |

## Variable properties (not variants — controlled via Figma variable modes)

Some settings are NOT component variants but are still important to document because they are applied to components through **Figma variable modes** at the instance level:

- **`color_scheme`**: Present in almost every section. The component instance is placed inside a frame that applies the corresponding color scheme variable mode.
- Any other settings that map directly to Figma variables defined in `/build-foundations`.

For each section, note which `color_scheme`-type settings exist (some sections have multiple, e.g., header has `color_scheme_top`, `color_scheme_bottom`, `color_scheme_transparent`). List alongside variants so the user sees the full picture.

## Merging with theme profile variant recommendations

If the theme profile provides `recommendations.components.prioritySections` with rich objects containing a `variants` map, merge them with the generic analysis:

### Merge procedure

1. **Profile variants as baseline:** For the current section, extract the profile's recommended variants (if any). Each has a `tier`, `values`, and `reason`.
2. **Generic analysis overlay:** Run the standard select-setting scan on the actual schema.
3. **Match by setting ID:** For each generic-detected variant:
   - If the setting ID matches a profile recommendation → **adopt the profile's tier and reason**. If the profile's `values` are a subset of the actual schema options, use the profile's values (the profile author intentionally excluded some). If the profile lists values not in the schema, warn and use only actual values.
   - If no profile match → keep as a `[detected]` variant with the generic tier.
4. **Stale profile entries:** If a profile recommends a setting ID that doesn't exist in the actual schema → warn and drop it. The theme may have changed.

### Presentation order

When showing merged results to the user:
1. `[recommended]` variants first (from profile), with their `reason`
2. `[detected]` variants after (from generic analysis only)

This lets the user see curated guidance up front, with additional findings appended. The user confirms the full set.
