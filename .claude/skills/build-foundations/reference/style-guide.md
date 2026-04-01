# Foundations Style Guide Page

On the "Foundations" page, create visual documentation frames. Each frame is a white card with auto-layout, padding, and subtle shadow.

## Frame base style

```javascript
frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
frame.cornerRadius = 8;
frame.effects = [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 2 }, radius: 8, spread: 0, visible: true, blendMode: "NORMAL" }];
frame.layoutMode = "VERTICAL";
frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = 32;
frame.itemSpacing = 16;
frame.primaryAxisSizingMode = "AUTO";
frame.counterAxisSizingMode = "AUTO";
```

### Mandatory: Flush layout after populating children

The Figma Plugin API has a known issue where `primaryAxisSizingMode = "AUTO"` does not reliably recalculate height after children are appended — especially when the frame was created with `resize()` or has nested auto-layout children. The frame can appear to have the correct properties but remain visually collapsed.

**After appending ALL children to ANY auto-layout frame** (including the main frame AND every nested container like column wrappers or row groups), apply this flush as the very last step before returning:

```javascript
function flushAutoLayout(frame, props) {
  frame.layoutMode = "NONE";
  frame.layoutMode = props.layoutMode;          // "VERTICAL" or "HORIZONTAL"
  frame.primaryAxisSizingMode = props.primaryAxisSizingMode || "AUTO";
  frame.counterAxisSizingMode = props.counterAxisSizingMode || "AUTO";
  if (props.paddingLeft != null) frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = props.paddingLeft;
  if (props.itemSpacing != null) frame.itemSpacing = props.itemSpacing;
}
```

Apply this bottom-up: flush innermost containers first, then their parents, then the outermost frame. This ensures each level recalculates with accurate child dimensions.

---

## 8a. Color Swatches

One frame per color collection (Theme Colors, Grey Scale). For each variable:
- A row (horizontal auto-layout) with:
  - Color swatch (40x40 frame, fill bound to the variable, cornerRadius 4)
  - Variable name (text node)
  - Hex value (text node, secondary color)

Group rows by variable name prefix (e.g., all `Porcelain/*` together with a group label).

---

## 8b. Color Schemas Overview

A frame showing each scheme as a column. For each scheme (mode):
- Scheme name as header
- Key color swatches: Background, Text, Primary Button BG, Secondary Button BG
- Show the variable alias target name under each swatch

---

## 8c. Typography Examples

A frame with one row per text style:
- Style name and metadata (font, size, line-height) as a small label
- Example text rendered with the actual text style applied

---

## 8d. Spacing Scale

A frame with one row per spacing value:
- Value label (e.g., "16px")
- Horizontal bar whose width equals the spacing value (max 320px for display)
- Fill bound to a neutral color

---

## 8e. Instance Architecture Reference

Create a reference frame on the Foundations page titled "Component Instance Rules". Include a brief text reminder that every sub-element that exists as a component must be instanced (never recreated as an inline frame), and why — one change to a component updates every instance everywhere.
