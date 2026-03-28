# Validation Procedures

## Programmatic Integrity Check

Run this via `use_figma` on each component:

```javascript
// Mandatory check: find invisible text, broken fills, unbound colors
const issues = [];
const texts = comp.findAll(n => n.type === "TEXT");
for (const t of texts) {
  for (const fill of t.fills) {
    if (fill.opacity !== undefined && fill.opacity < 0.01 && fill.visible !== false) {
      issues.push(`INVISIBLE TEXT: "${t.characters}" has fill opacity ${fill.opacity}`);
    }
    if (!fill.boundVariables?.color) {
      issues.push(`UNBOUND COLOR: "${t.characters}" text fill is not bound to a variable`);
    }
  }
}
const frames = comp.findAll(n => n.type === "FRAME" || n.type === "COMPONENT");
for (const f of frames) {
  for (const fill of (f.fills || [])) {
    if (fill.opacity !== undefined && fill.opacity < 0.01 && fill.visible !== false && !f.name.includes("Image")) {
      issues.push(`INVISIBLE FILL: frame "${f.name}" has fill opacity ${fill.opacity}`);
    }
  }
}
```

If ANY issues are found → this may indicate an upstream problem (see upstream-errors.md). Diagnose before fixing locally.

Additional checks:
- Buttons: width/height ratio > 2, height < 60px
- All fills: verify they're bound to variables, not hardcoded

## Variant Completeness Check

Run this via `use_figma` after all sections are built:

```javascript
const issues = [];
for (const section of manifest.components.sections) {
  if (!section.variants) continue;
  const node = sectionsPage.findOne(n => n.name === section.name);
  if (!node) {
    issues.push(`MISSING: ${section.name} not found`);
    continue;
  }
  if (node.type !== "COMPONENT_SET") {
    issues.push(`NOT A VARIANT SET: ${section.name} is a ${node.type}`);
    continue;
  }
  const propArrays = Object.values(section.variants);
  const expectedCount = propArrays.reduce((acc, arr) => acc * arr.length, 1);
  const actualCount = node.children.length;
  if (actualCount < expectedCount) {
    issues.push(`INCOMPLETE: ${section.name} has ${actualCount}/${expectedCount} variants`);
  }
}
```

## Image Placeholder Pattern

Cards with images must maintain aspect ratio at any card width:

- Use `layoutMode = "VERTICAL"` + `primaryAxisSizingMode = "FIXED"` + `counterAxisSizingMode = "FIXED"`, then `resize(w, h)`.
- After appending to the card: set `layoutSizingHorizontal = "FILL"` and **`constrainProportions = true`**.
- This ensures the image stays square (or whatever ratio) when the card is resized for mobile grids.
- Set a grey placeholder fill.
- For absolute-positioned children inside (e.g., badge), use `layoutPositioning = "ABSOLUTE"`.

**Do NOT use:**
- `layoutMode = "NONE"` → height collapses to 0 in auto-layout parent
- `layoutSizingVertical = "FIXED"` without `constrainProportions` → image stays fixed tall even when card shrinks
