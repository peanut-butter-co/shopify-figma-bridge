---
name: build-foundations
description: >
  Use when: creating Figma variables, text styles, or style guide from analyzed tokens
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/build-foundations/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

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
5. **Check for theme profile:** If `theme.hasProfile === true`, read `.claude/figma-sync/theme-profiles/{theme_slug}.json`. But **only use profile guidance for areas that passed validation** — check `theme.profileValidation` in the manifest (set by `/analyze-theme`). For validated areas, use the profile's `figmaMapping` sections. If a section shows `"diverged"` in profileValidation → ignore the profile for that area, use only the manifest's detected data.
6. If `buildStatus.foundations === "complete"` → warn user: "Foundations were already built. Re-running will recreate everything. Proceed?"

---

## Step 1: Create Pages

Using `use_figma`, create the pages defined in `config.pages` (default: Foundations, Atoms, Blocks, Sections).

**Important:** Figma creates a default "Page 1" — rename it to the first page name instead of creating a new one.

```javascript
const pages = figma.root.children;
pages[0].name = "Foundations";
figma.root.insertChild(1, figma.createPage());
// etc.
```

After creating pages, switch to the Foundations page for the next steps.

---

## Step 2: Theme Colors Collection

Create variable collection "Theme Colors" with a single mode.

From `foundations.colors.uniqueColors.themeColors`, create one COLOR variable per entry:
- Variable name: use the `name` field from the manifest
- Value: convert `hex` + `opacity` to `{r, g, b, a}` floats (r,g,b: 0-1 range, a = opacity)

**Naming:** Use `{Group}/Base` for the primary (fully opaque) swatch in each color group. If the manifest uses a numeric suffix, rename it.

**Always include** a `Transparent` variable with value `{r: 0, g: 0, b: 0, a: 0}`.

**Batch strategy:** Create all variables in a single `use_figma` call if possible. If the response exceeds ~20KB, split into batches of ~15 variables.

---

## Step 3: Grey Scale Collection

Create variable collection "Grey Scale" with a single mode.

From `foundations.colors.uniqueColors.greyScale`, create one COLOR variable per entry. Same approach as Theme Colors.

---

## Step 3.5: Alpha Variant Variables

See `.claude/skills/build-foundations/reference/alpha-variants.md` for the full procedure on finding, deduplicating, and creating alpha variant variables. This step is critical — many scheme colors include alpha/opacity that must have matching variables before building Color Schemas.

---

## Step 4: Color Schemas Collection

This is the most complex step. Create collection "Color Schemas" with **one mode per color scheme**.

See `.claude/skills/build-foundations/reference/color-schemas.md` for the detailed procedure including variable creation, alias binding, and batch strategy.

**Critical rules:**
- Color Schemas NEVER holds raw color values — only VARIABLE_ALIAS references
- Match by **both RGB and alpha**
- If no matching variable is found → **STOP and warn the user**

---

## Step 5: Typography Collection

Create variable collection "Typography" with a single mode, type FLOAT.

From `foundations.typography.presets`, create a variable for each preset's font size:
- `font-size/h1` = 56
- `font-size/h2` = 48
- `font-size/paragraph` = 14

**Do NOT create line-height variables.** The Figma API forces `unit: "PIXELS"` when binding a variable to lineHeight. Line heights will be set directly on text styles as percentages.

---

## Step 6: Spacing & Layout Collection

Create variable collection "Spacing & Layout" with a single mode, type FLOAT.

From `foundations.spacing`:
- **Spacing scale:** `spacing/{value}` for each value in `scale` array
- **Layout:** `layout/page-width` = value from `layout.pageWidth.value`
- **Radii:** `radius/{name}` for each entry in `radii`

---

## Step 7: Text Styles

For each preset in `foundations.typography.presets` (h1-h6, paragraph) plus any additional presets:

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

**Loading fonts:** Before setting font properties, ensure the font is loaded:
```javascript
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
```

---

## Step 7b: Mobile Text Styles (conditional)

**Check `foundations.typography.createMobileStyles`:**

- If `createMobileStyles` is `false` (or missing): **skip this step entirely**. Do not create mobile text styles.
- If `createMobileStyles` is `true`: create a mobile variant for every text style from Step 7.

**Sizes:**
- When `hasMobilePresets` is `true`: use sizes from `foundations.typography.presets.{preset}.mobile`
- When `hasMobilePresets` is `false`: duplicate desktop sizes (user explicitly chose mobile styles for manual customization)

**Naming:** If the desktop style is `Heading/H1`, the mobile variant is `Heading/H1 / Mobile`. This uses Figma's standard `/` hierarchy — the desktop style becomes a collapsible group with `Mobile` nested inside.

**Naming consistency is critical:** Always use spaces around `/` in the mobile suffix: `{name} / Mobile`. Never `{name}/Mobile` without spaces. Inconsistent spacing creates mismatched group names in Figma's style panel.

---

## Step 7c: Validate Text Styles

After creating all text styles (Step 7 + optional Step 7b), verify them:

1. Read back all local text styles via `use_figma`:
   ```javascript
   const styles = figma.getLocalTextStyles();
   return styles.map(s => ({ name: s.name, fontSize: s.fontSize, lineHeight: s.lineHeight }));
   ```

2. **Count check:** Compare the number of styles against expected:
   - If `createMobileStyles` is false: expected = number of presets (e.g., 7 for h1-h6 + paragraph)
   - If `createMobileStyles` is true: expected = number of presets x 2

3. **Naming check:** Verify that:
   - Desktop style names have exactly 2 `/`-segments (e.g., `Heading/H1`)
   - Mobile style names (if any) have exactly 3 `/`-segments (e.g., `Heading/H1 / Mobile`)
   - All mobile suffixes use consistent spacing: ` / Mobile` (with spaces)
   - No orphaned mobile styles exist without a matching desktop parent

4. **Value check:** For each style, confirm fontSize and lineHeight match the manifest values.

5. If any check fails → log the discrepancy, delete the incorrect style(s), and recreate them before proceeding.

---

## Step 8: Foundations Style Guide Page

On the "Foundations" page, create visual documentation frames. See `.claude/skills/build-foundations/reference/style-guide.md` for the detailed frame layouts for:
- 8a. Color Swatches
- 8b. Color Schemas Overview
- 8c. Typography Examples
- 8d. Spacing Scale
- 8e. Instance Architecture Reference

---

## Validation

After creating EACH style guide frame:
1. Use `get_screenshot` focused on the frame at 100%+ zoom
2. Verify the content is legible and properly laid out
3. If something looks broken → fix it before moving on

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
Text styles:       {N} desktop{, {N} mobile | (no mobile — theme uses CSS scaling)}
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
