---
name: analyze-theme
description: >
  Use when: extracting design tokens from a Shopify theme, or when manifest has no foundations data
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/analyze-theme/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Analyze Theme

You are analyzing a Shopify theme's configuration files to extract design tokens and propose which ones should become part of the Figma design system. This skill extracts **global theme settings only** — it does NOT analyze templates, sections, or blocks (that happens in `/propose-components`).

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## Pre-flight

1. Read `.claude/figma-sync/manifest.json`. If it doesn't exist, tell the user: "Run `/setup` first to configure the pipeline."
2. Verify `config` section exists with `storeUrl` and `figmaFileKey`.
3. **Check for theme profile:** Look for `.claude/figma-sync/theme-profiles/{theme_slug}.json` (e.g., `horizon.json`, `dawn.json`). If found, read it — it contains pre-loaded knowledge about how this theme structures typography, colors, spacing, etc. Use it to:
   - Know where to find font roles and how many to expect
   - Know the color scheme structure
   - Know which values are settings-driven vs CSS-hardcoded
   - Know about theme-specific quirks
   - Set `theme.hasProfile = true` in the manifest. If no profile exists, set `theme.hasProfile = false` and fall back to generic heuristics for all extraction.

---

## Step 1: Read Theme Configuration

Read these files from the theme codebase:

1. **`config/settings_schema.json`** — Full schema defining all available settings, their types, defaults, and organization
2. **`config/settings_data.json`** → `current` — Actual values in use
3. **`locales/en.default.schema.json`** — Translation keys to resolve `t:names.*`, `t:settings.*`, `t:options.*` labels to human-readable names

---

## Step 1.5: Validate Theme Profile (if found)

**Skip this step if no profile was found in pre-flight step 3.**

See `.claude/skills/analyze-theme/reference/profile-validation.md` for the full validation procedure including checks for typography, color schemes, spacing, and sections, plus how to handle divergences.

---

## Step 2: Extract Design Tokens

Parse the settings and extract the following categories. For each category, build a structured data object.

See `.claude/skills/analyze-theme/reference/token-extraction.md` for detailed extraction procedures for each token category:
- 2a. Color Schemes
- 2b. Typography
- 2c. Spacing, Layout & Radii
- 2d. Additional Tokens
- 2e. Mobile Typography Variance
- 2f. Required Atom Inventory

---

## Step 3: Propose Foundations

Present the extracted data to the user in a readable format. Organize by category:

```markdown
## Proposed Design System Foundations

### Colors
- **{N} color schemes** found: {list scheme names}
- **{N} unique theme colors** (non-grey)
- **{N} grey scale colors**
- **{N} semantic variables** per scheme, organized in {N} groups:
  {list group names with variable count each}

### Typography
- **Font families:**
  - Body: {family} ({weight})
  - Heading: {family} ({weight})
  - Subheading: {family} ({weight})
  - Accent: {family} ({weight})
- **{N} text presets:** {list h1-h6 + paragraph with size}

### Spacing & Layout
- **Page width:** {value}px ({setting name})
- **Border radii:** {list each with value}
- **Border widths:** {list each with value}
- **Spacing scale:** {list values if found, or "not found in settings — will use theme CSS"}

### Additional Tokens
- {list any additional tokens found}

### Required Atoms
- **{N} atoms identified** from theme code
- **{N} atoms to create** from common patterns
- Priority build order: core interactive atoms (Button, Input) → content atoms (Cards, Badges) → utility atoms (Spacer, Divider, Icon)

---

**Do you want to adjust anything?**
- Remove color schemes you don't use
- Add or remove token categories
- Change how tokens are named or grouped
```

**Wait for user confirmation before proceeding.**

---

## Step 4: Write to Manifest

Once the user confirms, update `.claude/figma-sync/manifest.json`:

1. Read the existing manifest
2. Set `foundations` to the complete extracted data:

```json
{
  "foundations": {
    "colors": {
      "schemes": { ... },
      "semanticGroups": [ ... ],
      "uniqueColors": {
        "themeColors": [ ... ],
        "greyScale": [ ... ]
      }
    },
    "typography": {
      "fontRoles": { ... },
      "presets": { ... }
    },
    "spacing": {
      "layout": { ... },
      "radii": { ... },
      "borderWidths": { ... },
      "scale": [ ... ]
    },
    "additionalTokens": { ... }
  }
}
```

3. Write the updated manifest back to disk

---

## Step 5: Summary

Show the user a summary of what was saved:

```
Foundations extracted and saved to manifest.

Colors:     {N} schemes, {N} theme colors, {N} greys, {N} semantic variables
Typography: {N} font roles, {N} presets (h1-h6 + paragraph)
Spacing:    {N} radii, {N} border widths, {N}-step spacing scale
Layout:     {pageWidth}px page width

Next step: Run /build-foundations to create these in Figma.
```

---

## Notes

### Theme-agnostic parsing

This skill must work with ANY Shopify theme, not just Horizon. The key universal patterns:

- **Color schemes:** All Shopify themes use `color_scheme_group` in `settings_schema.json`. The `definition` array structure with `type: "header"` dividers and `type: "color"` entries is standard.
- **Typography:** All themes use `font_picker` for font selection. Heading-level settings (`type_font_h{N}`, `type_size_h{N}`, etc.) are a common convention.
- **Settings format:** Shopify font format (`{family}_{style}{weight}`) is universal. Color formats (hex, hex+alpha, rgba) are universal.
- **Settings data:** `current` key in `settings_data.json` always holds the active values.

### What to do if a setting type is unexpected

If the theme uses settings patterns you don't recognize:
- Don't skip them silently — mention them to the user: "I found setting `{id}` of type `{type}` that I don't have a parser for. Should I include it?"
- The user can decide whether it's relevant.

### Handling missing settings

Not all themes have all setting types. For example:
- Some themes don't have `type_accent_font` — they may only have body and heading fonts
- Some themes don't have variant picker styling
- Spacing scales are often in CSS, not in settings

When a category has no settings, note it in the proposal: "No spacing scale found in theme settings. You may want to define one manually, or I can try to extract it from the theme's CSS files."

### If foundations already exist in manifest

If `manifest.foundations` is not null when this skill runs:
1. Warn the user: "Foundations have already been extracted. Re-running will overwrite the existing data."
2. If `buildStatus.foundations === "complete"`, warn additionally: "Foundations have already been built in Figma. Re-extracting won't update Figma — you'll need to run `/build-foundations` again."
3. Proceed only with user confirmation.
