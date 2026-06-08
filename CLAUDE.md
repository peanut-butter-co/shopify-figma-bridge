# Shopify Figma Bridge

Design system automation: extracts tokens from Shopify themes,
builds Figma design systems, and enables design-to-code workflows.

## Architecture

- Skills: `.claude/skills/` — pipeline phases and design tools
- State: `.claude/figma-sync/manifest.json` — single source of truth
- Profiles: `.claude/figma-sync/theme-profiles/` — theme knowledge
- Practices: `.claude/figma-best-practices.md` — Figma engineering ref
- Skill layout: each `SKILL.md` opens with the `gotchas.md` loader header and ends with an `## After Completion` self-learning step; `reference/*.md` holds long procedures, `evals/evals.json` holds triggering evals, and Figma-mutating skills keep a `gotchas.md` (the single home for their Plugin-API gotchas)

## Rules

- NEVER create inline frames — always use component instances
- NEVER hardcode colors/sizes — always bind to Figma variables
- NEVER skip a pipeline phase — each depends on the previous; every pre-flight gate is a HARD STOP, not advice (if an upstream key is missing, STOP and route the user to the prerequisite skill — never improvise or partially build)
- EVERY text node must have a textStyleId AND a variable-bound fill
- ALL Shopify JSON writes require backup + diff preview + user approval
- Sync is bidirectional — Figma ↔ Shopify in both directions

## Pipeline

`/setup` → `/analyze-theme` → `/build-foundations` → `/propose-components` → `/build-components` → `/compose-page`

Optional, after `/build-components`: `/build-design-rules` — generates `design-rules.json`, the Figma→code mapping that `/compose-page` and `/sync-colors` consume opportunistically. Run it before `/compose-page` to enable component name-matching.

Or run everything: `/build-design-system [template]`

## Manifest state contract

`manifest.json` is the single source of truth. Each phase writes specific keys; the next phase gates on them. Producers and consumers must agree — keep this table and the skills in sync.

| Phase | Writes | Gate the next phase reads |
|---|---|---|
| `/setup` | `config.*`, `theme.{name,version,author,hasProfile}` | — |
| `/analyze-theme` | `foundations`, `theme.hasProfile`, `theme.profileValidation` | `foundations != null` |
| `/build-foundations` | `buildStatus.foundations = "complete"` | `buildStatus.foundations === "complete"` |
| `/propose-components` | `components.{atoms,blocks,sections,skippedSections,scope,summary}`, `components.status = "confirmed"` | `components.status === "confirmed"` |
| `/build-components` | `buildStatus.{atoms,blocks,"sections-desktop","sections-mobile"} = "complete"`, `buildMeta.{practicesVersion,builtAt}` | any flat `buildStatus.*` phase `=== "complete"` |
| `/build-design-rules` (optional) | `design-rules.json`, `buildStatus.designRules = "complete"` | consumed opportunistically by `/compose-page`, `/sync-colors` |
| `/compose-page` | `buildStatus["composition-{template}"] = "complete"` | — |

## Maintenance

- `/sync-colors` — bidirectional color sync
- `/validate-instances` — audit instance compliance
- `/validate-shopify` — schema + JSON validation
- `/refresh-figma-practices` — update best practices
- `/learnings` — review and consolidate gotchas

## Tests

- `node .claude/scripts/skills-tests.js` — skill contract + unit harness: manifest state
  contracts (e.g. `components.status`), variant-count and color-conversion logic, and the
  required-MCP-tool STOP pre-flights. Zero dependencies; exit 0 = green. Fixture:
  `.claude/figma-sync/manifest-test.json`.
- `.claude/skills/<name>/evals/evals.json` — per-skill triggering/behavior evals (A9); the
  harness validates they are well-formed and runs sync-colors' conversion cases against
  `color-utils.js`.
