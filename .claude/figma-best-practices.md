# Figma Design Engineering Cheatsheet

**Version:** 2026-03-26
**Last researched:** 2026-03-26

Distilled from official Figma docs and expert practitioners (Joey Banks, Ridd, Alice Packard, Nathan Curtis, Luis Ouriach, Christine Vallaure). This is the reference for building design system components programmatically via the Plugin API.

Run `/refresh-figma-practices` to update this cheatsheet with the latest Figma features and community best practices.

---

## Auto-Layout Decision Model

**Every component should use auto-layout.** Fixed positioning is the exception.

### Fill vs Hug vs Fixed

| Mode | Behavior | Use when |
|------|----------|----------|
| **Hug** (`"AUTO"`) | Container shrinks to wrap content | Text labels, badges, buttons, content wrappers |
| **Fill** (`"FILL"`) | Child expands to consume available space in parent | Text that should wrap, main content areas, full-width sections |
| **Fixed** (`"FIXED"`) | Exact dimensions, never changes | Icons, avatars, image placeholders, toggles |

**Critical rule:** If any child in a Hug frame uses Fill, the parent silently becomes Fixed. This is the #1 source of layout confusion.

### Nesting Strategy (Joey Banks)

Combine Fill and Hug within nested frames:
- Outer frame: horizontal auto-layout
- Primary content: Fill (takes remaining space)
- Secondary content: Hug (only as wide as needed)
- This creates responsive balance automatically

### Min/Max Dimensions

Set via width/height dropdowns. Essential for responsive components:
- `minWidth` prevents collapse at narrow sizes
- `maxWidth` prevents over-expansion
- Always set min/max on components intended for multiple viewport widths

---

## Component Architecture

### When to Use What (Alice Packard's Framework)

| Situation | Use | Why |
|-----------|-----|-----|
| Interactive states (hover, active, default) | **Variants** | Layer structure stays intact across swaps |
| Binary toggles (show/hide icon) | **Boolean property** | Reduces variant count, accessible from top layer |
| Icons | **Separate components + instance swap** | No visual preview in variant dropdowns |
| Different structural elements (button vs input) | **Separate components** | Aligns with code structure |
| Theme/color scheme switching | **Variables with modes** | Not variants — modes update all bound colors at once |
| Responsive spacing/padding | **Variables** | Reusable across instances |
| Content hierarchy (primary/secondary/tertiary) | **Separate components** | Better discoverability, independent versioning |

### Naming Conventions (Consensus)

- Forward slashes for hierarchy: `Button/Primary`, `Icon/Arrow/Left`
- Capitalize property names: `Style`, `State`, `Size`
- Lowercase property values: `primary`, `hover`, `large`
- Boolean properties named affirmatively: `Has Icon` not `No Icon`
- **Align naming between design and code** — consistency matters more than the specific convention

### Component Qualities (Alice Packard's 12 Principles)

The most relevant for programmatic building:
1. **Thoughtfully named layers** — no "Frame 427" or "Group 12"
2. **Common modifications accessible from top layer** — expose nested properties
3. **Variables on all color fills** — never hardcoded hex values
4. **Auto-layout sizing rules hold during swaps** — test that Fill/Hug behavior survives variant changes
5. **No rogue artifacts or hidden layers** — clean up after building
6. **Containing frame flush against visual edges** — no extra padding in the component frame itself

---

## Responsive Components

### Core Principles

- Set top-level component frames to **Fill** width so they adapt to containers
- Use **min/max width** constraints to prevent collapse or over-expansion
- **Test at extreme sizes before finalizing** (Joey Banks): stretch instances to extreme widths to identify breaking points
- Use Wrap on horizontal auto-layout for card grids that reflow

### Image Aspect Ratio in Auto-Layout

**The challenge:** Maintaining aspect ratios inside auto-layout is a known pain point.

**Solution:** `constrainProportions = true` on the image frame + `layoutSizingHorizontal = "FILL"`. The image scales proportionally when the parent width changes. This works for:
- Square product card images
- 16:9 hero images
- Any fixed aspect ratio

**For complex ratios:** The "ratio spacer" technique uses a rotated inner frame to enforce specific aspect ratios (figmatricks.io).

### Desktop-to-Mobile Adaptation

Components that must work at both viewport widths:
- **Horizontal layouts → vertical stacking:** Change `layoutMode` from `"HORIZONTAL"` to `"VERTICAL"`
- **Grid column count reduction:** 4 cols → 2 cols on mobile
- **Padding reduction:** Desktop 40-48px → Mobile 16-20px
- **Same text styles** — let the narrower width create natural wrapping instead of scaling fonts
- **Use boolean variables** to toggle layout sections across breakpoints (Christine Vallaure) — reduces variant count vs separate desktop/mobile components

