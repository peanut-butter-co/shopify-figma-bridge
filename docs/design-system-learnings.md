# Design System Learnings

Findings from analyzing an existing Shopify theme design system in Figma (Sections Library — Master). This file contains ~80 pages, ~30+ component sets, and 247 variables across 10 collections. It maps a Shopify Horizon-style theme into a full Figma component library.

These learnings inform how our automated pipeline (`/build-foundations`, `/propose-components`, `/build-components`) should generate design systems.

---

## 1. File Organization

### Four-Tier Hierarchy

| Tier | Role | Examples |
|------|------|----------|
| **Utilities** | Design tokens (non-component pages) | Color, Icons, Radius, Shadow, Spacing, Typography |
| **Elements** | Atomic components (smallest reusable units) | Button, Badge, Price, Chip, Swatch, Input |
| **Blocks** | Composite components (atoms composed together) | Card, Text, Cart, Navigation, Media |
| **Sections** | Full page-width sections | Hero, Header, Footer, Featured Collection, FAQ |

Each tier gets its own page(s). Sections consume Blocks, Blocks consume Elements. This mirrors Shopify's own architecture (sections → blocks → settings).

### Naming Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| Public components | lowercase kebab-case | `button`, `badge`, `product-card` |
| Private/internal | dot prefix | `.button-hotspot`, `.cart-item`, `.social-icon` |
| Group wrappers | `-group` suffix | `button-group`, `badge-group`, `swatch-group` |
| Sub-variants | hyphen-joined | `button-icon`, `button-label`, `text-heading` |
| Icons | `icon/` namespace | `icon/arrow-left`, `icon/chevron-down` |
| Component hierarchy | forward slashes | `Icon/Arrow/Left` |

**Takeaway for pipeline:** Use dot prefix for internal sub-components that shouldn't appear in the assets panel. Use `-group` suffix for layout wrappers that arrange multiple instances of an atom.

### Documentation System

The file includes its own documentation components (`docs-header`, `docs-preview`, `docs-group`, `docs-component`, `docs-section`, `page-wrapper`) on a dedicated "System Level Components" page. These are used throughout to annotate each component page with usage notes.

**Takeaway for pipeline:** This level of internal documentation is beyond our scope but worth noting. Our components should at least have clear naming so they're self-documenting.

---

## 2. Variable & Token Architecture

### Collection Structure (10 collections, 247 variables)

| Collection | Modes | Variables | Purpose |
|------------|-------|-----------|---------|
| **Size Primitives** | 1 | 57 | Spacing scale, gaps, section padding |
| **Radius Primitives** | 1 | 13 | Border radius tokens + semantic aliases |
| **Typography Primitives** | 1 | 51 | Font families, weights, sizes, line heights |
| **.Color Schemes** | 3 (Group A/B/C) | 30 | Consumer-facing scheme selector |
| **.Scheme Group 1/2/3** | 4 each | 30 each | Base color palettes with alpha variants |
| **Button** | 1 | 6 | Component-level token overrides |

### Color System: Two-Tier Alias Chain

The most sophisticated pattern in the file. Colors use a two-level mode-switching system:

```
Component binds to → .Color Schemes (Group A/B/C modes)
                        ↓ aliases into
                     .Scheme Group 1/2/3 (4 modes each: e.g. White/Black, Blue/White)
                        ↓ resolves to
                     Actual RGBA values with alpha
```

This gives **3 groups × 4 schemes = 12 possible color themes**, switchable by setting modes on two collection levels. Each scheme group has:
- `Primary/` — 14 alpha variants (100% down to 0%)
- `Secondary/` — 14 alpha variants (100% down to 0%)
- `Accent/` — 2 values: Focus and Error

The alpha steps are: 100%, 90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 16%, 12%, 8%, 4%, 0%.

**Takeaway for pipeline:** Our color system already supports scheme modes, but we must include alpha variants. The 8%, 12%, 16%, 20%, 30% alpha values are used extensively for:
- Hover states (primary/8% overlay)
- Active states (primary/16% overlay)
- Disabled states (primary/20% overlay)
- Borders (primary/12%)
- Focus rings (accent/focus)

