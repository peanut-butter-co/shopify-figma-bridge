# Build Foundations Gotchas

Known issues and lessons learned from building foundations in Figma.

## Text Style Enforcement

- **EVERY text node must have a `textStyleId`** set to one of the local text styles. No exceptions.
- **EVERY text fill must be bound** to a token variable via `setBoundVariableForPaint`. Hardcoded colors are violations.
- Before creating ANY text node, load the font first: `await figma.loadFontAsync(style.fontName);`

## Mobile Text Styles

- Mobile text styles are **conditional** — only create them when `foundations.typography.createMobileStyles` is `true`.
- If the theme has no mobile-specific settings (e.g., Horizon uses CSS `clamp()` for responsive scaling) and the user declined mobile styles, do NOT create them. Duplicate styles with identical values are noise.
- The `/ Mobile` naming with `/` is correct and intentional — Figma uses `/` for hierarchy, so the desktop style becomes a collapsible group with `Mobile` nested inside. This is standard Figma practice.
- Naming MUST be consistent: always `{name} / Mobile` with spaces around `/`. Never `{name}/Mobile` without spaces — inconsistent naming is a bug.
- When mobile styles ARE created, verify the total count is exactly 2x the desktop style count.
- If `hasMobilePresets` is false but `createMobileStyles` is true (user chose manual mobile), duplicate desktop values for the mobile styles.

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
- **Layout flush is mandatory after populating children.** `primaryAxisSizingMode = "AUTO"` does not reliably recalculate frame dimensions after children are appended. Always toggle `layoutMode` off and back on as the final step — for EVERY auto-layout frame, including nested containers. Flush bottom-up (innermost first). See `reference/style-guide.md` for the `flushAutoLayout` helper.

## Screenshot Validation

- **Do not rationalize visual anomalies in screenshots.** A thin horizontal sliver is a collapsed frame, not "just a wide frame." A mostly-empty frame is broken, not "zoomed out."
- After each frame creation, take a screenshot and critically assess: is the content legible, proportionally sized, and properly structured? If not, fix it and re-screenshot.
- Apply the same scrutiny to every frame — do not fix a problem on one frame and skip the identical symptom on another.
