---
description: Assemble a page composition from built section components
argument-hint: <template-name, e.g. "index" for homepage>
---

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
   If not → tell user which phases are missing: "Run `/build-components sections-desktop` first."
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

If a template file doesn't exist in the theme, skip it. If the theme has additional custom templates (e.g., `page.lookbook.json`), add them at P3. If the theme profile includes `recommendations.templates.coverage`, use its priority overrides.

Run `/compose-page all` to build everything, or specify individual templates.

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

If the template's page doesn't exist yet in Figma, create it. The page name should match the template:
- `index` → "Homepage"
- `product` → "Product Page"
- `collection` → "Collection Page"
- Other templates → capitalize the template name

Switch to this page for the composition work.

### Desktop + Mobile Pairing

Each page type gets a labeled group in the Templates section:

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
// Find section component
const heroSet = page.findOne(n => n.name === "Hero Section" && n.type === "COMPONENT_SET");
const overlayVariant = heroSet.children.find(c => c.name.includes("Overlay"));
const heroInstance = overlayVariant.createInstance();

// Add to template frame
templateFrame.appendChild(heroInstance);
heroInstance.layoutSizingHorizontal = "FILL";
```

**Every element in a template must be an instance:**
- Header → instance of Header component
- Hero → instance of Hero Section component
- Product grid → section that internally instances Product Card components
- Footer → instance of Footer component

**NEVER build inline frames in templates.** If a section component doesn't exist, build it first in `/build-components`, then instance it here.

---

## Step 3: Desktop Composition

Create a frame for the desktop composition:

```
Name:    "{PageName} / Desktop"
Width:   config.desktopWidth (e.g., 1440px)
Height:  auto (primaryAxisSizingMode = "AUTO")
Layout:  auto-layout vertical, gap = 0
Fill:    bound to Essential/Background
```

For each section in order:
1. Find the desktop component for this section type
2. Create an instance of it inside the composition frame
3. Set `layoutSizingHorizontal = "FILL"` on the instance
4. **Apply color scheme:** Read the section's `colorScheme` from the manifest (or from the template JSON). Find the corresponding mode in the Color Schemas collection and apply it:
   ```javascript
   instance.setExplicitVariableModeForCollection(colorSchemasCollection, modeId);
   ```

**Important:** The section order comes from the template JSON, NOT from the manifest. The manifest stores component definitions, but the template defines the page composition order.

---

## Step 4: Mobile Composition

Create a frame for the mobile composition:

```
Name:    "{PageName} / Mobile"
Width:   config.mobileWidth (e.g., 390px)
Height:  auto (primaryAxisSizingMode = "AUTO")
Layout:  auto-layout vertical, gap = 0
Fill:    bound to Essential/Background
```

Same process as desktop but using the mobile section variants. Match sections using the `config.mobileNaming` pattern (default: `{name} / Mobile`).

Apply the same color schemes as the desktop counterparts.

---

## Step 5: Arrange on Canvas

Position both compositions on the Figma canvas:
- Desktop frame at position (0, 0)
- Mobile frame at position (desktopWidth + 100, 0) — to the right of desktop with 100px gap

---

## Step 6: Validation

### Visual validation in Figma:

1. Use `get_screenshot` on the full desktop composition
2. Use `get_screenshot` on the full mobile composition
3. Check for:
   - No gaps or overlaps between sections
   - Color schemes applied correctly (visible as background color changes between sections)
   - Consistent width across all sections

### Comparison against live store:

Using Chrome DevTools MCP:

1. Navigate to the store URL + template path:
   - `index` → store root URL
   - `product` → a product page URL (ask user if needed)
   - `collection` → a collection page URL (ask user if needed)

2. **Desktop comparison:**
   - `resize_page` to `{width: config.desktopWidth, height: 900}`
   - `take_screenshot` — full page
   - Compare section-by-section against the Figma composition

3. **Mobile comparison:**
   - `resize_page` to `{width: config.mobileWidth, height: 812}`
   - `take_screenshot` — full page
   - Compare against the Figma mobile composition

### What to check:
- Section order matches
- Overall proportions are recognizable
- Color scheme transitions between sections look correct
- Typography hierarchy is consistent
- Grid layouts have correct column counts

### Acceptance criteria:
An observer should immediately recognize that the Figma compositions represent the same page as the live store. It doesn't need to be pixel-perfect — it needs to be clearly the same design.

---

## Step 7: Fix Discrepancies

If the comparison reveals issues:

1. **Wrong section order:** Re-read the template JSON and reorder instances
2. **Wrong color scheme:** Check which scheme the section uses in the template settings and reapply the mode
3. **Layout issues:** These need to be fixed in the section components themselves (go back to `/build-components`), not in the composition
4. **Missing sections:** Check if there are sections in the template that weren't included in the component inventory

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
Available skills:
  - /propose-components <other-template> — build another page
  - /sync-colors — keep colors in sync after changes
```

---

## Notes

### Color scheme application

Each section instance in the composition should have its own color scheme mode set. This means:
- Section A can use `scheme-1` (white background)
- Section B can use `scheme-5` (dark background)
- Section C can use `warm-cream`

The composition frame itself should NOT have a mode set — it uses the default. Each child section manages its own scheme.

### Shared sections across templates

Header and footer sections are shared across templates. If they were already built for a previous template, reuse the existing components — don't rebuild them. The composition just instantiates them.

### Template-specific pages

If the user has already composed one template (e.g., homepage) and now composes another (e.g., product page), create a new page in Figma for it. Don't put multiple template compositions on the same page.
