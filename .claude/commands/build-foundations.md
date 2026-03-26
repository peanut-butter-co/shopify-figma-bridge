---
description: Build Figma foundations (variables, text styles, style guide) from analyzed theme data
---

# Build Foundations

You are building the design system foundations in Figma: pages, variable collections, text styles, and a visual style guide. This skill reads everything from the manifest — it does NOT read theme files directly.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Method:** Figma MCP (`use_figma` for creation/editing, `get_screenshot` for verification). No Chrome DevTools needed.

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify `foundations` is not null. If null → tell user: "Run `/analyze-theme` first."
3. Verify `config.figmaFileKey` exists. If missing → tell user: "Run `/setup` first."
4. Read `config.desktopWidth` and `config.mobileWidth` for later use.
5. If `buildStatus.foundations === "complete"` → warn user: "Foundations were already built. Re-running will recreate everything. Proceed?"

---

## Step 1: Create Pages

Using `use_figma`, create the pages defined in `config.pages` (default: Foundations, Atoms, Blocks, Sections).

**Important:** Figma creates a default "Page 1" — rename it to the first page name instead of creating a new one.

```javascript
// Rename "Page 1" to first page name, then create the rest
const pages = figma.root.children;
pages[0].name = "Foundations"; // or whatever the first page is
// Create remaining pages
figma.root.insertChild(1, figma.createPage());
// etc.
```

After creating pages, switch to the Foundations page for the next steps.

---

## Step 2: Theme Colors Collection

Create variable collection "Theme Colors" with a single mode.

From `foundations.colors.uniqueColors.themeColors`, create one COLOR variable per entry:
- Variable name: use the `name` field from the manifest (e.g., `Porcelain/100`, `Cinder/900`)
- Value: convert `hex` + `opacity` to `{r, g, b, a}` floats (r,g,b: 0-1 range, a = opacity)

**Always include** a `Transparent` variable with value `{r: 0, g: 0, b: 0, a: 0}`.

**Batch strategy:** Create all variables in a single `use_figma` call if possible. If the response exceeds ~20KB, split into batches of ~15 variables.

---

## Step 3: Grey Scale Collection

Create variable collection "Grey Scale" with a single mode.

From `foundations.colors.uniqueColors.greyScale`, create one COLOR variable per entry. Same approach as Theme Colors.

---

## Step 4: Color Schemas Collection

This is the most complex step. Create collection "Color Schemas" with **one mode per color scheme**.

1. **Create the collection** with modes named after each scheme key from `foundations.colors.schemes`
2. **Create semantic variables** organized by the groups in `foundations.colors.semanticGroups`. Each variable is named `{GroupName}/{PropertyLabel}` (e.g., `Essential/Background`, `Primary button/Label`)
3. **For each variable in each mode:** set the value as a `VARIABLE_ALIAS` pointing to the Theme Colors or Grey Scale variable whose hex matches the scheme's color value for that field.

**Critical rules:**
- Color Schemas NEVER holds raw color values — only VARIABLE_ALIAS references
- Match colors by hex value (with tolerance for float rounding: r,g,b within 0.005, alpha within 0.01)
- If no matching variable is found for a color → warn the user and create a new variable in the appropriate collection (grey if R≈G≈B, otherwise theme colors)

**Batch strategy:** Process one semantic group at a time (Essential, Primary Button, Secondary Button, etc.) to stay within the ~20KB response limit.

**Resolve variable labels:** Use the field `id` from the semantic group (e.g., `background`) and map to the label from the `definition` array in the schema. The manifest's `semanticGroups` has both the group name and the list of variable IDs. For the Figma variable name, use `{GroupName}/{human-readable label}` — resolve the label from `settings_schema.json`'s `definition` entries (their `label` field, resolved via locales).

---

## Step 5: Typography Collection

Create variable collection "Typography" with a single mode, type FLOAT.

From `foundations.typography.presets`, create a variable for each preset's font size:
- `font-size/h1` = 56
- `font-size/h2` = 48
- `font-size/paragraph` = 14
- etc.

**Do NOT create line-height variables.** The Figma API forces `unit: "PIXELS"` when binding a variable to lineHeight. Line heights will be set directly on text styles as percentages.

---

## Step 6: Spacing & Layout Collection

Create variable collection "Spacing & Layout" with a single mode, type FLOAT.

From `foundations.spacing`:
- **Spacing scale:** `spacing/{value}` for each value in `scale` array (e.g., `spacing/4`, `spacing/8`, `spacing/16`)
- **Layout:** `layout/page-width` = value from `layout.pageWidth.value`
- **Radii:** `radius/{name}` for each entry in `radii` (e.g., `radius/button-primary` = 14, `radius/input` = 4)

---

## Step 7: Text Styles

For each preset in `foundations.typography.presets` (h1-h6, paragraph) plus any additional presets (button, link, body-small if present):

1. Create a text style via `use_figma`
2. Set the font family and weight from the resolved `fontRole`
3. **Bind fontSize** to the corresponding Typography variable
4. **Set lineHeight directly** as `{ value: X, unit: "PERCENT" }` — do NOT bind to a variable
5. Set letterSpacing if specified
6. Set textCase if specified (UPPER, LOWER, TITLE, ORIGINAL)

