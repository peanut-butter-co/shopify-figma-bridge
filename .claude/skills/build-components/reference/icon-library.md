# Icon Library Build Procedure

After building the other atoms, create an **Icons** frame on the Atoms page containing every SVG icon from the theme.

## Discovery

1. **Glob** for `assets/icon-*.svg` in the theme directory
2. Read each SVG file and collect `{ name, svgContent }` pairs
3. The icon name is derived from the filename: `icon-cart.svg` → `cart`

## SVG Cleanup (before sending to Figma)

Theme SVGs often contain CSS custom properties and tokens that Figma cannot parse. Clean each SVG string before passing to `figma.createNodeFromSvg()`:

1. **Replace CSS variables in stroke-width:** `var(--icon-stroke-width)` → `1.5` (the default Shopify icon stroke)
2. **Replace `currentColor`** → `#000000` (Figma doesn't support `currentColor`)
3. **Remove `class` attributes** — they have no effect in Figma
4. **Remove `vector-effect` attributes** — not supported by Figma SVG parser
5. **Remove `aria-hidden` attributes**
6. **Fix malformed SVG tags** — e.g., `<svg svg` → `<svg` (seen in some theme icons like `icon-inventory.svg`)
7. **Preserve hardcoded colors** — some status icons (error, available, unavailable) use specific colors like `#EB001B`, `#108043`, `#DE3618`. Do NOT replace these with `#000000`.

## Building in Figma

```javascript
// 1. Create the Icons container frame on the Atoms page
const iconsFrame = figma.createFrame();
iconsFrame.name = 'Icons';
iconsFrame.layoutMode = 'HORIZONTAL';
iconsFrame.layoutWrap = 'WRAP';
iconsFrame.itemSpacing = 40;
iconsFrame.counterAxisSpacing = 48;
iconsFrame.paddingTop = 32;
iconsFrame.paddingBottom = 32;
iconsFrame.paddingLeft = 32;
iconsFrame.paddingRight = 32;
iconsFrame.primaryAxisSizingMode = 'FIXED';
iconsFrame.counterAxisSizingMode = 'AUTO';
iconsFrame.resize(800, 100);
iconsFrame.fills = [];

// 2. For each icon SVG:
await figma.loadFontAsync({ family: "Inter", style: "Regular" });

for (const { name, svg } of cleanedIcons) {
  const svgNode = figma.createNodeFromSvg(svg);

  const wrapper = figma.createFrame();
  wrapper.name = name;
  wrapper.layoutMode = 'VERTICAL';
  wrapper.itemSpacing = 8;
  wrapper.primaryAxisSizingMode = 'AUTO';
  wrapper.counterAxisSizingMode = 'AUTO';
  wrapper.counterAxisAlignItems = 'CENTER';
  wrapper.fills = [];

  // Normalize to 24x24 bounding box
  const maxDim = Math.max(svgNode.width, svgNode.height);
  const scale = 24 / maxDim;
  svgNode.resize(Math.round(svgNode.width * scale), Math.round(svgNode.height * scale));
  svgNode.name = name;

  const label = figma.createText();
  label.fontName = { family: "Inter", style: "Regular" };
  label.characters = name;
  label.fontSize = 10;
  label.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];

  wrapper.appendChild(svgNode);
  wrapper.appendChild(label);
  iconsFrame.appendChild(wrapper);
}
```

## Batching

If the theme has many icons (20+), split the `use_figma` calls into batches of ~15 icons each. Create the Icons frame in the first call, then find it by name in subsequent calls to append more icons.

## Validation

After all icons are placed, take a `get_screenshot` of the Icons frame and visually verify:
- All icons rendered correctly (no broken/empty frames)
- Labels are readable
- Grid layout is clean and even
