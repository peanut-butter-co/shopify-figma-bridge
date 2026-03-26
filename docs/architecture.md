# Analysis: From mega-prompt to modular skill system

## Context

The current prompt (`prompts/01. Build design system.md`) is a monolithic 420-line mega-prompt that builds a complete design system in Figma from Horizon's code. We want to convert it into a modular skill system for Claude Code that:
- Works with **any Shopify theme** (not just Horizon)
- Helps the user **decide what's relevant** (not extract everything)
- Has **interactive decision points** (propose -> confirm -> build)
- Is **optimized for known themes** (pre-configured recommendations for Horizon)

## Analysis of the current prompt

### Strengths
1. **Well-thought-out subagent architecture** -- Data Extraction, Reference Capture, Validation are clear responsibilities
2. **Robust validation protocol** -- batch validation with programmatic assertions + visual comparison
3. **Documented gotchas** -- accumulated learning in CLAUDE.md and CLAUDE_FEEDBACK.md is valuable
4. **Correct dependency order** -- foundations -> atoms -> blocks -> sections -> composition
5. **Clear extraction JSON structure** -- the data contract between subagents is well defined

### Weaknesses
1. **Monolithic** -- everything in one prompt, impossible to partially execute or re-run a phase
2. **Horizon hardcoded** -- section names, color schemes, store URLs, everything is specific
3. **No decision points** -- executes a fixed plan, user can't choose what to include
4. **Inflated scope** -- assumes ALL homepage components get created, no prioritization
5. **Fragile reference capture** -- depends on store being accessible (already caused problems, see CLAUDE_FEEDBACK.md)
6. **No persistence between sessions** -- if the conversation cuts off, all progress is lost
7. **Mixes extraction + decision + execution** -- three distinct concerns in a single flow

---

## Proposal: Pipeline of 6 skills + manifest

### Overall architecture

```
/setup --> manifest.json (config: store URL, Figma file, viewports)
  |
  v
/analyze-theme --> manifest.json (+ foundations: colors, typography, spacing)
  |
  v
/build-foundations --> Figma (variables, text styles, style guide)
  |
  v
/propose-components --> manifest.json (+ confirmed component inventory, theme-wide)
  |
  v
/build-components --> Figma (atoms, blocks, sections)
  |
  v  (repeatable per template)
/compose-page <template> --> Figma (page composition)
```

**Principles:**
- `/setup` runs once -- configures environment (store, Figma, viewports)
- `/propose-components` scans the entire theme (all sections/blocks) -- not tied to a template
- `/compose-page <template>` is where template-specific assembly happens (homepage, PDP, etc.)
- Decisions (what to build) separated from execution (building it)
- Components are built once; then `/compose-page` can be run for multiple templates

### The manifest as shared state

Skills can't call each other or share context. The solution: a **JSON file** (`.claude/figma-sync/manifest.json`) that accumulates extracted data, user decisions, and progress state.

```
.claude/figma-sync/
  manifest.json              <-- pipeline state
  theme-profiles/
    horizon.json             <-- pre-configured recommendations (optional)
```

Why JSON and not markdown?
- Skills need to read specific values (hex codes, sizes, section order)
- Inspectable by the user
- Survives session crashes
- Can be version-controlled in git

### The 6 skills

#### 0. `/setup` -- Initial project configuration

**Scope:** Configure the working environment before starting. Runs once (or when configuration needs to change).

**Flow:**
1. **Reference store URL:**
   - Ask the user for the URL (can be `https://my-store.myshopify.com` or `http://localhost:9292`)
   - Navigate to the URL with Chrome DevTools
   - If password screen detected -> ask user for password, enter it, save it in the manifest
   - If not accessible -> stop and ask user to resolve
2. **Figma file:**
   - Ask user for the URL or fileKey of the Figma file to work with
   - Verify access via `get_metadata` from the Figma MCP
3. **Propose configuration with defaults:**
   - Desktop design width: `1440px` (default)
   - Mobile design width: `390px` (default)
   - Pages to create in Figma: `Foundations, Atoms, Blocks, Sections` + one per template
   - Naming pattern for mobile variants: `[Section] / Mobile`
   - User can adjust any value
4. Write `manifest.json` with base configuration:

