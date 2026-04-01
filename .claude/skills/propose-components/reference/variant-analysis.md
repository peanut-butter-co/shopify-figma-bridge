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

### Tier 3 — Rarely variants (skip unless no Tier 1/2 options):
- **Section width** (page-width/full-width) — minor container change
- **Section height** (small/medium/large) — unless it's the primary visual differentiator

## What should NOT become variants

- `color_scheme` — handled via Figma variable modes
- `range` type settings (padding, spacing, gap, border-width) — infinite values
- Font/typography overrides — handled by text styles
- Show/hide toggles (`checkbox` type) — minor visual impact
- Content settings (text, images, URLs, video pickers)
- Settings gated by `condition` — these are conditional sub-settings, not independent variants. However, the **parent setting they depend on** may itself be a variant.

## Variable properties (not variants — controlled via Figma variable modes)

Some settings are NOT component variants but are still important to document because they are applied to components through **Figma variable modes** at the instance level:

- **`color_scheme`**: Present in almost every section. The component instance is placed inside a frame that applies the corresponding color scheme variable mode.
- Any other settings that map directly to Figma variables defined in `/build-foundations`.

For each section, note which `color_scheme`-type settings exist (some sections have multiple, e.g., header has `color_scheme_top`, `color_scheme_bottom`, `color_scheme_transparent`). List alongside variants so the user sees the full picture.
