---
name: validate-shopify
description: >
  Use when: writing or modifying Shopify template JSON files, section schemas,
  or settings_data.json. Also use before shopify theme push. Catches schema
  violations, setting dependency issues, range/step errors, and block type mismatches.
user-invocable: true
context: fork
allowed-tools: [Read, Glob, Grep, Write]
---

# Validate Shopify

> **Reference:** Before running validation, review
> `.claude/skills/validate-shopify/reference/common-schema-gotchas.md`
> for known edge cases and Shopify-specific pitfalls that affect how results
> should be interpreted.

## Purpose

This skill validates the structural and semantic correctness of a Shopify theme's
configuration layer: template JSON files, section schemas, settings data, and
cross-file references. It catches errors that `shopify theme check` misses --
particularly setting value violations, block type mismatches, range/step math
problems, and orphaned references.

Run this skill:
- Before every `shopify theme push`
- After modifying any `templates/*.json` file
- After changing a section's `{% schema %}` block
- After editing `config/settings_data.json`
- When debugging "setting not applying" issues in the theme editor

---

## Validation Procedure

Work through each phase sequentially. Collect all findings into the report
format defined at the end.

---

### Phase 1: Template JSON Validation

**Scope:** Every file matching `templates/*.json`

For each template file:

#### 1.1 Structural validity

```
1. Read the file
2. Confirm it parses as valid JSON
3. Confirm a top-level "sections" object exists
4. Confirm a top-level "order" array exists
5. Confirm every key in "order" exists in "sections"
6. Confirm every key in "sections" appears in "order" (flag orphaned sections)
```

**Error if:** JSON is malformed, `sections` or `order` is missing, or keys are
mismatched between the two.

#### 1.2 Section type resolution

For each section entry in `sections`:

```
1. Read the "type" field
2. Look for a matching file: sections/{type}.liquid
3. If not found, ERROR: section type does not resolve to a file
```

#### 1.3 Parse the section schema

For every resolved section file, extract and parse its schema:

```
1. Read the .liquid file
2. Find the content between {% schema %} and {% endschema %}
   - Use a regex or string search: match from "{% schema %}" to "{% endschema %}"
   - The content between those tags is JSON
3. Parse the JSON
4. Extract: name, settings[], blocks[], presets[], max_blocks
```

**Example parsing approach (pseudocode):**

```
file_content = Read(sections/{type}.liquid)
schema_match = regex(file_content, /\{%[-\s]*schema\s*[-]?%\}([\s\S]*?)\{%[-\s]*endschema\s*[-]?%\}/)
schema_json = JSON.parse(schema_match[1])
settings = schema_json.settings or []
blocks = schema_json.blocks or []
presets = schema_json.presets or []
max_blocks = schema_json.max_blocks or null
```

#### 1.4 Validate setting values

For each setting value provided in the template JSON, cross-reference it against
the section schema definition:

| Setting type | Validation rule |
|---|---|
| `range` | Value must be a number within `[min, max]`. Value must land on a valid step: `(value - min) % step === 0`. |
| `select` | Value must be one of the `options[].value` entries. |
| `radio` | Same as select. |
| `color_scheme` | Value must exist as a key in `config/settings_data.json` under `current.color_schemes`. |
| `number` | If `min` and/or `max` are defined, value must be within bounds. |
| `checkbox` | Value must be boolean (`true` or `false`). |
| `text` | No structural validation (any string is valid). |
| `textarea` | No structural validation. |
| `richtext` | No structural validation. |
| `image_picker` | Value should be a string (image reference). |
| `url` | Value should be a string. |
| `video_url` | Value should be a string containing a valid URL pattern. |
| `color` | Value should match hex format `#RRGGBB` or `#RGB`, or be empty string. |
| `color_background` | Value should be a CSS gradient or color string. |
| `font_picker` | Value should follow `family_style` format (e.g., `inter_n4`). |
| `collection` | Value should be a collection handle string. |
| `product` | Value should be a product handle string. |
| `blog` | Value should be a blog handle string. |
| `page` | Value should be a page handle string. |
| `link_list` | Value should be a menu handle string. |

#### 1.5 Validate blocks in templates

For each `blocks` entry in a template section:

```
1. Read the block's "type" field
2. Check that this type exists in the section schema's "blocks" array
   - Match against blocks[].type
3. Count total blocks per section
   - If section defines max_blocks, total must be <= max_blocks
4. For each block's settings, validate values using the same rules as 1.4
   - The setting definitions come from the matching block schema, not the section
```

---

### Phase 2: Section Schema Validation

**Scope:** Every file matching `sections/*.liquid` that contains a `{% schema %}` block

