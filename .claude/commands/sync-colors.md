---
description: Sync color schemes between Figma and Shopify
argument-hint: <shopify-to-figma|figma-to-shopify>
---

# Sync Color Schemes: Figma ↔ Shopify

**Direction:** `$ARGUMENTS`

You are syncing color scheme data between the Figma file (via Figma MCP `use_figma` tool) and Shopify's `config/settings_data.json`.

**Method:** Figma MCP (`use_figma` for reading/writing variables). Always pass `skillNames: "figma-use"` to every `use_figma` call.

**Manifest path:** `.claude/figma-sync/manifest.json`

**After syncing:** Run `/validate-instances` to verify all components still reference variables correctly.

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json` to get `config.figmaFileKey`
2. Verify the Figma MCP server is connected by calling `use_figma` with a simple read script
3. If `use_figma` fails → tell the user to check their Figma MCP connection (`/mcp` to authenticate)

---

## Architecture

Colors flow through the variable collections (adapts to either 2-collection or 3-collection architecture):

**2-collection (Evil Horizon default):**
```
Shopify settings_data.json (hex values)
    ↕ conversion
Primitives collection (raw {r,g,b,a} values, single mode)
    ↕ VARIABLE_ALIAS
Tokens collection (semantic aliases, 6 modes)
```

**3-collection (Horizon spec):**
```
Shopify settings_data.json (hex values)
    ↕ conversion
Theme Colors / Grey Scale collections (raw values)
    ↕ VARIABLE_ALIAS
Color Schemas collection (semantic aliases, multi-mode)
```

**Invariant:** The semantic collection (Tokens or Color Schemas) NEVER holds raw color values — only `VARIABLE_ALIAS` references. This must be maintained in both directions.

**Auto-detect architecture:** Use `use_figma` to list collections. If "Primitives" + "Tokens" exist → 2-collection. If "Theme Colors" + "Grey Scale" + "Color Schemas" exist → 3-collection.

---

## Mappings

### Variable Names: Figma ↔ Shopify field

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

### Shopify → Figma RGBA floats

Shopify uses three formats:

1. **Plain hex** `#rrggbb` → `{r, g, b, a: 1}`
2. **Hex with alpha** `#rrggbbaa` → `{r, g, b, a}` where `aa` is the alpha byte (0–255 → 0–1)
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

### Figma RGBA floats → Shopify hex

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

## Direction: Shopify → Figma

### Step 1: Read Shopify data

Read `config/settings_data.json`. Parse `current.color_schemes` to get all schemes and their color values.

### Step 2: Read Figma state

Use `use_figma` to read the current state of variable collections:

```javascript
// Detect architecture and read all variables
const collections = await figma.variables.getLocalVariableCollectionsAsync();

// Find raw color collection(s)
const primitives = collections.find(c => c.name === "Primitives");
const themeColors = collections.find(c => c.name === "Theme Colors");
const greyScale = collections.find(c => c.name === "Grey Scale");

// Find semantic collection
const tokens = collections.find(c => c.name === "Tokens");
const colorSchemas = collections.find(c => c.name === "Color Schemas");

const rawCollection = primitives || themeColors; // primary raw collection
const semanticCollection = tokens || colorSchemas;

// Read all raw variables
const rawVars = {};
const rawCollectionIds = [];
if (primitives) rawCollectionIds.push(...primitives.variableIds);
if (themeColors) rawCollectionIds.push(...themeColors.variableIds);
if (greyScale) rawCollectionIds.push(...greyScale.variableIds);

for (const vid of rawCollectionIds) {
  const v = await figma.variables.getVariableByIdAsync(vid);
  if (v.resolvedType === "COLOR") {
    const modeId = v.variableCollectionId === (primitives || themeColors).id
      ? (primitives || themeColors).modes[0].modeId
      : greyScale.modes[0].modeId;
    rawVars[v.id] = { name: v.name, value: v.valuesByMode[modeId] };
  }
}

// Read semantic variables with their aliases per mode
const semanticVars = {};
for (const vid of semanticCollection.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(vid);
  semanticVars[v.name] = { id: v.id, valuesByMode: v.valuesByMode };
}

return {
  architecture: primitives ? "two-collection" : "three-collection",
  rawVarCount: Object.keys(rawVars).length,
  semanticVarCount: Object.keys(semanticVars).length,
  modes: semanticCollection.modes.map(m => ({ name: m.name, id: m.modeId })),
  rawVars,
  semanticVars
};
```

