---
description: Audit Figma file for instance compliance — find inline frames that should be component instances
---

# Validate Instances

You are auditing the Figma design system file to find inline frames that should be component instances. This is a quality check that ensures the cascade principle is maintained.

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## What This Checks

The #1 rule of this design system: **every sub-element that exists as a component MUST be instanced, never recreated as an inline frame.**

This skill finds violations — places where someone built a button-like frame instead of instancing the Button component, or a card-like frame instead of instancing Product Card.

---

## Step 1: Build Component Registry

Use `use_figma` to scan all pages and build a registry of every component:

```javascript
const registry = [];
for (const pg of figma.root.children) {
  await figma.setCurrentPageAsync(pg);
  pg.findAll(n => {
    if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") {
      registry.push({ name: n.name, id: n.id, page: pg.name });
    }
    return false;
  });
}
return registry;
```

---

## Step 2: Scan for Violations

For each template and section composition, check if there are frames that LOOK like components but aren't instances:

### Heuristic checks:

1. **Button-like frames:** Any frame with:
   - `primaryAxisAlignItems === "CENTER"` + `counterAxisAlignItems === "CENTER"`
   - Exactly 1 text child
   - Corner radius > 0
   - A solid fill
   - NOT an instance (`.type !== "INSTANCE"`)
   → Likely should be a Button instance

2. **Card-like frames:** Any frame with:
   - `layoutMode === "VERTICAL"`
   - First child is a frame with clipsContent (image placeholder)
   - Has text children (title, price)
   - NOT an instance
   → Likely should be a Product Card, Blog Card, or Collection Card instance

3. **Input-like frames:** Any frame with:
   - Stroke on all sides
   - Contains a single text child
   - Looks like a form input
   - NOT an instance
   → Likely should be an Input Field instance

### Scan scope:
- All children of the Templates section
- All children of the Sections section
- All composites in the Blocks section (Buy Buttons, Filters, etc.)

---

## Step 3: Report

Present findings:

```markdown
## Instance Audit Report

### Summary
- Components scanned: {N}
- Templates checked: {N}
- Sections checked: {N}
- Composites checked: {N}

### Violations Found: {N}

| Location | Frame Name | Should Be Instance Of | Node ID |
|----------|-----------|----------------------|---------|
| Homepage / Desktop | "Shop Now" button frame | Button (Primary) | 123:456 |
| PDP / Desktop | Inline product card | Product Card (Portrait) | 789:012 |
| ... | ... | ... | ... |

### Clean: {N} components with all instances correct
```

---

## Step 4: Auto-Fix (Optional)

If the user confirms, automatically fix violations:

For each violation:
1. Find the parent frame
2. Note the position index in parent's children
3. Create an instance of the correct component
4. Copy relevant text overrides from the inline frame
5. Insert instance at the same position
6. Remove the inline frame
7. Set FILL sizing if the original had it

**Always ask before auto-fixing.** Show the list first, let the user confirm.

---

## Step 5: Re-validate

After fixes, re-run the scan to confirm 0 violations remain.

```
Instance audit complete!

Before: {N} violations
After:  0 violations

All templates and sections are using proper component instances.
Design system cascade is intact.
```
