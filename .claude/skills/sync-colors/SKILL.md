---
name: sync-colors
description: >
  Use when: syncing color schemes between Figma and Shopify
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/sync-colors/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Sync Color Schemes: Figma <-> Shopify

**Direction:** `$ARGUMENTS`

You are syncing color scheme data between the Figma file (via Figma MCP `use_figma` tool) and Shopify's `config/settings_data.json`.

**Method:** Figma MCP (`use_figma` for reading/writing variables).

**Manifest path:** `.claude/figma-sync/manifest.json`

**After syncing:** Run `/validate-instances` to verify all components still reference variables correctly.

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json` to get `config.figmaFileKey`
2. Verify the Figma MCP server is connected by calling `use_figma` with a simple read script
3. If `use_figma` fails → tell the user to check their Figma MCP connection

---

## Architecture

Colors flow through the variable collections (adapts to either 2-collection or 3-collection architecture):

**2-collection (Primitives + Tokens):**
```
Shopify settings_data.json (hex values)
    <-> conversion
Primitives collection (raw {r,g,b,a} values, single mode)
    <-> VARIABLE_ALIAS
Tokens collection (semantic aliases, 6 modes)
```

**3-collection (Theme Colors + Grey Scale + Color Schemas):**
```
Shopify settings_data.json (hex values)
    <-> conversion
Theme Colors / Grey Scale collections (raw values)
    <-> VARIABLE_ALIAS
Color Schemas collection (semantic aliases, multi-mode)
```

**Invariant:** The semantic collection NEVER holds raw color values — only `VARIABLE_ALIAS` references.

**Auto-detect architecture:** Use `use_figma` to list collections and identify which pattern is used.

---

## Mappings

**Note:** Figma variable group names may vary. Read the actual variable names from the Figma file first rather than forcing defaults. If `.claude/figma-sync/design-rules.json` exists, read `tokenMap` to verify the Figma variable → CSS property mapping is current.

| Figma Variable | Shopify Field |
|---|---|
| `Essential/Background` | `background` |
| `Essential/Heading` | `foreground_heading` |
| `Essential/Text` | `foreground` |
| `Essential/Accent` | `primary` |
| `Essential/Accent Hover` | `primary_hover` |
| `Essential/Outline` | `border` |
| `Essential/Shadow` | `shadow` |
| `Primary Button/Background` | `primary_button_background` |
| `Primary Button/Text` | `primary_button_text` |
| `Primary Button/Border` | `primary_button_border` |
| `Primary Button/Background Hover` | `primary_button_hover_background` |
| `Primary Button/Text Hover` | `primary_button_hover_text` |
| `Primary Button/Border Hover` | `primary_button_hover_border` |
| `Secondary Button/Background` | `secondary_button_background` |
| `Secondary Button/Text` | `secondary_button_text` |
| `Secondary Button/Border` | `secondary_button_border` |
| `Secondary Button/Background Hover` | `secondary_button_hover_background` |
| `Secondary Button/Text Hover` | `secondary_button_hover_text` |
| `Secondary Button/Border Hover` | `secondary_button_hover_border` |
| `Input/Background` | `input_background` |
| `Input/Text` | `input_text_color` |
| `Input/Border` | `input_border_color` |
| `Input/Background Hover` | `input_hover_background` |
| `Variant/Background` | `variant_background_color` |
| `Variant/Text` | `variant_text_color` |
| `Variant/Border` | `variant_border_color` |
| `Variant/Background Hover` | `variant_hover_background_color` |
| `Variant/Text Hover` | `variant_hover_text_color` |
| `Variant/Border Hover` | `variant_hover_border_color` |
| `Variant Selected/Background` | `selected_variant_background_color` |
| `Variant Selected/Text` | `selected_variant_text_color` |
| `Variant Selected/Border` | `selected_variant_border_color` |
| `Variant Selected/Background Hover` | `selected_variant_hover_background_color` |
| `Variant Selected/Text Hover` | `selected_variant_hover_text_color` |
| `Variant Selected/Border Hover` | `selected_variant_hover_border_color` |

---

## Color Format Conversion

### Shopify -> Figma RGBA floats

Shopify uses three formats:

1. **Plain hex** `#rrggbb` → `{r, g, b, a: 1}`
2. **Hex with alpha** `#rrggbbaa` → `{r, g, b, a}` where `aa` is the alpha byte (0-255 → 0-1)
3. **RGBA string** `rgba(r,g,b,a)` → `{r/255, g/255, b/255, a}`

```javascript
function shopifyHexToRGBA(hex) {
  hex = hex.trim();
  if (hex.startsWith('rgba')) {
    const m = hex.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    return { r: +m[1]/255, g: +m[2]/255, b: +m[3]/255, a: +m[4] };
  }
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
```

### Figma RGBA floats -> Shopify hex

```javascript
function rgbaToShopifyHex(rgba) {
  const { r, g, b, a } = rgba;
  if (r === 0 && g === 0 && b === 0 && a === 0) return 'rgba(0,0,0,0)';
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (Math.abs(a - 1) < 0.001) return hex;
  return `${hex}${toHex(a)}`;
}
```

### Matching colors
Two colors match if `{r, g, b}` within `0.005` tolerance AND `a` within `0.01` tolerance.

---

## Direction: Shopify -> Figma

### Step 1: Read Shopify data
Read `config/settings_data.json`. Parse `current.color_schemes` to get all schemes and their color values.

### Step 2: Read Figma state
Use `use_figma` to read the current state of variable collections. Detect architecture and read all raw + semantic variables.

### Step 3: Build the change plan
For each scheme (mode) x each color field: convert Shopify hex, check if a matching raw variable exists, plan creation of new variables if needed.

### Step 4: Show diff to user
Display new variables, changed aliases, and orphaned variables. **Wait for user approval.**

### Step 5: Apply changes in Figma
Create new raw variables, update semantic aliases, optionally remove orphaned variables.

### Step 6: Verify
Read back the semantic collection and spot-check values.

---

## Direction: Figma -> Shopify

### Step 1: Read Figma data
Use `use_figma` to read all semantic variables with resolved values.

### Step 2: Build the change plan
Map each Figma variable to its Shopify field. Convert resolved `{r,g,b,a}` to Shopify hex.

### Step 3: Show diff to user
Read current `config/settings_data.json` and compare. Show changed values only. **Wait for user approval.**

### Step 4: Write to Shopify
Use the Edit tool to update `config/settings_data.json`. **Only modify color fields.**

### Step 5: Verify
Re-read the file and confirm values match.

---

## Error Handling

- If a semantic variable has a raw color instead of an alias → warn (architecture violation)
- If a Shopify scheme key doesn't match any Figma mode → warn and skip
- If `use_figma` fails → check Figma MCP connection
- Never silently overwrite — always show diff first

---

## Naming Conventions for New Variables

### Grey variants (r ~= g ~= b)
- `Color/Gray/{shade}` in Primitives, or `Grey/{shade}` in Grey Scale collection
- Shade: round `(1 - r) * 900` to nearest 50

### Colored variants
- `Color/Brand/{name}` in Primitives, or match existing Theme Colors group
- Alpha variants: append opacity percentage (e.g., `Color/Black/87`)
- New colors: ask user for a name