Without these alpha variants, interactive states on components will require hardcoded colors.

### Spacing Token Structure

The 57 size primitives follow a clear taxonomy:

| Category | Variables | Examples |
|----------|-----------|---------|
| **Core Sizes** | 32 | `size-0` through `size-32`, with half-steps (`size-0-25`, `size-0-5`, `size-1-5`) |
| **Gap** | 10 | `gap-size-none` through `gap-size-4xl` |
| **Line** | 7 | `line-size-none` through `line-size-2xl` |
| **Section Spacing** | 4 | `px-desktop`, `px-mobile`, `py-desktop`, `py-mobile` |
| **Grid Spacing** | 2 | `desktop`, `mobile` |
| **Layout Spacing** | 2 | `desktop`, `mobile` |

**Notable:** Desktop/mobile breakpoints are separate named variables, NOT modes on a single variable. This means components must reference the correct desktop or mobile variable explicitly.

**Takeaway for pipeline:** Our spacing system should include:
1. A core size scale (matching the theme's spacing scale)
2. Semantic aliases for section padding (horizontal/vertical × desktop/mobile)
3. Grid and layout spacing tokens
4. Gap tokens for consistent component internal spacing

### Typography Token Structure

51 variables covering:
- **Font families** (3): header, body, accent
- **Font weights** (2): regular, bold (maps to "Medium")
- **Text sizes** (26): scale from 6px to 128px, named by 4px-base multiplier (`text-size-1-5` = 6px, `text-size-32` = 128px)
- **Line heights** (20): scale from 10px to 144px, named by t-shirt sizes (`line-height-6xs` through `line-height-11xl`)

**No composite text styles** — font-family, size, weight, and line-height are independent primitives. Components assemble them manually.

**Takeaway for pipeline:** This is a trade-off. Independent primitives give maximum flexibility but risk mismatched combinations. Our pipeline currently creates composite text styles (heading-xl, body-md, etc.) which is safer for automated building. We should keep composite styles but ensure the underlying variables match this granular structure.

### Radius Tokens

13 variables in two groups:
- **Raw scale** (10): `radius-none` (0) through `radius-4xl` (24), plus `radius-full` (9999)
- **Semantic aliases** (3): `radius-square` → none, `radius-curved` → sm (4), `radius-round` → full (9999)

**Takeaway for pipeline:** Components bind to semantic aliases (`radius-curved`), not raw values. This allows global radius changes. Our pipeline should create both the raw scale AND semantic aliases.

---

## 3. Component Architecture Patterns

### Universal Breakpoint Variant

**Every component** at every tier has a `Breakpoint: Desktop | Mobile` variant property. This is the primary responsive mechanism — not fluid resizing, but explicit variant switching with fixed dimensions per breakpoint.

| Breakpoint | Typical Section Width | Card Width | Button Padding |
|------------|----------------------|------------|----------------|
| Desktop | 1440px | 500px | 20px horizontal, 12px vertical |
| Mobile | 375px | 300px | 16px horizontal, 8px vertical |

**Takeaway for pipeline:** We should always include a Breakpoint variant. This is more predictable than trying to make components fluid with min/max constraints. The `Breakpoint` prop cascades down — sections pass it to blocks, blocks pass it to atoms.

### Variant Property Decision Framework

From analyzing all components, here's how Shopify theme settings map to Figma component properties:

| Theme Setting Type | Figma Property Type | Examples |
|-------------------|-------------------|---------|
| Layout choices (columns, alignment) | **VARIANT** | `columnsDesktop: "2"/"3"/"4"`, `Text Alignment: "Left"/"Center"/"Right"` |
| Structural modes (size, fullwidth) | **VARIANT** | `Height: "Small"/"Medium"/"Large"`, `Full width: "Yes"/"No"` |
| Interactive states | **VARIANT** | `State: "Default"/"Hover"/"Active"/"Focus"/"Disabled"` |
| Show/hide toggles | **BOOLEAN** | `Show Caption`, `Show Button`, `Filter`, `Sort Options` |
| Editable text content | **TEXT** | `productName`, `vendorName`, `Header`, `Caption` |
| Swappable sub-components | **INSTANCE SWAP** | `iconRSwap` (icon slot in buttons) |
| Color scheme | **VARIABLE MODES** | Never a variant — always mode-switched |
| Responsive breakpoint | **VARIANT** | `Breakpoint: "Desktop"/"Mobile"` |

**Key insight:** Color scheme is NEVER a variant. It's always handled via variable modes. This prevents variant explosion (12 schemes × N variants would be unmanageable).

### Inverted Color Pattern

Rather than separate light/dark component variants, atoms use an `Inverted: Yes/No` boolean that swaps `primary` and `secondary` color roles. This keeps the component count manageable while supporting both dark-on-light and light-on-dark contexts.

**Takeaway for pipeline:** When building components that appear over images or colored backgrounds, include an `Inverted` boolean rather than duplicating the entire component.

### Composition Over Duplication

The hero section is a thin shell that composes a `text` sub-component (which itself composes `button-group` → `button` → icons). Content properties are NOT duplicated on the parent — they flow through `componentPropertyReferences`.

```
hero (shell — only structural variants)
  └── layout (frame with background)
        └── text (instance — owns all content props)
              ├── caption (boolean toggle + text prop)
              ├── header (boolean toggle + text prop)
              ├── body (boolean toggle + text prop)
              └── button-group (boolean toggle)
                    └── button (instance swap for icon)
```

**Takeaway for pipeline:** Sections should be thin wrappers. Content properties live on the innermost component that owns the content. Use `componentPropertyReferences` to bubble them up to the section level.

### Slot/Block Architecture for Product Cards

The `product-card` uses a placeholder pattern that mirrors Shopify's block system:
- Ships with 4 `product-card-block` slots set to "Placeholder" type (dashed borders)
- Designers swap each slot to the desired block type: Name, Price, Vendor, Swatch, Button
- The `product-card-block` component set has a `type` variant that renders completely different content per type

**Takeaway for pipeline:** For components with Shopify blocks (product cards, custom content sections), create a block component set with a `type` variant for each block type, and use placeholder instances in the parent.

### Grid Layout = Explicit Rows

Product grids use manually constructed `row` frames (horizontal auto-layout, FILL children, fixed gap) stacked vertically. There's no CSS-grid-like wrapping — column count is controlled by which variant is selected.

**Takeaway for pipeline:** When building grid sections, create explicit row frames rather than trying to simulate CSS grid. Each row is a horizontal auto-layout frame with N card instances set to FILL.

---

## 4. Section-Level Patterns

### Full-Width Toggle

The hero's `Full width: Yes/No` variant works by:
- **Yes:** Root has zero padding. Background image covers edge-to-edge.
- **No:** Root gets horizontal padding (40px). Inner layout frame gets rounded corners. Creates a "contained" look.

This is a common pattern across sections — the toggle controls section padding, not the content itself.

### Height as Variant, Not Property

Section heights are explicit variant options (Xsmall/Small/Medium/Large) with fixed pixel values per breakpoint:
- Desktop: 400/600/800/1000px
- Mobile: 250/350/450/550px

This is more predictable than fluid heights and matches how Shopify themes implement height settings (predefined options, not arbitrary values).

### Text Alignment as Spatial Positioning

The hero has 6 alignment options: `Center Left`, `Center`, `Center Right`, `Bottom Left`, `Bottom Center`, `Bottom Right`. These control BOTH:
1. The auto-layout alignment of the content frame (`primaryAxisAlignItems`, `counterAxisAlignItems`)
2. The text alignment within the text block

**Takeaway for pipeline:** When a section has "position" or "alignment" settings, implement them as combined spatial + text alignment, not just `text-align`.

### Section Spacing Tokens

All sections use dedicated section-spacing variables for their outer padding:
- `section-spacing-(horizontal)/px-desktop` and `px-mobile`
- `section-spacing-(vertical)/py-desktop` and `py-mobile`
- `layout-spacing/desktop` and `mobile` for internal gaps

This ensures consistent spacing across all sections without hardcoding.

### Boolean Toggles for Optional Sections

Complex sections like `product-grid` use multiple boolean properties to toggle optional areas:

| Boolean | Controls |
|---------|---------|
| `Filter` | Sidebar filter panel visibility |
| `Collection Header` | Header + dividers visibility |
| `Sort Options` | Sort bar visibility |
| `Subcollections` | Subcollection row visibility |

**Takeaway for pipeline:** Map Shopify section settings with `type: checkbox` or visibility toggles to Figma boolean properties. This is more maintainable than creating separate variants for every show/hide combination.

---

## 5. Atom Design Patterns

### Button Anatomy

The button is the most complex atom, with 40 variants across 5 properties:
- `Breakpoint`, `Inverted`, `Transparent`, `State` (5 states)
- Plus instance swap for trailing icon with boolean visibility toggle

Interactive states use alpha color overlays:
- Default: `primary/100%` background
- Hover: `primary/100%` + `primary/8%` overlay
- Active: `primary/100%` + `primary/16%` overlay
- Focus: `accent/focus` ring at `size-0-75` (3px)
- Disabled: `primary/20%` fill, `primary/50%` text

### Badge Simplicity

Badges are the simplest atom — just a flex container with text. No instance swaps, no boolean toggles. The `Type` variant (Sale/Sold out/Metafield/Blank) changes the text and color.

**Takeaway for pipeline:** Not every atom needs to be complex. Simple components with just variant switching are fine when there's no interactive or compositional complexity.

### Icons as Flat Components

101 standalone icon components (not in a component set), all at 24×24px. Named `icon/slash-name`. No variants, no nesting — just vector shapes.

**Takeaway for pipeline:** Icons should be simple flat components under a shared namespace. They're consumed via instance swap properties in other components.

### Price Component

The `price` atom demonstrates selective complexity:
- `Sale: Yes/No` toggles the savings display
- `Savings style: Amount/Percent` switches between "$X off" and "X% off"
- `Show cents as superscript: Yes/No` — uses mixed font sizes within a single text node

**Takeaway for pipeline:** Map specific Shopify settings to specific variant properties. Not every setting needs representation — focus on the ones that change the visual structure.

---

## 6. Anti-Patterns to Avoid

### Found in the analyzed file:

1. **Empty/dead collections** — `.Default Scheme` and a separator collection exist but are empty. Clutter.
2. **Unnamed variant mode** — `.Scheme Group 1` mode "3" has no descriptive name while all others do.
3. **Hardcoded values breaking alias chains** — Button mobile padding is hardcoded to 0 instead of aliasing into Size Primitives.
4. **Misleading naming** — "Bold" font weight maps to "Medium" in the actual font. Confusing.
5. **No composite text styles** — All typography is assembled from independent primitives, risking mismatched combinations.
6. **Desktop/mobile as separate variables instead of modes** — Requires manual selection of the correct variable instead of mode-switching. This is a design choice (explicit is better than implicit) but adds cognitive overhead.

### General anti-patterns to guard against:

7. **Variant explosion** — Avoid creating separate variants for every combination. Use boolean props for toggles, instance swaps for icons, and variable modes for color schemes.
8. **Deep nesting without purpose** — If a sub-component is only used once, it may not need to be a separate component. The file's `text` block is justified because it's reused across hero, rich text, media with text, etc.
9. **Over-abstracting atoms** — Not every element needs a component. Dividers and simple text nodes can be plain frames.

---

## 7. Recommendations for Our Pipeline

### Variable Generation (`/build-foundations`)

1. **Always generate alpha variants** for scheme colors: 100%, 90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 16%, 12%, 8%, 4%, 0%
2. **Create semantic radius aliases** (square/curved/round) in addition to the raw scale
3. **Include section-spacing and layout-spacing tokens** as dedicated variable groups
4. **Keep composite text styles** but ensure underlying variables match the granular structure

### Component Proposal (`/propose-components`)

1. **Always include Breakpoint variant** (Desktop/Mobile) on every component
2. **Map settings to property types** using the decision framework in section 3
3. **Never make color scheme a variant** — always use variable modes
4. **Use dot prefix** for internal sub-components
5. **Use `-group` suffix** for layout wrappers
6. **Propose placeholder/slot patterns** for components with Shopify blocks

### Component Building (`/build-components`)

1. **Sections should be thin wrappers** — delegate content to block-level sub-components
2. **Use componentPropertyReferences** to bubble up content props from nested instances
3. **Build grids with explicit row frames**, not wrap-based layouts
4. **Include Inverted boolean** for components that appear over images/colored backgrounds
5. **Use alpha color variants** for all interactive states (hover, active, disabled, focus)
6. **Bind all spacing to variables** — never hardcode pixel values on padding/gap
7. **Set icons as instance swap properties** with boolean visibility toggles

### Page Composition (`/compose-page`)

1. **Use section-spacing tokens** for consistent vertical rhythm between sections
2. **Set scheme modes on section frames** to achieve different color treatments per section
3. **Full-width vs contained** is a padding toggle on the root section frame

---

## 8. Gap Analysis: Their System vs Our Pipeline

This section compares how the analyzed design system ("theirs") implements each pattern versus how our skills (`/build-foundations`, `/propose-components`, `/build-components`, `/compose-page`) define the same pattern. It's organized into two lists: things we should definitely adopt, and things where both approaches have trade-offs.

---

### 8A. Things We Should Adopt

These are patterns where their approach is clearly better or fills a gap in ours.

#### 1. Granular alpha color variants (14-step scale)

- **Theirs:** Every scheme color has 14 alpha variants (100%, 90%, 80%, 70%, 60%, 50%, 40%, 30%, 20%, 16%, 12%, 8%, 4%, 0%). These drive interactive states: hover (8%), active (16%), disabled (20%), borders (12%), focus rings.
- **Ours:** We create alpha variants only where scheme colors happen to use them (Step 3.5 in `/build-foundations`). We don't generate a systematic scale — we only create what the scheme data requires.
- **Gap:** Our components lack the intermediate alphas needed for hover/active/disabled states. When `/build-components` builds a button, it has no `Primary/8%` variable to use for the hover overlay.
- **Action:** Generate a standard alpha scale (at minimum: 8%, 12%, 16%, 20%, 30%, 50%) for both Primary and Secondary colors, regardless of whether the scheme data explicitly uses them. The scheme-driven alpha variants from Step 3.5 remain, but the standard scale fills the interactive-state gap.

#### 2. Semantic radius aliases

- **Theirs:** Three semantic aliases (`radius-square` → 0, `radius-curved` → 4, `radius-round` → 9999) on top of the raw scale. Components bind to the semantic alias, not the raw value.
- **Ours:** We create named radii per component (`radius/button-primary`, `radius/input`, `radius/badge`) but no abstract semantic aliases.
- **Gap:** If a client wants to change all "slightly rounded" elements at once, they'd need to update each component-specific variable individually.
- **Action:** Add semantic aliases (`radius-square`, `radius-curved`, `radius-round`) and make component radii alias into them where appropriate (e.g., `radius/button-primary` → `radius-curved`).

#### 3. Section-spacing and layout-spacing tokens

- **Theirs:** Dedicated variable groups: `section-spacing-(horizontal)/px-desktop`, `px-mobile`, `py-desktop`, `py-mobile`, plus `layout-spacing/desktop`, `layout-spacing/mobile`, `grid-spacing/desktop`, `grid-spacing/mobile`.
- **Ours:** We create a flat spacing scale (`spacing/4`, `spacing/8`, etc.) and a `layout/page-width` variable, but no semantic section-spacing or layout-spacing tokens.
- **Gap:** Section padding is either hardcoded from reference capture or uses generic spacing tokens. There's no single variable to adjust "all section horizontal padding" globally.
- **Action:** Add semantic spacing tokens for section padding (horizontal/vertical × desktop/mobile) and layout/grid gaps. These alias into the raw spacing scale.

#### 4. Dot prefix for private sub-components

- **Theirs:** Internal sub-components use a `.` prefix (`.button-hotspot`, `.cart-item`, `.social-icon`). These don't appear in the Figma assets panel for consumers.
- **Ours:** No naming convention for private vs public components. Everything is equally visible.
- **Action:** Adopt the dot prefix for section-specific blocks and internal helpers that shouldn't be independently dragged from the assets panel.

#### 5. `-group` suffix for layout wrappers

- **Theirs:** Layout wrappers that arrange multiple instances of an atom use `-group` suffix (`button-group`, `badge-group`, `swatch-group`).
- **Ours:** No naming convention for layout wrappers.
- **Action:** Adopt `-group` suffix when building wrappers in `/build-components`.

#### 6. Instance swap properties with boolean visibility for icons

- **Theirs:** Buttons expose `iconRSwap` (instance swap) + `showIconR` (boolean). The icon slot is swappable and independently toggleable.
- **Ours:** `/build-components` mentions using atom instances but doesn't define instance swap properties or boolean visibility toggles on parent components.
- **Action:** When building atoms with optional icon slots, expose them as instance swap + boolean pairs. Define this pattern in `/build-components`.

#### 7. Inverted color pattern

- **Theirs:** Atoms have an `Inverted: Yes/No` boolean that swaps primary/secondary roles. Used for components over images or dark backgrounds.
- **Ours:** We handle color via scheme modes on section frames, but atoms don't have an inverted toggle.
- **Gap:** A button inside a dark hero section relies on the parent's color scheme mode to look correct. If the scheme doesn't perfectly invert all colors (e.g., subtle alpha values), the button may look wrong.
- **Action:** Add `Inverted` boolean to key atoms (Button, Badge, Text Link) that may appear over both light and dark backgrounds.

#### 8. Composition via componentPropertyReferences

- **Theirs:** Sections are thin shells. Content properties (text, toggles) live on inner sub-components and bubble up via `componentPropertyReferences`. The hero doesn't duplicate the text block's properties.
- **Ours:** `/build-components` doesn't mention `componentPropertyReferences`. Properties would need to be set by drilling into nested instances.
- **Action:** Document and implement `componentPropertyReferences` so section-level properties can be edited from the top level without expanding nested instances.

---

### 8B. Trade-Offs: Their Approach vs Ours

These are areas where both approaches are valid. Each has pros and cons.

#### 1. Responsive: Breakpoint variant vs separate components

**Theirs:** Every component has a `Breakpoint: Desktop | Mobile` variant. One component set, two variants. Desktop hero = 1440×800px, mobile hero = 375×450px.

**Ours:** Desktop and mobile are separate components. `Hero` at 1440px and `Hero / Mobile` at 390px. Placed side by side on the same page.

| | Breakpoint variant (theirs) | Separate components (ours) |
|---|---|---|
| **Pros** | Single source of truth — one component to update. Switching between breakpoints is a property toggle. Fewer items in the assets panel. Compatible with Figma Sites auto-switching. | No variant explosion (N variants × 2 breakpoints). Mobile can have completely different structure/hierarchy without forcing a shared layer tree. Easier to compare visually side-by-side. |
| **Cons** | Doubles the variant matrix (e.g., 9 layout variants × 2 breakpoints = 18). Forces desktop and mobile to share the same layer tree, even when mobile restructures significantly (e.g., stacked vs side-by-side). Changes to one breakpoint can accidentally affect the other. | Two components to maintain — changes must be applied twice. No single "switch" to preview mobile. More items in assets panel. Not compatible with Figma Sites auto-switching. |
| **Best when** | Structure is identical across breakpoints (same children, same hierarchy, just different sizes/spacing). Works well for atoms and simple blocks. | Mobile has fundamentally different layout (e.g., hero changes from overlay text to stacked text, grid goes from 4-col to 1-col with different card layout). Common for sections. |

**Our research conclusion** (from `docs/responsive-component-architecture-research.md`): Use a hybrid — variables/modes for spacing differences, viewport variants only when structure is shared, separate components when mobile is structurally different. Our current pipeline defaults to separate components always, which is the safest default but may over-split simple atoms.

**Consideration:** We could make this configurable per component in `/propose-components`. Atoms and simple blocks → breakpoint variant. Sections with structural changes → separate components.

#### 2. Color system: Two-tier alias chain vs flat schemes

**Theirs:** Two-tier system: `.Color Schemes` (3 group modes) → `.Scheme Group 1/2/3` (4 modes each) = 12 possible themes. Complex but powerful.

**Ours:** Single `Color Schemas` collection with one mode per scheme. Direct aliases from semantic variables to Theme Colors / Grey Scale base variables. Simpler, flatter.

| | Two-tier (theirs) | Flat schemes (ours) |
|---|---|---|
| **Pros** | 12 themes from 7 collections. Adding a new palette only requires adding a mode to one group. Scales elegantly for multi-brand or heavy theming. | Simple to understand and debug. One collection, one mode per scheme. What you see is what you get. Directly mirrors Shopify's scheme structure. |
| **Cons** | Complex to set up and maintain. Debugging which mode resolves to which color requires tracing two alias levels. Harder for an automated pipeline to generate correctly. | Adding a new theme requires adding a full new mode with all semantic mappings. Doesn't scale as elegantly for 10+ themes. |
| **Best when** | The brand needs many theme combinations (e.g., seasonal campaigns, sub-brands). The system is maintained by experienced designers. | The system maps 1:1 to Shopify color schemes (typically 4-8). The priority is simplicity and debuggability. |

**Our position:** Our flat approach matches Shopify's actual scheme model more closely. Each Shopify color scheme = one mode. This is correct for our use case. The two-tier system is overkill unless the client has 10+ brand variants.

#### 3. Typography: Independent primitives vs composite text styles

**Theirs:** 51 independent variables (font-family, font-weight, text-size, line-height as separate variables). No composite text styles. Components assemble typography from individual variables.

**Ours:** Composite text styles (`Heading/H1`, `Body/Paragraph`, etc.) with font-size bound to a Typography variable. Line-height set directly as percentage. Font-family and weight baked into the style.

| | Independent primitives (theirs) | Composite text styles (ours) |
|---|---|---|
| **Pros** | Maximum flexibility — can mix any family with any size with any weight. Changes to one dimension don't require updating text styles. Good for systems with many typography permutations. | Consistent, pre-validated combinations. Impossible to accidentally pair a heading font with body sizing. Text styles appear in Figma's style picker for easy application. Easier for designers to apply. |
| **Cons** | No guardrails — any combination is possible, including wrong ones. Components must correctly assemble 4+ independent values. No text style picker in Figma. | Less flexible — adding a new combination requires creating a new text style. Font-family changes require updating every style (though this is scriptable). More text styles to manage (we create desktop + mobile × font roles). |
| **Best when** | The system needs many ad-hoc typography combinations, or the theme frequently changes font pairings. | The typography system is well-defined (as in Shopify themes with preset levels) and consistency is more important than flexibility. |

**Our position:** Composite text styles are better for our use case. Shopify themes define a fixed set of presets (h1-h6 + paragraph), and we want designers to pick from a curated list, not assemble typography from parts.

#### 4. Spacing: Separate desktop/mobile variables vs responsive modes

**Theirs:** Desktop and mobile spacing are separate named variables (`px-desktop`, `px-mobile`, `gap-size-desktop`, `gap-size-mobile`). Components must reference the correct one explicitly.

**Ours:** Single spacing scale, no desktop/mobile distinction in variables. Spacing values come from reference capture measurements and are applied per-component at build time.

| | Separate variables (theirs) | Single scale + build-time values (ours) |
|---|---|---|
| **Pros** | Explicit — clear which value applies where. Changing all desktop section padding is one variable edit. Theme profile can define exact desktop/mobile token pairs. | Simpler variable structure. No risk of accidentally using a desktop token in a mobile component. Spacing comes from the actual live store, so it's always accurate. |
| **Cons** | Components must pick the right variable — easy to use `px-desktop` in a mobile context. More variables to manage. Manual binding. | No single lever to adjust "all mobile padding" globally. Spacing is baked at build time, not token-driven. Harder to make sweeping spacing changes later. |
| **Best when** | The system needs global spacing control and the team wants to adjust all desktop/mobile padding from one place. | Accuracy to the live store is the priority, and global spacing overrides aren't a common workflow. |

**Consideration:** We could adopt semantic section-spacing tokens (see 8A item 3) without going full separate-variables. Create `section-padding/horizontal` and `section-padding/vertical` tokens with desktop/mobile values, and bind section components to them. This gives the global control lever without the full complexity.

#### 5. Grid layout: Explicit rows vs native Grid/wrap

**Theirs:** Product grids use manually constructed `row` frames — horizontal auto-layout with N cards per row, stacked vertically. Column count is controlled by variant.

**Ours:** `/build-components` recommends native Grid layout (`layoutMode = "GRID"`) with fallback to wrap layout.

| | Explicit rows (theirs) | Native Grid (ours) |
|---|---|---|
| **Pros** | Predictable — each row is a known entity. Easy to control exact card placement. Works reliably with all Figma features. No Grid-mode bugs. | Less code — Grid handles row wrapping automatically. Changing column count is a single property change. Matches CSS Grid mental model. |
| **Cons** | Verbose — adding/removing items requires restructuring rows. Changing column count means rebuilding the row structure. More frames in the layer panel. | Figma's Grid mode is relatively new and may have quirks. Fallback to wrap mode has its own sizing gotchas (`layoutGrow` and `FILL` don't work on wrap children). |
| **Best when** | Reliability is critical and the grid content is static (e.g., product cards in a design system preview). | The grid needs to be flexible, and the builder is comfortable handling Grid-mode edge cases. |