**Naming convention:**
- `Heading/Display H1` (for h1 when it uses accent font)
- `Heading/H2` through `Heading/H6`
- `Text/Body` (paragraph)
- `Text/Body Small` (if exists)
- `Text/Button` (if button typography extracted)
- `Text/Link` (if exists)

**Loading fonts:** Before setting font properties, ensure the font is loaded:
```javascript
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
```

---

## Step 7b: Mobile Text Styles

For EVERY text style created in Step 7, also create a mobile variant:

**Naming:** If the desktop style is `Heading/H1`, create `Heading/H1 / Mobile` at the mobile size.

If the theme has separate mobile font sizes (from `foundations.typography.presets.{preset}.mobile`), use those. If desktop and mobile sizes are the same, still create both styles — this allows future per-client customization.

**When using font roles (Body, Heading, Subheading, Accent):**
Create styles organized by role:
- `Heading/H1` (desktop) and `Heading/H1 / Mobile`
- `Body/H1` (desktop) and `Body/H1 / Mobile`
- etc.

This gives 4 roles × (H1-H6 + Paragraph) × 2 breakpoints = up to 56 styles (minus roles that don't use Paragraph). Always create both breakpoints.

---

## Step 8: Foundations Style Guide Page

On the "Foundations" page, create visual documentation frames. Each frame is a white card with auto-layout, padding, and subtle shadow.

**Frame base style:**
```javascript
frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
frame.cornerRadius = 8;
frame.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 2 }, radius: 8, spread: 0, visible: true, blendMode: "NORMAL" }];
frame.layoutMode = "VERTICAL";
frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 32;
frame.itemSpacing = 16;
frame.primaryAxisSizingMode = "AUTO";
frame.counterAxisSizingMode = "AUTO";
```

### 8a. Color Swatches

One frame per color collection (Theme Colors, Grey Scale). For each variable:
- A row (horizontal auto-layout) with:
  - Color swatch (40x40 frame, fill bound to the variable, cornerRadius 4)
  - Variable name (text node)
  - Hex value (text node, secondary color)

Group rows by variable name prefix (e.g., all `Porcelain/*` together with a group label).

### 8b. Color Schemas Overview

A frame showing each scheme as a column. For each scheme (mode):
- Scheme name as header
- Key color swatches: Background, Text, Primary Button BG, Secondary Button BG
- Show the variable alias target name under each swatch

### 8c. Typography Examples

A frame with one row per text style:
- Style name and metadata (font, size, line-height) as a small label
- Example text rendered with the actual text style applied

### 8d. Spacing Scale

A frame with one row per spacing value:
- Value label (e.g., "16px")
- Horizontal bar whose width equals the spacing value (max 320px for display)
- Fill bound to a neutral color

### 8e. Instance Architecture Reference

Create a reference frame documenting the instance rules:

**Title:** "Component Instance Rules"

**Content (as text nodes):**
```
RULE: Every sub-element that exists as a component MUST be instanced.
Never recreate buttons, inputs, or blocks as inline frames.

✓ Button in a section → instance of Button component
✓ Product card in a grid → instance of Product Card component
✓ Input in a form → instance of Input Field component
✗ Recreating a button-like frame with manual styling
✗ Building a card from scratch instead of instancing

WHY: One change to Button updates every button everywhere.
Without instances, it's a mockup, not a design system.
```

This frame serves as a visual reminder on the Foundations page.

---

## Validation

After creating EACH style guide frame:
1. Use `get_screenshot` focused on the frame at 100%+ zoom
2. Verify the content is legible and properly laid out
3. If something looks broken (text overlapping, invisible swatches, cramped rows) → fix it before moving on

**Do NOT batch-create all frames without validation.**

### Figma API gotchas for this skill:
- `createVariable(name, collectionObject, type)` — pass collection OBJECT, not ID
- `setBoundVariable('lineHeight', var)` forces `unit: "PIXELS"` — always set lineHeight directly: `{ value: 110, unit: "PERCENT" }`
- `use_figma` requires `blendMode: "NORMAL"` in shadow effects
- `use_figma` rejects `"HUG"` for `primaryAxisSizingMode` — use `"AUTO"`
- Paint `color` objects don't accept `a` (alpha) via `use_figma` — use `opacity` on the paint
- Text nodes in auto-layout: set `layoutSizingHorizontal = "FILL"` + `textAutoResize = "HEIGHT"` after appending

---

## Step 9: Update Manifest

Read the manifest, set `buildStatus.foundations = "complete"`, and write it back.

---

## Step 10: Summary

```
Foundations built in Figma!

Pages created:     {list page names}
Variable collections:
  - Theme Colors:    {N} variables
  - Grey Scale:      {N} variables
  - Color Schemas:   {N} semantic variables x {N} modes
  - Typography:      {N} variables
  - Spacing & Layout: {N} variables
Text styles:       {N} styles
Style guide:       {N} documentation frames on Foundations page

Next step: Run /propose-components to plan which components to build.
```

---

## Rollback

If a step fails mid-execution:
- **Variable collections:** Delete the collection by name and recreate it
- **Text styles:** Delete all and recreate
- **Style guide frames:** Delete all children of the Foundations page and recreate

**Exception:** If Color Schemas collection exists but only one group of aliases failed, do NOT delete the collection — just re-run the alias assignment for that group.