For each section schema:

#### 2.1 Required structure

```
- "name" field must exist and be a non-empty string (or translation key)
- "settings" must be an array (if present)
- Each setting must have "type" and "id" fields
- "blocks" must be an array (if present)
- Each block must have "type" and "name" fields
```

#### 2.2 Range setting math

For every setting where `type` is `range`:

```
interval = max - min
steps = interval / step

ERROR if: step does not divide interval evenly (interval % step !== 0)
WARNING if: steps > 100 (slider becomes unwieldy with too many positions)
WARNING if: step is 0 or negative
```

**Example:**
- `min: 0, max: 100, step: 3` -- 100/3 = 33.33 -- ERROR: does not divide evenly
- `min: 0, max: 100, step: 1` -- 100/1 = 100 -- WARNING: 100 steps is borderline
- `min: 0, max: 60, step: 4` -- 60/4 = 15 -- PASS

#### 2.3 Select setting limits

For every setting where `type` is `select`:

```
WARNING if: options count > 20
ERROR if: options count > 50
ERROR if: options count === 0
```

#### 2.4 Setting ID uniqueness

```
Collect all setting IDs within a single section (including settings inside blocks).
Section-level setting IDs must be unique among section-level settings.
Each block type's setting IDs must be unique within that block type.
Block-level IDs may duplicate section-level IDs (different scope).
```

#### 2.5 Block type file resolution

For each block definition in the schema's `blocks` array:

```
1. Read the block "type"
2. If the type starts with "@app" or "@theme", skip (these are special Shopify types)
3. Strip any namespace prefix (e.g., "shopify://blocks/foo" → "foo") before resolving
3. Otherwise, look for: blocks/{type}.liquid OR blocks/_{type}.liquid
4. ERROR if: neither file exists
```

#### 2.6 Preset validation

For each preset in the schema's `presets` array:

```
1. "name" must exist
2. For each setting in preset.settings:
   a. Setting key must match a defined setting ID in the schema
   b. Setting value must pass the same validation rules from Phase 1.4
3. For each block in preset.blocks:
   a. Block type must exist in schema's blocks array
   b. Block settings must validate against the block's schema
```

---

### Phase 3: Settings Data Validation

**Scope:** `config/settings_data.json`

#### 3.1 Structural validity

```
1. File must parse as valid JSON
2. Must have a "current" key at top level
3. current.color_schemes should exist (if any template references color schemes)
```

#### 3.2 Color scheme completeness

```
1. Collect every color_scheme value referenced in templates/*.json
2. For each referenced scheme ID:
   a. Check it exists as a key in current.color_schemes
   b. ERROR if missing
```

#### 3.3 Font value format

For any font-related values in settings data:

```
Valid format: {family}_{style}{weight}
- family: lowercase, underscores for spaces (e.g., "abril_fatface")
- style: "n" (normal) or "i" (italic)
- weight: single digit 1-9 (1=100, 4=400, 7=700, 9=900)

Examples:
  inter_n4           -- Inter, Normal, 400
  inter_n7           -- Inter, Bold, 700
  abril_fatface_n4   -- Abril Fatface, Normal, 400
  playfair_display_i4 -- Playfair Display, Italic, 400
```

**WARNING if:** Font value does not match the `{family}_{style}{weight}` pattern.

#### 3.4 Orphaned settings detection

```
1. Collect all setting IDs defined across:
   - config/settings_schema.json (theme settings)
   - All section schemas
2. Collect all setting keys in settings_data.json current.*
3. For each key in settings_data that is not in any schema:
   WARNING: potentially orphaned setting "{key}"

Note: Some keys are Shopify-internal (e.g., "content_for_index"). Skip those.
Known internal keys: content_for_index, content_for_header, content_for_footer,
                     sections, color_schemes
```

---

### Phase 4: Setting Dependency Validation

#### 4.1 Conditional setting checks

Some settings use Shopify's `condition` property (added in recent API versions):

```json
{
  "type": "range",
  "id": "overlay_opacity",
  "label": "Overlay opacity",
  "condition": "overlay_enabled eq true"
}
```

For templates that set `overlay_opacity` but do NOT set `overlay_enabled: true`:

```
WARNING: "{id}" has a condition on "{dependency_id}" but the dependency
         is not explicitly set in the template. The setting may be invisible
         in the theme editor.
```

#### 4.2 Header group awareness

Settings organized under `header` type entries form visual groups. While headers
do not enforce dependencies, flag cases where a template sets values for settings
that appear below a disabled toggle in the same group. This is a WARNING, not
an error, since the values are technically valid.

---

### Phase 5: Cross-File Reference Validation