**Our position:** Native Grid is the right default for our automated pipeline — it's less code and more maintainable. Keep the wrap fallback for edge cases. The explicit-rows approach is better for hand-built files where each row might differ.

#### 6. Property bubbling: componentPropertyReferences vs drill-down

**Theirs:** Section-level properties are defined on inner sub-components and bubbled up via `componentPropertyReferences`. Editing "Header text" on a hero instance edits the nested text block's header.

**Ours:** Not explicitly defined. Properties would need to be accessed by expanding nested instances.

| | Property references (theirs) | Drill-down (ours) |
|---|---|---|
| **Pros** | Clean UX — all editable properties visible at the top level. Designers don't need to expand instances. Feels like editing a single component. | Simpler to build programmatically — no reference wiring needed. Each component is self-contained. Less risk of reference breakage. |
| **Cons** | Complex to set up programmatically — requires mapping property IDs between parent and child. References can break if the child component's properties change. | Worse designer UX — must expand nested instances to edit text. Easy to miss a nested property. Feels fragmented. |
| **Best when** | The system is for designers who need fast, top-level editing. Sections have many editable text fields. | The system is primarily for reference/documentation, and designers will detach instances for customization. |

**Note:** This is listed as 8A item 8 (should adopt), but the implementation complexity is significant. It's worth adopting for key sections (hero, media-with-text) where the UX benefit is clearest, rather than trying to wire every property.

