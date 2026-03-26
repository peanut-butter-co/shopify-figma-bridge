---
description: Sync color schemes between Figma and Shopify
argument-hint: <shopify-to-figma|figma-to-shopify>
---

# Sync Color Schemes: Figma ↔ Shopify

**Direction:** `$ARGUMENTS`

You are syncing color scheme data between the Figma file (via Chrome DevTools MCP + `evaluate_script`) and Shopify's `config/settings_data.json`.

**Pre-flight check — Figma tab detection:**

Before doing anything, run this sequence:

1. Use `list_pages` (Chrome DevTools MCP) to check if there's already a Figma tab open (URL contains `figma.com/design`).
2. If a Figma tab is found → `select_page` to it, then run a quick `evaluate_script` to verify `typeof figma !== 'undefined'`. If `figma` is undefined, tell the user to open and close any Figma plugin once (known bug where the global isn't available until a plugin has run).
3. If NO Figma tab is found → ask the user for the Figma file URL, then use `navigate_page` to open it. Wait for load, then verify `figma` global.
4. If the `figma` global check fails after navigation → stop and ask the user for help. Do NOT try workarounds.

---

## Architecture

Colors flow through 3 layers:

```
Shopify settings_data.json (hex values)
    ↕ conversion
Theme Colors / Grey Scale collections (raw {r,g,b,a} values)
    ↕ VARIABLE_ALIAS
Color Schemas collection (semantic aliases, 8 modes)
```

**Color Schemas NEVER holds raw color values** — only `VARIABLE_ALIAS` references to Theme Colors or Grey Scale. This invariant must be maintained in both directions.

---

## Mappings

### Scheme Names: Figma mode ↔ Shopify key

| Figma Mode Name | Shopify Key |
|---|---|
| `scheme-1` | `scheme-1` |
| `scheme-2` | `scheme-2` |
| `scheme-3` | `scheme-3` |
| `scheme-4` | `scheme-4` |
| `scheme-5` | `scheme-5` |
| `scheme-6` | `scheme-6` |
| `transparent-dark-on-light` | `scheme-58084d4c-a86e-4d0a-855e-a0966e5043f7` |
| `warm-cream` | `scheme-a90ef358-2055-47a9-8aa5-43e27902b46c` |

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
| `Primary Button/Label` | `primary_button_text` |
| `Primary Button/Border` | `primary_button_border` |
| `Primary Button/Background Hover` | `primary_button_hover_background` |
| `Primary Button/Label Hover` | `primary_button_hover_text` |
| `Primary Button/Border Hover` | `primary_button_hover_border` |
| `Secondary Button/Background` | `secondary_button_background` |
| `Secondary Button/Label` | `secondary_button_text` |
| `Secondary Button/Border` | `secondary_button_border` |
| `Secondary Button/Background Hover` | `secondary_button_hover_background` |
| `Secondary Button/Label Hover` | `secondary_button_hover_text` |
| `Secondary Button/Border Hover` | `secondary_button_hover_border` |
| `Inputs/Background` | `input_background` |
| `Inputs/Label` | `input_text_color` |
| `Inputs/Border` | `input_border_color` |
| `Inputs/Background Hover` | `input_hover_background` |
| `Variants/Background` | `variant_background_color` |
| `Variants/Label` | `variant_text_color` |
| `Variants/Border` | `variant_border_color` |
| `Variants/Background Hover` | `variant_hover_background_color` |
| `Variants/Label Hover` | `variant_hover_text_color` |
| `Variants/Border Hover` | `variant_hover_border_color` |
| `Variants/Background Selected` | `selected_variant_background_color` |
| `Variants/Label Selected` | `selected_variant_text_color` |
| `Variants/Border Selected` | `selected_variant_border_color` |
| `Variants/Background Selected Hover` | `selected_variant_hover_background_color` |
| `Variants/Label Selected Hover` | `selected_variant_hover_text_color` |
| `Variants/Border Selected Hover` | `selected_variant_hover_border_color` |

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
  // Handle rgba(r,g,b,a) format
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
  // Transparent special case
  if (r === 0 && g === 0 && b === 0 && a === 0) return 'rgba(0,0,0,0)';
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (Math.abs(a - 1) < 0.001) return hex;
  return `${hex}${toHex(a)}`;
}
```

### Matching colors: how to find if a color already exists

Two colors match if their `{r, g, b}` values are within `0.005` tolerance AND their `a` values are within `0.01` tolerance. This accounts for float rounding.

---

## Direction: Shopify → Figma

### Step 1: Read Shopify data

Read `config/settings_data.json` with the Read tool. Parse `current.color_schemes` to get all 8 schemes and their color values.

### Step 2: Read Figma state

Use `evaluate_script` to read the current state of all three collections:
- Theme Colors: all variables with their `{r,g,b,a}` values
- Grey Scale: all variables with their `{r,g,b,a}` values
- Color Schemas: all variables with their alias targets per mode

### Step 3: Build the change plan

For each scheme (mode) × each color field:
1. Convert the Shopify hex to `{r,g,b,a}`
2. Check if a variable with that exact color exists in Theme Colors or Grey Scale
3. If yes → that's the alias target
4. If no → plan to create a new variable in the appropriate collection:
   - If `r ≈ g ≈ b` (within 0.01) → Grey Scale
   - Otherwise → Theme Colors
   - Name it based on existing naming conventions (e.g., `Grey/500` for a mid-grey, or `NewColor/Base` for new brand colors)

### Step 4: Show diff to user

Before making any changes, display a summary:
- New variables to create in Theme Colors / Grey Scale
- Changed aliases in Color Schemas (old target → new target)
- Orphaned variables to remove (if any color is no longer referenced by ANY scheme)

**Wait for user approval before proceeding.**

### Step 5: Apply changes in Figma

Execute via `evaluate_script`:
1. Create any new variables in Theme Colors / Grey Scale
2. Update Color Schemas aliases for changed values
3. Remove orphaned variables from Theme Colors / Grey Scale

### Step 6: Verify

Read back the Color Schemas collection and spot-check a few values to confirm aliases resolve correctly.

---

## Direction: Figma → Shopify

### Step 1: Read Figma data

Use `evaluate_script` to read all Color Schemas variables. For each variable in each mode:
1. Get the alias target (the Theme Colors or Grey Scale variable it points to)
2. Read that target variable's actual `{r,g,b,a}` value
3. Convert to Shopify hex format

```javascript
// Read all Color Schemas with resolved values
async () => {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const csCollection = collections.find(c => c.name === "Color Schemas");
  const tcCollection = collections.find(c => c.name === "Theme Colors");
  const gsCollection = collections.find(c => c.name === "Grey Scale");

  // Build ID → variable map for resolving aliases
  const allVars = {};
  for (const id of [...tcCollection.variableIds, ...gsCollection.variableIds]) {
    const v = await figma.variables.getVariableByIdAsync(id);
    const val = v.valuesByMode[v.variableCollectionId === tcCollection.id
      ? tcCollection.modes[0].modeId
      : gsCollection.modes[0].modeId];
    allVars[v.id] = { name: v.name, value: val };
  }

  // Read Color Schemas
  const result = {};
  for (const varId of csCollection.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(varId);
    result[v.name] = {};
    for (const mode of csCollection.modes) {
      const val = v.valuesByMode[mode.modeId];
      if (val && val.type === "VARIABLE_ALIAS") {
        const target = allVars[val.id];
        result[v.name][mode.name] = {
          aliasTo: target.name,
          resolved: target.value  // {r, g, b, a}
        };
      }
    }
  }
  return result;
}
```

### Step 2: Build the change plan

For each scheme, map each Figma variable to its Shopify field (using the mapping table above) and convert the resolved `{r,g,b,a}` to Shopify hex format.

### Step 3: Show diff to user

Read the current `config/settings_data.json` and compare against the planned values. Show:
- Changed values: `scheme-1.background: #ffffff → #faf7f2`
- Unchanged values: skip

