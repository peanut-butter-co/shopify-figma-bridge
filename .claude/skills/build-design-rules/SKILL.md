---
name: build-design-rules
description: >
  Use when: generating a design system rules file mapping Figma to code
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/build-design-rules/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Build Design System Rules

You are generating a design system rules file that maps every Figma component to its corresponding theme code file, documents token mappings, and establishes the Figma-to-code workflow.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Output path:** `.claude/figma-sync/design-rules.json`

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify `buildStatus.foundations === "complete"` and `buildStatus.components` has at least one completed phase
3. If not → "Build foundations and at least some components first."

---

## Step 1: Scan Built Components

Use `use_figma` to scan the Figma file and build an inventory of all components:

```javascript
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
Map each Figma variable to its CSS custom property:
- `Essential/Background` → `rgb(var(--color-background))`
- `Essential/Heading` → `rgb(var(--color-foreground-heading))`
- `Essential/Text` → `rgb(var(--color-foreground))`
- `Primary Button/Background` → `rgb(var(--color-primary-button-background))`

### Text style mapping
Map each Figma text style to CSS:
- `Heading/H1/Desktop` → `--font-heading--family`, `--font-h1--size`, `--font-heading--weight`

### Spacing/radius mapping
Map Figma variables to CSS:
- `Spacing/lg` → `var(--padding-lg)` or `var(--gap-lg)`
- `Radius/buttons-primary` → `var(--style-border-radius-buttons-primary)`

---

## Step 4: Generate Rules File

Write `.claude/figma-sync/design-rules.json` with this structure:

```json
{
  "generatedAt": "2026-03-28T...",
  "componentMap": {
    "Hero Section": {
      "file": "sections/hero.liquid",
      "type": "section",
      "variants": ["Overlay", "Split"]
    },
    "Product Card": {
      "files": ["blocks/_product-card.liquid", "snippets/product-card.liquid"],
      "type": "block"
    },
    "Button": {
      "file": "snippets/button.liquid",
      "type": "atom"
    }
  },
  "tokenMap": {
    "Essential/Background": "rgb(var(--color-background))",
    "Essential/Heading": "rgb(var(--color-foreground-heading))",
    "Essential/Text": "rgb(var(--color-foreground))",
    "Primary Button/Background": "rgb(var(--color-primary-button-background))"
  },
  "textStyleMap": {
    "Heading/H1": {
      "family": "--font-heading--family",
      "size": "--font-h1--size",
      "weight": "--font-heading--weight"
    },
    "Text/Body": {
      "family": "--font-body--family",
      "size": "--font-body--size",
      "weight": "--font-body--weight"
    }
  },
  "spacingMap": {
    "spacing/lg": "var(--padding-lg)",
    "radius/buttons-primary": "var(--style-border-radius-buttons-primary)"
  },
  "collections": {
    "Theme Colors": { "modes": 1, "type": "COLOR" },
    "Grey Scale": { "modes": 1, "type": "COLOR" },
    "Color Schemas": { "modes": 6, "type": "COLOR" },
    "Typography": { "modes": 1, "type": "FLOAT" },
    "Spacing & Layout": { "modes": 1, "type": "FLOAT" }
  }
}
```

Populate each section from the Figma scan (Step 1) and manifest data (Step 3). The `componentMap` keys must match Figma component names exactly.

---

## Step 5: Update Manifest

Set `buildStatus.designRules = "complete"` in the manifest.

---

## Step 6: Summary

```
Design system rules generated!

Output: .claude/figma-sync/design-rules.json

Component mappings: {N} Figma components → code files
Token mappings:     {N} color + {N} spacing + {N} radius
Text styles:        {N} mapped to CSS variables

Used by: /build-components, /compose-page, /sync-colors
```
