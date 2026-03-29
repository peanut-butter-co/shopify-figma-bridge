# Gap Analysis: AgenticUI Design Systems Manual vs Shopify Figma Bridge

**Source:** [AgenticUI Design Systems Manual](https://www.notion.so/Design-Systems-Manual-6b4136bd61e2821d973d01f004af58fa) (agenticui.net)
**Compared against:** Our current bridge implementation (PR #5) + Evil Horizon Figma file

---

## Scoring

| Status | Meaning |
|--------|---------|
| ✅ Strong | We do this well, aligned with AgenticUI |
| ⚠️ Partial | We do some of this but gaps exist |
| ❌ Missing | We don't do this at all |

---

## The 10 Laws

| Law | AgenticUI Rule | Our Status | Gap |
|-----|---------------|------------|-----|
| 1. Name every layer semantically | No "Frame 74" — layer names become code identifiers | ✅ Strong | Our components are semantically named. Templates and sections have clear names. |
| 2. Use Figma Variables for everything | Every color, spacing, radius, typography value | ⚠️ Partial | Colors and radius are variable-bound. **Gap: spacing/padding on many components uses raw values, not bound to Spacing primitives.** Typography uses text styles (correct) but font sizes aren't variable-bound. |
| 3. Three-tier token hierarchy | Primitive → Semantic → Component | ⚠️ Partial | We have Primitive → Semantic (2 tiers). **Gap: no component-tier tokens** (e.g., `button.primary.background.hover`). Our semantic tokens serve double duty as component tokens. |
| 4. DTCG W3C format | `.tokens.json` with `$value`, `$type`, `$description` | ❌ Missing | We don't export tokens in DTCG format. No `.tokens.json` file. No Tokens Studio integration. No Style Dictionary pipeline. |
| 5. Structure components atomically | Atoms compose into molecules, not monolithic blobs | ✅ Strong | Our entire system is atomic: atoms → blocks → sections → templates. Instance-only architecture enforced. |
| 6. Map variant props to code props | Figma variant names match code prop names | ⚠️ Partial | Our variant names are semantic (`Style=Primary`, `State=Default`) but **they don't always match the actual Liquid/CSS prop names** in the theme. No formal prop interface mapping. |
| 7. Auto-layout all the things | Every multi-element frame uses auto-layout | ✅ Strong | All components use auto-layout. We enforce this in build-components skill. |
| 8. Name slots explicitly | header, footer, actions, leading-visual, trailing-actions | ❌ Missing | Our content areas are named generically ("Content", "Content Area"). **No slot naming convention.** AI can't reliably map content to regions. |
| 9. Add Code Connect | Link every component to its code implementation | ❌ Missing | We have a mapping table (component → code file) but **no actual Figma Code Connect** set up. Requires Org/Enterprise plan. Our JSON design-rules file is the workaround. |
| 10. Build a `.ai/` directory | Machine-readable generation rules in the repo | ⚠️ Partial | We have `.claude/rules/figma-design-system.md` and `.claude/figma-sync/` which serve a similar purpose. **Not standardized to `.ai/` convention.** Not in DTCG/machine-readable format. |

---

## Three-Tier Token Architecture

| Aspect | AgenticUI Recommendation | Our Implementation | Gap |
|--------|-------------------------|-------------------|-----|
| Tier 1: Primitives | Raw values: `colors.blue.500 = #0052CC` | ✅ `Color/Black/100`, `Color/Brand/Sage`, `Spacing/lg`, `Radius/inputs` | Aligned. Our naming uses `/` groups instead of `.` dots but structure is correct. |
| Tier 2: Semantic | Usage intent: `color.text.interactive` | ✅ `Essential/Text`, `Primary Button/Background`, `Input/Border` | Aligned. Our semantic tokens map to Shopify's `color_scheme_group` roles. |
| Tier 3: Component | Scoped: `button.primary.background.hover` | ❌ Not implemented | **Major gap.** We don't have component-scoped tokens. Button colors come directly from semantic tokens. This means you can't theme a single component independently. |
| DTCG format | `.tokens.json` with `$value`, `$type`, `$description` | ❌ Not implemented | No export pipeline. No `$description` on any variable. |
| Token descriptions | `$description` on every token — machine-readable docs | ❌ Not implemented | **Zero descriptions on any Figma variable.** AI reading our tokens gets values but no usage context. |
| Light/dark modes | Covered in token categories | ✅ | We have 6 color scheme modes (Scheme 1–6) which includes light and dark. |

---

## Component Architecture

| Aspect | AgenticUI Recommendation | Our Implementation | Gap |
|--------|-------------------------|-------------------|-----|
| Atomic hierarchy | Atoms → Molecules → Organisms → Templates → Pages | ✅ Strong | Atoms (Button, Input, Swatch) → Blocks (Product Card, Cart Line Item) → Sections (Hero, Product List) → Templates (Homepage, PDP) |
| Auto-layout default | Every multi-element frame | ✅ Strong | Enforced across all components |
| Build smallest first | Atoms before molecules, never top-down | ✅ Strong | This is our core workflow — "build atoms up, not sections down" |
| Resizing behaviors | Hug for buttons, Fill for sections, Fixed for icons | ⚠️ Partial | Mostly correct but some components have inconsistent sizing (e.g., Button height was 100px FIXED instead of HUG — we fixed this) |
| Layer hierarchy flat | No deeper than 5 levels | ⚠️ Partial | Most components are flat but some composites (Cart Drawer, Product Card) nest 6-7 levels deep |
| Slot naming | header, footer, actions, leading-visual | ❌ Missing | Content areas named "Content", "Content Area", "Product Card Content" — not using the slot convention |
| Min/max constraints | On flexible containers | ❌ Missing | No min/max width constraints on any component. Responsive behavior undefined. |

---

## CBDS (Context-Based Design Systems)

| Aspect | AgenticUI Recommendation | Our Implementation | Gap |
|--------|-------------------------|-------------------|-----|
| What it is | Encoded in component | ✅ | Component names and variant names convey what each is |
| How it behaves | Encoded in variants/states | ⚠️ Partial | We have state variants (Default, Hover, Selected, Disabled) on some components (Size Option, Variant Swatch) but **not all** (Button has no hover/disabled variants) |
| When to use it | Encoded in descriptions/metadata | ❌ Missing | **No component descriptions in Figma.** No usage guidelines, no "when to use" context. AI has no guidance on when to use Button vs Text Link. |
| Context Engineer role | Senior dev who owns system integrity | ⚠️ | This is essentially what we're doing with the bridge — but not formalized as a role |
| 7-step CBDS flow | Design → Lint → Extract → Validate → Test → Layout → Approve | ⚠️ Partial | We have design → build → validate (steps 1, 3, 4). **Missing: linting (step 2), testing (step 5), layout tools (step 6).** |

---

## AI-Ready vs AI-Hostile Patterns

| Pattern | AgenticUI "AI-Ready" | Our Status |
|---------|---------------------|------------|
| Layer names | Semantic (CardHeader, ActionButtons) | ✅ |
| Color values | Variables, never hardcoded | ✅ (post-refactor) |
| Token names | Readable, not truncated | ✅ |
| Variants | Single component set with variant props | ✅ |
| Layout | Auto-layout everywhere | ✅ |
| Documentation | Code Connect + .ai/ directory | ❌ |
| Component size | Atomic, composable | ✅ |
| Token structure | Primitive → Semantic → Component | ⚠️ (missing component tier) |

---

## Summary: Priority Gaps to Close

### High Priority (affects AI code generation quality)

1. **Token descriptions** — Add `$description` to every Figma variable. Zero effort per token, massive impact on AI understanding. E.g., `Essential/Background` should describe: "Primary section background color. Applied to section-level frames. Changes per color scheme."

2. **Component descriptions** — Every Figma component needs a description explaining what it is, when to use it, and how it relates to code. E.g., Button: "Primary CTA button. Maps to `snippets/button.liquid`. Variants: Primary (filled), Secondary (outline). Use for form submits, cart actions, CTAs."

3. **Slot naming** — Rename "Content", "Content Area" to slot names: `header`, `content`, `actions`, `media`, `footer`. Especially important for sections (Hero, Media with Content, Product Card).

### Medium Priority (improves system robustness)

4. **Component-tier tokens** — Add a third variable collection for component-scoped tokens: `button.primary.background`, `card.border.radius`, `input.padding`. Allows per-component theming without touching semantic tokens.

5. **DTCG export** — Add a skill that exports Figma variables to `.tokens.json` in DTCG format with `$value`, `$type`, `$description`. This enables Tokens Studio and Style Dictionary integration.

6. **Variant prop naming** — Audit variant property names against actual Liquid/CSS class names. Ensure `Style=Primary` maps to the actual `.button--primary` CSS class.

7. **Min/max constraints** — Add minWidth/maxWidth to responsive components (buttons, inputs, cards, sections).

### Lower Priority (nice to have, future work)

8. **Code Connect** — Requires Figma Org/Enterprise plan. Our JSON design-rules file is the pragmatic alternative.

9. **`.ai/` directory** — Standardize our `.claude/figma-sync/` to also output to `.ai/` for cross-tool compatibility (Cursor, Copilot, etc.).

10. **Missing component states** — Button needs Hover, Disabled, Loading states. Input needs Focus, Error, Disabled. These states exist in the CSS but not in Figma.