**Wait for user approval before writing.**

### Step 4: Write to Shopify

Use the Edit tool to update `config/settings_data.json` at path `current.color_schemes.[scheme-key].settings.[field]`.

**Important:** Only modify color fields. Do not touch any other settings in the file.

### Step 5: Verify

Re-read the modified file and confirm the values match expectations.

---

## Error Handling

- If a Color Schemas variable has a raw color value instead of an alias → warn the user (this breaks the architecture)
- If a Shopify scheme key doesn't match any Figma mode → warn and skip
- If `evaluate_script` fails → stop and ask user to check the Figma tab
- Never silently overwrite — always show the diff first

---

## Naming Conventions for New Variables

When creating new variables in Theme Colors or Grey Scale (Shopify → Figma direction):

### Grey Scale (when r ≈ g ≈ b)
- Use `Grey/{luminance}` where luminance is `0` (white) to `900` (black)
- For alpha variants: `Grey/{luminance}/{alpha_percent}` (e.g., `Grey/900/53`)
- Luminance mapping: round `(1 - r) * 900` to nearest 100

### Theme Colors (when colored)
- Try to match existing group names (Porcelain, Linen, Sky, Cinder, Navy)
- A color "matches" a group if its RGB (ignoring alpha) is within 0.01 of another color in that group
- Alpha variants: append `/{alpha_percent}` (e.g., `Cinder/900/80`)
- Genuinely new colors: ask the user for a name
