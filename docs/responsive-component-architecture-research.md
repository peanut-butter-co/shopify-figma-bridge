# Responsive Component Architecture in Figma: Desktop vs Mobile

Research conducted 2026-03-27 to evaluate whether desktop and mobile versions of a component should be **variants of the same component set** or **separate components**.

---

## Context

PR #2 proposes a `Viewport=Desktop/Mobile` variant pattern where every desktop section component gets a corresponding mobile variant within the same component set. This research evaluates that approach against industry best practices.

---

## Expert Opinions & Industry Sources

### Luis Ouriach (Figma Design Advocate, FRAILS Framework)

The most authoritative voice on this topic. Key positions:

- **Against mega-variants:** Testing showed nested instances outperform mega-variants in both performance and maintainability.
- **Separate components for structural differences:** "Fully responsive components with layout direction changes per breakpoint aren't natively possible in Figma. Rather than fighting this limitation, embrace separate components for each breakpoint."
- **Adoption over consolidation:** "Never hesitate to create additional components if doing so increases adoption rates. Complexity through excess variants often discourages usage more than thoughtful separation does."
- **Verbosity over conciseness:** Better to have clearly named separate components than one overloaded component set that's hard to navigate.

Sources:
- [Building Components for Consumption, Not Complexity (Part 1)](https://www.smashingmagazine.com/2023/12/building-components-consumption-not-complexity-part1/)
- [Building Components for Consumption, Not Complexity (Part 2)](https://www.smashingmagazine.com/2023/12/building-components-consumption-not-complexity-part2/)

### Alice Packard (Figma Community Expert)

Recommends a layered decision framework:

- **Variables for breakpoints**, not variants. Create a "Breakpoint" variable collection with modes (Desktop/Mobile), bind spacing, font size, and padding to those variables.
- **Variants** reserved for interactive states (hover, active, default) and binary toggles.
- **Separate components** for "major composition changes" and "hierarchy levels."

Source: [When to use variants, component props, variables, or separate components](https://www.alicepackarddesign.com/blog/when-you-should-use-variants-vs-creating-separate-components)

### Figma Official Documentation

Recommends variants of the same component with a breakpoint property, especially for **Figma Sites** where variants auto-switch based on breakpoint names. However, this guidance is primarily about their Sites product and assumes components share similar structure across breakpoints.

Source: [Create a responsive component that automatically adapts to each breakpoint](https://help.figma.com/hc/en-us/articles/31242826664983-Create-a-responsive-component-that-automatically-adapts-to-each-breakpoint)

### Belka Digital

Explicitly rejects multiple variants in favor of a single component using Figma variables:
- "You eliminate the need for countless variants and manual edits."
- Define breakpoints, create variables with modes for each, apply variables to component properties (padding, font size, icon visibility, width).
- Frames viewport variants as the old approach leading to "variant proliferation."

Source: [Why you'll kick yourself for not designing responsive components with Figma](https://www.belkadigital.com/blog/why-youll-kick-yourself-for-not-designing-responsive-components-with-figma)

### Devot (Design Agency)

Advocates **variables with modes** over viewport-specific component variants:
- Single component with variable-driven adaptation.
- Reserve component variants only when complete restructuring is necessary.
- Nested frames inherit the mode from their parent, enabling fully responsive layouts without duplicating artboards.

Source: [Figma Responsive Design Patterns: Variables & Variants](https://devot.team/blog/figma-responsive-design)

---

## How Major Design Systems Handle It

### Shopify Polaris
Uses a **toggle within variants** for small screen adaptation, not separate components. But Polaris is an admin UI with relatively consistent structure across breakpoints, not marketing pages with radically different layouts.

### Material Design 3
Reduced 700+ list variants down to ~45 through aggressive simplification. Uses variables and properties rather than breakpoint variants. Focus is on minimizing variant count.

---

## The Three-Tier Decision Pattern

| Situation | Recommended Approach | Example |
|-----------|---------------------|---------|
| Same structure, different sizing/spacing | **Variables + modes** (no variants needed) | Button, Card, Input |
| Same structure, some layout changes | **Viewport variant** on same component set | Collection Header, Blog Header |
| Fundamentally different layout/hierarchy | **Separate components** | Mobile Hero, Mobile Product Info |

---

## Key Takeaways

1. **Variables + modes is the modern best practice** for components that share structure but differ in sizing/spacing. This avoids variant explosion entirely.

2. **Viewport variants are valid** but only when desktop and mobile share genuinely similar structure (same child count, same hierarchy, just different sizing).

3. **Separate components are the right call** when mobile has a fundamentally different layout, different child count, or different hierarchy. Forcing structurally different designs into one component set adds complexity without benefit.

4. **The text style/fill violation problem is orthogonal** to the component architecture question. Unstyled text and unbound fills can happen whether you use variants, separate components, or inline frames. That's a discipline issue solved by text style enforcement, not by component structure.

5. **Variant explosion is a recognized anti-pattern.** Adding a Viewport dimension multiplies every existing variant combination by 2. If a component already has 3 other variant properties, that's significant bloat.

6. **Adoption matters more than consolidation.** Per Luis Ouriach, if separate components are easier for the team to find, understand, and use correctly, that's the better architecture even if it means some duplication.

---

## Recommendation for This Project

A hybrid approach based on structural similarity:

1. Use **variables/modes** for spacing and typography differences between breakpoints.
2. Use **viewport variants** only where structure is genuinely shared (Collection Header, Blog Header, Search Header, 404 Content).
3. Use **separate components** where mobile is structurally different (Mobile Hero, Mobile Product Info, Mobile Collection List, Mobile Marquee).
4. Treat **text style enforcement** as a separate concern from component architecture.
