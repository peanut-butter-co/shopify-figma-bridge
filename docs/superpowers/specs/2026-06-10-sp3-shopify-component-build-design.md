# SP-3 — Per-component Shopify build (`/build-shopify-component`)

**Date:** 2026-06-10
**Status:** Approved-by-mandate (user: autonomous — "tira todo lo que puedas, iremos corrigiendo")
**Parent:** [SP-2 foundations build](2026-06-10-sp2-shopify-foundations-design.md) · [design→build contract](../../contract/design-build-contract.md)
**Consumes:** SP-1.1 recomputed `work-order.json` + `componentMap` (`design-rules.json`), `manifest.compositions`, `manifest.foundations`, the crunchy-horizon host at `config.themeRoot`.

---

## 1. Context

SP-2 landed the **foundations** (color schemes + typography) into the host theme. The downstream build now
proceeds **component by component** — the second half of the user's fixed model:

> "se configuran los foundations > colores y fonts; se va implementando componente a componente. Y en
> cada componente, primero se ve hasta dónde se llega con settings y luego el resto con código."

And, critically, config and code are **one** human-assisted step, not two commands:

> "config y código son un único paso, pero human assisted. El skill inspecciona, propone un plan al
> developer, el developer aprueba o corrige, y se ejecuta."

SP-3 is the skill that does this: **one component at a time**, *inspect → propose a gap-transparent plan →
developer approves/corrects → execute (config first, then code)* behind the SP-2 safe-write substrate. It is
the mirror, on the Shopify side, of the Figma-side `/build-components`.

The SP-1.1 recompute already classified each Aristopet component against crunchy-horizon: **15 `config`
baselines** (a host section to build ON), **6 `code`/`no-candidate`** (bespoke, author from scratch), **1
`app`**. SP-3 walks that work-order.

---

## 2. Decisions

### D1 — One skill, one unified human-assisted step (config **and** code)
`/build-shopify-component` handles **one component per cycle** and, within it, presents config + code as a
**single** inspect→propose→approve→execute step (per the user). It does **not** split into a config-only and
a code-only command. The proposal explains BOTH "how far settings reach" AND "what's left for code"; on one
approval it executes config first, then code.

