# Conclusions: How to Improve Our Skill System

**Date:** 2026-03-27
**Based on:** [Claude Code Skills Best Practices Research](./claude-code-skills-best-practices-research.md)
**Current state:** 11 commands in `.claude/commands/`, no skills, no agents, no hooks

---

## Table of Contents

1. [Current System Assessment](#1-current-system-assessment)
2. [Migration: Commands to Skills](#2-migration-commands-to-skills)
3. [Restructured Skill Architecture](#3-restructured-skill-architecture)
4. [Introducing Agents](#4-introducing-agents)
5. [The Design Agent: Designing with the System](#5-the-design-agent)
6. [Self-Learning System](#6-self-learning-system)
7. [Hooks](#7-hooks)
8. [CLAUDE.md Optimization](#8-claudemd-optimization)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Current System Assessment

### What We Have

11 markdown files in `.claude/commands/` acting as slash commands:

| Command | Role | Lines (est.) |
|---------|------|-------------|
| `/setup` | Configure store + Figma | ~150 |
| `/analyze-theme` | Extract design tokens | Large |
| `/build-foundations` | Create Figma variables/styles | Large |
| `/propose-components` | Propose component inventory | Large |
| `/build-components` | Build atoms/blocks/sections | Very large |
| `/compose-page` | Assemble page compositions | Large |
| `/build-design-system` | Orchestrator (runs all above) | ~210 |
| `/build-design-rules` | Generate design rules file | Medium |
| `/sync-colors` | Bidirectional color sync | Medium |
| `/validate-instances` | Audit instance compliance | Medium |
| `/refresh-figma-practices` | Update best practices cheatsheet | Medium |

Plus supporting infrastructure:
- `manifest.json` -- shared state
- Theme profiles (`theme-profiles/*.json`)
- Best practices cheatsheet (`figma-best-practices.md`)
- Auto-memory files (4 feedback entries)

### What Works Well

1. **Sequential pipeline with resume logic** -- robust checkpoint system via manifest
2. **Theme profiles** -- pre-loaded knowledge that accelerates analysis
3. **Instance-only architecture** -- clear design philosophy enforced across all skills
4. **Manifest as single source of truth** -- clean state management between phases
5. **Best practices cheatsheet** -- centralized Figma knowledge
6. **Memory-based feedback** -- capturing real mistakes (alpha variants, component selection, etc.)

### What Needs Improvement

1. **Everything is a command** -- commands inject into main context, consuming budget. Large skill files eat context window fast.
2. **No auto-invocation** -- users must know and type `/build-components`. Claude can't proactively suggest or trigger the right skill.
3. **No isolation** -- all commands run in the main context. A failure in `/build-components` pollutes the entire session.
4. **No hooks** -- no automatic formatting, quality gates, or feedback capture.
5. **No design agent** -- the system builds design systems but can't design WITH them (the stated goal).
6. **No self-learning beyond manual memory** -- feedback is saved manually, not systematically integrated.
7. **Skill files are too long** -- some commands are likely 500+ lines, exceeding the recommended <500 line limit. Claude may start ignoring late instructions.
8. **Descriptions are summaries, not triggers** -- per CSO research, descriptions should tell Claude WHEN to fire, not WHAT the skill does.

---

## 2. Migration: Commands to Skills

### Why Move

| Aspect | Commands (`.claude/commands/`) | Skills (`.claude/skills/`) |
|--------|-------------------------------|---------------------------|
| Trigger | Manual `/slash` only | Auto-invocable + manual |
| Context | Injected into current window | `context: fork` = isolated |
| Discovery | Must know the name | Claude matches by description |
| Structure | Single file | Folder with supporting files |
| Composition | Read other command files | Can reference docs, scripts, templates |
| Cross-tool | Claude Code only | Agent Skills standard (multi-tool) |

**Recommendation:** Migrate all 11 commands to `.claude/skills/`. This is the single highest-impact change.

### How to Migrate

For each current command:

```
.claude/commands/build-foundations.md
  ↓ becomes ↓
.claude/skills/build-foundations/
  SKILL.md              # Core instructions (<500 lines)
  reference/            # Supporting docs pulled out of main file
    variable-structure.md
    text-style-rules.md
  gotchas.md            # Known failure points (from memory + experience)
```

**Key changes in SKILL.md frontmatter:**

```yaml
---
name: build-foundations
description: >
  Use when: the user wants to create Figma variable collections,
  text styles, or a style guide page from analyzed theme tokens.
  Requires: manifest.json with foundations data and buildStatus.foundations !== "complete".
user-invocable: true
context: fork
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, mcp__figma__get_metadata, Read, Write, Grep, Glob]
---
```

**Critical:** Change descriptions from summaries to triggers (CSO pattern from Superpowers).

---

## 3. Restructured Skill Architecture

### Proposed Skill Map

```
.claude/skills/
  ├── setup/                    # Phase 1 - Configure pipeline
  │   └── SKILL.md
  │
  ├── analyze-theme/            # Phase 2 - Extract tokens
  │   ├── SKILL.md
  │   └── reference/
  │       ├── color-extraction-rules.md
  │       └── typography-mapping.md
  │
  ├── build-foundations/         # Phase 3 - Figma variables/styles
  │   ├── SKILL.md
  │   ├── reference/
  │   │   ├── variable-structure.md
  │   │   └── text-style-rules.md
  │   └── gotchas.md
  │
  ├── propose-components/        # Phase 4 - Component inventory
  │   ├── SKILL.md
  │   └── reference/
  │       └── selection-criteria.md
  │
  ├── build-components/          # Phase 5 - Construct in Figma
  │   ├── SKILL.md
  │   ├── reference/
  │   │   ├── atoms-guide.md
  │   │   ├── blocks-guide.md
  │   │   └── sections-guide.md
  │   └── gotchas.md
  │
  ├── compose-page/              # Phase 6 - Assemble pages
  │   └── SKILL.md
  │
  ├── build-design-system/       # Orchestrator
  │   └── SKILL.md
  │
  ├── build-design-rules/        # Generate code mapping
  │   └── SKILL.md
  │
  ├── sync-colors/               # Maintenance
  │   └── SKILL.md
  │
  ├── validate-instances/        # Audit
  │   └── SKILL.md
  │
  ├── refresh-figma-practices/   # Knowledge update
  │   └── SKILL.md
  │
  ├── design/                    # NEW - Design with the system
  │   ├── SKILL.md
  │   ├── reference/
  │   │   ├── composition-patterns.md
  │   │   └── design-operations.md
  │   └── gotchas.md
  │
  └── learnings/                 # NEW - Self-learning skill
      └── SKILL.md
```

### Should We Have More or Fewer Skills?

**Same number of pipeline skills (11), plus 2 new ones (13 total).**

The current pipeline granularity is correct. Each phase has clear inputs, outputs, and checkpoint logic. Merging phases (e.g., analyze + build-foundations) would create monolithic skills that exceed 500 lines and make resume logic harder. Splitting further (e.g., build-atoms vs build-blocks as separate skills) would add unnecessary overhead -- they're already sub-phases within build-components.

**New skills to add:**
1. **`/design`** -- The design agent skill (see section 5)
2. **`/learnings`** -- Self-learning review skill (see section 6)

---

## 4. Introducing Agents

### Why Agents

Skills with `context: fork` give isolation but still run synchronously. For the build pipeline this is fine. But for **design tasks** (the stated next goal), we need an agent that:
- Understands the built design system
- Can compose new designs using existing components
- Operates with its own tools and model configuration
- Can be invoked proactively when the user discusses design

### Proposed Agent: Design Engineer

```
.claude/agents/design-engineer.md
```

```yaml
---
name: design-engineer
description: >
  PROACTIVELY use when: the user wants to create, modify, or iterate
  on designs in Figma using the built design system. This includes
  composing pages, modifying sections, swapping color schemes,
  trying different layouts, updating typography, or any creative
  design work that uses existing components and variables.
tools:
  - mcp__figma__use_figma
  - mcp__figma__get_screenshot
  - mcp__figma__get_metadata
  - mcp__figma__get_design_context
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__resize_page
  - Read
  - Glob
  - Grep
model: opus
skills:
  - design
memory: project
---
```

**Key:** The `PROACTIVELY` keyword in the description makes Claude auto-invoke this agent when the user discusses design work. The agent loads the `design` skill for domain knowledge and has access to both Figma and Chrome DevTools.

### Agent vs Skill Decision Matrix

| Task Type | Use Skill | Use Agent |
|-----------|-----------|-----------|
| Pipeline phases (setup, analyze, build...) | Yes (context: fork) | No |
| Quick maintenance (sync-colors, validate) | Yes (inline) | No |
| Creative design work | No | Yes (design-engineer) |
| Multi-step design iteration | No | Yes (design-engineer) |
| Feedback review | Yes (learnings) | No |

---

## 5. The Design Agent: Designing with the System

This is the missing piece. Currently the system builds design systems but doesn't design with them.

### `/design` Skill (loaded by design-engineer agent)

```yaml
---
name: design
description: >
  Use when: the user wants to create, modify, or compose designs in Figma
  using the built design system. Covers page composition, section arrangement,
  color scheme changes, typography experiments, and layout iterations.
user-invocable: true
disable-model-invocation: true
context: fork
agent: design-engineer
---
```

### Capabilities

The design skill should enable these operations:

**Page Composition:**
- "Create a homepage with hero, featured collection, and testimonials"
- "Build a product page that emphasizes the image gallery"
- "Make a landing page for a summer sale"

**Section Manipulation:**
- "Swap the hero section for a carousel"
- "Add a newsletter signup section before the footer"
- "Remove the featured product section"

**Color & Theme:**
- "Try this page with the Dark Brown color scheme"
- "Switch the hero to Sage Green and the footer to Black"
- "Show me the same page in all color schemes side by side"

**Typography:**
- "Make the headings larger"
- "Try the accent font for the hero heading"
- "Increase line height on body text"

**Layout:**
- "Show me desktop and mobile side by side"
- "Make the product grid 3 columns instead of 4"
- "Increase spacing between sections"

### How It Works

1. **Read manifest** to understand what's built (components, variables, schemes)
2. **Read the Figma file** via `get_metadata` to understand current state
3. **Compose designs** using `use_figma` with:
   - Only component instances (never inline frames)
   - Variable bindings (never hardcoded values)
   - Proper auto-layout (per best practices cheatsheet)
4. **Show screenshots** after each change for user feedback
5. **Iterate** based on user direction

### Design Operations Reference

The skill's `reference/design-operations.md` should catalog:
- How to instantiate each component type
- How to swap color schemes via variable modes
- How to apply typography changes via variables
- How to arrange sections in a page frame
- How to create responsive variants

This reference gets built automatically by `/build-design-rules` or accumulated through use.

---

## 6. Self-Learning System

### Architecture: Three Layers

```
Layer 1: Passive Capture (hooks)
  ├── PostToolUse hook detects corrections
  ├── Stop hook checks for unresolved issues
  └── Writes to .claude/figma-sync/learnings-queue.json

Layer 2: Active Review (skill)
  ├── /learnings command reviews queue
  ├── User approves/rejects items
  └── Approved items → skill gotchas or memory

Layer 3: Skill Integration (automatic)
  ├── Gotchas files in each skill folder
  ├── Read at skill invocation
  └── Updated when learnings are approved
```

### Layer 1: Passive Capture

A hook that monitors for correction patterns:

```json
// .claude/settings.json (hooks section)
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__figma__use_figma",
        "type": "prompt",
        "prompt": "Analyze the tool result. If the result shows an error or the user previously corrected the approach for this type of Figma operation, output a JSON object: {\"learning\": \"description of what went wrong or was corrected\", \"skill\": \"which skill this relates to\", \"severity\": \"high|medium|low\"}. If nothing notable, output null."
      }
    ]
  }
}
```

**Simpler alternative (recommended to start):** Instead of hooks, add a section to each skill's SKILL.md:

```markdown
## After Completion

If the user corrected your approach during this skill execution:
1. Read `.claude/skills/{this-skill}/gotchas.md`
2. Append the correction with date and context
3. This will inform future executions
```

This is self-contained, requires no hook infrastructure, and leverages the existing skill system.

### Layer 2: `/learnings` Skill

```yaml
---
name: learnings
description: >
  Use when: the user says "review learnings", "what have we learned",
  "update gotchas", or wants to review and consolidate feedback from
  recent design system work.
user-invocable: true
---
```

The skill:
1. Reads all `gotchas.md` files across skills
2. Reads auto-memory feedback files
3. Presents a consolidated view
4. Asks user to confirm, reject, or refine each learning
5. Updates the relevant skill's `gotchas.md`
6. Cleans up redundant or outdated entries

### Layer 3: Skill Integration

Each skill's SKILL.md includes at the top:

```markdown
## Known Gotchas

!`cat .claude/skills/{skill-name}/gotchas.md 2>/dev/null || echo "No gotchas recorded yet."`
```

This uses dynamic context injection (`` !`command` ``) to load gotchas at invocation time. The gotchas are always current because they're read from disk, not baked into the skill.

### What Gets Learned

| Category | Example | Stored In |
|----------|---------|-----------|
| Figma API quirks | "resize() must be called before fill to prevent clipping" | `build-components/gotchas.md` |
| Theme-specific | "Horizon alpha colors need separate variable collection" | `build-foundations/gotchas.md` + memory |
| Design patterns | "3-column grid works better than 4 for mobile product cards" | `design/gotchas.md` |
| Process | "Always take screenshot before AND after variable mode swap" | `compose-page/gotchas.md` |
| Tool behavior | "Chrome DevTools MCP needs page reload after password entry" | `setup/gotchas.md` |

### Migration of Existing Memory Feedback

The 4 existing memory files should seed the gotchas:

| Memory File | Target Gotcha |
|-------------|---------------|
| `feedback_component_selection.md` | `propose-components/gotchas.md` |
| `feedback_variant_analysis.md` | `propose-components/gotchas.md` |
| `feedback_missing_tools.md` | `build-components/gotchas.md` |
| `feedback_alpha_variables.md` | `build-foundations/gotchas.md` |

Keep the memory files too (they serve a different purpose -- cross-session context), but the gotchas become the primary source for skill-scoped learning.

---

## 7. Hooks

### Recommended Hooks (start minimal)

**1. Figma Screenshot After Build**
```json
{
  "PostToolUse": [
    {
      "matcher": "mcp__figma__use_figma",
      "type": "command",
      "command": "echo 'Figma modified - consider taking a screenshot to verify'"
    }
  ]
}
```

**2. Manifest Integrity Check**
```json
{
  "PreToolUse": [
    {
      "matcher": "Write(.claude/figma-sync/manifest.json)",
      "type": "prompt",
      "prompt": "Verify the manifest JSON being written is valid and preserves all existing fields. Check that no data is being lost compared to the current manifest. Output 'OK' if valid, or describe the issue."
    }
  ]
}
```

**3. Session Start Context**
```json
{
  "SessionStart": [
    {
      "type": "command",
      "command": "cat .claude/figma-sync/manifest.json 2>/dev/null | python3 -c \"import json,sys; m=json.load(sys.stdin); print(f'Design system: {m[\"theme\"][\"name\"]} v{m[\"theme\"][\"version\"]} | Build: {json.dumps(m[\"buildStatus\"])}')\" 2>/dev/null || echo 'No design system configured yet.'"
    }
  ]
}
```

**Don't over-engineer hooks.** Start with these 3 and add more only when you discover specific failure patterns.

---

## 8. CLAUDE.md Optimization

### Current State

No project-level CLAUDE.md exists. All knowledge is in skill files and memory.

### Recommendation: Add a Minimal CLAUDE.md

```markdown
# Shopify Figma Bridge

Design system automation: extracts design tokens from Shopify themes and builds
Figma design systems with variables, text styles, and components.

## Architecture

- Skills in `.claude/skills/` -- pipeline phases and design tools
- State in `.claude/figma-sync/manifest.json` -- single source of truth
- Theme profiles in `.claude/figma-sync/theme-profiles/` -- pre-loaded theme knowledge
- Best practices in `.claude/figma-best-practices.md` -- Figma engineering reference

## Key Rules

- NEVER create inline frames -- always use component instances
- NEVER hardcode colors/sizes -- always bind to Figma variables
- NEVER skip a pipeline phase -- each depends on the previous one
- NEVER proceed if an MCP tool is missing -- stop and ask user

## Quick Reference

- Full pipeline: `/build-design-system [template]`
- Design with system: `/design [description]`
- Individual phases: `/setup`, `/analyze-theme`, `/build-foundations`, `/propose-components`, `/build-components`, `/compose-page`
- Maintenance: `/sync-colors`, `/validate-instances`, `/refresh-figma-practices`
- Review learnings: `/learnings`
```

**Keep it under 30 lines.** All detail stays in skill files.

---

## 9. Implementation Roadmap

### Phase 1: Migrate Commands to Skills (Low risk, high impact)

1. Create `.claude/skills/` directory structure
2. Move each command to a skill folder with proper SKILL.md
3. Rewrite descriptions as triggers (CSO pattern)
4. Split large skill files, extracting reference material to subdirectories
5. Add `context: fork` to heavy skills (build-foundations, build-components, compose-page)
6. Add `gotchas.md` to each skill folder, seeded from existing memory feedback
7. Add dynamic gotcha injection (`` !`cat ...` ``) to each SKILL.md
8. Test each skill still works via `/skill-name`
9. Remove old `.claude/commands/` once verified

### Phase 2: Add CLAUDE.md + Hooks (Low risk, medium impact)

1. Create project CLAUDE.md (minimal, <30 lines)
2. Add SessionStart hook for pipeline status display
3. Add manifest integrity hook
4. Test hooks don't interfere with existing workflows

### Phase 3: Self-Learning System (Medium risk, high impact)

1. Create `/learnings` skill
2. Add "After Completion" section to each skill for self-updating gotchas
3. Consolidate existing memory feedback into skill gotchas
4. Test learning cycle: run skill -> get correction -> gotcha saved -> next run uses gotcha

### Phase 4: Design Agent (Medium risk, highest impact)

1. Create `.claude/agents/design-engineer.md`
2. Create `.claude/skills/design/` with SKILL.md and reference docs
3. Build design operations reference from manifest data
4. Test with simple operations: "compose a homepage", "swap color scheme"
5. Iterate based on real usage, capturing learnings
6. Expand capabilities incrementally

### Priority Order

```
Phase 1 (Skills migration)    ████████████████████  Impact: ★★★★☆  Risk: ★☆☆☆☆
Phase 2 (CLAUDE.md + Hooks)   ████████              Impact: ★★★☆☆  Risk: ★☆☆☆☆
Phase 3 (Self-learning)       ████████████████      Impact: ★★★★☆  Risk: ★★☆☆☆
Phase 4 (Design agent)        ████████████████████  Impact: ★★★★★  Risk: ★★★☆☆
```

---

## Summary of Changes

| Area | Current | Proposed |
|------|---------|----------|
| Commands | 11 in `.claude/commands/` | 0 (migrated to skills) |
| Skills | 0 | 13 in `.claude/skills/` |
| Agents | 0 | 1 (`design-engineer`) |
| Hooks | 0 | 3 (SessionStart, PostToolUse, PreToolUse) |
| CLAUDE.md | None | 1 minimal file (<30 lines) |
| Self-learning | 4 manual memory files | Gotchas per skill + `/learnings` review |
| Design capability | Only page composition | Full design agent with creative iteration |
| Context isolation | None (all injected) | `context: fork` on heavy skills |
| Auto-invocation | None | Agent + skill descriptions as triggers |
