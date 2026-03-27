# Shopify Figma Bridge

A set of Claude Code skills that automatically build a Figma design system from any Shopify theme's code.

## What it does

Given a Shopify theme codebase, these skills:
1. Extract design tokens (colors, typography, spacing) from theme settings
2. Create Figma variable collections, text styles, and a visual style guide
3. Propose which sections and blocks should become Figma components
4. Build those components in Figma with proper variable bindings
5. Assemble page compositions matching the live store

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI
- A Shopify theme codebase (any theme)
- A Figma file to build into
- MCP servers configured:
  - **Figma MCP** (`use_figma`, `get_screenshot`, `get_metadata`)
  - **Chrome DevTools MCP** (for reference capture from the live store)

## Installation

Copy the `.claude/commands/` directory into your Shopify theme project:

```bash
# From your theme project root
cp -r path/to/shopify-figma-bridge/.claude/commands/ .claude/commands/
```

Or clone this repo and symlink:

```bash
ln -s path/to/shopify-figma-bridge/.claude/commands/ .claude/commands/
```

## Usage

Run the skills in order from Claude Code:

```
/setup                    → Configure store URL, Figma file, viewports
/analyze-theme            → Extract design tokens, propose foundations
/build-foundations        → Build variables, text styles, style guide in Figma
/propose-components       → Propose which sections/blocks to create
/build-components         → Build components in Figma
/compose-page index       → Assemble homepage composition
```

Each skill reads from and writes to a shared manifest (`.claude/figma-sync/manifest.json`) that persists progress across sessions.

## Pipeline

```
/setup → /analyze-theme → /build-foundations → /propose-components → /build-components → /compose-page → /build-design-rules
```

Or run the entire pipeline at once:

```
/build-design-system [template]    → runs all phases in sequence, resuming from last checkpoint
```

- `/setup` runs once — configures environment
- `/analyze-theme` extracts global theme settings (colors, typography, spacing)
- `/build-foundations` creates Figma variables, text styles, and a style guide page
- `/propose-components` scans all sections/blocks and proposes what to build (two phases: select components, then propose variants)
- `/build-components` captures reference from the live store and builds atoms, blocks, sections
- `/compose-page <template>` assembles a page composition (e.g., homepage, product page)
- `/build-design-rules` generates a rules file mapping Figma components to theme code

## Theme profiles

For known themes, you can add a profile in `.claude/figma-sync/theme-profiles/{theme-name}.json` with pre-tuned recommendations (which settings matter, which sections to prioritize, suggested variants). The skills work without a profile — they discover everything from the theme's code.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full design rationale, decisions, and data flow.

## Skills reference

| Skill | Description |
|-------|-------------|
| `/setup` | Configure store URL, Figma file, design widths |
| `/analyze-theme` | Extract colors, typography, spacing from theme settings |
| `/build-foundations` | Create Figma variables, text styles, style guide |
| `/propose-components` | Propose component inventory + variants |
| `/build-components` | Build atoms, blocks, sections in Figma |
| `/compose-page` | Assemble page compositions from built components |
| `/build-design-rules` | Generate rules file mapping Figma components to theme code |
| `/build-design-system` | Run the full pipeline end-to-end (resumes from last checkpoint) |
| `/sync-colors` | Bidirectional color sync between Figma and Shopify |
| `/validate-instances` | Audit Figma file for instance compliance |
| `/refresh-figma-practices` | Research latest Figma best practices and propose cheatsheet updates |
