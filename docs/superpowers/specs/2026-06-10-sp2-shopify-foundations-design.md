# SP-2: Shopify foundations build (`/build-shopify-foundations`) — design

> Part of the downstream-build reshape. Replaces the abandoned monolithic `/configure-store`
> idea (see §1). This is the FIRST downstream build skill: **foundations only**.

> **Revised 2026-06-10 (lean-write pivot).** The write *mechanism* described below (the backup + reserialize +
> `verifyOnlyChanged` safe-write substrate) was superseded after the first live run: we now **edit directly**
> (surgical `Edit` / programmatic set-by-path) → validate → spot-check the preview, with **no backups** (git is
> the net; dev theme only, never prod). The discovery/mapping logic (`foundations-map.js`) and the gap
> transparency are unchanged. Rationale + recovery copy:
> `docs/superpowers/archive/2026-06-10-safe-write-substrate/README.md`.

## 1. Context

The downstream tooling (Phases 7–8) was originally framed as two global lanes — `/configure-store`
(all config) then `/scaffold-*` (all code). The user rejected that as too optimistic: a process that
tries to set every section/block setting at once breaks against theme reality. The real workflow,
mirrored from the Figma side (`/build-foundations` → `/build-components`), is:

1. **Foundations first** (colors + fonts, global, once).
2. **Then component by component** — and within each component, *configure as far as settings reach,
   then code the rest*, as ONE human-assisted step (inspect → propose plan → developer approves/
   corrects → execute).