#### 5.1 Block file references

```
1. Glob all block types referenced in any section schema
2. For each type (excluding @app and @theme types):
   a. Check blocks/{type}.liquid exists OR blocks/_{type}.liquid exists
   b. ERROR if neither exists
```

#### 5.2 Snippet references

```
1. Grep all .liquid files for {% render '{name}' %} patterns
   - Regex: \{%-?\s*render\s+['"]([^'"]+)['"]\s*
2. For each referenced snippet name:
   a. Check snippets/{name}.liquid exists
   b. ERROR if not found
```

#### 5.3 Asset references

```
1. Grep all .liquid files for references to assets:
   - {{ '{name}' | asset_url }}
   - Regex: ['"]([^'"]+)['"]\s*\|\s*asset_url
2. For each referenced asset name:
   a. Check assets/{name} exists
   b. WARNING if not found (could be a Shopify CDN asset)
```

---

## Output Format

Generate the report in this structure:

```markdown
## Shopify Validation Report

### Summary
- Templates checked: {N}
- Sections checked: {N}
- Settings validated: {N}
- Passed: {N}
- Warnings: {N}
- Errors: {N}

### Errors (must fix before push)

| File | Location | Issue |
|------|----------|-------|
| templates/index.json | sections.hero.settings.section_height | Value "huge" not in select options: [auto, small, medium, large, full-screen] |
| templates/product.json | sections.main.blocks.block_3 | Block type "nonexistent" not found in section schema |
| sections/hero.liquid | schema.settings.padding_top | Range step 3 does not divide interval 100 evenly (33.33 steps) |

### Warnings (should fix)

| File | Location | Issue |
|------|----------|-------|
| sections/slideshow.liquid | schema.settings.slide_speed | Range 100-5000 with step 1 yields 4900 positions (>100) |
| config/settings_data.json | current.old_feature_toggle | Potentially orphaned setting: not found in any schema |
| templates/index.json | sections.hero.settings.overlay_opacity | Setting has condition on "overlay_enabled" which is not set |

### Passed Checks

All other validations passed without issues.
```

---

## Execution Checklist

When running this skill, follow these steps in order:

1. **Read reference material**
   - Read `.claude/skills/validate-shopify/reference/common-schema-gotchas.md`
   - Note any theme-specific edge cases

2. **Discover files**
   - `Glob("templates/*.json")` to find all template files
   - `Glob("sections/*.liquid")` to find all section files
   - `Glob("blocks/*.liquid")` and `Glob("blocks/_*.liquid")` to index block files
   - `Glob("snippets/*.liquid")` to index snippet files
   - `Glob("assets/*")` to index asset files
   - `Read("config/settings_data.json")` to load settings data
   - `Read("config/settings_schema.json")` to load theme settings schema

3. **Run Phase 1** -- Template JSON validation
4. **Run Phase 2** -- Section schema validation
5. **Run Phase 3** -- Settings data validation
6. **Run Phase 4** -- Setting dependency validation
7. **Run Phase 5** -- Cross-file reference validation

8. **Compile report** using the output format above
9. **Write report** to stdout (do not write a file unless the user requests it)

---

## Edge Cases and Special Handling

### Sections without schemas

Some section files may not have a `{% schema %}` block (rare but possible for
simple sections). Skip schema validation for these but log:

```
INFO: sections/{name}.liquid has no schema block -- skipping schema validation
```

### JSON templates vs Liquid templates

Only validate `templates/*.json` files. The `gift_card.liquid` template and any
other `.liquid` templates in the templates directory use a different structure
and should be skipped.

### Shopify-managed sections

Sections with types starting with `shopify://` are managed by Shopify and do
not have local files. Skip file resolution for these.

### Theme blocks with @app type

Block types starting with `@app` are third-party app blocks. Skip file
resolution for these. Block types starting with `@theme` reference theme blocks
and should resolve normally (strip the `@theme/` prefix before looking up the file).

### Translation keys as values

Setting labels, names, and header content may use translation key format:
`t:sections.hero.name`. These are valid and should not be flagged as errors.

### The -1 padding convention

Many Shopify themes use `-1` as a default for padding settings to mean "inherit
from desktop." If a range setting has `min: -1`, the actual usable range starts
at 0, with -1 being a special sentinel. Do not flag `-1` as out-of-range if
`min` is `-1`.

### Color scheme UUID keys

Modern Shopify themes use UUID-style keys for color schemes:
`scheme-a90ef358-2c2f-4e3b-8f5a-1d2e3f4a5b6c`. These are valid keys. Do not
assume color schemes are named `scheme-1` through `scheme-6`.
