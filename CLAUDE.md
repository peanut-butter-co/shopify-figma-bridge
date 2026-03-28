# Shopify Figma Bridge

Design system automation: extracts tokens from Shopify themes,
builds Figma design systems, and enables design-to-code workflows.

## Architecture

- Skills: `.claude/skills/` — pipeline phases and design tools
- Commands: `.claude/commands/` — legacy (migrating to skills)
- State: `.claude/figma-sync/manifest.json` — single source of truth
- Profiles: `.claude/figma-sync/theme-profiles/` — theme knowledge
- Practices: `.claude/figma-best-practices.md` — Figma engineering ref

## Rules

- NEVER create inline frames — always use component instances
- NEVER hardcode colors/sizes — always bind to Figma variables
- NEVER skip a pipeline phase — each depends on the previous
- EVERY text node must have a textStyleId AND a variable-bound fill
- ALL Shopify JSON writes require backup + diff preview + user approval
- Sync is bidirectional — Figma ↔ Shopify in both directions

## Pipeline

`/setup` → `/analyze-theme` → `/build-foundations` → `/propose-components` → `/build-components` → `/compose-page`

Or run everything: `/build-design-system [template]`

## Maintenance

- `/sync-colors` — bidirectional color sync
- `/validate-instances` — audit instance compliance
- `/validate-shopify` — schema + JSON validation
- `/refresh-figma-practices` — update best practices
- `/learnings` — review and consolidate gotchas