#### 7. Variant depth: Full state matrix vs minimal variants

**Theirs:** Button has 40 variants (Breakpoint × Inverted × Transparent × State with 5 states). Hero has 96 variants (Breakpoint × Full-width × Height × Text-alignment).

**Ours:** `/propose-components` recommends only Tier 1-2 settings as variants (layout, alignment, media position). States (hover, active, disabled) and toggles (show/hide) are not mentioned as variant candidates.

| | Full state matrix (theirs) | Minimal variants (ours) |
|---|---|---|
| **Pros** | Complete prototyping support — designers can show hover states, disabled buttons, etc. Every visual state has a real component. Useful for handoff to developers. | Far fewer variants to build and maintain. Faster pipeline execution. Less variant noise in the properties panel. |
| **Cons** | Massive variant count (40 buttons, 96 heroes). Slow to build programmatically. Many variants may never be used in compositions. | No hover/active states — prototyping is limited. Developers can't see what a disabled button looks like without asking. |
| **Best when** | The design system is actively used for prototyping and developer handoff. Interactive states matter. | The design system is primarily for layout and composition planning. Interaction design happens in code, not Figma. |

**Our position:** Start minimal. Our pipeline is about layout composition, not interaction prototyping. Interactive states can be added later for specific atoms (Button) if the client needs them. Adding states to sections (hero hover?) is almost never useful.
