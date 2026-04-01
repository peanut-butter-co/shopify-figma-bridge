# Page Layout

After building all components for a page, arrange them so nothing overlaps and the page is easy to browse.

## Algorithm

Components are placed directly on the canvas (not nested in wrapper frames) so they appear correctly in the Figma Assets panel.

```
cursorY = 0

Group components by category (from manifest data).
For each category group:
  For each component in the group:
    component.x = 0
    component.y = cursorY

    If the component has a mobile counterpart:
      mobile.x = MOBILE_X_OFFSET
      mobile.y = cursorY
      cursorY += max(component.height, mobile.height) + VERTICAL_GAP
    Else:
      cursorY += component.height + VERTICAL_GAP

  cursorY += CATEGORY_GAP  (extra breathing room between groups)
```

## Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `VERTICAL_GAP` | 60px | Between components within a group |
| `CATEGORY_GAP` | 100px | Extra space between category groups (added on top of VERTICAL_GAP) |
| `MOBILE_X_OFFSET` | `config.desktopWidth + 80` | Desktop width + 80px gap. Default: 1520px |

## Category groupings

Derive from the manifest — do NOT hardcode theme-specific names.

### Atoms page

Group by `foundations.requiredAtoms[].category`:
1. `interactive` — buttons, inputs, checkboxes, text links, quantity selectors
2. `content` — product cards, collection cards, badges, variant swatches
3. `utility` — spacers, dividers, icons

### Blocks page

Single group — all blocks together. No sub-categories needed.

### Sections page

Group by `components.sections[].category`:
1. `structural` — header, footer, announcements
2. `reusable` — hero, product list, collection list, etc.
3. `page-specific` — product information, main collection, main cart, etc.

Desktop and mobile variants are placed side by side on the same row.

## When to run

Run the layout arrangement as the **last step of each page's build phase**:
- After all atoms are built and validated → arrange Atoms page
- After all blocks are built and validated → arrange Blocks page
- After mobile sections are built and validated → arrange Sections page

## Important

- Place components directly on the page canvas, never inside wrapper frames
- The layout must run AFTER all components on the page are fully built (including mobile variants for sections)
- Read actual `.height` and `.width` from each component after building — do not assume sizes
