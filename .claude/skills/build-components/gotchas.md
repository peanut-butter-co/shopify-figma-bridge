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
- Use Mobile text styles (`Heading/H3 / Mobile`, not `Heading/H3`) for all text in mobile components.
- Grid changes: product grids typically go from 4 columns (desktop) to 2 columns (mobile). Always verify from the reference capture.

## Page Layout

- Components must be placed directly on the canvas (not nested in wrapper frames) so they appear correctly in the Figma Assets panel.
- NEVER leave components at default position (0,0) — they will overlap. Always run the page layout arrangement after building all components for a page.
- See `reference/page-layout.md` for the placement algorithm.

## Figma API Gotchas

See `reference/figma-api-gotchas.md` for all Figma Plugin API gotchas including resize() ordering, child sizing, image placeholders, and paint binding.