### D2 — Deterministic spine in a tested helper; the skill orchestrates
The reusable, testable logic lives in `.claude/scripts/component-build.js` (pure functions). The skill
(`SKILL.md`) is a thin orchestrator + protocol + gates, exactly like SP-2's `build-shopify-foundations`. What
is deterministic (picking the next component, assembling the inspection, validating a proposed config mapping,
proposing schema extensions) is single-sourced and unit-tested; what is judgment (the semantic mapping of an
off-process design's intent to host settings, and authoring liquid) is the human-assisted live part.

### D3 — Config reach = a *validated proposed mapping*, not raw intent
Aristopet was designed off-process in its **own** setting vocabulary (`left_title`, `menu_item_1`, …), which
is not Horizon's. So "how far do settings reach" is not computable from the intent keys alone — it requires a
**semantic mapping** (intent → host setting), which the AI proposes live and the developer confirms.
`component-build.js` then **deterministically validates** that mapping against the host schema (reusing
`reachability.expressibilityIssues`) and partitions it into: **applied** (host setting exists + value
in-domain), **schemaExtensions** (a new setting, or widening an existing select/range — à la SP-2), and
**codeGaps** (no host setting → liquid). This keeps the SP-0 **bias-to-code** honest: nothing is "config"
without proof against the schema.

### D4 — Execute behind the SP-2 safe-write substrate, config-first
Reuse `safe-shopify-write.js` (backup + diff + approval + `verifyOnlyChanged`) and `shopify-validate.js`.
Execution order within the one step: **(a) config** — apply schema extensions to the host section's
`{% schema %}` + write the section instance(s) into the template / section-group JSON with the mapped
settings/blocks; **(b) code** — author/edit the section `.liquid` (+ theme blocks) for the codeGaps, bound to
foundations variables. Every write is backup → diff-preview → approval → `verifyOnlyChanged`/validate. This
extends the substrate from "config JSON only" (SP-2) to also cover section `.liquid` (schema-block injection)
and template/section-group JSON.

### D5 — Gap-transparent, never silently approximate (inherited from SP-2)
The proposal lists **every** gap: each codeGap, each schema extension, each approximation, each off-process
setting that must be re-authored. For a `code`/`no-candidate` component it proposes a **new** section
(schema + liquid skeleton bound to foundations) rather than forcing a poor host match. For an `app` component
it documents the app-slot and writes no code. The developer sees everything and decides.

### D6 — Scope of the v1 code reach: guided authoring + safe write, not a codegen engine
A deterministic liquid-generator that reproduces an arbitrary off-process design is neither tractable nor
honest. v1's code reach = the skill **guides** authoring (a liquid skeleton bound to foundations variables +
the component's intent, following `figma-best-practices` conventions) and lands it behind
backup→diff→approval→`shopify-validate`. The liquid markup is authored in-the-loop (AI + developer), not
emitted by a script. This is the highest-uncertainty surface and the first thing testing will refine — which
is exactly the user's "iremos corrigiendo."

### D7 — Per-component build status in the manifest
`buildStatus.components` is an object keyed by component slug, value `"complete"`. The skill records it after
a component's step finishes, and `nextComponent` skips completed ones, enabling the continue-to-next loop and
resumability. Gate: `buildStatus.shopifyFoundations === "complete"` (foundations must precede components).

---

## 3. Architecture

```
.claude/scripts/component-build.js        # NEW — pure, tested deterministic spine
.claude/scripts/safe-shopify-write.js     # EXTEND — section .liquid schema-injection + textual safe write
.claude/skills/build-shopify-component/    # NEW — the skill (orchestrator + protocol)
  ├── SKILL.md            # gotchas loader + gates + inspect→propose→approve→execute + continue loop + After Completion
  ├── gotchas.md          # Plugin/host write gotchas (self-learning home)
  ├── reference/
  │   ├── plan.md         # the config-reach + code-reach planning reference
  │   └── execute.md      # the safe config + code write protocol
  └── evals/evals.json    # triggering/behavior evals
```

### 3.1 `component-build.js` — exported API (deterministic, unit-tested)

- **`nextComponent(componentMap, buildStatus)` → `{ key, verdict, basis, candidate } | null`.**
  Iterates `componentMap` keys in order; returns the first whose `buildStatus.components?.[key] !== "complete"`
  with its reachability summary; `null` when all are built. Drives the continue-to-next loop + resumability.

- **`inspectComponent(key, componentMap, compositions)` → inspection object.**
  Deterministic assembly of everything the developer must see:
  `{ key, type, verdict, basis, candidate, kind, hostSchema, usages }` where `hostSchema =
  componentMap[key].schema` (the load-bearing projection) and `usages` is the list, gathered across all
  templates, of `{ template, desktopNodeId, mobileNodeId, colorScheme, settings, blocks, mobileDivergence }`.
  Throws if `key` is not in `componentMap`.

- **`configPlan(mapping, hostSchema)` → `{ applied, schemaExtensions, schemaWidenings, codeGaps }`.**
  `mapping` is the developer-confirmed proposal: an array of
  `{ intentKey, target, type, value }` where `target` is a host setting id (or `null` for pure code). For each:
  - `target == null` → `codeGaps.push({ intentKey, reason: "no host setting (code)" })`.
  - `target` present but **not** in `hostSchema.settings` → a new setting →
    `schemaExtensions.push({ id: target, type, value })` (a brand-new id, appended via `injectSchemaSettings`).
  - `target` present and in `hostSchema.settings`: validate `value` via `settingValueIssue`. In-domain →
    `applied.push({ id: target, value })`. Off-domain on a `select`/`range` → `schemaWidenings.push` (add
    option / widen min-max, à la SP-2); off-domain on any other type → `codeGaps`.
  **`schemaExtensions` (new ids) and `schemaWidenings` (existing ids) are separate buckets on purpose:** the
  append path (`injectSchemaSettings`) dedups by id and would silently no-op a widening, so a widening must
  edit its existing setting in place. Keeping them apart makes that mistake unrepresentable. Pure (reuses
  `reachability`/`shopify-validate`), so the config reach is provable, not guessed.

- **`sectionSchemaExtension(schemaText, extensions)` → new `{% schema %}` block text** (in
  `safe-shopify-write.js`, see §3.2) — injects the `schemaExtensions` settings into a section's parsed schema
  and re-serializes, leaving the rest of the `.liquid` byte-identical.

### 3.2 `safe-shopify-write.js` — extension (reuses existing primitives)

Add, alongside the existing JSONC helpers:
- **`injectSchemaSettings(liquidSource, newSettings)` → liquidSource'** — parse the `{% schema %}` (reusing
  `extractSchema`), append `newSettings` to `schema.settings` (dedup by id), re-serialize ONLY the schema
  block back into the source (the surrounding liquid is untouched). Returns the new source string.
- **`textBackup`/diff** — the existing `backup()` already copies any file; the diff for `.liquid` is textual
  (show the before/after of the schema block + any markup change). `verifyOnlyChanged` stays for JSON writes
  (templates / section-groups / settings_data).

No new write primitive philosophy — same backup → diff → approval → validate, generalized to `.liquid` +
template JSON.

### 3.3 The skill protocol (`SKILL.md`)

For a component `key` (named arg, or `nextComponent` when none):

1. **Pre-flight — HARD GATES (STOP on any failure):** manifest readable; `buildStatus.shopifyFoundations
   === "complete"` (else route to `/build-shopify-foundations`); `work-order.json` + `design-rules.json`
   present; `componentMap[key]` exists; host theme valid (`themeRoot/config/settings_schema.json`). If
   `verdict === "app"` → record the app-slot, mark complete, skip to the next.