---

## Variables and Design Tokens

### Three-Tier Architecture (Industry Consensus)

```
Primitive (raw values)     → Grey/900: #000000
    ↓ alias
Semantic (purpose-aware)   → Essential/Text: {Grey/900}
    ↓ applied to
Component (fills, strokes) → text.fills bound to Essential/Text
```

### Collection Organization

- **One collection per category:** Colors, Spacing, Typography, Radii
- **Modes for theming:** Color Schemas collection with one mode per scheme
- **Groups within collections:** Essential, Primary Button, Secondary Button, etc.
- **Alpha variants as children:** `Grey/900/81` (81% opacity) under `Grey/900` group
- Limit: 5,000 variables per collection

### Key Principles (Luis Ouriach)

- **Don't over-tokenize** — "We create too many design tokens, particularly for colors"
- Only tokenize values that are genuinely reused or need to change with themes
- Variables and styles are complementary: styles for composite values (typography), variables for individual values (colors, spacing)

### Color Schemas with Modes

- Each color scheme = one mode in the Color Schemas collection
- Semantic variables alias to primitive color variables (Theme Colors, Grey Scale)
- **Alpha-bearing colors need their own base variables** — `#000000cf` needs `Grey/900/81`, not an alias to `Grey/900` or `Transparent`
- Switching the mode on a frame instance updates all bound colors automatically — no variant needed for color scheme

---

## Grid Layouts

### Auto-Layout Wrap (Recommended for Card Grids)

```
grid.layoutMode = "HORIZONTAL"
grid.layoutWrap = "WRAP"
grid.itemSpacing = columnGap
grid.counterAxisSpacing = rowGap
// Children: fixed width, calculated as (containerWidth - (cols-1) * gap) / cols
// NEVER use layoutSizingHorizontal = "FILL" on wrap children
```

### Native Grid Auto-Layout (New — Config 2025)

Available but with limitations:
- Good for: flat galleries, card grids, bento layouts
- Can span elements across multiple cells
- Variables work for gap spacing

**Limitations vs CSS Grid:**
- No `fr` units — Figma's "Auto" behaves like `1fr`, not CSS `auto`
- No `auto-fill` / `auto-fit` for dynamic column counts
- No named grid areas or subgrid
- Reordering is clunky
- If a cell overhangs another, dimensions become fixed

**Practical choice:** Use auto-layout Wrap for responsive card grids. Use native Grid only for fixed-structure layouts like dashboards or bento boxes.

---

## Common Mistakes to Avoid

1. **Fixed height on text containers** — use Hug (maps to CSS `auto`). Fixed causes pixel discrepancies.
2. **Not testing at extreme sizes** — components should survive 320px to 1920px widths.
3. **Manual spacing without auto-layout** — leads to hours of rework.
4. **Hardcoded colors** — always bind to variables. No exceptions.
5. **Over-creating variants** — use boolean properties, variables with modes, and slots before reaching for more variants.
6. **Ignoring layer naming** — "Frame 427" breaks overrides and makes instances unpredictable.
7. **Using constraints inside auto-layout** — they don't work there. Use `layoutPositioning = "ABSOLUTE"` for exceptions.
8. **Creating separate components for every breakpoint** — use responsive patterns (Fill, min/max, constrainProportions) so one component adapts.

---

## Sources

- Joey Banks — [Auto Layout Techniques](https://medium.com/@joeyabanks/techniques-for-using-auto-layout-in-figma-fb2c874940ae), [Responsive Components](https://medium.com/@joeyabanks/the-easy-way-to-build-responsive-components-in-figma-3eb6d4850f65)
- Alice Packard — [12 Delightful Component Qualities](https://www.alicepackarddesign.com/blog/12-ways-to-make-your-figma-components-more-delightful-to-use), [Variants vs Separate Components](https://www.alicepackarddesign.com/blog/when-you-should-use-variants-vs-creating-separate-components)
- Nathan Curtis — [Configuration Collapse](https://nathanacurtis.substack.com/p/configuration-collapse), [Slots in Design Systems](https://nathanacurtis.substack.com/p/slots-in-design-systems)
- Christine Vallaure — [Figma Grid and CSS Grid](https://uxdesign.cc/figmas-new-grid-you-must-understand-css-grid-as-a-designer-fbb00416e1cc)
- Luis Ouriach — [Extended Collections for Multi-Brand Systems](https://events.figma.com/extendedcollections/LO)
- Figma Official — [Auto Layout Guide](https://help.figma.com/hc/en-us/articles/360040451373), [Variables Guide](https://help.figma.com/hc/en-us/articles/15339657135383), [Component Architecture](https://www.figma.com/best-practices/component-architecture/), [Grid Auto Layout](https://help.figma.com/hc/en-us/articles/31289469907863)