### Step 3: Build the change plan

For each scheme (mode) × each color field:
1. Convert the Shopify hex to `{r,g,b,a}`
2. Check if a raw variable with that exact color exists
3. If yes → that's the alias target
4. If no → plan to create a new variable in the raw collection:
   - If `r ≈ g ≈ b` (within 0.01) → Grey Scale (or `Color/Gray/*` in Primitives)
   - Otherwise → Theme Colors (or `Color/Brand/*` in Primitives)

### Step 4: Show diff to user

Before making any changes, display:
- New variables to create
- Changed aliases (old target → new target)
- Orphaned variables to remove (no longer referenced)

**Wait for user approval.**

### Step 5: Apply changes in Figma

Use `use_figma` to:
1. Create any new raw variables
2. Update semantic aliases for changed values
3. Optionally remove orphaned raw variables

```javascript
// Example: update an alias
const semanticVar = await figma.variables.getVariableByIdAsync(semanticVarId);
semanticVar.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: targetRawVarId });
```

### Step 6: Verify

Use `use_figma` to read back the semantic collection and spot-check values.

---

## Direction: Figma → Shopify

### Step 1: Read Figma data

Use `use_figma` to read all semantic variables with resolved values:

```javascript
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const primitives = collections.find(c => c.name === "Primitives");
const tokens = collections.find(c => c.name === "Tokens");
const semantic = tokens || collections.find(c => c.name === "Color Schemas");
const rawCols = [primitives, collections.find(c => c.name === "Theme Colors"), collections.find(c => c.name === "Grey Scale")].filter(Boolean);

// Build ID → value map for resolving aliases
const rawVarValues = {};
for (const col of rawCols) {
  for (const vid of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(vid);
    if (v.resolvedType === "COLOR") {
      rawVarValues[v.id] = v.valuesByMode[col.modes[0].modeId];
    }
  }
}

// Read semantic variables with resolved colors
const result = {};
for (const vid of semantic.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(vid);
  result[v.name] = {};
  for (const mode of semantic.modes) {
    const val = v.valuesByMode[mode.modeId];
    if (val && val.type === "VARIABLE_ALIAS" && rawVarValues[val.id]) {
      result[v.name][mode.name] = rawVarValues[val.id]; // resolved {r,g,b,a}
    }
  }
}
return { modes: semantic.modes.map(m => m.name), variables: result };
```

### Step 2: Build the change plan

Map each Figma variable to its Shopify field (using mapping table). Convert resolved `{r,g,b,a}` to Shopify hex.

### Step 3: Show diff to user

Read current `config/settings_data.json` and compare. Show changed values only.

**Wait for user approval.**

### Step 4: Write to Shopify

Use the Edit tool to update `config/settings_data.json` at `current.color_schemes.[scheme-key].settings.[field]`.

**Only modify color fields. Do not touch other settings.**

### Step 5: Verify

Re-read the file and confirm values match.

---

## Error Handling

- If a semantic variable has a raw color instead of an alias → warn (architecture violation)
- If a Shopify scheme key doesn't match any Figma mode → warn and skip
- If `use_figma` fails → check Figma MCP connection, ask user to re-authenticate
- Never silently overwrite — always show diff first

---

## Naming Conventions for New Variables

### Grey variants (r ≈ g ≈ b)
- `Color/Gray/{shade}` in Primitives, or `Grey/{shade}` in Grey Scale collection
- Shade: round `(1 - r) * 900` to nearest 50

### Colored variants
- `Color/Brand/{name}` in Primitives, or match existing Theme Colors group
- Alpha variants: append opacity percentage (e.g., `Color/Black/87`)
- New colors: ask user for a name
