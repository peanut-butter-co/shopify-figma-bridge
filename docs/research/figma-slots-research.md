# Figma Slots: Comprehensive Research

> Distilled from official Figma docs and expert practitioners: Joey Banks, Ridd, Alice Packard, Nathan Curtis, Luis Ouriach, Christine Vallaure, and Murphy Trueman.

---

## 1. What Are Slots

**A slot is a designated place inside a component where custom content can be inserted — an intentional opening in a component's hierarchy to allow custom variation.** (Nathan Curtis)

Slots are flexible areas added to components that let designers freely add and arrange content directly inside an instance without detaching it, while maintaining adherence to the design system.

### The Problem They Solve

Before native slots, designers faced a painful choice:

- **Detach the instance** to customize content (losing all future updates from the library)
- **Hack it** with instance swap properties inside components (functional but not clean or scalable)
- **Over-configure** with dozens of boolean/enum props to cover every possible layout ("scrollbar of shame")

As Christine Vallaure puts it: slots mean "no more slot component hacks" — they represent "a big step toward truly composable design systems in Figma."

Murphy Trueman frames it as a paradox: **loosening control actually increases system effectiveness.** Tight governance doesn't prevent workarounds — it encourages them. When components are overly rigid, designers either detach or compromise their designs to fit available variants.

### The Paradigm Shift

Slots move design systems from **configuration** (props-driven) to **composition** (content-driven):

| Before Slots | With Slots |
|---|---|
| Toggle visibility with booleans | Add/remove content freely |
| Enumerate every layout variant | Compose layouts on the fly |
| Monolithic supercomponents | Smaller, focused subcomponents |
| System-driven configuration | User-driven composition |

---

## 2. How Slots Work in Figma

> Slots are currently in **open beta**. Changes, bugs, or performance issues are expected.

### Three Ways to Create a Slot

**Method 1 — Convert Frame to Slot**
Select a nested frame in a main component:
- Right-click > "Convert to slot"
- Shortcut: `Cmd+Shift+S` (Mac) / `Ctrl+Shift+S` (Win)
- Or use the right panel button

**Method 2 — Wrap Objects in New Slot**
For non-frame objects (text, groups, instances, multiple selections):
- Right-click > "Wrap in new slot"
- Automatically creates a slot property

**Method 3 — Create Property Then Assign**
From the right panel:
- Click "Create property" > select "Slot"
- Configure name, documentation, and preferred instances
- Later assign to frames via dropdown

### Slot Capabilities

Slots inherit frame properties:
- Horizontal/vertical auto layout
- Min/max dimensions
- Color fills and effects
- Variables
- Default content (can be empty or pre-populated)

### Working with Slots in Instances

**Adding content:**
- Drag from canvas or Assets panel
- Hover over slot > click "Add instances" for filtered list
- Duplicate layers within the slot
- Use any design tool directly

**Reset operations:**
- **Reset slot**: Reverts overrides to main component state
- **Delete contents**: Removes all layers for fresh start

### Constraints & Limitations

- Cannot bind a slot property to top-level component layers
- Slots apply to **nested layers** within main components or variants
- Use multi-edit to apply slots across variants simultaneously
- **Removing a slot property is destructive** — instances with modifications revert to defaults. Test removal in branches first.

### Preferred Instances

Setting preferred instances allows teams to curate which components appear when adding assets to a slot. This reduces guesswork by guiding designers toward recommended or commonly used components.

### Code Connect

Code Connect maps structured slot content into code examples, representing flexible child content (text, layers, nested components) in code snippets — bridging design to development.

---

## 3. Slot Types & Patterns

Nathan Curtis identifies five distinct slot categories:

### General Slots
Default slots for main component content, corresponding to `children` in code. Examples: Modal body, Card body — areas where designers customize internal structure.

### Named Slots
Multiple designated areas within a component for distinct content types. Example — a Row component with:
- `leading visual` (left)
- Default content (middle)
- `trailing actions` (right)

Named slots prevent "avoidable brittleness" from excessive property configurations.

