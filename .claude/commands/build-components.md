---
description: Build confirmed components in Figma (atoms, blocks, sections)
argument-hint: <atoms|blocks|sections-desktop|sections-mobile|all>
---

# Build Components

You are building the confirmed component inventory in Figma: atoms, blocks, and sections. This skill combines reference capture from the live store with Figma construction and validation.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Phase:** `$ARGUMENTS` — one of `atoms`, `blocks`, `sections-desktop`, `sections-mobile`, or `all` (default)

**Methods:**
- **Figma MCP** (`use_figma` + `get_screenshot`) — all Figma creation and validation
- **Chrome DevTools MCP** — reference capture only (store navigation, DOM measurements, store screenshots)

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify `components.status === "confirmed"`. If not → "Run `/propose-components` first."
3. Verify `buildStatus.foundations === "complete"`. If not → "Run `/build-foundations` first."
4. Read `config.storeUrl`, `config.storePassword`, `config.figmaFileKey`, `config.desktopWidth`, `config.mobileWidth`
5. Determine which phase to run based on `$ARGUMENTS`:
   - `all` → run atoms → blocks → sections-desktop → sections-mobile in sequence
   - Specific phase → run only that phase
6. Check `buildStatus` for already-completed phases. If re-running a completed phase, warn user.

---

## Reference Capture

Before building any visual components, capture reference data from the live store. This step runs once regardless of which phase is selected.

### Using Chrome DevTools MCP:

1. **Navigate to the store:** `navigate_page` to `config.storeUrl`
2. **Handle password:** If `config.storePassword` exists and a password screen appears, enter the password
3. **If store is not accessible:** STOP completely. Tell the user to resolve access. Do NOT proceed with estimated values.

### Desktop capture (viewport = `config.desktopWidth`):

4. `resize_page` to `{width: config.desktopWidth, height: 900}`
5. `take_screenshot` — full page reference
6. Use `evaluate_script` to measure key dimensions:

```javascript
// Measure buttons, cards, sections, grid layouts
(() => {
  const measure = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      width: r.width, height: r.height,
      paddingTop: parseFloat(s.paddingTop),
      paddingRight: parseFloat(s.paddingRight),
      paddingBottom: parseFloat(s.paddingBottom),
      paddingLeft: parseFloat(s.paddingLeft),
      borderRadius: s.borderRadius,
      gap: s.gap,
      fontSize: parseFloat(s.fontSize),
      lineHeight: parseFloat(s.lineHeight)
    };
  };

  return {
    button: measure('.button, .btn, [class*="button"]'),
    productCard: measure('.product-card, [class*="product-card"]'),
    collectionCard: measure('.collection-card, [class*="collection-card"]'),
    heroSection: measure('.hero, [class*="hero"]'),
    header: measure('header, .header'),
    footer: measure('footer, .footer'),
    // Add more selectors based on the sections in the template
  };
})()
```

7. For grid sections, measure column count and gaps:
```javascript
(() => {
  const grids = document.querySelectorAll('[class*="grid"], [style*="grid"]');
  return Array.from(grids).map(g => {
    const s = getComputedStyle(g);
    return {
      columns: s.gridTemplateColumns,
      gap: s.gap,
      columnGap: s.columnGap,
      rowGap: s.rowGap,
      selector: g.className
    };
  });
})()
```

### Mobile capture (viewport = `config.mobileWidth`):

8. `resize_page` to `{width: config.mobileWidth, height: 812}`
9. `take_screenshot` — full page mobile reference
10. Measure the same elements at mobile viewport — note layout changes (column count, stacking direction, padding reductions)

### Store captured data

Keep the measurements and screenshots in memory for the build phases. These do NOT need to persist in the manifest — they're only used during this skill invocation.

---

## Phase: Atoms

Build all atoms from `components.atoms` on the Atoms page.

### For each atom:

1. **Read the relevant code** — search for the atom's HTML/CSS in snippets, blocks, or section files. Look for class names, CSS custom properties, and structure.

2. **Build in Figma** using `use_figma`:
   - Use ONLY Color Schemas variables for all fills, strokes, text colors
   - Use Spacing & Layout variables for padding and radii
   - Bind font sizes to Typography variables
   - Apply text styles where appropriate

3. **Component Sets** for atoms with variants (e.g., Button with Style × State):
   - Create a Component Set
   - Each variant is a component inside the set
   - Name variants following Figma convention: `Style=Primary, State=Default`

### Design rules for atoms:

- **Buttons:** Use captured measurements for height and padding. Bind fills to `Primary Button/*` or `Secondary Button/*` variables. Use `radius/button-primary` or `radius/button-secondary`. Apply button text style.
- **Inputs:** Bind to `Inputs/*` variables. Use `radius/input`. Include placeholder text.
- **Badges:** Use the color schemes specified in settings (`badge_sale_color_scheme`, `badge_sold_out_color_scheme`). Use `radius/badge`.
- **Dividers:** Simple line, stroke bound to `Essential/Outline`.
- **Icons:** 24x24 placeholder frame, fill bound to `Essential/Text`.

### After all atoms: Validate

For EACH atom component:
1. Use `get_screenshot` focused on the component at 100%+ zoom
2. Compare visually against the store reference screenshots
3. Run programmatic checks:
   - Buttons: width/height ratio > 2, height < 60px
   - All fills: verify they're bound to variables, not hardcoded
4. Fix any issues found

Update `buildStatus.atoms = "complete"` in manifest.

---

## Phase: Blocks

Build all blocks from `components.blocks` on the Blocks page.

### For each block:

