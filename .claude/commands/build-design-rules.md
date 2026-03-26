---
description: Generate design system rules file mapping Figma components to theme code
---

# Build Design System Rules

You are generating a design system rules file that maps every Figma component to its corresponding theme code file, documents token mappings, and establishes the Figma-to-code workflow.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Output path:** `.claude/rules/figma-design-system.md`

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify `buildStatus.foundations === "complete"` and `buildStatus.components` has at least one completed phase
3. If not → "Build foundations and at least some components first."

---

## Step 1: Scan Built Components

Use `use_figma` to scan the Figma file and build an inventory of all components:

```javascript
// Scan all pages for components
const results = [];
for (const pg of figma.root.children) {
  await figma.setCurrentPageAsync(pg);
  pg.findAll(n => {
    if (n.type === "COMPONENT" || n.type === "COMPONENT_SET") {
      results.push({ name: n.name, type: n.type, page: pg.name, id: n.id });
    }
    return false;
  });
}
return results;
```

---

## Step 2: Map Components to Code

For each Figma component, find its corresponding code file:

1. **Sections:** `sections/{name}.liquid`
2. **Blocks (public):** `blocks/{name}.liquid`
3. **Blocks (internal):** `blocks/_{name}.liquid`
4. **Snippets:** `snippets/{name}.liquid`

Scan the `blocks/`, `sections/`, and `snippets/` directories. Match Figma component names to file names using these rules:
- Figma "Header" → `sections/header.liquid`
- Figma "Product Card" → `blocks/_product-card.liquid` + `snippets/product-card.liquid`
- Figma "Button" → `snippets/button.liquid` + `blocks/button.liquid`
- Figma "Footer / Menu" → `blocks/menu.liquid`

---

## Step 3: Build Token Mapping Table

From the manifest's `foundations` data, build a mapping table:

### Color tokens
Map each Figma Tokens variable to its CSS custom property:
- `Essential/Background` → `rgb(var(--color-background))`
- `Essential/Heading` → `rgb(var(--color-foreground-heading))`
- `Essential/Text` → `rgb(var(--color-foreground))`
- `Primary Button/Background` → `rgb(var(--color-primary-button-background))`
- etc.

### Text style mapping
Map each Figma text style to CSS:
- `Heading/H1/Desktop` → `--font-heading--family`, `--font-h1--size`, `--font-heading--weight`

### Spacing/radius mapping
Map Figma Primitives to CSS:
- `Spacing/lg` → `var(--padding-lg)` or `var(--gap-lg)`
- `Radius/buttons-primary` → `var(--style-border-radius-buttons-primary)`

---

## Step 4: Generate Rules File

Write `.claude/rules/figma-design-system.md` with:

### Part 1: Figma Library Building Rules
- Variable collections (names, structure, modes)
- Text styles (naming convention, role mapping)
- Page organization (section fill, spacing, mobile placement)
- Component patterns (instance-only, token bindings)
- Instance lookup table (every sub-element → its component)

### Part 2: Figma-to-Code Translation
- Token mapping tables (Figma variable → CSS property)
- Text style mapping (Figma style → CSS variables)
- Component-to-file mapping (every Figma component → its .liquid file)
- Required implementation flow (get_design_context → get_screenshot → identify → translate → validate)
- Styling rules (BEM, specificity, responsive breakpoints)
- Asset handling rules

### Part 3: Client Template Workflow
- How to duplicate the file for a new client
- What to change (Primitives, text style fonts)
- What cascades automatically (Tokens, component instances)

---

## Step 5: Update Manifest

Set `buildStatus.designRules = "complete"` in the manifest.

---

## Step 6: Summary

```
Design system rules generated!

Output: .claude/rules/figma-design-system.md

Component mappings: {N} Figma components → code files
Token mappings:     {N} color + {N} spacing + {N} radius
Text styles:        {N} mapped to CSS variables

The rules file will be automatically loaded by Claude Code
for all future Figma implementation tasks.
```