This spec covers **only step 1**: a `/build-shopify-foundations` skill (call it Phase 7a). The
per-component build is a separate later spec (referred to here as **spec #3**).

**Host correction (resolved during this brainstorm).** SP-1 pointed `config.themeRoot` at a bare
Shopify *Skeleton* theme placeholder on Google Drive. The real Aristopet host is
**crunchy-horizon** — a fork of Shopify's Horizon theme with custom typography — on the `develop`
branch of `peanut-butter-co/crunchy-horizon`. It is now checked out at the **repo root** (gitignored
by the `*` whitelist in `.gitignore`), and `aristopet/manifest.json › config.themeRoot` is repointed
to `"."`. This correction matters because Horizon already ships a native color-scheme system and a
rich typography system — so foundations is mostly **config against existing systems**, not building
a system from scratch (which is what the Skeleton would have required).

**Input.** This skill consumes `.claude/figma-sync/aristopet/manifest.json › foundations` (the SP-1
deliverable: 4 color schemes, 3 font roles, a type scale, spacing).

## 2. Goal

A human-assisted skill that lands Aristopet's reconstructed foundations into crunchy-horizon's
**native** color-scheme and typography systems — populating what maps cleanly, and **proposing the
schema extensions that close the gaps** — gated by a `backup → diff → approval` safe write.

## 3. Decisions

- **D1 — Scope = foundations only.** Colors + fonts/type. The per-component build is spec #3.
  Spacing, collections, catalog, and any section/block settings are out of scope.
- **D2 — Use crunchy-horizon's NATIVE systems.** Populate the existing `color_scheme_group` and
  `type_*` settings; **extend** the schema where a value is not expressible. Never bake a parallel
  token system that fights the theme.
- **D3 — Human-assisted + gap-transparent.** `inspect → propose plan → approve/correct → execute`.
  The proposal **explains every gap** and the schema modification that closes it. Nothing is
  approximated silently. (The user's concrete instruction: for `h1 = 80px` not on Horizon's size
  ladder, the skill *proposes adding 80px to the ladder*, it does not quietly snap to 88.)
- **D4 — Host = crunchy-horizon@develop at the repo root; `themeRoot = "."`.** Resolved relative to
  the repo root (where the skill runs).
- **D5 — Extract a reusable safe-write substrate** (what the decomposition called SP-0b). It lives
  in committed tooling, is unit-tested, and is **reused by spec #3's per-component build**.

## 4. Skill behavior (the pipeline)

```
inspect → map + detect gaps → propose plan (explain gaps) → developer approves/corrects → execute → record
```

1. **Inspect.** Read `aristopet/manifest.json › foundations`. Read the **live** theme config at
   `themeRoot`: `config/settings_schema.json` (the `color_scheme_group` roles, the `type_*` settings
   and their option lists) and `config/settings_data.json` (current schemes + type values). The skill
   reads the LIVE schema — it must NOT assume stock Horizon, because crunchy's customizations vary.
2. **Map + detect gaps.** Run the pure mapping (see §5). Produce: the planned `settings_data.json`
   writes (4 schemes + fonts + type values), the planned `settings_schema.json` extensions, and a
   list of **gaps**, each with a proposed resolution:
   - *missing scale value* (`type_size_h1` has no `80`) → propose **adding the option**.
   - *orphan role* (`foreground_chip` has no Horizon role) → propose **drop** (with note).
   - *surplus schemes* (Horizon ships `scheme-1..6` + a UUID scheme; Aristopet uses `scheme-1..4`)
     → propose **prune** the unreferenced ones.
   - *font not in the Shopify library* (if `Instrument Sans` is unavailable) → propose a **custom
     font source** (crunchy already has this pattern: Selfie Neue Rounded / Boldonse / Arthura).
   - *tokenized line-height/letter-spacing gap* (Aristopet's exact px aren't a token) → propose the
     **nearest token**, and flag that an exact value would need a new token + its CSS resolution
     (larger surface — developer decides).
3. **Propose plan.** Present a structured plan: the diff preview of both files, plus a "gaps &
   resolutions" section. The developer approves or corrects (e.g., "use 72 not 80", "keep scheme-5").
4. **Execute.** Via the safe-write substrate (§6), against the approved plan.
5. **Record.** Set `manifest.buildStatus.shopifyFoundations = "complete"` + stamp `buildMeta`.

## 5. The mappings (Aristopet → crunchy-horizon)

Implemented as a **pure function** `foundationsMap(foundations, liveSchema, liveData) → { schemeWrites,
typeWrites, fontWrites, schemaExtensions, gaps, pruneSchemes }` so it is unit-testable without
touching a real theme (§7).

### 5.1 Colors — near 1:1 (config)

Horizon's `color_scheme_group` (id `color_schemes`) defines its roles with **`"alpha": true`** on
every color — so Aristopet's alpha colors (`#1e1b1814`, `#c9a88280`, `#faf7f21a`) store directly as
8-digit hex / rgba. **The alpha-variant gotcha is resolved natively by the host.**

| Aristopet role | Horizon role | Note |
|---|---|---|
| `background`, `foreground_heading`, `foreground`, `border`, `primary` | identical ids | exact |
| `primary_button_background` / `_text` / `_border` | identical ids | exact |
| `secondary_button_background` / `_text` | identical ids | exact |
| `inputs_text` / `inputs_border` / `inputs_hover_background` | `input_text_color` / `input_border_color` / `input_hover_background` | rename map |
| `foreground_chip` | — | orphan → propose drop |
| — | `primary_hover`, `shadow`, all `*_hover_*`, `variant_*`, `selected_variant_*` | Horizon-only → keep theme defaults (Aristopet doesn't specify) |

**Schemes.** Populate `scheme-1..4` from Aristopet's four schemes (these are exactly the ids the
`compositions[*].order[*].colorScheme` references — invariant 5). Propose pruning the
host's surplus `scheme-5`, `scheme-6`, and the UUID-named scheme (unreferenced).

### 5.2 Fonts — families (config)

| Horizon setting | Aristopet source | Value |
|---|---|---|
| `type_body_font` | body role | DM Sans 400 (`dm_sans_n4`) |
| `type_subheading_font` | label role | DM Sans 600 (`dm_sans_n6`) |
| `type_heading_font` | heading role | Instrument Sans 700 (`instrument_sans_n7`) |
| `type_accent_font` | (none) | leave the host default (Aristopet defines no accent role) |

Each `type_*_font` has a companion `type_*_font_source` select. If `Instrument Sans` is not in the
Shopify font library, the skill proposes adding a custom font source option (crunchy pattern) rather
than failing. (Verify availability during the plan — see §10.)

### 5.3 Type scale — the config↔code boundary

Map Aristopet presets to Horizon levels: `h1→h1`, `h2→h2`, `h3→h3`, `paragraph→paragraph`. For each:
`type_font_h*` (heading), `type_size_h*`, `type_line_height_h*`, `type_letter_spacing_h*`,
`type_case_h*`.

- **Sizes** (`type_size_h*` = `select` of px values): `h2 48` ✓, `h3 32` ✓, `paragraph 14` ✓ — exact.
  **`h1 80` is not on the ladder (…72, 88…) → propose adding `80` to `type_size_h1`'s options (D3).**
- **Line-height / letter-spacing** (`select` of tokens tight/normal/loose): map to the nearest token;
  flag the residual fidelity gap (exact px would need a new token + its CSS — bigger surface, dev
  decides).
- **Case** (`none`/`uppercase`): exact.
- **Out of scope here:** Aristopet's `overline` (13px label, uppercase) and `caption` (11px) are NOT
  heading levels — they are component-level text styles, handled in spec #3. `h4`–`h6` are left at
  Horizon defaults (Aristopet doesn't define them).

## 6. Safe-write substrate (`.claude/scripts/safe-shopify-write.js` + skill procedure)

The deterministic mechanics live in a committed, unit-tested script
`.claude/scripts/safe-shopify-write.js`; the interactive diff/approval flow lives in the skill prose.
This is the reusable piece (former SP-0b), **inherited by spec #3**.

Procedure (satisfies the hard rule *"all Shopify JSON writes require backup + diff preview + user
approval"*):

1. **Pull** — read the target files (`config/settings_schema.json`, `config/settings_data.json`).
2. **Backup** — copy each to `.claude/figma-sync/backups/<file>.<YYYYMMDD-HHMMSS>.json` (outside the
   theme dir). `settings_data.json` carries a "may be overwritten by the theme editor" header, so the
   backup is mandatory.
3. **Build "after" in memory** and **diff-preview** at key level (before → after).
4. **User approval** — block until approved.
5. **Write** — apply only the approved paths.
6. **Verify** — re-read; assert only approved paths changed; **restore from backup** on any violation.
7. **Validate** — run `.claude/scripts/shopify-validate.js` against `themeRoot`.

Script-side (testable) functions: `backup(themeRoot, relPath)`, `verifyOnlyChanged(before, after,
approvedPaths) → violations[]`. Interactive steps (diff render, approval) stay in the skill.

## 7. Tests

- **Golden fixture** under `.claude/scripts/fixtures/shopify-foundations/`: a committed snapshot of
  the relevant crunchy-horizon config (the `color_scheme_group` block + the `type_*` settings of
  `settings_schema.json`, plus `settings_data.json`) — kept separate from the live (gitignored) theme
  so the harness is reproducible. The pure `foundationsMap(...)` (§5) over this fixture + Aristopet's
  foundations must produce a **deterministic expected plan**: `scheme-1..4` populated (with alpha),
  the font writes, the type writes, the `schemaExtensions` adding `80` to `type_size_h1`, and the
  `pruneSchemes` list. Assert deep-equality against a committed expected-output JSON.
- **Safe-write unit tests:** `backup` creates the timestamped file; `verifyOnlyChanged` returns a
  violation when a non-approved key differs (so the restore path fires).
- **New harness group** `'SP-2: shopify-foundations build'` in `skills-tests.js`, classified in
  `GROUP_STRENGTH` (HR-3 meta-check). Plus the skill's `evals/evals.json` (triggering + behavior).

## 8. State + file structure

- **Skill files** (mirror the Figma-side shape): `.claude/skills/build-shopify-foundations/{SKILL.md
  (gotchas loader header + `## After Completion`), gotchas.md, reference/*.md, evals/evals.json}`.
- **Tooling:** `.claude/scripts/foundations-map.js` (pure mapping), `.claude/scripts/safe-shopify-
  write.js` (substrate), `.claude/scripts/fixtures/shopify-foundations/` (golden fixture).
- **`.gitignore`:** no change needed — `!.claude/scripts/fixtures/**` already whitelists the new
  fixture dir, and `!.claude/scripts/*.js` already whitelists the new scripts.
- **Pre-flight gates (HARD STOP):** `themeRoot` resolves to a real theme (`config/settings_schema.json`
  exists); `aristopet … foundations != null`; the theme's schema contains a `color_scheme_group`
  (else STOP — wrong host, route the user to fix `themeRoot`).
- **State written:** `manifest.buildStatus.shopifyFoundations = "complete"` + `buildMeta.builtAt`.
  (Add a row to the CLAUDE.md manifest state-contract table.)

## 9. Out of scope / follow-ups (NOT this spec)

- **Recompute SP-1 reachability/work-order against crunchy-horizon.** SP-1's `design-rules.json` and
  `work-order.json` were computed against the bare Skeleton, where 20/22 components were `code`
  (`no-candidate`). Against Horizon (a rich theme) many of those verdicts will flip `code → config`.
  This is a **separate task that must run before spec #3** and will change spec #3's inputs
  materially. Flagged here so it is not forgotten.
- `overline` / `caption` component-level text styles → spec #3.
- The per-component build skill → spec #3.
- Collections / catalog → later.

## 10. Risks

- **Instrument Sans availability** in the Shopify `font_picker` is unconfirmed. Mitigation: the skill
  proposes a custom font source (crunchy pattern) if it is absent. Verify in the plan.
- **Tokenized line-height/letter-spacing** cannot be pixel-exact via settings alone. v1 maps to the
  nearest token and flags the gap (acceptable under D3 — transparent, not silent).
- **`settings_data.json` theme-editor overwrite** — the file is admin-generated; concurrent theme-
  editor use could clobber a write. The backup + verify steps mitigate; document the caveat.
- **Live-schema drift** — the mapping must read the live schema each run (crunchy's customizations
  differ from stock Horizon and may change). The pure function takes the live schema as input, so it
  adapts; tests pin a fixture snapshot.
