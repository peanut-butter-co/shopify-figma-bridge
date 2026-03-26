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

**References:**
- `.claude/figma-best-practices.md` — Figma design engineering patterns (auto-layout, responsive components, grids). Consult when facing layout decisions.
- `.claude/figma-sync/theme-profiles/{slug}.json` — If `theme.hasProfile === true` in the manifest, read the theme profile. It contains theme-specific knowledge about section patterns (grid settings, block nesting, color scheme application), icon handling, and layout quirks that inform how components should be built.

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
8. **Practices version check:** Read the `Version` date from `.claude/figma-best-practices.md`. Compare with `buildMeta.practicesVersion` in the manifest (if it exists). If the cheatsheet version is newer than the last build → warn: "The Figma best practices were updated since the last build ({old date} → {new date}). Building with new practices may introduce inconsistencies with existing components. Continue with new practices or keep old patterns?" Store the version used in `buildMeta.practicesVersion` when the build completes.

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

## CRITICAL: Instance-Only Architecture

**This is the #1 rule for the entire build process.**

Every sub-element that exists as a component MUST be created as an instance, never as an inline frame. This means:

1. **Build atoms FIRST.** Before building any block or section, ALL confirmed atoms must exist as Figma components.
2. **Blocks instance atoms.** A composite block instances its child atom components — it never recreates them as inline frames.
3. **Sections instance blocks and atoms.** A grid section instances card components — it never builds inline cards.
4. **Templates instance sections.** A page template instances Header, content sections, and Footer components.

**How to instance in use_figma:**
```javascript
// Find a component
const comp = page.findOne(n => n.name === "Button" && n.type === "COMPONENT_SET");
const variant = comp.children.find(c => c.name.includes("Primary"));
const instance = variant.createInstance();

// Add to parent and configure
parent.appendChild(instance);
instance.layoutSizingHorizontal = "FILL"; // AFTER appendChild

// Override text (load font first!)
await figma.loadFontAsync({family: "Inter", style: "Regular"});
const textNode = instance.findOne(n => n.type === "TEXT");
if (textNode) textNode.characters = "Add to Cart";
```

**Instance lookup table — common UI patterns and which atom to instance:**

| Sub-element needed | Instance of |
|---|---|
| Any button (CTA, submit, add to cart) | Button (Primary/Secondary variant) |
| Text input or search field | Input Field |
| Checkbox in a form | Checkbox (Checked/Unchecked) |
| Underlined or styled link | Text Link (Default/Accent) |
| Tab or accordion toggle | Tab (Active/Inactive) |
| Carousel/slideshow arrow | Arrow Button (Left/Right) |
| Sale/sold out label | Badge |
| Color or style picker | Variant Swatch (Default/Selected) |
| Product card in a grid | Product Card |
| Blog post card | Blog Card |
| Collection card | Collection Card |
| Quantity stepper (+/-) | Quantity Selector |

This table covers universal UI patterns. If the theme has additional atoms confirmed in `/propose-components`, add them to this lookup.

**Before building ANY composite:** List sub-elements needed. For each, check if the component exists. If yes → instance. If no → build the atom first.

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
- **Icons:** Build the full theme icon library (see "Icon Library" below).

### Icon Library

After building the other atoms, create an **Icons** frame on the Atoms page containing every SVG icon from the theme.

#### Discovery

1. **Glob** for `assets/icon-*.svg` in the theme directory
2. Read each SVG file and collect `{ name, svgContent }` pairs
3. The icon name is derived from the filename: `icon-cart.svg` → `cart`

#### SVG Cleanup (before sending to Figma)

Theme SVGs often contain CSS custom properties and tokens that Figma cannot parse. Clean each SVG string before passing to `figma.createNodeFromSvg()`:

1. **Replace CSS variables in stroke-width:** `var(--icon-stroke-width)` → `1.5` (the default Shopify icon stroke). If the theme has a custom stroke width in its CSS, use that value instead.
2. **Replace `currentColor`** → `#000000` (Figma doesn't support `currentColor`)
3. **Remove `class` attributes** — they have no effect in Figma and can cause parse issues
4. **Remove `vector-effect` attributes** — not supported by the Figma SVG parser
5. **Remove `aria-hidden` attributes**
6. **Fix malformed SVG tags** — e.g., `<svg svg` → `<svg` (seen in some theme icons like `icon-inventory.svg`)
7. **Preserve hardcoded colors** — some status icons (error, available, unavailable) use specific colors like `#EB001B`, `#108043`, `#DE3618`. Do NOT replace these with `#000000`.

#### Building in Figma

```javascript
// 1. Create the Icons container frame on the Atoms page
const iconsFrame = figma.createFrame();
iconsFrame.name = 'Icons';
iconsFrame.layoutMode = 'HORIZONTAL';
iconsFrame.layoutWrap = 'WRAP';
iconsFrame.itemSpacing = 40;
iconsFrame.counterAxisSpacing = 48;
iconsFrame.paddingTop = 32;
iconsFrame.paddingBottom = 32;
iconsFrame.paddingLeft = 32;
iconsFrame.paddingRight = 32;
iconsFrame.primaryAxisSizingMode = 'FIXED';
iconsFrame.counterAxisSizingMode = 'AUTO';
iconsFrame.resize(800, 100);
iconsFrame.fills = [];

// 2. For each icon SVG:
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

for (const { name, svg } of cleanedIcons) {
  const svgNode = figma.createNodeFromSvg(svg);

  // Wrapper frame: icon + label
  const wrapper = figma.createFrame();
  wrapper.name = name;
  wrapper.layoutMode = 'VERTICAL';
  wrapper.itemSpacing = 8;
  wrapper.primaryAxisSizingMode = 'AUTO';
  wrapper.counterAxisSizingMode = 'AUTO';
  wrapper.counterAxisAlignItems = 'CENTER';
  wrapper.fills = [];

  // Normalize to 24x24 bounding box
  const maxDim = Math.max(svgNode.width, svgNode.height);
  const scale = 24 / maxDim;
  svgNode.resize(Math.round(svgNode.width * scale), Math.round(svgNode.height * scale));
  svgNode.name = name;

  // Label
  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Regular" };
  label.characters = name;
  label.fontSize = 10;
  label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];

  wrapper.appendChild(svgNode);
  wrapper.appendChild(label);
  iconsFrame.appendChild(wrapper);
}
```

#### Batching

If the theme has many icons (20+), split the `use_figma` calls into batches of ~15 icons each, because embedding all SVG strings in a single call can exceed the code size limit. Create the Icons frame in the first call, then find it by name in subsequent calls to append more icons.

#### Validation

After all icons are placed, take a `get_screenshot` of the Icons frame and visually verify:
- All icons rendered correctly (no broken/empty frames)
- Labels are readable
- Grid layout is clean and even

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

- **Cards with images:** The image placeholder frame must maintain its aspect ratio at any card width. Use `layoutMode = "VERTICAL"` with `primaryAxisSizingMode = "FIXED"` + `counterAxisSizingMode = "FIXED"`, then `resize(w, h)`. After appending to the card, set `layoutSizingHorizontal = "FILL"` and **`constrainProportions = true`**. This ensures the image stays square (or whatever ratio) when the card is resized for mobile grids. Set a grey placeholder fill. For absolute-positioned children inside (e.g., badge), use `layoutPositioning = "ABSOLUTE"`.
  - ❌ `layoutMode = "NONE"` → height collapses to 0 in auto-layout parent
  - ✅ `layoutMode = "VERTICAL"` + `constrainProportions = true` + `layoutSizingHorizontal = "FILL"` → maintains aspect ratio at any width
- **Text nodes in auto-layout:** Always set `layoutSizingHorizontal = "FILL"` and `textAutoResize = "HEIGHT"` after appending to prevent overflow.
- **Product cards:** Include image placeholder, title (text style), price (text style), and optionally badge instance.
- **Use atom instances** where applicable — if a button atom exists, instantiate it instead of rebuilding.
- **Use icon instances** where sections or blocks reference icons — find the matching icon frame in the Icons container on the Atoms page and clone or reference it. If the icon doesn't exist in the library, create it inline as a fallback.

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

If the section has `variants` defined in the manifest, you MUST build it as a **Component Set** with all variant combinations — not a single Component.

**Process for each section with variants:**

1. Read the `variants` object from the manifest (e.g., `{ "Position": ["Top", "Center", "Bottom"], "Alignment": ["Left", "Center", "Right"] }`)
2. Calculate the total combinations (e.g., 3 × 3 = 9)
3. Build EACH combination as a separate component frame, adjusting the layout to reflect the variant:
   - **Position (Top/Center/Bottom):** Change `primaryAxisAlignItems` — `"MIN"` for Top, `"CENTER"` for Center, `"MAX"` for Bottom
   - **Alignment (Left/Center/Right):** Change `counterAxisAlignItems` — `"MIN"` for Left, `"CENTER"` for Center, `"MAX"` for Right
   - **Layout mode (Grid/Carousel/Editorial):** Change grid structure, card arrangement, or content treatment
   - **Media position (Left/Right):** Reverse the order of children in horizontal auto-layout
   - **Media width (Wide/Medium/Narrow):** Adjust the proportional width of the media frame
4. Name each variant following Figma convention: `Position=Top, Alignment=Left`
5. Combine all variants into a Component Set using `figma.combineAsVariants(components, page)`

**Do NOT skip variants.** A section with variants defined in the manifest that is built as a single Component is incomplete. The variant combinations are the primary deliverable — they let designers pick configurations in the Figma properties panel.

### After all desktop sections: Validate

**A. Visual validation** — Screenshot each section (or each variant of a Component Set) and compare against desktop store reference.

**B. Variant completeness check** — run this via `use_figma` after all sections are built:

```javascript
// Check every section with variants in manifest was built as a Component Set
const manifest = /* read from manifest */;
const sectionsPage = figma.root.children.find(p => p.name === "Sections");
const issues = [];

for (const section of manifest.components.sections) {
  if (!section.variants) continue; // No variants expected

  const node = sectionsPage.findOne(n => n.name === section.name);
  if (!node) {
    issues.push(`MISSING: ${section.name} not found on Sections page`);
    continue;
  }
  if (node.type !== "COMPONENT_SET") {
    issues.push(`NOT A VARIANT SET: ${section.name} is a ${node.type}, expected COMPONENT_SET`);
    continue;
  }

  // Count expected combinations
  const propArrays = Object.values(section.variants);
  const expectedCount = propArrays.reduce((acc, arr) => acc * arr.length, 1);
  const actualCount = node.children.length;

  if (actualCount < expectedCount) {
    issues.push(`INCOMPLETE: ${section.name} has ${actualCount}/${expectedCount} variants`);
  }
}
```

If any issues are found → fix them before marking the phase complete.

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

### Mobile Component Placement

Mobile components go NEXT TO their desktop counterpart, not in a separate mobile section.

- Desktop Header component → Mobile Header component right next to it
- Desktop Footer → Mobile Footer right next to it
- Desktop Product Card → Mobile Product Card right next to it

This makes it easy for designers to compare desktop and mobile side by side.

**Naming:** Desktop = "Header", Mobile = "Header / Mobile"
**Spacing:** 40px gap between desktop and mobile variants

### Mobile Section Components

**Every visually distinct section in a mobile template MUST be its own component.** Never build mobile template content as inline frames.

For each desktop section component, create a corresponding mobile variant:

**Pattern: Viewport variants on the same component set**
```
Collection Header (COMPONENT_SET)
├── Viewport=Desktop (1440px, H2, 48px padding)
└── Viewport=Mobile (375px, H3, 24px padding)
```

**Required mobile viewport variants:**
- Collection Header (Desktop/Mobile)
- Blog Header (Desktop/Mobile)
- 404 Content (Desktop/Mobile)
- Article Hero (Desktop/Mobile)
- Page Header (Desktop/Mobile)
- Search Header (Desktop/Mobile)

**Mobile-only components (no desktop equivalent):**
- Mobile Product Info (PDP product details at mobile sizing)
- Mobile Hero (hero section at 375px)
- Mobile Media Section
- Mobile Collection List

### Text Style Enforcement

**EVERY text node must have:**
1. A `textStyleId` set to one of the 50 local text styles
2. A fill bound to a token variable via `setBoundVariableForPaint`

**No exceptions.** If a text node is created without both of these, it's a violation.

Before creating ANY text node:
```javascript
// Load font first
await figma.loadFontAsync(style.fontName);
// Create text
const text = figma.createText();
text.characters = "My Text";
// Apply text style
text.textStyleId = style.id;
// Bind fill to token
text.fills = [figma.variables.setBoundVariableForPaint(basePaint, "color", tokenVar)];
```

**Use Mobile text styles for mobile components:**
- Heading/H3/Mobile (not H3/Desktop) for mobile headings
- Body/Paragraph/Mobile for mobile body text
- Subheading/H6/Mobile for mobile labels

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

**Image placeholders that must maintain aspect ratio (e.g., product card images):**
- ❌ `layoutMode = "NONE"` → height collapses to 0 in auto-layout parent
- ❌ `layoutSizingVertical = "FIXED"` without `constrainProportions` → image stays 334px tall even when card shrinks to 175px (not square on mobile)
- ✅ Use `layoutMode = "VERTICAL"` + `primaryAxisSizingMode = "FIXED"` + `counterAxisSizingMode = "FIXED"`, then `resize(w, h)`. After appending to parent: `child.layoutSizingHorizontal = "FILL"` + **`child.constrainProportions = true`**. This keeps the image square (or any ratio) at any parent width.
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

### Visual Validation Checklist

After building EACH component, run this checklist:

1. **Screenshot:** `get_screenshot` of the component
2. **Overlap check:** No components overlapping or stacked on top of each other
3. **Instance check:** All sub-elements should appear as purple-linked instances in Figma (not blue unlinked frames)
4. **Token check:** All colors should come from variables (no hardcoded hex)
5. **Text style check:** All text should use a local text style (not unstyled text)
6. **Layout check:** Auto-layout working, no clipped text, proper spacing

**Do NOT move to the next component until the current one passes all 6 checks.**

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