```json
{
  "config": {
    "storeUrl": "https://...",
    "storePassword": "...",
    "figmaFileKey": "abc123",
    "desktopWidth": 1440,
    "mobileWidth": 390,
    "pages": ["Foundations", "Atoms", "Blocks", "Sections"],
    "mobileNaming": "{name} / Mobile"
  },
  "foundations": null,
  "components": null,
  "buildStatus": {}
}
```

**No argument.** Interactive -- asks everything to the user.

---

#### 1. `/analyze-theme` -- Understand the theme and propose foundations

**Scope:** Read theme config files, extract global design tokens, propose what to include as design system foundations. **Only theme settings** -- doesn't analyze templates or sections (that comes later in `/propose-components`).

**Flow:**
1. Read `settings_schema.json`, `settings_data.json`, locales
2. **Propose to user:**
   - Colors: how many schemes, which semantic groups
   - Typography: which fonts, which presets
   - Spacing/radii: what values appear
   - Button styles, inputs, and other relevant global tokens
3. User confirms/adjusts (remove unused schemes, add missing tokens)
4. Write confirmed data to `manifest.json`

**Theme-agnostic:** Dynamically parses the schema (all Shopify themes use `settings_schema.json` with `color_scheme_group`, `font_picker`, etc.). No hardcoded names.

**Theme-specific:** If `.claude/figma-sync/theme-profiles/horizon.json` exists, uses it for better recommendations (e.g., "in Horizon, the most relevant settings are colors, typography, and button styles").

**No argument** -- theme settings are global, don't depend on which page you're building.

#### 2. `/build-foundations` -- Build variables, text styles, style guide

**Scope:** Create in Figma everything that doesn't require visual reference: pages, variable collections, text styles, foundations page.

**Method:** Figma MCP (`use_figma` for creation/editing, `get_screenshot` for verification). Does NOT use Chrome DevTools -- no browser needed.

**Flow:**
1. Read `manifest.json`, validate that `foundations` section exists
2. Pre-flight: verify it has the Figma `fileKey` (from manifest or as argument)
3. Create pages, variable collections, text styles
4. Build style guide on the Foundations page
5. Validate each frame with `get_screenshot` at 100%+
6. Update `manifest.json` -> `buildStatus.foundations = "complete"`

**Design decision:** This skill does NOT read theme files directly. It only reads the manifest. Theme-specific interpretation already happened in `/analyze-theme`.

#### 3. `/propose-components` -- Propose component inventory

**Scope:** For a specific template, analyze its sections and blocks, propose which components to create in Figma with smart grouping.

**Argument:** `<template-name>` (e.g., `index` for homepage, `product` for PDP)

**Flow:**
1. Read `templates/<template>.json` + section groups (`header-group.json`, `footer-group.json`)
2. For each section in the template, read the `.liquid` file and analyze: what blocks it accepts, what settings it has, what atoms it uses
3. **Grouping criteria (dynamic, not hardcoded):**
   - **Universal blocks** (appear in multiple sections: text, button, image, product card) -> standalone components on the Blocks page
   - **Section-specific blocks** (only used inside one specific section) -> NOT created as separate components, integrated directly into the section that uses them
   - This criteria is applied by analyzing the theme's code, not with fixed rules -- each theme can have different blocks
4. **Propose to user** with table of components, recommended variants, and what it recommends skipping
5. User confirms/adjusts
6. Update `manifest.json` -> `components.status = "confirmed"`

**For variants:** Analyze each section's settings. If it has `color_scheme` -> variant per scheme. If it has `alignment` with left/center/right options -> propose those variants. But don't propose ALL -- prioritize those with significant visual impact.

#### 4. `/build-components` -- Build components in Figma

**Scope:** Build confirmed atoms, blocks, and sections, with reference capture and validation.

**Method:** Figma MCP (`use_figma` + `get_screenshot`) for building and validating in Figma. Chrome DevTools MCP only for reference capture (navigating to the store, measuring DOM, store screenshots).

**Flow:**
1. Read manifest, load confirmed component inventory
2. **Reference capture (Chrome DevTools):** navigate to store, screenshots + DOM measurements at 1440px and 390px
3. **Build (Figma MCP):** build in order: atoms -> blocks -> sections (desktop) -> sections (mobile)
4. **Batch validation:** `get_screenshot` of each component in Figma, compare against store screenshots
5. Update `buildStatus` for each completed tier