1. **Read the source block files** listed in `sourceBlocks` (e.g., `blocks/_product-card.liquid`, `snippets/product-card.liquid`)
2. **Use captured measurements** for dimensions, proportions, spacing
3. **Build in Figma** following the HTML structure:
   - Translate HTML hierarchy to Figma frame hierarchy
   - Use auto-layout to match CSS flexbox/grid patterns
   - Bind all colors to Color Schemas variables
   - Apply text styles to text nodes

### Design rules for blocks:

- **Cards with images:** Use `constrainProportions = true` + `layoutMode = "NONE"` on the image placeholder frame to maintain aspect ratio. Set a grey placeholder fill.
- **Text nodes in auto-layout:** Always set `layoutSizingHorizontal = "FILL"` and `textAutoResize = "HEIGHT"` after appending to prevent overflow.
- **Product cards:** Include image placeholder, title (text style), price (text style), and optionally badge instance.
- **Use atom instances** where applicable — if a button atom exists, instantiate it instead of rebuilding.

### After all blocks: Validate

Same process as atoms — screenshot each block, compare against store, check dimensions, fix issues.

Update `buildStatus.blocks = "complete"` in manifest.

---

## Phase: Sections Desktop

Build all sections from `components.sections` on the Sections page, desktop variants only.

### General rules for sections:

- **Width:** `config.desktopWidth` (e.g., 1440px)
- **Background:** Bind to `Essential/Background` variable — NEVER hardcode colors
- **Color scheme:** Read from the section's `colorScheme` in the manifest. Use `setExplicitVariableModeForCollection` to apply the correct mode from Color Schemas.
- **Padding and gaps:** Use captured measurements from reference capture
- **Component description:** Set to `Type: Section, Schema: {name}, File: {file}`

### For each section:

1. **Read `sections/{type}.liquid`** for the HTML structure and settings
2. **Read the template JSON** for the section's actual settings and block instances
3. **Build the frame hierarchy** matching the HTML/CSS structure:
   - Outer section frame: full width, auto-layout vertical
   - Content container: centered, max-width from page settings
   - Block areas: auto-layout with children
4. **Instantiate blocks and atoms** where they exist as components. For integrated blocks (section-specific), build them inline as frames.
5. **Create as Component** (or Component Set if variants exist)

### Grid layouts:

For sections with grids (product lists, collection lists):

```javascript
// Use native Grid layout
grid.layoutMode = "GRID";
grid.gridColumnCount = N;
grid.gridColumnSizes = Array(N).fill({ type: "FLEX", value: 1 });
grid.gridRowSizes = Array(Math.ceil(items / N)).fill({ type: "HUG" });
grid.gridColumnGap = columnGap;
grid.gridRowGap = rowGap;
// Children: layoutSizingHorizontal = "FILL"
```

**Fallback** if Grid mode issues: `layoutWrap = "WRAP"` with fixed-width children. Calculate child width: `(containerWidth - (columns - 1) * gap) / columns`. **NEVER** use `layoutGrow = 1` or `layoutSizingHorizontal = "FILL"` on wrap children.

### Section variants:

If the section has variants beyond Desktop/Mobile (e.g., alignment), create a Component Set with properties:
- `Viewport = Desktop` (this phase)
- `Alignment = Left, Center, Right` (if applicable)
- etc.

### After all desktop sections: Validate

Screenshot each section, compare against desktop store reference, fix issues.

Update `buildStatus["sections-desktop"] = "complete"` in manifest.

---

## Phase: Sections Mobile

For each desktop section, create a mobile variant on the same Sections page.

### General rules:

- **Width:** `config.mobileWidth` (e.g., 390px)
- **Naming:** Follow `config.mobileNaming` pattern (default: `{name} / Mobile`)
- **Grid changes:** Read the theme's mobile column settings. Common patterns:
  - Product grids: 2 columns on mobile (from `--mobile-columns` CSS variable)
  - Collection grids: 1-2 columns
  - Stacking: horizontal layouts become vertical
- **Padding:** Use mobile measurements from reference capture
- **Typography:** Same text styles (responsive sizing is NOT handled in Figma variants — keep same styles, let the narrower width create natural wrapping)

### For each section:

1. Use the mobile reference screenshots and measurements
2. Build a new component (or variant in Component Set) at mobile width
3. Adjust grid column counts, padding, and layout direction based on mobile measurements
4. Same color scheme as desktop counterpart

### After all mobile sections: Validate

Screenshot each section at mobile width, compare against mobile store reference.

Update `buildStatus["sections-mobile"] = "complete"` in manifest.

---

## Important Reminders

### From CLAUDE.md gotchas:
- `resize()` overrides sizing modes — set `primaryAxisSizingMode`/`counterAxisSizingMode` AFTER `resize()`
- Set `layoutSizingHorizontal = "FILL"` AFTER appending child to auto-layout parent
- Text nodes in auto-layout default to HUG width → set `layoutSizingHorizontal = "FILL"` + `textAutoResize = "HEIGHT"`
- Image frames: `constrainProportions = true` requires `layoutMode = "NONE"`
- `use_figma` requires `blendMode: "NORMAL"` in shadow effects
- `use_figma` rejects `"HUG"` for `primaryAxisSizingMode` — use `"AUTO"`
- Paint `color` objects don't accept `a` (alpha) via `use_figma` — use `opacity` on the paint

### Validation discipline:
- NEVER validate at zoomed-out scale — always 100%+ zoom
- NEVER say "looking good" without actually taking a screenshot and inspecting
- Screenshot EACH component individually, not the whole page at once
- If the store is inaccessible at any point → STOP and ask user

---

## Summary

After completing all phases (or the requested phase):

```
Components built in Figma!

Phase        Status
─────        ──────
Atoms        {complete|skipped|N built}
Blocks       {complete|skipped|N built}
Sections DT  {complete|skipped|N built}
Sections MB  {complete|skipped|N built}

Next step: Run /compose-page {template} to assemble the page composition.
```
