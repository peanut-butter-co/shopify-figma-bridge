# Skills system review — 2026-06-08

Exhaustive multi-agent audit of the `.claude` skills system of **shopify-figma-bridge**
(the Shopify→Figma design-system pipeline). Companion raw data:
[`skills-review-2026-06-08-findings.md`](skills-review-2026-06-08-findings.md).

## Method & scope

- **In scope:** the 13 skills under `.claude/skills/`, the shared `.claude/figma-best-practices.md`,
  state/infra under `.claude/figma-sync/` (`manifest.json`, `theme-profiles/`), `.claude/scripts/generate-proposal-html.js`,
  `.claude/settings.local.json`, and the project docs `CLAUDE.md` / `README.md` / `install.sh` / `.gitignore`.
- **Out of scope (excluded):** the Horizon theme code present only to exercise the skills —
  `assets/`, `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/`, `templates/`
  (confirmed via the repo's whitelist `.gitignore`).
- **Criteria:** Anthropic's [skill-creator best practices](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
  (groups A1–A9), the project conventions in `CLAUDE.md` plus the team learnings (groups B1–B7),
  system-level dimensions (C1–C10), and project-specific criteria mined from `docs/` (group P).
- **Execution:** 57 agents — 1 rubric-enrichment, 13 per-skill auditors + 5 cross-cutting auditors,
  an adversarial verification pass over every critical/high finding, and synthesis. `build-design-system`'s
  per-skill auditor failed mid-run and was re-run with a standalone follow-up agent (not adversarially verified).
- **Result:** **128 verified findings** (+~5 from the `build-design-system` follow-up), **4 refuted** by verification.

| Severity | Count |
|---|---|
| 🔴 Critical | 5 |
| 🟠 High | 9 |
| 🟡 Medium | 66 |
| ⚪ Low | 48 |
| ❌ Refuted | 4 |

## 1. Executive summary

1. **The happy path is dead.** `components.status === "confirmed"` is read as a gate by `build-components`
   and the orchestrator, but **no skill ever writes it** → after a complete `/propose-components`,
   `/build-components` loops on "Run /propose-components first". Reproducible with the repo's current manifest.
   *(3 of the 5 criticals are this one root cause.)*
2. **The only Shopify-writing skill (`sync-colors`) is unsafe** — it edits `config/settings_data.json` with no
   backup and with a tool mismatch (`Edit` in the body, only `Write` declared) that can overwrite the whole file.
   The word "backup" appears in **no** skill, despite `CLAUDE.md:19` mandating it.
3. **Enforcement is decorative.** `plans/pipeline-phase-enforcement.md` is unimplemented; pre-flight gates are
   read-only asserts that never prove the producer actually wrote the state; "NEVER skip a phase" has no mechanism.
4. **Manifest state-contract drift.** 13 C4 findings: many manifest fields are written-by-nobody or read-by-nobody
   (`sourceBlocks`, `buildStatus.components`, `buildMeta.practicesVersion`, `config.instancePolicy`…). No phase→keys table exists.
5. **No test/install safety net.** Zero evals anywhere; `install.sh` and `README` point at a `.claude/commands/`
   directory that no longer exists (empty install with a false success message).

## 2. Skill × severity matrix

| Skill | 🔴 | 🟠 | 🟡 | ⚪ | Σ | Hotspots |
|---|---|---|---|---|---|---|
| **system** (cross-cutting) | 2 | 4 | 23 | 15 | 44 | C4 state · A9 evals · C1 triggering · C6 backups |
| validate-shopify | – | 1 | 5 | 4 | 10 | A6 logic-in-prose · gotchas/format |
| build-components | 1 | 1 | 3 | 4 | 9 | C4 contracts · dead variant check |
| build-foundations | – | – | 5 | 4 | 9 | C2 base naming · A6 alpha · B3 |
| compose-page | – | – | 3 | 5 | 8 | C5 tools · P2 gotchas injection |
| setup | – | 1 | 5 | 2 | 8 | C5 preflight · C8 over-scope · plaintext password |
| sync-colors | 1 | – | 5 | 2 | 8 | **B4 backup · C8 Edit** |
| validate-instances | – | 2 | 3 | 2 | 7 | B3 destructive auto-fix · C5 STOP |
| build-design-rules | – | – | 3 | 4 | 7 | C4 orphan · P8 buildStatus.components |
| propose-components | 1 | – | 3 | 2 | 6 | **C4 components.status** · Step 8 schema |
| analyze-theme | – | – | 4 | 1 | 5 | P1 gotchas · A1 trigger |
| learnings | – | – | 1 | 3 | 4 | C2 gotcha format ≠ reality |
| refresh-figma-practices | – | – | 3 | – | 3 | C5 · B7 · A1 |
| build-design-system* | – | – | 2 | 3 | 5 | corroborates `components.status`; C8 tool union |

*\*follow-up audit; not adversarially verified.*

## 3. Top issues, prioritized (impact × effort)

### 🔴 CRIT-A — Dead happy path: broken `components.status` contract · effort S
- **Producer:** `propose-components/SKILL.md:162-168` writes the `components` object (atoms/blocks/sections/scope/summary) but **never** `status`.
- **Consumers:** `build-components/SKILL.md:35` and `build-design-system/SKILL.md:35` gate on `components.status === "confirmed"`.
- **Effect:** `/build-components` always fails pre-flight; the orchestrator never advances Phase 4→5. *(Criticals #1, #2, #4 = same cause.)*
- **Fix:** have Step 8 write `components.status = "confirmed"` after both confirmations, **or** change both consumers to `components.summary != null`. Pick one signal and document it in `CLAUDE.md`.

### 🔴 CRIT-B — `sync-colors` writes to Shopify unsafely · effort S
- **(B4) No backup:** `sync-colors/SKILL.md:185-186` edits `config/settings_data.json` with no prior copy. Violates `CLAUDE.md:19`. A partial write is unrecoverable.
- **(C8) Tool mismatch:** the body uses `Edit` but `allowed-tools` (`SKILL.md:7`) only declares `Write` → block, or fallback to `Write` which **overwrites the entire file**.
- **Fix:** timestamped backup before writing + add `Edit` to allowed-tools (or `Write` with a "color fields only" guard + a real diff). Codify a shared "Shopify write protocol" all writing skills inherit.

### 🟠 HIGH-C — Missing-MCP-tool STOP is inconsistent · effort S (team learning `feedback_missing_tools`)
`build-components` does it; **not** setup (1st pipeline skill, `SKILL.md:33`), validate-instances (`:30`), build-foundations, compose-page, refresh-figma-practices, sync-colors, validate-shopify. Risk: silent partial runs. **Fix:** a standard "required MCP tools → STOP" pre-flight block.

### 🟠 HIGH-D — Phase-enforcement plan unimplemented · effort L
`plans/pipeline-phase-enforcement.md` prescribes 5 changes (hard-fail gates, zero-raw-frames, completion verification, orchestrator via Skill tool, drop `context: fork`). Grep: **none exist**. The motivating failure (skip /propose-components, build a fraction of atoms, compose with raw frames) is still reproducible. **Fix:** implement it or formally close it in the plan header.

### 🟠 HIGH-E — Installer & README broken (point at `.claude/commands/`) · effort M
`install.sh:52` does a silent 404 `curl` yet prints "Done! Installed 7 skills"; `README.md:25-36` copies/symlinks `.claude/commands/`. Skills live in `.claude/skills/`. **Fix:** rewrite both to `.claude/skills/` and make a failed download exit non-zero.

### 🟠 HIGH-F — Variant-completeness check is dead · effort S
`build-components/reference/validation.md:70-73` treats `section.variants` as flat arrays, but they are now objects → `expectedCount = NaN` → the comparison never fires → **never flags incomplete components** (breaks "Do NOT skip variants"). **Fix:** `v.values.length` or read `section.totalVariantCombinations`.

### 🟠 HIGH-G — Destructive auto-fix without visual verification · effort M
`validate-instances/SKILL.md:129-142` deletes inline frames and re-parents instances in live templates with one batch confirmation, no per-fix screenshot (despite holding `get_screenshot`), and the original is already gone. Conflicts with the screenshot-validation learning. **Fix:** screenshot + critical evaluation after each swap; one at a time.

### 🟠 HIGH-H — `validate-shopify`: deterministic validation in prose · effort L
`validate-shopify/SKILL.md:86-96` re-derives JSON.parse, schema regex, range modulo, ID uniqueness and cross-ref as pseudocode every run. **Fix:** a `scripts/validate.js` that emits the report; SKILL.md keeps only when-to-invoke and interpretation.

## 4. Findings by dimension (consolidated themes)

- **C4 · Manifest state contract (13)** — orphan fields: `sourceBlocks` (read, never written), `buildStatus.components` (read by build-design-rules; build-components writes flat keys), `buildMeta.practicesVersion`, `config.instancePolicy`/`mobilePlacement`, `foundations.requiredAtoms`, `theme.profileValidation`, `summary` schema drift. → **Add a phase→keys-written→keys-read table** to `CLAUDE.md` and reconcile every skill.
- **A9 · Evals (13)** — zero coverage across all 13 skills; several are highly testable (validate-shopify, analyze-theme, setup). → adopt an `evals/evals.json` convention system-wide.
- **B7 + P11 · Self-learning loop (14)** — `gotchas.md` missing in analyze-theme, setup, validate-shopify, build-design-rules, learnings; "After Completion" step missing in nearly all; the gotcha format defined in `learnings/SKILL.md:132-140` **does not match** the format the real files use.
- **C1 · Triggering / overlap (8)** — thin descriptions, no negative clause, no ordinal anchor. Collisions: orchestrator↔6 phases, validate-shopify↔validate-instances, learnings↔refresh, analyze↔foundations, propose↔build, build↔compose, sync-colors↔validators. → **uniform template**: `<scope> · <pipeline position> · Not for <neighbour>`.
- **C8 · allowed-tools (7)** — sync-colors missing `Edit` (critical); setup over-scoped (`use_figma`/`get_screenshot`/`Glob`/`Grep` for a config-only skill); validate-shopify declares `Write` while read-only; build-design-rules `get_screenshot` unused; build-design-system carries the union of all phase tools without a comment.
- **C2/C3 · Consistency/DRY (10)** — Figma-API gotchas duplicated (inline `build-foundations/SKILL.md:215-223` vs gotchas.md vs figma-best-practices.md); instance-only rule restated in 4–6 places with diverging wording; no documented rule for when to use `gotchas.md` vs `reference/`; `Grey`/`Gray` drift in sync-colors; magic number `6 schemes`; `375px` vs `mobileWidth`.
- **C7 · Doc/infra (3)** — `CLAUDE.md:24` omits `/build-design-rules` from the pipeline and `/validate-shopify`+`/learnings` from Maintenance; `.gitignore:41` ignores the wrong path (`theme-profiles/manifest.json`; the real manifest is only caught by the `*` catch-all).
- **C8/security (1, medium)** — `setup/SKILL.md:43` stores `storePassword` in plaintext in the manifest without warning (verified: the manifest is git-ignored).
- **C10 · Script (1, low)** — `generate-proposal-html.js:259-261` interpolates some numeric/array fields without `esc()`.

## 5. Per-skill status

- **build-components** 🔴 — nonexistent `sourceBlocks` + NaN variant check; ALL-CAPS theatrics.
- **propose-components** 🔴 — never writes `components.status`; Step 8 under-specifies the schema the generator consumes.
- **sync-colors** 🔴 — missing backup + undeclared `Edit`; `context: fork` should be inline.
- **setup** 🟠 — no tool pre-flight (1st skill); plaintext password; over-scoped tools.
- **validate-instances** 🟠 — destructive auto-fix without verification; no tool STOP; never reads the manifest.
- **validate-shopify** 🟠 — deterministic logic in prose (→script); no gotchas.md; unnecessary `Write`.
- **build-foundations** 🟡 — inconsistent `{Group}/Base` naming; alpha math in prose; duplicated gotchas.
- **compose-page** 🟡 — no tool STOP; ignores `storePassword`; hardcoded `375px`; gotchas injection inside a fence (see §6).
- **build-design-rules** 🟡 — orphan phase (nothing chains it); gates nonexistent `buildStatus.components`; no gotchas.md.
- **analyze-theme** 🟡 — no gotchas.md (only pipeline phase without one); ambiguous 2nd description clause.
- **build-design-system** 🟡 — solid orchestrator; inherits the `components.status` bug; allowed-tools = union without a comment.
- **learnings** ⚪ — preaches a gotcha format ≠ the real one; no capture of its own corrections.
- **refresh-figma-practices** ⚪ — no WebSearch/WebFetch guard; single-phrase description.

## 6. Appendix — refuted, contested & coverage

**Refuted by adversarial verification (4)** — not counted as findings:
- ×2 "propose-components can't run Step 9 because `Bash` isn't in allowed-tools" → rejected (the `node`/`open` is likely run by the main agent, not the skill).
- "validate-instances gotchas.md missing" (B7) and "injection inside ```sh fence" (build-components, P2) → rejected as mis-framed/duplicate.

**⚠️ Contested — needs a manual check (potentially high impact):** verification **contradicted itself** on whether `!cat … gotchas.md` inside a ```sh fence actually executes as dynamic context. One instance was refuted; `compose-page/SKILL.md:10-12` remained a finding. **If it does not execute inside the fence, the gotchas/learnings loop is silently broken across ~10 skills** — worth confirming in a real run before any B7 fix.

**Coverage notes (method honesty):**
- The per-skill auditor for `build-design-system` failed in the workflow; covered by a standalone follow-up agent **not** adversarially verified.
- One verifier (for HIGH-E, install.sh) failed → that finding is "unverified", but corroborated by the README finding (confirmed, same cause).
- Synthesis was done in the main thread because the synthesis subagent hit a transient rate limit. The 128 raw findings live in the workflow output and in the companion file.

## 7. Recommended fix order

1. **CRIT-A** + **CRIT-B** + **HIGH-C** + **HIGH-F** — four small, high-impact edits (effort S) that restore the happy path and make Shopify writes safe.
2. Confirm the §6 contested gotchas-injection question (one quick real-run test) — it gates every B7/P11 fix.
3. **HIGH-E** (installer/README) and the C7 doc fixes — cheap, restore trust in install/docs.
4. **C4 state-contract table** — the highest-count theme; write the phase→keys table, then reconcile skills.
5. **HIGH-D** (phase enforcement) and **HIGH-H** (validate-shopify script) — larger, schedule deliberately.
6. System-wide conventions: description template (C1), `evals/` convention (A9), self-learning loop (B7/P11), allowed-tools least-privilege (C8).
