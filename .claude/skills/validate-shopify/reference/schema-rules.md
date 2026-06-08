# Common Shopify Schema Gotchas

A reference of known schema issues encountered in Evil Horizon and general
Shopify theme development. Review this before interpreting validation results --
some "violations" are intentional patterns.

---

## 1. Range Step/Interval Math

**The rule:** `step` must divide `(max - min)` evenly, or the range slider UI
breaks in the theme editor.

**What goes wrong:** The slider renders intermediate positions that don't land on
clean values. Merchants drag the slider and see values like `33.33` instead of
whole numbers. In some cases, the slider cannot reach `max` at all.

**Example:**
```json
{
  "type": "range",
  "id": "padding_top",
  "min": 0,
  "max": 100,
  "step": 3,
  "default": 0
}
```
100 / 3 = 33.33 -- the slider cannot reach 100. Valid positions: 0, 3, 6, ...
99. The merchant can never select 100.

**Fix:** Choose a step that divides the interval evenly. For 0-100: use 1, 2, 4,
5, 10, 20, 25, 50, or 100.

---

## 2. Select Options Count

**The rule:** Too many options makes the dropdown unusable in the theme editor.

**Thresholds:**
- **> 20 options:** WARNING -- consider splitting into groups or using a different
  setting type
- **> 50 options:** ERROR -- the dropdown is functionally broken on mobile devices
  and slow to render

**Common offenders:** Font family selectors, country/region pickers, and icon
name selectors.

**Fix:** For large option sets, use a `text` field with documentation, or split
into cascading selects (e.g., category then item).

---

## 3. Color Scheme References

**The gotcha:** Custom color schemes use UUID-style keys, not sequential names.

```json
// settings_data.json
{
  "current": {
    "color_schemes": {
      "scheme-1": { ... },
      "scheme-a90ef358-2c2f-4e3b-8f5a-1d2e3f4a5b6c": { ... },
      "scheme-custom-dark": { ... }
    }
  }
}
```

**What goes wrong:** A template references `"color_scheme": "scheme-a90ef358-..."`
but someone edits settings_data.json and removes or renames that scheme. The
section silently falls back to no color scheme, causing invisible text or broken
layouts.

**Key point:** The first 6 schemes (`scheme-1` through `scheme-6`) are created
by default, but merchants can add custom schemes with UUID keys through the
theme editor. Both formats are valid.

---

## 4. Font Value Format

**The format:** `{family}_{style}{weight}`

| Component | Description | Values |
|-----------|-------------|--------|
| `family` | Font family name, lowercase, underscores for spaces | `inter`, `abril_fatface`, `playfair_display` |
| `style` | Normal or italic | `n` = normal, `i` = italic |
| `weight` | Weight as single digit | `1`=100, `2`=200, `3`=300, `4`=400, `5`=500, `6`=600, `7`=700, `8`=800, `9`=900 |

**Examples:**
```
inter_n4            -- Inter, Normal, 400 (regular)
inter_n7            -- Inter, Bold, 700
inter_i4            -- Inter, Italic, 400
abril_fatface_n4    -- Abril Fatface, Normal, 400
playfair_display_i7 -- Playfair Display, Bold Italic, 700
assistant_n4        -- Assistant, Normal, 400
```

**What goes wrong:** Manually editing settings_data.json with incorrect format
(e.g., `"Inter"` instead of `"inter_n4"`) causes the font to not load. The
theme falls back to the browser default, which looks broken.

---

## 5. Block Type Must Match Filename

**The rule:** A block's `type` value in a section schema must correspond to an
actual file in the `blocks/` directory.

**File lookup order:**
1. `blocks/{type}.liquid` -- exact match
2. `blocks/_{type}.liquid` -- underscore-prefixed match (Evil Horizon convention)

**Example:**
```json
// In section schema
{
  "blocks": [
    { "type": "hero", "name": "Hero" }
  ]
}
```
Expects either `blocks/hero.liquid` or `blocks/_hero.liquid` to exist.

**Special types that skip file lookup:**
- `@app` -- third-party app blocks, managed by Shopify
- `@theme/block-name` -- theme blocks, strip the `@theme/` prefix before lookup

**What goes wrong:** Renaming a block file without updating all section schemas
that reference it. The section appears to work but the block type silently
disappears from the theme editor's "Add block" menu.

---

## 6. Setting ID Uniqueness

**The rule:** Setting IDs must be unique within their scope.

**Scopes:**
- **Section-level settings:** All IDs must be unique within the section
- **Block-level settings:** All IDs must be unique within that block type
- **Cross-scope:** A block setting ID *can* duplicate a section setting ID
  (they are in different scopes)
- **Cross-section:** The same ID can appear in different sections (each section
  is independent)