### Slots for Repeating Items
Groups of predictable, identical children: Checkbox Group, Tabs, Breadcrumbs, Button groups. These accommodate indeterminate quantities of a single component type.

### Nested Slots
Multi-level slot relationships spanning beyond two hierarchical levels. An Action List might contain Group Headers and Items, with Items themselves containing leading/trailing visual slots.

### Higher-Order Layout Slots
Slots applied to page-level components and layout patterns, enabling composition across entire template hierarchies rather than isolated components.

---

## 4. Implementation Guide

Nathan Curtis outlines a three-phase approach for adopting slots in an existing library:

### Phase 1: Discovery

**Component Audit**
Systematically inventory all Figma assets, cataloging:
- Component name and hierarchy
- Compositional role (root vs. header/body/footer/actions)
- Existing instance swap properties
- Variant-specific slots
- Nested composability
- Full props inventory (what to keep vs. remove)

Curtis provides a [reference Google Sheet](https://docs.google.com/spreadsheets/d/1creGsbaqWyYbMa8jH6DFKv6DlbWlkQebUB7LPsH7kok/edit?usp=sharing) for structuring audit data.

**Comparative Research**
- Align with existing code implementations
- Study public libraries with strong composition patterns (GitHub Primer, MUI React)

**Exploration**
Create a dedicated Figma exploration file with:
- **Examples section**: 4-6 instances per pattern, annotate slot areas in magenta
- **Alternatives section**: 2-3 architectural variations per pattern
- **Periphery**: Open questions, recommended decisions

### Phase 2: Decisions

**Define the Slot Approach per Component:**

| Approach | Description |
|---|---|
| Slot, empty default | No initial content |
| Slot, with default content | Pre-populated starting state |
| Config-first + custom escape hatch | Props bind to layers; slot enables override |
| Named slot, always visible | Permanent, unfoldable |
| Named slot with visibility prop | Conditional display |
| Items slot | For repeating content |
| Subcomponent, no slot | Legacy or simple structures |
| Subcomponent with slot | Nested composability |
| No slot | End-of-life / deprecation |

**Naming Conventions:**
- Default slots: `children`, `items`, or semantic names
- Named slots: explicit identifiers (`startVisual`, `endVisual`)

**Default Content Strategy:**
- `none` — empty by default
- `uniform` — consistent across all variants
- `varying` — different defaults per variant

**Permissiveness Levels:**
- **Closed**: Restrict to specific child component types
- **Open**: Use preferred values for guidance without enforcement
- **Bounds**: Define `minItems` and `maxItems` constraints

**Layout Configuration:**

Set:
- Direction (horizontal/vertical)
- Resizing behavior (fixed/fill/hug)
- Item spacing (gap)

Do NOT set:
- Visual styles on slots (color, corners, strokes)
- **Padding on the slot layer** — if internal padding is needed, nest the slot within a containing frame

### Phase 3: Implementation

**Branching Strategy:**
- One branch per component
- Batch similar-pattern components for simultaneous conversion

**Complexity Ordering:**
- **Early**: Simple components (Button, Pill, Alert)
- **Later**: Deeply nested structures (Action List with Item/StartVisual/Text/EndVisual)

**Per-Component Workflow:**
1. Define slot approach
2. Set slot properties (name, default content, permissiveness)
3. Configure layout (direction, spacing, resizing)
4. Refactor props (remove obsolete instance swaps)
5. Build test examples
6. Align with code
7. Review & adjust

---

## 5. Configuration Collapse

A companion concept from Nathan Curtis: as slots increase, many props become unnecessary.

### Props Targeted for Removal

| Category | Examples | Replacement |
|---|---|---|
| **Visibility props** | `showIcon`, `hideDescription`, `actionsVisible` | Designers add/remove in slots |
| **Layout props** | Padding, direction, resizing controls | Slot layout handles it |
| **Visual hack props** | Single-element color, corner radius, border | Composed subcomponents |
| **Complex config** | `actionsCount`, multi-level hierarchies | Simpler slotted subcomponents |

### The Guiding Principle

> "Make the common configurable, make the uncommon composable."

**Retain:** Behavioral and foundational props (`state`, `appearance`, `size`)
**Remove:** Structural noise from the configurable surface
**Provide:** Rich examples showing common composition patterns

### Real-World Examples

- **Pill**: Collapsed visibility props (`Start Visual Visible`, `End Visual Visible`) by nesting visuals in a children slot, eliminating type variants entirely
- **Alert**: Removed `Body` and `Text` subcomponents; placed all elements in a single slot with pre-made layouts
- **Card**: Hollowed into an unopinionated container, letting teams build purpose-driven extensions

---

## 6. Expert Perspectives

### Alice Packard — Placeholders Philosophy

Packard prefers the term "placeholder" over "slot" — the latter suggests rigid holes, whereas Figma's implementation is flexible and responsive. She uses the scissors glyph (&#x2702;) to represent the "removal" needed to swap components.

**Key recommendations:**
- **Auto layout is mandatory** for all placeholder components
- **Keep unpublished**: Prefix with `.` or `_` to prevent publication to the asset panel
- **Distinctive styling**: Use vibrant neons or unusual visuals so placeholders are clearly temporary
- **Expose nested instances**: Surface properties of swapped components
- **Offer content carriers**: Provide curated swap values to reduce friction

**The Bento-Boxing Anti-Pattern:**
Packard's primary warning — don't cram multiple placeholders into a single component trying to predict every designer need (`placeholder 1`, `placeholder 2`...). This defeats the purpose of flexible systems.

> "Trying to predict every possible way designers might want to customize a component using placeholders is what wastes time. That's like trying to look into a crystal ball."

**Strategic placeholders** grounded in actual team needs are valuable; speculative ones are not.

**Container Framework (via Nathan Curtis):**
Curtis identifies four container types: blocks, zones, slots, and substitutions. Packard builds on this, emphasizing that the number of placeholders should reflect documented requirements, not hypothetical scenarios.

### Ridd — Practical Use Cases

Three core use cases for slots:

1. **Content across containers**: Same content in different containers (modals, cards) without duplication
2. **Container flexibility**: Consistent container UI with unlimited content variations inside
3. **Template reusability**: Core page layouts that preserve spacing while accommodating diverse content

**Practical tips:**
- Position the "Slot" component as the first variant so all content options appear in the dropdown
- Build with auto layout and make "fill container" the default for everything
- Include descriptive text within slots to guide team members

### Christine Vallaure — AI Connection

Vallaure positions slots as transformative for both humans and AI:

> "A component with named slots tells an agent exactly what goes where, unlike a detached frame which provides no guidance."

Slots eliminate the need for slot component hacks, offering more flexibility, less detaching, and cleaner handoff — critical for composable design systems.

### Luis Ouriach — System Architecture

As Figma's Design Advocate, Ouriach focuses on:
- **Reducing complexity to encourage adoption** — sometimes less configuration means more usage
- **Staging Libraries**: Team-level extensions of the global system for specific work, which can later be promoted to the global library
- **Structure recommendations** for slot architecture in his community playground files

### Murphy Trueman — The Control Paradox

The governance model must shift with slots:

| Old Model | New Model |
|---|---|
| Gatekeeper role | Boundary definition + trust |
| Approval gates | Clear guidelines |
| "No" orientation | "Here's how" guidance |

**Non-negotiables** (controlled): Brand identity, accessibility, technical specs
**Composable areas** (flexible): Content arrangement, component combinations, layout variations

> "Confidence drives adoption — but it also drives contribution." Systems that empower teams create virtuous cycles.

### Joey Banks — Flexible Components at Scale

Banks, founder of Baseline Design (ex-Webflow, Twitter, Figma), focuses on:
- Design systems at scale with 50+ designer teams
- Knowing **when to create, extend, or break** components for cleaner systems
- Using variables alongside slots to make designs flexible and scalable
- His community file ["Building Flexible Components with Slots"](https://www.figma.com/community/file/969234311094210750) pioneered many patterns before native slot support

---

## 7. Best Practices & Anti-Patterns

### Do

- **Start with high-traffic components**: Dialogs, menus, modals, cards, panels see the biggest wins
- **Include default content** in slots to give designers context — often no edits needed
- **Set preferred instances** to curate what appears in the slot picker
- **Use auto layout everywhere** — slots must be responsive
- **Make fill container the default** for slot children
- **Prohibit padding on slot layers** — nest in a containing frame instead
- **Build rich examples** showing common composition patterns
- **Coordinate layout decisions with dev** for consistent code implementation
- **Test in branches** before publishing, especially when removing slot properties

### Don't

- **Don't bento-box** — cramming speculative placeholders for every hypothetical need
- **Don't set visual styles on slots** (color, corners, strokes)
- **Don't one-to-one replace** instance swaps with slots — rethink composition holistically
- **Don't rush to publish** — pilot many components before mass release
- **Don't skip the audit** — discovery and decisions phases prevent costly mid-implementation pivots
- **Don't add slots everywhere** — focus on components where structure stays consistent but content changes frequently

---

## 8. Slots and AI / Code Alignment

### Code Parity

Slots mirror patterns developers have used for years:

| Platform | Slot Mechanism |
|---|---|
| React | `children` prop, named props (`footer={<Button/>}`) |
| Vue | `<slot>` element, named slots |
| Web Components | `<slot>` HTML element |
| SwiftUI | `@ViewBuilder` closures |

This alignment means designers and developers share mental models — what a designer composes in a Figma slot maps directly to what a developer renders in code.

### AI Readiness

Curtis argues Figma prioritized slots partly because "machines now compose interfaces":

- **Explicit composition** creates readable structure that AI can parse and generate
- **Fewer, predictable patterns** outperform hyper-configuration for AI agents
- Named slots tell an agent **exactly what goes where** (Vallaure)
- Detached frames provide **no structural guidance** for automation

Three converging forces make composable systems essential:
1. **AI integration**: Agents need structured, composable interfaces
2. **Code-to-design workflows**: Emerging tools work best with composable components
3. **Tool evolution**: Variables, Extended Collections, and Slots align design tools with web development

---

## 9. Sources

### Official Figma
- [How to Supercharge your Design System with Slots](https://www.figma.com/blog/supercharge-your-design-system-with-slots/) — Figma Blog
- [Use Slots to Build Flexible Components in Figma](https://help.figma.com/hc/en-us/articles/38231200344599-Use-slots-to-build-flexible-components-in-Figma) — Figma Help Center

### Nathan Curtis
- [Slots in Design Systems](https://nathanacurtis.substack.com/p/slots-in-design-systems) — Substack
- [Implementing Slots in a Figma Library](https://nathanacurtis.substack.com/p/implementing-slots-in-a-figma-library) — Substack
- [Configuration Collapse](https://nathanacurtis.substack.com/p/configuration-collapse) — Substack

### Alice Packard
- [Placeholders Are for People Who Know Trying to Predict the Future is a Losing Game](https://www.alicepackarddesign.com/blog/placeholders-are-for-people-who-know-trying-to-predict-the-future-is-a-losing-game)

### Ridd
- [Slot Components for Dummies](https://typefully.com/ridd_design/slot-components-for-dummies-FvUHl64b0Zsp)

### Christine Vallaure
- [Figma Design System Updates (Schema 2025)](https://christinevallaure.medium.com/figma-design-system-updates-d00ff4288d01)
- [Agentic AI, Design Systems & Figma](https://christinevallaure.substack.com/p/agentic-ai-design-systems-and-figma)

### Murphy Trueman
- [Slots and the Control Paradox](https://blog.murphytrueman.com/slots-and-the-control-paradox/)

### Community Files
- [Building Flexible Components with Slots — Joey Banks](https://www.figma.com/community/file/969234311094210750)
- [Figma Slots Playground — Luis Ouriach](https://www.figma.com/community/file/1610367877471727305)
- [Setting Up Slot Components](https://www.figma.com/community/file/1454741719610424312)

### Material Design
- [Unlocking Component Flexibility with Slots in Figma — M3](https://m3.material.io/blog/material-3-slot-components-figma)
