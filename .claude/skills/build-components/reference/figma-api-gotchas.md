# Figma API Gotchas

## Page navigation
- `figma.currentPage = page` → **WRONG**
- `await figma.setCurrentPageAsync(page)` → CORRECT

## Binding variables to fills/strokes — use `setBoundVariableForPaint`, not `setBoundVariable`
- `frame.setBoundVariable('fills', 0, 'color', myVar)` → **WRONG**
- `frame.fills = [figma.variables.setBoundVariableForPaint(figma.util.solidPaint("#000"), myVar)]` → CORRECT
- Helper pattern: `function bindPaint(p, v) { return figma.variables.setBoundVariableForPaint(p, 'color', v); }`

## `resize()` overrides sizing modes — ALWAYS set sizing modes AFTER `resize()`
- `frame.primaryAxisSizingMode = "AUTO"; frame.resize(1440, 1);` → sizing mode reverts to FIXED (**WRONG**)
- `frame.resize(1440, 1); frame.primaryAxisSizingMode = "AUTO";` → sizing mode sticks (CORRECT)
- This is the #1 cause of "height is 1" bugs. If the component height is wrong, check this first.

## `counterAxisSizingMode` only accepts `"FIXED"` | `"AUTO"` — never `"FILL"`
- `content.counterAxisSizingMode = "FILL"` → throws validation error
- Set `layoutSizingHorizontal = "FILL"` on the child AFTER appending it to an auto-layout parent

## Child sizing (`layoutSizingHorizontal`/`layoutSizingVertical`) — set AFTER appending to parent
- `child.layoutSizingHorizontal = "FILL"; parent.appendChild(child)` → error: not in auto-layout
- `parent.appendChild(child); child.layoutSizingHorizontal = "FILL"` → CORRECT

## Image placeholders that must maintain aspect ratio
- `layoutMode = "NONE"` → height collapses to 0 in auto-layout parent
- `layoutSizingVertical = "FIXED"` without `constrainProportions` → image stays fixed tall even when card shrinks
- CORRECT: Use `layoutMode = "VERTICAL"` + `primaryAxisSizingMode = "FIXED"` + `counterAxisSizingMode = "FIXED"`, then `resize(w, h)`. After appending to parent: `child.layoutSizingHorizontal = "FILL"` + `child.constrainProportions = true`.
- For absolute-positioned children inside (e.g., badge overlay), use `child.layoutPositioning = "ABSOLUTE"`

## Other gotchas
- Text nodes in auto-layout default to HUG width → set `layoutSizingHorizontal = "FILL"` + `textAutoResize = "HEIGHT"` after appending
- Component instances can't be resized via `resize()` with fixed sizing — use `layoutSizingHorizontal = "FILL"` in auto-layout parents
- Use `await node.getMainComponentAsync()` not `node.mainComponent` (dynamic-page mode)
- Use `await node.setTextStyleIdAsync(style.id)` not `node.textStyleId = style.id`
- `createVariable(name, collectionObject, type)` — pass collection OBJECT, not ID

## `use_figma` MCP gotchas (validation layer)
- `blendMode: "NORMAL"` is required in shadow effects — omitting causes validation error
- `primaryAxisSizingMode` rejects `"HUG"` — use `"AUTO"` instead
- Paint `color` objects don't accept `a` (alpha) — use `opacity` on the paint: `{ type: "SOLID", color: { r, g, b }, opacity: 0.8 }`