**What goes wrong:** Duplicate IDs within the same scope cause the theme editor
to only save the last one. The merchant changes a setting, saves, and the value
reverts because a duplicate ID overwrote it.

**Detection approach:**
```
For each section schema:
  section_ids = [s.id for s in schema.settings]
  assert len(section_ids) == len(set(section_ids))

  For each block in schema.blocks:
    block_ids = [s.id for s in block.settings]
    assert len(block_ids) == len(set(block_ids))
```

---

## 7. Padding Settings with -1 Default

**The convention:** Many Shopify themes (including Horizon) use `-1` as a special
sentinel value for padding settings. It means "inherit from desktop" or "use
the theme default."

```json
{
  "type": "range",
  "id": "padding_bottom_mobile",
  "min": -1,
  "max": 100,
  "step": 1,
  "default": -1,
  "label": "Mobile bottom padding",
  "info": "-1 inherits desktop value"
}
```

**Validation note:** When `min` is `-1`, the range is technically valid. The
usable range is 0 to max, with -1 as a special case. Do not flag `-1` as an
error when the schema explicitly sets `min: -1`.

**What goes wrong:** Someone changes `min` to `0` without updating the default
from `-1`. The theme editor rejects the value and falls back to `min`, which
changes the layout unexpectedly.

---

## 8. Conditional Settings

**The pattern:** Setting B only appears in the theme editor when setting A has
a certain value. Template JSON can still store values for hidden settings.

```json
{
  "type": "checkbox",
  "id": "show_overlay",
  "label": "Show overlay",
  "default": false
},
{
  "type": "range",
  "id": "overlay_opacity",
  "label": "Overlay opacity",
  "condition": "show_overlay eq true",
  "min": 0,
  "max": 100,
  "step": 5,
  "default": 50
}
```

**What goes wrong:** A template sets `overlay_opacity: 80` but doesn't set
`show_overlay: true`. The overlay opacity is stored but invisible in the theme
editor. This is technically valid -- the value is preserved and will take effect
if the merchant enables the overlay -- but it can cause confusion during debugging.

**Validation approach:** Flag as WARNING, not ERROR. The merchant may have
intentionally pre-configured the value before enabling the feature.

---

## 9. max_blocks Limit

**The rule:** If a section defines `max_blocks`, the total number of blocks in
a template cannot exceed that limit.

**Default behavior:** If `max_blocks` is not defined, Shopify allows up to 50
blocks per section (the platform default). However, some sections explicitly set
lower limits.

**Common limits in Evil Horizon:**
```json
// footer-utilities: max 3 blocks (icons/links)
"max_blocks": 3

// slideshow: max 10 slides
"max_blocks": 10

// announcement-bar: max 5 announcements
"max_blocks": 5
```

**What goes wrong:** A template JSON file defines more blocks than allowed. The
theme editor silently drops the excess blocks, which can remove content the
merchant expects to see.

---

## 10. Preset Validation

**The rule:** Preset setting values must be valid according to the schema
definition -- same types, within ranges, matching select options.

**Example of a broken preset:**
```json
{
  "presets": [{
    "name": "Hero Banner",
    "settings": {
      "section_height": "huge",
      "padding_top": 200
    }
  }]
}
```
If `section_height` only allows `[auto, small, medium, large, full-screen]`,
the value `"huge"` is invalid. If `padding_top` has `max: 100`, the value `200`
is out of range.

**What goes wrong:** When a merchant adds the section via "Add section" in the
theme editor, the preset applies with invalid values. The theme editor may
silently clamp or ignore these values, causing the preset to look different
from what was intended.

**Detection:** Apply the same validation rules from template setting validation
(Phase 1.4 in SKILL.md) to every setting value inside every preset.

---

## Quick Reference: Validation Priority

| Issue | Severity | Impact |
|-------|----------|--------|
| Invalid JSON in template | ERROR | Page will not render |
| Missing section file | ERROR | Section silently disappears |
| Setting value out of range | ERROR | Theme editor rejects/clamps value |
| Select value not in options | ERROR | Setting silently uses default |
| Missing block file | ERROR | Block type unavailable in editor |
| Duplicate setting IDs | ERROR | Settings overwrite each other |
| Range step math error | ERROR | Slider cannot reach certain values |
| Missing color scheme | ERROR | Section loses all styling |
| Orphaned settings | WARNING | Dead data, potential confusion |
| Too many select options | WARNING | Poor editor UX |
| Too many range steps | WARNING | Slider is hard to use precisely |
| Conditional dependency | WARNING | Hidden settings may confuse |
| Missing snippet file | ERROR | Liquid render error at runtime |
| Missing asset file | WARNING | Could be CDN-hosted asset |
