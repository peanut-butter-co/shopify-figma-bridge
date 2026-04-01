# Reference Capture Procedure

Before building any visual components, capture reference data from the live store. This step runs once regardless of which phase is selected.

## Using Chrome DevTools MCP

1. **Navigate to the store:** `navigate_page` to `config.storeUrl`
2. **Handle password:** If `config.storePassword` exists and a password screen appears, enter the password
3. **If store is not accessible:** STOP completely. Tell the user to resolve access. Do NOT proceed with estimated values.

## Desktop capture (viewport = `config.desktopWidth`)

4. `resize_page` to `{width: config.desktopWidth, height: 900}`
5. `take_screenshot` — full page reference
6. Use `evaluate_script` to measure key dimensions:

```javascript
(() => {
  const measure = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      width: r.width, height: r.height,
      paddingTop: parseFloat(s.paddingTop),
      paddingRight: parseFloat(s.paddingRight),
      paddingBottom: parseFloat(s.paddingBottom),
      paddingLeft: parseFloat(s.paddingLeft),
      borderRadius: s.borderRadius,
      gap: s.gap,
      fontSize: parseFloat(s.fontSize),
      lineHeight: parseFloat(s.lineHeight)
    };
  };

  return {
    button: measure('.button, .btn, [class*="button"]'),
    productCard: measure('.product-card, [class*="product-card"]'),
    collectionCard: measure('.collection-card, [class*="collection-card"]'),
    heroSection: measure('.hero, [class*="hero"]'),
    header: measure('header, .header'),
    footer: measure('footer, .footer'),
  };
})()
```

7. For grid sections, measure column count and gaps:
```javascript
(() => {
  const grids = document.querySelectorAll('[class*="grid"], [style*="grid"]');
  return Array.from(grids).map(g => {
    const s = getComputedStyle(g);
    return {
      columns: s.gridTemplateColumns,
      gap: s.gap,
      columnGap: s.columnGap,
      rowGap: s.rowGap,
      selector: g.className
    };
  });
})()
```

## Mobile capture (viewport = `config.mobileWidth`)

8. `resize_page` to `{width: config.mobileWidth, height: 812}`
9. `take_screenshot` — full page mobile reference
10. Measure the same elements at mobile viewport — note layout changes (column count, stacking direction, padding reductions)

## Store captured data

Keep the measurements and screenshots in memory for the build phases. These do NOT need to persist in the manifest — they're only used during this skill invocation.
