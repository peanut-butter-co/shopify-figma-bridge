# Build Foundations Gotchas

Known issues and lessons learned from building foundations in Figma.

## Text Style Enforcement

- **EVERY text node must have a `textStyleId`** set to one of the local text styles. No exceptions.
- **EVERY text fill must be bound** to a token variable via `setBoundVariableForPaint`. Hardcoded colors are violations.
- Before creating ANY text node, load the font first: `await figma.loadFontAsync(style.fontName);`

## Mobile Text Styles

- Always create mobile text styles even if desktop and mobile sizes are identical — this allows future per-client customization.
- Mobile style naming: `Heading/H1 / Mobile` (not `Heading/H1/Mobile` — note the spaces around `/`).
- When using font roles, create styles organized by role: `Body/H1`, `Heading/H1`, etc. for all breakpoints.

## Line Height Variables

- Do NOT create line-height variables. The Figma API forces `unit: "PIXELS"` when binding a variable to lineHeight.
- Always set lineHeight directly: `{ value: 110, unit: "PERCENT" }`.

## Variable Creation

- `createVariable(name, collectionObject, type)` — pass collection OBJECT, not ID string.
- Paint `color` objects don't accept `a` (alpha) via `use_figma` — use `opacity` on the paint instead.

## Auto-Layout

- `primaryAxisSizingMode` rejects `"HUG"` — use `"AUTO"` instead.
- `use_figma` requires `blendMode: "NORMAL"` in shadow effects — omitting causes validation error.
- Text nodes in auto-layout: set `layoutSizingHorizontal = "FILL"` + `textAutoResize = "HEIGHT"` AFTER appending to parent.
