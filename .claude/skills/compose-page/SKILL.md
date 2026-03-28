---
name: compose-page
description: >
  Use when: assembling page templates from section instances
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__resize_page, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/compose-page/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Compose Page

You are assembling a full page composition in Figma by instantiating the section components in the correct order. This creates a realistic representation of how the page looks as a whole.

**Manifest path:** `.claude/figma-sync/manifest.json`
**Template:** `$ARGUMENTS` (e.g., `index` for homepage, `product` for PDP)

**Method:** Figma MCP (`use_figma` + `get_screenshot`) for all Figma operations. Chrome DevTools MCP for final validation against the live store.

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`
2. Verify all section phases are complete:
   - `buildStatus["sections-desktop"] === "complete"`
   - `buildStatus["sections-mobile"] === "complete"`
   If not → tell user which phases are missing.
3. Read `config.desktopWidth`, `config.mobileWidth`, `config.figmaFileKey`
4. Read `components.sections` for the section order and color schemes

---

## Template Coverage

Every Shopify theme follows a standard template structure. Scan `templates/` to confirm which exist, then build them as desktop + mobile pairs in this priority order:

| Template | Source file | Priority |
|----------|-----------|----------|
| Homepage | `templates/index.json` | P1 |
| Product Page | `templates/product.json` | P1 |
| Collection Page | `templates/collection.json` | P1 |
| Cart Page | `templates/cart.json` | P1 |
| Search Results | `templates/search.json` | P2 |
| Blog Listing | `templates/blog.json` | P2 |
| Blog Article | `templates/article.json` | P2 |
| 404 Page | `templates/404.json` | P2 |
| Generic Page | `templates/page.json` | P2 |
| Contact Page | `templates/page.contact.json` | P2 |
| All Collections | `templates/list-collections.json` | P3 |
| Password Page | `templates/password.json` | P3 |
| Gift Card | `templates/gift_card.liquid` | P3 |
| Policy Page | Custom (legal content layout) | P3 |

Skip any that don't exist. Include custom templates at P3. Run `/compose-page all` to build everything, or specify individual templates.

---

## Step 1: Determine Section Order

Read the template files to get the exact section order:

1. **Header sections:** from `sections/header-group.json` → `sections` object, ordered by `order` field
2. **Body sections:** from `templates/{template}.json` → `sections` object, ordered by `order` field
3. **Footer sections:** from `sections/footer-group.json` → `sections` object, ordered by `order` field

Build the complete ordered list: header sections → body sections → footer sections.
Map each entry to the corresponding Figma component by matching the section `type` to `components.sections[].type`.

---

## Step 2: Create Page

If the template's page doesn't exist yet in Figma, create it. Name mapping:
- `index` → "Homepage"
- `product` → "Product Page"
- `collection` → "Collection Page"
- Other templates → capitalize the template name

### Desktop + Mobile Pairing

Each page type gets a labeled group:

```
"Homepage" label (Inter Bold 18px)
├── Homepage / Desktop (1440px wide) — left
└── Homepage / Mobile (375px wide) — right, 40px gap

120px gap to next page group

"PDP" label
├── PDP / Desktop
└── PDP / Mobile
```

Desktop and mobile templates are ALWAYS side by side, never in separate areas.

---

## Instance-Only Composition

Templates are composed ENTIRELY from component instances:

```javascript
const heroSet = page.findOne(n => n.name === "Hero Section" && n.type === "COMPONENT_SET");
const overlayVariant = heroSet.children.find(c => c.name.includes("Overlay"));
const heroInstance = overlayVariant.createInstance();
templateFrame.appendChild(heroInstance);
heroInstance.layoutSizingHorizontal = "FILL";
```

**Every element in a template must be an instance.** NEVER build inline frames in templates.

### Text Audit After Composition

After composing each template, run a quick audit:
```javascript
const texts = templateFrame.findAll(n => n.type === "TEXT");
for (const t of texts) {
  if (!t.textStyleId) console.warn("UNSTYLED:", t.characters);
  if (t.fills[0]?.type === "SOLID" && !t.fills[0]?.boundVariables?.color) console.warn("UNBOUND:", t.characters);
}
```

---

## Step 3: Desktop Composition

Create a frame for the desktop composition:
- Name: `"{PageName} / Desktop"`
- Width: `config.desktopWidth`
- Height: auto (`primaryAxisSizingMode = "AUTO"`)
- Layout: auto-layout vertical, gap = 0
- Fill: bound to Essential/Background

For each section in order: find the desktop component, create an instance, set `layoutSizingHorizontal = "FILL"`, and apply color scheme via `setExplicitVariableModeForCollection`.

**Important:** Section order comes from the template JSON, NOT from the manifest.

---

## Step 4: Mobile Composition

Create a frame for the mobile composition:
- Name: `"{PageName} / Mobile"`
- Width: `config.mobileWidth`
- Height: auto
- Layout: auto-layout vertical, gap = 0
- Fill: bound to Essential/Background

Same process as desktop but using mobile section variants. Apply the same color schemes.

---

## Step 5: Arrange on Canvas

- Desktop frame at position (0, 0)
- Mobile frame at position (desktopWidth + 100, 0) — to the right with 100px gap

---

## Step 6: Validation

### Visual validation in Figma:
1. `get_screenshot` on the full desktop composition
2. `get_screenshot` on the full mobile composition
3. Check for: no gaps/overlaps, correct color schemes, consistent width

### Comparison against live store:
Using Chrome DevTools MCP, navigate to the store URL + template path, take screenshots at both viewports, and compare section-by-section.

### Acceptance criteria:
An observer should immediately recognize that the Figma compositions represent the same page as the live store. It doesn't need to be pixel-perfect — it needs to be clearly the same design.

---

## Step 7: Fix Discrepancies

1. **Wrong section order:** Re-read template JSON and reorder instances
2. **Wrong color scheme:** Check which scheme the section uses in template settings
3. **Layout issues:** Fix in section components via `/build-components`, not in the composition
4. **Missing sections:** Check if there are sections not in the component inventory

---

## Step 8: Update Manifest

```json
{
  "buildStatus": {
    "composition-{template}": "complete"
  }
}
```

---

## Step 9: Summary

```
Page composition complete!

Template: {template}
Desktop:  {PageName} / Desktop ({desktopWidth}px, {N} sections)
Mobile:   {PageName} / Mobile ({mobileWidth}px, {N} sections)

Section order:
  1. {section1Name} (scheme: {scheme})
  2. {section2Name} (scheme: {scheme})
  ...

The design system for "{template}" is complete.
```

---

## Notes

### Color scheme application
Each section instance has its own color scheme mode set. The composition frame itself should NOT have a mode set — it uses the default.

### Shared sections across templates
Header and footer are shared. If already built, reuse existing components.

### Template-specific pages
If composing a new template, create a new page in Figma. Don't put multiple template compositions on the same page.