2. **Inspect:** run `inspectComponent`; present the verdict, the host candidate + its settings/blocks, and
   the design intent (settings/blocks/colorScheme/mobileDivergence) per template usage.
3. **Propose (gap-transparent):**
   - `config` baseline → propose the intent→host **mapping**, run `configPlan`, and present **applied** /
     **schemaExtensions** (à la SP-2) / **codeGaps**, plus any `mobileDivergence` routed to code.
   - `code`/`no-candidate` → propose a **new** `sections/<slug>.liquid` (schema settings + a liquid skeleton
     bound to foundations variables) + any new theme blocks.
   - List **every** gap. Ask the developer to approve or correct (e.g. "map `left_title` → host `heading`",
     "use a new `eyebrow` setting", "this is code").
4. **Execute (only after approval), config-first:**
   a. **Config:** backup → `injectSchemaSettings` for the `schemaExtensions` → write the section instance(s)
   into the template/section-group JSON with the `applied` settings/blocks → `verifyOnlyChanged` →
   `shopify-validate`.
   b. **Code:** author/edit `sections/<slug>.liquid` (+ blocks) for the codeGaps, bound to foundations
   variables → backup → diff → approval → `shopify-validate`.
5. **Record:** `buildStatus.components[key] = "complete"`, `buildMeta.builtAt`.
6. **Continue:** offer the next un-built component (`nextComponent`).

---

## 4. Manifest state contract

| Phase | Writes | Gate the next phase reads |
|---|---|---|
| `/build-shopify-foundations` (SP-2) | `buildStatus.shopifyFoundations = "complete"` | `buildStatus.shopifyFoundations === "complete"` |
| `/build-shopify-component` (SP-3) | `buildStatus.components.<key> = "complete"`, `buildMeta.builtAt` | per-component resumability via `nextComponent` |

Gate read by SP-3: `buildStatus.shopifyFoundations === "complete"` (HARD STOP otherwise).

---

## 5. Testing

- **`component-build.js` unit group** (`SP-3: component build`) in `skills-tests.js` + `GROUP_STRENGTH`:
  `nextComponent` (skips completed, returns null when done, order), `inspectComponent` (assembles usages +
  host schema; throws on unknown key), `configPlan` (applied / schemaExtension / codeGap partition incl.
  off-domain-select → widening, new-setting → extension, null-target → codeGap), `injectSchemaSettings`
  (appends to the schema block, dedups by id, leaves surrounding liquid intact, output re-parses via
  `extractSchema`).
- **Skill evals** (`evals/evals.json`, ≥4 cases): triggers on "build the X component into the host theme";
  routes to `/build-shopify-foundations` when foundations aren't built; no-trigger on Figma-side build.
- **Harness lints:** `## After Completion` + `gotchas.md` (P11/B7); `EVAL_SKILLS` + `SELF_LEARN` entries;
  CLAUDE.md mentions the skill dir (C7/F067); allowed-tools/context (C8/C9).

---

## 6. Scope / non-goals (YAGNI)

- **In:** one tested per-component skill (config + code as one human step), the deterministic spine
  (next/inspect/configPlan/injectSchemaSettings), safe execution (config JSON + section-schema injection +
  guided liquid), buildStatus contract, docs.
- **Out (deferred):** a deterministic liquid-codegen engine (v1 guides authoring — D6); automatic semantic
  intent→host mapping (the AI proposes, the helper validates — D3); multi-design/multi-theme generalization;
  consolidating SP-2's and SP-3's schema-extension logic into one shared module (noted; not now); pushing
  theme files to the live store (build is local; deploy is out of scope).

## 7. Approaches considered

- **A — Monolithic per-component codegen** (a script emits full schema + liquid + instancing deterministically).
  *Rejected:* off-process semantic mapping + arbitrary liquid are not deterministic; brittle and dishonest.
- **B — Human-assisted protocol + tested deterministic spine + safe execution** (RECOMMENDED / chosen). The
  skill guides; helpers do inspection, config-plan validation, schema-extension, safe writes; liquid authored
  in-the-loop. Matches the user's fixed model and the SP-2 pattern.
- **C — Config-only v1, code as a later command.** *Rejected:* the user explicitly fused config + code into
  one human-assisted step; a config-only command contradicts the model.

## 8. Open questions / risks

1. **Liquid authoring fidelity (D6)** — the highest-uncertainty surface; v1 is guided + validated, refined by
   testing. A misbuild is caught by `shopify-validate` + the human diff, never silently shipped.
2. **Instancing target** — whether a section lands in `templates/<t>.json` vs a `*-group.json` (header/footer
   chrome) is per-component; the skill inspects the host's existing placement and proposes accordingly.
3. **Schema-extension overlap with SP-2** — `configPlan`/`injectSchemaSettings` echo SP-2's foundations-map
   extension logic; consolidation is deferred to keep SP-3 self-contained and shippable.
