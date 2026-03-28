# Build Components Gotchas

Known issues and lessons learned from building Figma components.

## Instance Architecture

- **The #1 rule:** Every sub-element that exists as a component MUST be created as an instance, never as an inline frame.
- Before building ANY composite (block or section), list all sub-elements needed. For each, check if the component exists. If yes → instance. If no → build the atom first.
- Inline frames that look like components are the most common violation found by `/validate-instances`.

## Screenshot After Every Step

- NEVER validate at zoomed-out scale — always 100%+ zoom.
- NEVER say "looking good" without actually taking a screenshot and inspecting.
- Screenshot EACH component individually, not the whole page at once.
- If you skip validation on one component, bugs compound in composites that use it.

## Mobile Components

- Mobile components go NEXT TO their desktop counterpart, not in a separate area. 40px gap between them.
- Use Mobile text styles (`Heading/H3/Mobile`, not `Heading/H3`) for all text in mobile components.
- Grid changes: product grids typically go from 4 columns (desktop) to 2 columns (mobile). Always verify from the reference capture.

## resize() Ordering

- `resize()` overrides sizing modes. ALWAYS set sizing modes AFTER `resize()`, not before.
- This is the #1 cause of "height is 1" bugs. If the component height is wrong, check this first.

## Image Placeholders

- Use `constrainProportions = true` on image placeholder frames. Without this, images stay fixed height even when the card shrinks for mobile.
- Never use `layoutMode = "NONE"` for image placeholders — height collapses to 0 in auto-layout parents.

## Child Sizing

- `layoutSizingHorizontal` and `layoutSizingVertical` must be set AFTER `appendChild()`, not before.
- `counterAxisSizingMode` only accepts `"FIXED"` or `"AUTO"` — never `"FILL"`.
