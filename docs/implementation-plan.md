# Implementation Plan: Skills Migration, Design Agent, and Shopify Validation

**Date:** 2026-03-27
**Based on:** [system-improvement-conclusions.md](../system-improvement-conclusions.md), [responsive-component-architecture-research.md](responsive-component-architecture-research.md), Evil Horizon build learnings
**Status:** Proposal for review

---

## Overview

Four phases, ordered by impact and risk. Each phase is independently shippable.

```
Phase 1: Commands → Skills migration         Impact: ★★★★☆  Risk: ★☆☆☆☆
Phase 2: CLAUDE.md + Hooks + Self-learning   Impact: ★★★☆☆  Risk: ★☆☆☆☆
Phase 3: Shopify JSON validation layer       Impact: ★★★★☆  Risk: ★★☆☆☆
Phase 4: Design Agent + Brand Onboarding     Impact: ★★★★★  Risk: ★★★☆☆
```

---

## Phase 1: Commands → Skills Migration

### What changes

Move 11 commands from `.claude/commands/` to `.claude/skills/`. Each becomes a folder with `SKILL.md` + reference docs + `gotchas.md`.

### Directory structure

```
.claude/skills/
├── setup/SKILL.md
├── analyze-theme/
│   ├── SKILL.md
│   └── reference/
│       ├── color-extraction-rules.md
│       └── typography-mapping.md
├── build-foundations/
│   ├── SKILL.md
│   ├── reference/
│   │   ├── variable-structure.md
│   │   └── text-style-rules.md
│   └── gotchas.md
├── propose-components/
│   ├── SKILL.md
│   └── reference/selection-criteria.md
├── build-components/
│   ├── SKILL.md
│   ├── reference/
│   │   ├── atoms-guide.md
│   │   ├── blocks-guide.md
│   │   ├── sections-guide.md
│   │   └── instance-lookup-table.md
│   └── gotchas.md
├── compose-page/SKILL.md
├── build-design-system/SKILL.md
├── build-design-rules/SKILL.md
├── sync-colors/SKILL.md
├── validate-instances/SKILL.md
├── refresh-figma-practices/SKILL.md
├── learnings/SKILL.md              ← NEW
└── design/                          ← NEW (Phase 4)
    ├── SKILL.md
    └── reference/
        ├── design-operations.md
        └── composition-patterns.md
```

### Key changes per skill

**Frontmatter:** Descriptions become triggers, not summaries.

```yaml
# Before (command):
---
description: Build Figma foundations from analyzed theme data
---

# After (skill):
---
name: build-foundations
description: >
  Use when: the user wants to create Figma variable collections,
  text styles, or a style guide page. Also triggers when manifest
  has foundations data but buildStatus.foundations !== "complete".
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob]
---
```

**Splitting large files:** Extract reference material to subfolders. Target <500 lines per SKILL.md. Everything the skill needs to reference goes in `reference/` — loaded on demand, not injected into context.

**Gotchas seeding:** Migrate existing memory feedback into skill-specific gotchas files:

| Memory File | Target Gotcha |
|-------------|---------------|
| `feedback_figma_workflow.md` | `build-components/gotchas.md` (instance architecture), `compose-page/gotchas.md` (template rules) |
| `feedback_always_use_instances.md` | `build-components/gotchas.md` (instance lookup table) |
| `feedback_always_validate.md` | `build-components/gotchas.md` (screenshot after every step) |
| `feedback_mobile_components.md` | `build-components/gotchas.md` (viewport variants) |
| `feedback_templates_must_use_instances.md` | `compose-page/gotchas.md` (template organization) |

### Responsive components: Variables vs Viewport variants

Per Pablo's research (`responsive-component-architecture-research.md`), the expert consensus favors **variables with breakpoint modes** over Viewport variant component sets.

**Revised approach for responsive components:**
- Create a "Breakpoint" variable collection with Desktop and Mobile modes
- Bind spacing, font size, padding to breakpoint variables
- Single component adapts via mode switching — no separate Desktop/Mobile variants
- Reserve Viewport variants only for components with fundamentally different structure (e.g., header → mobile drawer)

**Components to convert from Viewport variants to variable-driven:**
- Collection Header, Blog Header, Page Header, Search Header, 404 Content → single component with breakpoint variables
- Article Hero → keep as variants (structure changes significantly between desktop/mobile)
- Mobile Product Info → keep separate (entirely different composition)

