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
4. **Verify required MCP tools are available:**
   - **Figma MCP** (`use_figma`, `get_screenshot`) — required for all phases
   - **Chrome DevTools MCP** (`navigate_page`, `evaluate_script`, `take_screenshot`, `resize_page`) — required for reference capture
   - If any required MCP tool is missing → **STOP immediately**. Tell the user which MCP server is missing and ask them to configure it before continuing. Do NOT proceed without it. Do NOT fall back to estimates or skip reference capture.
5. Read `config.storeUrl`, `config.storePassword`, `config.figmaFileKey`, `config.desktopWidth`, `config.mobileWidth`
6. Determine which phase to run based on `$ARGUMENTS`:
   - `all` → run atoms → blocks → sections-desktop → sections-mobile in sequence
   - Specific phase → run only that phase
7. Check `buildStatus` for already-completed phases. If re-running a completed phase, warn user.

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

For EACH atom component individually (NOT the whole page):

**A. Visual validation** — screenshot each component at 100%+ zoom using `get_screenshot` with the component's node ID. Compare against the store reference. Check that all text is readable, colors are correct, and proportions match.

**B. Programmatic integrity check** — run this via `use_figma` on each component:

```javascript
// Mandatory check: find invisible text, broken fills, unbound colors
const issues = [];
const texts = comp.findAll(n => n.type === "TEXT");
for (const t of texts) {
  for (const fill of t.fills) {
    if (fill.opacity !== undefined && fill.opacity < 0.01 && fill.visible !== false) {
      issues.push(`INVISIBLE TEXT: "${t.characters}" has fill opacity ${fill.opacity}`);
    }
    if (!fill.boundVariables?.color) {
      issues.push(`UNBOUND COLOR: "${t.characters}" text fill is not bound to a variable`);
    }
  }
}
const frames = comp.findAll(n => n.type === "FRAME" || n.type === "COMPONENT");
for (const f of frames) {
  for (const fill of (f.fills || [])) {
    if (fill.opacity !== undefined && fill.opacity < 0.01 && fill.visible !== false && !f.name.includes("Image")) {
      issues.push(`INVISIBLE FILL: frame "${f.name}" has fill opacity ${fill.opacity}`);
    }
  }
}
```

If ANY issues are found → **this may indicate an upstream problem** (see "Upstream Error Protocol" below). Diagnose before fixing locally.

Additional checks:
- Buttons: width/height ratio > 2, height < 60px
- All fills: verify they're bound to variables, not hardcoded

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

Same process as atoms — run BOTH visual (A) and programmatic (B) checks on each block individually. Screenshot each block component at 100%+ zoom, and run the integrity check script.

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

## Upstream Error Protocol

This skill depends on outputs from previous pipeline steps (foundations, variables, text styles). When validation catches an issue, **always diagnose whether the root cause is local or upstream** before applying a fix.

### How to diagnose

When a programmatic check flags an issue (e.g., invisible text, broken fill), investigate one level deeper:
1. **Check the variable value** — does the bound variable resolve to the expected color/value in the active mode?
2. **Check if the issue is isolated or systemic** — does the same variable cause problems on multiple nodes?
3. **If it's systemic** (same variable broken everywhere), the issue is upstream — in foundations, not in the component.

### What to do when you find an upstream error

**STOP building components.** Do NOT apply local workarounds (like manually setting opacity) and continue. Instead:

1. Identify the upstream cause (e.g., "Essential/Text variable resolves to alpha=0 because it aliases to Transparent instead of an alpha variant")
2. Report to the user: explain what's broken, which previous step caused it, and what the fix would be
3. Ask the user: "Should I fix the [foundations/variables/styles] first, or continue with a workaround?"
4. Only proceed once the user decides

**Why this matters:** A local patch hides the bug. Every subsequent component will inherit the same issue, and the fix becomes exponentially harder later. It's always cheaper to fix upstream first.

### Examples of upstream vs local issues

| Symptom | Upstream? | Root cause |
|---------|-----------|------------|
| Text invisible (opacity=0) on multiple components | Yes | Variable aliases to wrong base color (foundations) |
| One button's border radius looks wrong | No | Wrong radius variable used (local fix) |
| All fills show hardcoded color instead of variable | Yes | Variable collection missing or misconfigured |
| A single text node has wrong font | No | Wrong text style applied (local fix) |

---

## Important Reminders

### Figma Plugin API gotchas:

**Page navigation:**
- ❌ `figma.currentPage = page`
- ✅ `await figma.setCurrentPageAsync(page)`

**Binding variables to fills/strokes — use `setBoundVariableForPaint`, not `setBoundVariable`:**
- ❌ `frame.setBoundVariable('fills', 0, 'color', myVar)`
- ✅ `frame.fills = [figma.variables.setBoundVariableForPaint(figma.util.solidPaint("#000"), myVar)]`
- The helper `bindPaint(paint, variable)` pattern: `function bindPaint(p, v) { return figma.variables.setBoundVariableForPaint(p, 'color', v); }`

**`resize()` overrides sizing modes — ALWAYS set sizing modes AFTER `resize()`:**
- ❌ `frame.primaryAxisSizingMode = "AUTO"; frame.resize(1440, 1);` → sizing mode reverts to FIXED
- ✅ `frame.resize(1440, 1); frame.primaryAxisSizingMode = "AUTO";` → sizing mode sticks
- This is the #1 cause of "height is 1" bugs. If the component height is wrong, check this first.

**`counterAxisSizingMode` only accepts `"FIXED"` | `"AUTO"` — never `"FILL"`:**
- ❌ `content.counterAxisSizingMode = "FILL"` → throws validation error
- ✅ Set `layoutSizingHorizontal = "FILL"` on the child AFTER appending it to an auto-layout parent

**Child sizing (`layoutSizingHorizontal`/`layoutSizingVertical`) — set AFTER appending to parent:**
- ❌ `child.layoutSizingHorizontal = "FILL"; parent.appendChild(child)` → error: not in auto-layout
- ✅ `parent.appendChild(child); child.layoutSizingHorizontal = "FILL"`

**Fixed-height children in vertical auto-layout (e.g., image placeholders):**
- ❌ A `layoutMode = "NONE"` frame as a child of vertical auto-layout → height collapses to 0
- ✅ Use `layoutMode = "VERTICAL"` with `primaryAxisSizingMode = "FIXED"` + `counterAxisSizingMode = "FIXED"`, then `resize(w, h)`, then after appending: `child.layoutSizingHorizontal = "FILL"; child.layoutSizingVertical = "FIXED"`
- For absolute-positioned children inside (e.g., badge overlay), use `child.layoutPositioning = "ABSOLUTE"`

**Other gotchas:**
- Text nodes in auto-layout default to HUG width → set `layoutSizingHorizontal = "FILL"` + `textAutoResize = "HEIGHT"` after appending
- Component instances can't be resized via `resize()` with fixed sizing — use `layoutSizingHorizontal = "FILL"` in auto-layout parents
- Use `await node.getMainComponentAsync()` not `node.mainComponent` (dynamic-page mode)
- Use `await node.setTextStyleIdAsync(style.id)` not `node.textStyleId = style.id`
- `createVariable(name, collectionObject, type)` — pass collection OBJECT, not ID

### `use_figma` MCP gotchas (validation layer):
- `blendMode: "NORMAL"` is required in shadow effects — omitting causes validation error
- `primaryAxisSizingMode` rejects `"HUG"` — use `"AUTO"` instead
- Paint `color` objects don't accept `a` (alpha) — use `opacity` on the paint: `{ type: "SOLID", color: { r, g, b }, opacity: 0.8 }`

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