**Argument:** `<atoms|blocks|sections-desktop|sections-mobile|all>` -- allows re-running a specific phase if it fails.

**Design decision:** Reference capture is INSIDE this skill (not separate) because measurements are only needed during building, and it avoids an additional skill boundary with context loss.

#### 5. `/compose-page` -- Assemble page compositions

**Scope:** Create full-page frames by instantiating built section components.

**Flow:**
1. Read template JSON for section order
2. Create Desktop frame (1440px) + Mobile frame (390px)
3. Instantiate sections in order, applying color schemes
4. Final validation against store
5. Update manifest

**Argument:** `<template-name>` (e.g., `index`, `product`, `collection`)

---

## Theme profiles: pre-configured recommendations

For known themes, an optional JSON file with:

```json
{
  "theme": "Horizon",
  "version": "3.x",
  "recommendations": {
    "foundations": {
      "relevantSettings": ["colors", "typography", "buttons", "radii"],
      "skipSettings": ["cart", "search", "predictive-search"]
    },
    "components": {
      "prioritySections": ["hero", "product-list", "collection-list", "media-with-content"],
      "skipSections": ["custom-liquid", "main-404", "password"],
      "groupAsOne": {
        "Cart": ["_cart-products", "_cart-summary", "_cart-title"],
        "Footer": ["footer", "footer-utilities", "_footer-social-icons"]
      },
      "recommendedVariants": {
        "hero": ["content-alignment: left|center|right", "color_scheme"],
        "product-list": ["columns: 3|4", "color_scheme"]
      }
    }
  },
  "colorMappings": { "..." : "..." },
  "schemeMappings": { "..." : "..." }
}
```

Without profile -> the system discovers everything from code and proposes based on heuristics.
With profile -> proposals come pre-filtered with better defaults.

---

## Decisions made

0. **Everything in English** -- skills, manifest, descriptions, and user interactions are written in English.
1. **6 skills** (setup + 5 pipeline) -- each with clear scope. Build skills are pure executors.
2. **Dynamic grouping** -- not hardcoded. Universal blocks (used across multiple sections) -> standalone components. Section-specific blocks -> integrated into that section. Determined by analyzing the code, not fixed rules.
3. **Reference capture inside `/build-components`** -- not as a separate skill. If the store fails, the skill stops and asks for help.
4. **`sync-colors` stays independent** -- for continuous sync post-creation. Mapping tables should migrate to the manifest to share a single source of truth.
5. **Execution method:**
   - **Figma MCP (`use_figma` + `get_screenshot`)** for all Figma operations
   - **Chrome DevTools MCP** for reference capture (navigating to the store, measuring DOM, store screenshots) and visual validation
6. **JSON manifest** as state mechanism between skills.

---

## Resulting file structure

```
.claude/
  commands/
    setup.md                   <-- Skill 0: initial configuration
    analyze-theme.md           <-- Skill 1: extract + propose foundations
    build-foundations.md       <-- Skill 2: build variables, text styles
    propose-components.md      <-- Skill 3: propose component inventory
    build-components.md        <-- Skill 4: build atoms, blocks, sections
    compose-page.md            <-- Skill 5: assemble page compositions
    sync-colors.md             <-- Existing: bidirectional color sync
  figma-sync/
    manifest.json              <-- Pipeline state (created by /setup)
    theme-profiles/
      horizon.json             <-- Pre-configured recommendations for Horizon
```

## What's preserved from the current prompt

- Subagent architecture (Data Extraction, Reference Capture, Validation) -> preserved within build skills
- Extraction JSON structure -> manifest basis
- Batch validation protocol -> inside `/build-components`
- Design hints (aspect ratio, text nodes, grids, lineHeight) -> in CLAUDE.md (already there)
- Gotchas by method -> in CLAUDE.md (already there)

## What changes

| Before | After |
|---|---|
| One prompt that does everything | 6 independent skills with shared state |
| Horizon hardcoded | Theme-agnostic with optional profiles |
| No user decisions | Propose -> confirm -> build |
| No persistence | JSON manifest persists across sessions |
| Fixed scope (entire homepage) | User chooses what to include |
| Single execution method | Figma MCP for Figma + Chrome DevTools for store |
