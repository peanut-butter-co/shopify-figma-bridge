# Propose Components Gotchas

Known issues and lessons learned from proposing component inventories.

## Mandatory Atom Checklist

- NEVER skip atoms that exist in the theme. Even if they seem trivial (Spacer, Divider), they are critical for the instance-only architecture.
- If a theme scan doesn't find a source file for an atom, mark it as "create from common patterns" — do NOT omit it from the proposal.
- Cross-reference with theme profile's `mandatoryAtoms` list if available.

## Scope Confusion

- "Core pages only" still includes ALL reusable sections (hero, media-with-content, carousels) and structural sections (header, footer). These appear across all page types.
- Only page-specific `main-*` sections for secondary pages get excluded in core-only scope.

## Variant Over-Specification

- Do NOT make `color_scheme` a variant. It is applied via Figma variable modes, not component variants.
- Settings gated by `visible_if` are NOT independent variants — only the parent setting they depend on may be a variant.
- Keep variant combinations manageable: 3x3 = 9 is fine, 5x5x3 = 75 is too many. Flatten or prioritize.