This is a Phase 1 task since it affects the component architecture before the design agent relies on it.

### Tasks

- [ ] Create `.claude/skills/` directory structure
- [ ] Migrate each command to skill folder with proper SKILL.md frontmatter
- [ ] Rewrite all descriptions as triggers
- [ ] Split `build-components.md` into SKILL.md + reference files (it's the largest)
- [ ] Create `gotchas.md` per skill, seeded from memory files
- [ ] Add dynamic gotcha injection to each SKILL.md
- [ ] Create "Breakpoint" variable collection pattern doc
- [ ] Convert Viewport variant components to variable-driven responsive
- [ ] Test each skill still works via `/skill-name`
- [ ] Remove old `.claude/commands/` directory

---

## Phase 2: CLAUDE.md + Hooks + Self-Learning

### CLAUDE.md (minimal — <30 lines)

```markdown
# Shopify Figma Bridge

Design system automation: extracts tokens from Shopify themes,
builds Figma design systems, and enables design-to-code workflows.

## Architecture
- Skills: `.claude/skills/` — pipeline phases and design tools
- State: `.claude/figma-sync/manifest.json` — single source of truth
- Profiles: `.claude/figma-sync/theme-profiles/` — theme knowledge
- Practices: `.claude/figma-best-practices.md` — Figma engineering ref

## Rules
- NEVER inline frames — always use component instances
- NEVER hardcode colors/sizes — always bind to Figma variables
- NEVER skip a pipeline phase — each depends on the previous
- EVERY text node must have a textStyleId AND a variable-bound fill

## Quick Reference
- Full pipeline: `/build-design-system [template]`
- Design: `/design [description]`
- Phases: /setup → /analyze-theme → /build-foundations → /propose-components → /build-components → /compose-page
- Maintenance: /sync-colors, /validate-instances, /refresh-figma-practices
```

### Hooks (3 to start)

**1. Session Start — show pipeline status:**
```json
{
  "SessionStart": [{
    "type": "command",
    "command": "cat .claude/figma-sync/manifest.json 2>/dev/null | python3 -c \"import json,sys; m=json.load(sys.stdin); print(f'Theme: {m[\"theme\"][\"name\"]} | Build: {json.dumps(m[\"buildStatus\"])}')\" 2>/dev/null || echo 'No design system configured.'"
  }]
}
```

**2. Post Figma write — reminder to screenshot:**
```json
{
  "PostToolUse": [{
    "matcher": "mcp__figma__use_figma",
    "type": "command",
    "command": "echo '📸 Figma modified — verify with get_screenshot'"
  }]
}
```

**3. Manifest integrity — validate before write:**
```json
{
  "PreToolUse": [{
    "matcher": "Write(.claude/figma-sync/manifest.json)",
    "type": "prompt",
    "prompt": "Verify the manifest JSON preserves all existing fields. Output 'OK' if valid."
  }]
}
```

### Self-Learning (`/learnings` skill)

Each skill adds an "After Completion" section:
```markdown
## After Completion
If the user corrected your approach:
1. Read `.claude/skills/{this-skill}/gotchas.md`
2. Append the correction with date and context
3. Future executions will read this automatically
```

The `/learnings` skill reviews all gotchas across skills, consolidates, and lets the user approve/reject.

### Tasks

- [ ] Create project CLAUDE.md
- [ ] Add 3 hooks to `.claude/settings.json`
- [ ] Create `/learnings` skill
- [ ] Add "After Completion" section to all skills
- [ ] Test hooks don't interfere with workflows
- [ ] Test learning cycle: correction → gotcha → next run uses it

---

## Phase 3: Shopify JSON Validation Layer

### The problem

Shopify template JSON (`templates/*.json`) and section schemas are strict. Common failures:
- Setting value outside schema range (slider max exceeded)
- Setting dependency violations (setting A requires setting B to be enabled)
- Block type not allowed in section
- Block count exceeds `max_blocks`
- Invalid `color_scheme` reference
- Range slider step/interval math doesn't divide evenly
- Too many options generated for a select dropdown

### The solution: `/validate-shopify` skill

A new skill that validates JSON templates and section schemas before pushing to Shopify.

```yaml
---
name: validate-shopify
description: >
  Use when: writing or modifying Shopify template JSON files,
  section schemas, or settings. Also use before any shopify theme push.
  Catches schema violations, setting dependency issues, and range errors.
user-invocable: true
context: fork
---
```

### Validation checks

**Template JSON validation:**
```
1. Parse JSON — is it valid?
2. For each section in "sections":
   a. Does the section type exist in sections/ directory?
   b. Read the section's {% schema %} block
   c. For each setting value:
      - Is the value within the schema's range/options?
      - If type=range: does the value respect min/max/step?
      - If type=select: is the value one of the defined options?
   d. For each block:
      - Is the block type in the section's allowed blocks list?
      - Block count <= max_blocks?
3. Cross-reference: if setting A has "condition" on setting B, verify B is set correctly
4. Color scheme references: do they exist in settings_data.json?
```

**Section schema validation:**
```
1. Range settings: step must divide (max - min) evenly
2. Select settings: reasonable number of options (<50)
3. Block definitions: types referenced must exist in blocks/ directory
4. Setting IDs: no duplicates within a section
5. Presets: all preset setting values must be valid per the schema
```

**Settings data validation:**
```
1. Every color_scheme referenced by templates exists
2. Font values decode correctly (family_style format)
3. No orphaned settings (defined in data but not in schema)
```

### Integration with Design Agent

When the Design Agent modifies a template JSON (Phase 4), it runs `/validate-shopify` before writing. Failed validation blocks the write and shows the specific error.

### Tasks

- [ ] Create `/validate-shopify` skill
- [ ] Build schema parser (reads `{% schema %}` from .liquid files)
- [ ] Implement range/step validation
- [ ] Implement setting dependency checking
- [ ] Implement block type/count validation
- [ ] Implement cross-file reference validation
- [ ] Add validation hook to template writes
- [ ] Test against Evil Horizon's actual templates
- [ ] Document common Shopify schema gotchas

---

## Phase 4: Design Agent + Brand Onboarding

### The vision

A design agent that operates the built design system — not generating designs from scratch, but composing from real components and keeping Figma ↔ Shopify in sync.

### The agent

```yaml
# .claude/agents/design-engineer.md
---
name: design-engineer
description: >
  PROACTIVELY use when: the user wants to compose pages, modify sections,
  swap color schemes, try layouts, onboard a new client brand, or do any
  creative work using the built design system. Also use when the user
  provides brand guidelines, color palettes, or asks to set up a new store.
tools:
  - mcp__figma__use_figma
  - mcp__figma__get_screenshot
  - mcp__figma__get_metadata
  - mcp__figma__get_design_context
  - Read
  - Write
  - Glob
  - Grep
  - WebFetch
model: opus
skills:
  - design
  - validate-shopify
memory: project
---
```

### Core capabilities

**1. Template-driven page composition**

Read a Shopify template JSON → build matching Figma page from component instances:

```
Agent reads: templates/index.json
  → sections: hero (scheme-1, height=large), product-list (columns=4), footer
Agent builds: Figma frame with Hero instance + Product List instance + Footer instance
  → Each section's color scheme set via variable mode
  → Each section's settings reflected in component properties
```

**2. Bidirectional sync**

Figma → Shopify:
- Designer rearranges sections in Figma
- Agent reads new order, updates template JSON
- Validates via `/validate-shopify` before writing

Shopify → Figma:
- Developer changes template JSON
- Agent reads changes, updates Figma composition to match
- Takes screenshot for designer review

**3. Brand onboarding workflow**

```
Input: Brand guidelines (PDF, website URL, or structured brief)
  ↓
Step 1: Extract brand tokens
  - Colors (primary, secondary, accent, neutral palette)
  - Typography (heading font, body font, weights)
  - Logo assets
  - Voice/tone notes
  ↓
Step 2: Generate brand MD file
  - .claude/figma-sync/brands/{client-name}.md
  - Structured brand tokens in standard format
  ↓
Step 3: Apply to design system
  - Update Primitives collection with brand colors
  - Update text styles with brand fonts
  - Generate all 6 color schemes from the brand palette
  ↓
Step 4: Build templates
  - Compose all 14 page templates using brand-styled components
  - Take screenshots for review
  ↓
Step 5: Generate Shopify settings
  - Write settings_data.json with brand colors/fonts
  - Validate all templates against schemas
  ↓
Output: Complete Figma file + Shopify settings, ready for content
```

**4. Design iteration**

Natural language design operations:
- "Try the hero with scheme-5 (dark) and full-screen height"
- "Swap product grid for a carousel"
- "Show me 3 color scheme options for the homepage"
- "Make the collection page 3 columns on mobile"

Each operation: modify component instances or variable modes → screenshot → user reviews → iterate or approve.

### Design operations reference

The `/design` skill's reference docs catalog every operation:

```markdown
## Section Operations
- Add section: create instance, insert at position in template frame
- Remove section: remove instance, update template JSON
- Reorder: change child order in auto-layout
- Swap type: remove old instance, add new (hero → slideshow)

## Color Operations
- Swap scheme: setExplicitVariableModeForCollection(tokensCollection, modeId)
- Preview all schemes: duplicate frame 6 times, each with different mode

## Typography Operations
- Change font role: update text style font family (cascades to all instances)
- Adjust size: modify text style fontSize (cascades)

## Layout Operations
- Change columns: modify product grid wrap children width
- Adjust spacing: modify section itemSpacing or padding
- Toggle mobile: swap to mobile variant or switch breakpoint variable mode
```

### Shopify JSON awareness

The agent must understand Shopify's template structure deeply:

```json
// templates/index.json
{
  "sections": {
    "hero_abc123": {
      "type": "hero",
      "settings": {
        "color_scheme": "scheme-1",
        "section_height": "large",
        "content_position": "center"
      },
      "blocks": {
        "heading_def456": {
          "type": "text",
          "settings": { "text": "Welcome" }
        }
      },
      "block_order": ["heading_def456"]
    }
  },
  "order": ["hero_abc123"]
}
```

The agent maps each section type → Figma component, each setting → component property or variable mode, each block → nested instance.

### Tasks

- [ ] Create `.claude/agents/design-engineer.md`
- [ ] Create `.claude/skills/design/SKILL.md`
- [ ] Build design operations reference from manifest + existing components
- [ ] Implement template JSON → Figma composition
- [ ] Implement Figma → template JSON sync
- [ ] Build brand onboarding workflow (PDF/URL → brand MD → Primitives)
- [ ] Create brand MD template format
- [ ] Implement color scheme generation from brand palette
- [ ] Add `/validate-shopify` integration
- [ ] Test with Evil Horizon: compose homepage from index.json
- [ ] Test brand onboarding: new client brand → full template set
- [ ] Document the full workflow in README

---

## Open Questions (Posted for Review — See PR #5 Comments)

1. **Responsive components** — Hybrid approach proposed: breakpoint variables for shared-structure components, Viewport variants for structurally different ones. **Awaiting Pablo's input on the split list.**
2. **Design agent scope** — Our position: layout-only to start. Content generation as future add-on.
3. **Brand onboarding format** — Our position: structured `brand-brief.md` template + optional URL scraping.
4. **Shopify validation depth** — Our position: structural AND semantic (range/step math, setting dependencies).
5. **Sync direction** — Our position: manual with diff preview. Auto-sync too risky.

---

## What We Can Start NOW (No Blockers)

These items have no dependencies on open questions:

### Immediate: Phase 1 — Skills Migration (excluding responsive conversion)
- Create `.claude/skills/` directory structure
- Migrate 11 commands to skill folders with SKILL.md frontmatter
- Rewrite descriptions as triggers
- Split large files, extract reference material
- Create gotchas.md per skill
- Add dynamic gotcha injection
- Test each skill

**Responsive component conversion deferred** until Pablo confirms the split list.

### Immediate: Phase 3 — Shopify Validation Skill
- Create `/validate-shopify` SKILL.md
- Build schema parser
- Implement all validation checks
- Test against Evil Horizon templates

### Immediate: GitHub Pages Landing Page
- Create `docs/index.html`
- Capture screenshots from Figma
- Enable GitHub Pages
- See `docs/github-pages-plan.md` for full spec

### Blocked: Waiting on Pablo
- Responsive component conversion (Phase 1 subtask)
- Phase 4 Design Agent (depends on Phase 1 + 3 completion)

---

## Timeline Estimate

| Phase | Effort | Status |
|-------|--------|--------|
| Phase 1: Skills migration (core) | 1 session | **Ready to start** |
| Phase 1: Responsive conversion | 0.5 session | Blocked — awaiting Pablo |
| Phase 2: Hooks + learning | 1 session | After Phase 1 core |
| Phase 3: Shopify validation | 1-2 sessions | **Ready to start** (parallel with Phase 1) |
| Phase 4: Design agent | 2-3 sessions | After Phase 1 + 3 |
| Landing page | 1 session | **Ready to start** (parallel with anything) |

Phases 1 (core), 3, and landing page can all run in parallel starting now.
