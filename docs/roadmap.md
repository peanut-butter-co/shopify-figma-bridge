# Roadmap: Design the Store, Build the Store (Phases 5–9)

**Date:** 2026-06-08
**Based on:** [implementation-plan.md](archive/2026-03-27-implementation-plan.md) (Phase 4 "Design Agent", scoped but never built), [design-system-learnings.md](research/design-system-learnings.md), [figma-slots-research.md](research/figma-slots-research.md), [responsive-component-architecture-research.md](research/responsive-component-architecture-research.md), [github-pages-landing-plan.md](github-pages-landing-plan.md)
**Status:** Proposal for review

---

## Overview

The build pipeline is done. We can turn an existing Shopify theme into a Figma design system, propose and build components, compose per-template pages, and emit a Figma→code mapping. That is the **upstream** half of the bridge.

This roadmap is the **downstream** half: after the design system exists, (1) a designer designs the new store, and (2) developers realize that design in the host theme — partly by **configuration** (theme settings, JSON templates, the theme editor) and partly by **code** (liquid, css, js). Today neither half exists as tooling. Both are done ad-hoc in chat, and the pipeline writes nothing back to the host theme except colors.

We frame this as **Phases 5–9**, continuing the numbering from the prior plan (Phases 1–3 shipped; Phase 4 "Design Agent" was specified in [implementation-plan.md](archive/2026-03-27-implementation-plan.md) but never built — there is no `.claude/skills/design/` and no `.claude/agents/` directory). This roadmap **supersedes Phase 4 as written**: Phase 4 only ever planned Figma composition + Shopify-JSON/settings patching. The two named gaps reach further — a repeatable, gated *design workflow*, and a *code-generation lane* that authors host `.liquid/.css/.js`. The code lane is genuinely greenfield: no prior doc, skill, agent, or research covers it.

| Phase | What it delivers | Impact | Risk |
|-------|-----------------|:------:|:----:|
| **5 — Foundations** | State model + safe-write + honesty fixes that unblock everything | ★★★★☆ | ★☆☆☆☆ |
| **6 — Design the store** | `/design-store` + `design-engineer` agent (named gap #1) | ★★★★★ | ★★★☆☆ |
| **7 — Build via config** | `/configure-store`, JSON lane (named gap #2a) | ★★★★★ | ★★★★☆ |
| **8 — Build via code** | `/scaffold-section`, css vars, Liquid (named gap #2b) | ★★★★★ | ★★★★★ |
| **9 — Production readiness** | QA, deploy, audits, drift, multi-client (cross-cutting) | ★★★★☆ | ★★★☆☆ |

This table is the single source of impact/risk scores. Phases below carry only an effort estimate; consult this table for impact/risk.

**Size scale (used throughout):** **S** = part of a session · **M** = 1–2 sessions · **L** = 3–4 sessions · **XL** = 5+ sessions.

---

## Where We Are Today (The Boundary)

The shipped pipeline ends at **Figma + local mapping artifacts**, and never mutates the host theme except for colors.

```
/setup → /analyze-theme → /build-foundations → /propose-components
       → /build-components → /compose-page → /build-design-rules
                                                      │
                                                      ▼
   TERMINAL ARTIFACTS (all read-only w.r.t. the host theme):
   • Figma: variables, text styles, style guide, atom/block/section
     components (desktop + mobile), per-template Desktop+Mobile compositions
   • manifest.json   buildStatus = {foundations:"complete", "composition-{t}":"complete"}
   • proposal.html   (visual component proposal)
   • design-rules.json  (Figma→liquid file + Figma var→CSS map)
                                                      │
   ═══════════════════════ HAND-OFF EDGE ═════════════════════════
                                                      │
   GAP #1  "Designer designs the new store"  → NO skill, NO agent.
           Done ad-hoc in chat. /compose-page starts AFTER design decisions
           are made (it reads section order from EXISTING template JSON).
                                                      │
   GAP #2  "Devs build the store"  → NO skill.
           (a) CONFIG: templates/*.json, settings_data.json, theme editor, menus
           (b) CODE:   liquid/css/js, section & block schemas, settings_schema.json
                                                      │
   The ONLY write-back today: /sync-colors → config/settings_data.json color
   fields (approval-gated, maintenance tool, OUTSIDE the build pipeline).
```

**Precise statement of the boundary.** The pipeline produces a built Figma design system, one or more per-template page compositions, and a design-rules document. It does **not** turn "design the store" into a repeatable workflow, and it does **not** generate or edit the host theme's configuration or code to realize the design in the live store. `design-rules.json` *names* target liquid files and CSS variables but nobody downstream opens those files to write them.

`/compose-page` Step 8 **does** persist a coarse `buildStatus["composition-{t}"] = "complete"` flag. What it discards is the **rich structure** — section order, node IDs, per-section settings, color scheme, and blocks. So a designed store currently lives only as Figma frames plus a human's memory of chat decisions; the machine-readable layout that the build lanes need does not exist. Phase 5 fixes exactly this.

**Important context for any agent executing this roadmap.** This repo (`shopify-figma-bridge`) is **portable tooling** — a skill-pack installed *into* a host Shopify theme repo. The store's `sections/`, `templates/`, `assets/`, `config/`, `*.liquid` do **not** live here. Every "build the store" skill ships from this repo but **operates on the host theme's files**, resolved from a host-theme root (see Phase 5).

**Ambient-skill caveat (portability risk).** Several skills this roadmap reuses — `nano-banana`, `shopify-liquid`, `shopify-dev`, `shopify-custom-data`, `shopify-admin`, and the Chrome DevTools / Figma MCP servers — are **harness/plugin skills, not part of this pack**. A host theme that installs this portable pack will not automatically have them. Every phase that depends on an ambient skill must (a) declare it a precondition and STOP-if-missing per the MEMORY rule, and (b) document it in the install/readiness check. This is tracked explicitly in Phases 8–9 and the install fix in Phase 5.

---

## How This Roadmap Is Organized

The journey is the spine. The **two user-named gaps** map to three phases — gap #1 is Phase 6; gap #2 splits into the config lane (Phase 7, "#2a") and the code lane (Phase 8, "#2b"). The **discovered gaps** are integrated where they belong and flagged `⊕ DISCOVERED`; the index at the end is a pure cross-reference, not a re-argument.

```
Phase 5  Foundations        →  Phase 6  DESIGN THE STORE   (gap #1)
   (unblocks everything)         │
                                 ▼  machine-readable compositions model
Phase 7  BUILD via CONFIG   ─┐  (gap #2a)
Phase 8  BUILD via CODE     ─┴→ realize the design in the host theme  (gap #2b)
                                 │
                                 ▼
Phase 9  CROSS-CUTTING: QA the BUILT store, deploy, audits, drift, multi-client
```

**The load-bearing dependency:** the design phase output must be **machine-readable** to drive the build phases. Today the rich design intent evaporates into Figma frames. Phase 5 fixes the state model so Phase 6 can emit a `compositions` artifact that Phases 7–8 *consume* instead of re-deriving from chat. Get this wrong and the whole pipeline stays open-ended.

---

## Canonical issues (stated once, referenced everywhere)

To avoid repeating the same problem in five phases, the recurring cross-cutting facts are stated here once and referenced by name below.

- **[BIDIRECTIONAL-CLAIM]** CLAUDE.md declares "Sync is bidirectional" and github-pages-landing-plan.md advertises Bidirectional Sync, but **only colors round-trip** today. Aspirational until Phase 9. Fixed in docs in Phase 5; realized by `/detect-drift` in Phase 9.
- **[THEMEROOT]** No skill has a `config.themeRoot` or host-theme preflight; every Shopify-touching skill assumes CWD is the host theme root. Introduced in Phase 5; a precondition for every writer in Phases 7–9.
- **[SAFE-WRITE]** No shipped skill backs up before writing, and `/sync-colors` does not `theme pull` before writing — contradicting CLAUDE.md's "ALL Shopify JSON writes require backup + diff preview + user approval." Shared utility built in Phase 5; consumed by every writer.
- **[DESIGN-RULES-TRUST]** `/build-design-rules` *guesses* file paths from Figma names, never confirms they exist, and stores no schema shape or reachability. Hardened once in Phase 7; consumed by Phases 7–8.
- **[LIQUID-ONLY]** `gift_card.liquid`, `robots.txt.liquid`, `agents.md.liquid`, `llms.txt.liquid`, `llms-full.txt.liquid` have no Figma instances and must be authored as code, bypassing composition. Defined here; routed to the code lane in Phase 8.
- **[VISUAL-DIFF]** The render-vs-Figma fidelity mechanism (push to dev theme → Chrome DevTools screenshot at configured viewports → Figma `get_screenshot` of the matching node → semantic diff, blocking on anomalies per the MEMORY rule "a thin sliver = broken layout"). Built once as `/visual-qa` in Phase 9; invoked as the definition-of-done by both the design review (Phase 6) and deploy (Phase 9).

---

## Phase 5 — Foundations for Downstream

Small, low-risk, high-leverage prerequisites that every later phase depends on. Ship this first.

### Scope & Deliverables

- **`⊕ DISCOVERED` Persisted `compositions` model in the manifest.** Add `manifest.compositions` keyed by template: per template an ordered array of `{ sectionType, figmaNodeId, colorScheme, settings:{…}, blocks:[{type, settings, order}] }`. Have `/compose-page` *write* it (it already computes section order + per-section scheme; it just discards the rich structure today — Step 8 persists only the coarse `composition-{t}: "complete"` flag). This is the shared design→build contract — the literal seam between gap #1 and gap #2. Promote `buildStatus` to per-artifact state (`sections|blocks|compositions = proposed|built|configured`) so orchestrators can resume into the new phases.
- **`⊕ DISCOVERED` Shared safe-Shopify-write utility** (`.claude/skills/_shared/safe-shopify-write.md`) — fixes **[SAFE-WRITE]**. Steps: optional `theme pull --only` (drift check) → timestamped backup → change plan → diff of changed values only → **wait for approval** → targeted `Edit` → re-read/verify → `/validate-shopify`, block on errors. Note: `/sync-colors` is internally inconsistent — its body says "Use the Edit tool … only modify color fields" but its frontmatter declares `Write` in `allowed-tools`. The utility codifies **targeted Edit, never wholesale Write**, and retrofitting `/sync-colors` to it also corrects that frontmatter.
- **`⊕ DISCOVERED` `config.themeRoot` + host-theme preflight** — introduces **[THEMEROOT]**. Add `config.themeRoot` (default `.`), set during `/setup` after asserting the four marker dirs exist (`config/`, `templates/`, `sections/`, `blocks/`), and a shared preflight that fails loudly per "STOP if required tools missing." A *writer* must never guess where to write.
- **`⊕ DISCOVERED` Design-system versioning.** Add `manifest.meta { designSystemVersion (semver), figmaFileVersion, lastBuiltAt, changelog[] }`, bumped when `/build-foundations`/`/build-components`/`/compose-page` complete. Stamp each composition and `design-rules.json` with the version it was built from. Mirrors the dated-version convention in [figma-best-practices.md](../.claude/figma-best-practices.md) / `/refresh-figma-practices`. Precondition for drift detection, QA diffing, and release gating later.
- **`⊕ DISCOVERED` Fix `install.sh` + honest capability docs.** Verified: `install.sh` still `mkdir -p .claude/commands` and downloads into `.claude/commands/`, and its list covers only **7 of the 13** shipped skills; the pack lives in `.claude/skills/`. So the installer drops files where Claude won't discover them — a load-bearing bug at the exact distribution boundary this roadmap depends on. Update it to install all 13 skills to `.claude/skills/` plus the supporting `theme-profiles/` and reference files, and to surface the ambient-skill preconditions (see Overview caveat) as a post-install readiness note. Simultaneously reconcile [github-pages-landing-plan.md](github-pages-landing-plan.md), which advertises `/design`, **Brand Onboarding**, and **Bidirectional Sync** as shipped — soften to "color sync today; design-to-store in progress" and fix the obsolete `.claude/commands/` Quick Start path. Per **[BIDIRECTIONAL-CLAIM]**, mark CLAUDE.md's "Sync is bidirectional" as aspirational until Phase 9.

### Reuses
`/compose-page` (already computes order/scheme), `/sync-colors` (write discipline to extract + frontmatter to fix), `/validate-shopify` (post-write gate), `/setup` (preflight host), manifest as single source of truth.

### Dependencies
None. **Start now.**

### Tasks
- [ ] Add `manifest.compositions` schema; have `/compose-page` write node IDs + per-instance settings/scheme/blocks
- [ ] Promote `buildStatus` to per-artifact state
- [ ] Write `_shared/safe-shopify-write.md`; retrofit `/sync-colors` (adds missing backup + pull, fixes Write-in-frontmatter)
- [ ] Add `config.themeRoot` + shared host-theme preflight; set it in `/setup`
- [ ] Add `manifest.meta` versioning + changelog; stamp compositions and `design-rules.json`
- [ ] Rewrite `install.sh` for `.claude/skills/`, all 13 skills, + ambient-skill readiness note
- [ ] Reconcile `github-pages-landing-plan.md` + CLAUDE.md capability claims with reality

**Effort: M**

---

## Phase 6 — Design the Store (Named Gap #1)

A repeatable, gated, brief→direction→catalog→page-by-page→review workflow that replaces today's ad-hoc chat. This **extends** the unbuilt Phase 4 Design Agent. Note: implementation-plan.md's Phase 4 agent declared `skills:[design, validate-shopify]`; this roadmap renames/expands that to `/design-store`, `/compose-page`, `/validate-shopify`, so it is an extension rather than a verbatim revival.

### Scope & Deliverables

- **New `/design-store` orchestrator skill** (`.claude/skills/design-store/SKILL.md`, `context: fork`) — manifest-driven, checkpointed, mirroring `/build-design-system`'s resume/`Continue? (yes/stop)` pattern. Each phase writes a `manifest.storeDesign` block and pauses for approval:
  1. **Brief intake** → `⊕ DISCOVERED` structured brand brief. No requirements artifact exists today; the pipeline reverse-engineers tokens from an *existing* theme and has no concept of a *new* store's goals/audience/voice/catalog. Back it with `reference/brand-brief-template.md`, persist to `.claude/figma-sync/brands/{client}.md` and `manifest.storeDesign.brief`. Optional ingestion of a user-provided `https://` brand URL via `WebFetch`.
  2. **Art direction** → `⊕ DISCOVERED` moodboard/direction gate. The shipped `proposal.html` is a *component inventory*, not a *direction*. Reuse its generation mechanism (extend `generate-proposal-html.js` or add `generate-direction-html.js`) to render 2–3 palette/scheme options (from `foundations.colors.schemes`), type-pairing and density options, and reference-site thumbnails. Leverage the existing `setExplicitVariableModeForCollection` duplicate-frame preview pattern. Persist the approved direction; it seeds which schemes `/compose-page` applies.
  3. **`⊕ DISCOVERED` Catalog / merchandising model.** A new store needs a product/collection data model, and the design depends on it: `/compose-page` screenshots a *live* store, so the composition implicitly assumes catalog shape, yet nothing plans it. Capture, into `manifest.storeDesign.catalog`: collection structure, product-type taxonomy, option/variant strategy, tags-as-merchandising, the PLP **faceted-filter** plan (`filter.v.*` via Search & Discovery), and collection **sort orders**. This makes the PLP design realizable and hands Phase 9 the metafield/metaobject definition list. The data lives admin-side (not in Figma or theme files); plan it via `shopify-custom-data` / `shopify-admin`.
  4. **Sitemap / template-coverage plan** → `⊕ DISCOVERED` per-store coverage plan with routing. `/compose-page` already ships a tiered 14-template coverage table (Home/PDP/PLP/Cart P1; Search/Blog/Article/404/Page/Contact P2; All-Collections/Password/Gift-Card/Policy P3). The real gap is that this table is **not codified into a per-store design plan with build routing**, and it omits **contextual/alternate templates, section groups, and hosted account surfaces**. Scan host `templates/`, cross-reference brief must-haves, and emit `manifest.storeDesign.coverage`: every needed surface tagged `designMethod = json-compose | liquid-code | hosted-account | content-layout` and `status = planned|designed|approved`. Add the **JSON-composable vs Liquid-only** distinction (the **[LIQUID-ONLY]** set routes to the code lane), note `customers/*` is now hosted Customer Accounts UI, and include policy pages, section groups, alternate/custom templates, and contextual `market`/`b2b` variants.
  5. **`⊕ DISCOVERED` Navigation / menu plan.** Header/footer link lists live in Online Store → Navigation (`linklists`) — **admin objects, not theme files** (`header-group.json` only references a menu *handle*). The design depends on menu structure that nothing currently plans. Capture the menu tree (main + footer + any mega-menu) into `manifest.storeDesign.navigation` so Phase 7 can populate the menus the section groups reference. Flag that menus are created admin-side via `shopify-admin`, not authored as files.
  6. **Page-by-page composition** → delegate to existing `/compose-page` per template (Desktop + Mobile), persisting to the Phase-5 `compositions` model.
  7. **Content + asset + localization prep** → `⊕ DISCOVERED` (see below).
  8. **Review gate** → a11y/perf/SEO/i18n review + approval artifact (see below).
  9. **Handoff spec** → the per-store, machine-readable artifact the build phases consume.
- **New `design-engineer` agent** (`.claude/agents/design-engineer.md`) — documented agent frontmatter only (`tools`, `model: opus`, `memory: project`, `skills: [design-store, compose-page, validate-shopify]`). `context: fork` is a skill-level field and belongs on `/design-store`, not the agent record.
- **`⊕ DISCOVERED` Content/copy generation step, localization-aware.** Nothing produces real copy today; component defaults supply placeholder strings. Using the brief's voice + catalog, draft per-template headlines, value props, CTA microcopy, policy stubs, and alt-text; persist to `manifest.storeDesign.content` keyed `template→section→setting`, and write the characters into the Figma instances. **Plan localizability now, not as an afterthought:** keys must map to `t:`-filtered schema labels and `locales/*.json` entries so the config/code lanes can realize them as translatable theme content rather than hardcoded English. Capture target locales, RTL need, and Shopify Markets currency/price design states from the brief. Flag every string `draft|approved`; legal/policy text is human-reviewed, not AI-final.
- **`⊕ DISCOVERED` Imagery / asset-prep spec.** Acute because the config lane (BrickspaceLab/theme-skill — see Phase 7) **deliberately inserts empty image blocks** and will not carry Figma assets across. Per content image, emit purpose, aspect ratio/dimensions (incl. 2048px zoom source), WebP export, product-shot consistency rules, decorative-vs-content alt designation, and a mapping to the `image_picker` setting it fills; persist to `manifest.storeDesign.assets` as the merchant's upload checklist. Optionally generate non-final mood imagery via the `nano-banana` skill for direction boards.
- **`⊕ DISCOVERED` Design-time states/variants.** Empty, loading, error, hover/focus/disabled are never designed today. Extend `/propose-components` to derive a required-states checklist per component (atoms: default/hover/active/focus/disabled; data-bearing sections: default/empty/loading/error), have `/build-components` build them via the existing variant infra, and have `/design-store` compose the high-traffic states (empty cart, no search results, sold-out, form error). Add a states-coverage check to the review gate.
- **`⊕ DISCOVERED` Accessibility-by-design checks.** Contrast (4.5:1 body / 3:1 large/icons/borders) on every text-style × scheme-background pair from `foundations`; touch targets ≥44px; one h1 + ordered headings + landmark plan; alt text required from the content step; reduced-motion flagging. Run Chrome DevTools `lighthouse_audit` (accessibility) against composed templates in a dev theme as corroboration. Frame as a **baseline, not certification**. *(Note: the figure that Shopify-rendered automated checks cover only a fraction of WCAG criteria is plausible but **unverified from this codebase** — confirm before quoting.)* Lives in a `/review-design` skill (or extends `/validate-instances`).
- **`⊕ DISCOVERED` Responsive coverage beyond one mobile width.** Design happens at exactly two fixed widths as separate components; tablet and Horizon's container-query reflow are undesigned, and the [responsive-component-architecture-research.md](research/responsive-component-architecture-research.md) hybrid is not applied. Add an optional `config.viewports` array (incl. a tablet width), validate at all configured widths via Chrome DevTools `resize_page`, and resolve the per-component split list by **citing** the research's hybrid table (do not re-derive). Record the choice in the component model.
- **`⊕ DISCOVERED` Design review / approval artifact.** Review is conversational and leaves no record. `/review-design` writes `manifest.storeDesign.compositions[t].review = {status, notes, date, reviewer}` per template, optionally renders a client-facing review HTML (reuse the `proposal.html` mechanism), invokes the **[VISUAL-DIFF]** mechanism (built in Phase 9) at design time, and the downstream build phases **require `status==="approved"`** before any host-theme write — the formal design→build gate.

### Reuses
`/compose-page` (composition + live-store screenshot validation), `/propose-components` (variant/instance/scope classification), `/build-foundations` (schemes/typography for direction), `proposal.html` generator, Chrome DevTools MCP (`take_screenshot`, `resize_page`, `lighthouse_audit`), Figma MCP (`get_screenshot`), `nano-banana`, `WebFetch`, `shopify-custom-data`/`shopify-admin` (catalog + menus), the Phase-5 `compositions` model.

### Dependencies
Phase 5 (`compositions` model, versioning). Within the phase: brief → catalog → content; coverage → compositions → review. **Ambient:** Chrome DevTools + Figma MCP, `nano-banana`, `WebFetch` (STOP-if-missing).

### Tasks
- [ ] `design-store/SKILL.md` (checkpointed, approval-gated phases) + `.claude/agents/design-engineer.md`
- [ ] `reference/brand-brief-template.md`; persist `brands/{client}.md` + `manifest.storeDesign.brief`; optional URL ingestion
- [ ] Art-direction board (extend proposal HTML generator); persist approved direction
- [ ] Catalog/merchandising model → `manifest.storeDesign.catalog` (taxonomy, variants, PLP filters, sorts)
- [ ] Navigation/menu plan → `manifest.storeDesign.navigation`
- [ ] Codified template-coverage plan with json-compose / liquid-code / hosted-account routing
- [ ] Localization-aware content/copy + alt-text → `manifest.storeDesign.content` (locale keys) + Figma characters
- [ ] Asset-prep spec → `manifest.storeDesign.assets`; document the empty-image-block reality
- [ ] States checklist in `/propose-components`; build via `/build-components`; compose high-traffic states
- [ ] `/review-design`: a11y baseline + states + responsive + per-template approval artifact + visual-diff
- [ ] `config.viewports` (add tablet); validate at all widths; resolve responsive split list per the research

**Effort: XL**

---

## Phase 7 — Build the Store via Configuration (Named Gap #2a)

The mechanical, highest-leverage slice of "build the store": realize the approved design in the host theme **without authoring code**, by writing `templates/*.json`, section/block settings, `settings_data.json`, section groups, and by populating the admin-side menus the design depends on. This closes the pipeline's terminal asymmetry — see **[BIDIRECTIONAL-CLAIM]**.

### BrickspaceLab/theme-skill — Concrete Recommendation

> **External-claim caveat.** `theme-skill` is an external repo not present here and not cited to any research doc in this pack. The capability descriptions below (runtime block-type discovery, `theme push --strict` validation, `.agent/rules/` convention, "~80% of `/configure-store`") are **stated from its public description and must be confirmed in the spike before relying on them.**

**Recommendation: adopt as the JSON executor behind a thin bridge — do *not* build a strict-validator from scratch, and do *not* adopt it wholesale.** Grounding (pending spike confirmation):

- `theme-skill` is a JSON-only Shopify config editor that edits `templates/*.json` + `settings_data.json`, reportedly **discovers allowed block/section types at runtime** from parent `{% schema %}` `blocks` arrays (handling `@theme`/`@app` and `_`-prefixed private blocks), validates via `shopify theme push --strict`, enforces range-step math / exact select values / unique non-`_` IDs / `block_order` rules / richtext sanitization, and handles images conservatively (empty blocks, never fabricated). If confirmed, that is most of `/configure-store`, and re-implementing it is wasted effort plus a second strict-validator to maintain.
- But it does **not** consume a structured design system (our `manifest.compositions`, `design-rules.json`, token maps), and it reportedly expects project rules under `.agent/rules/` rather than our `.claude/` layout. **It is also not portable into this pack** (ambient-skill caveat): a host install will not have it unless separately installed.

**The fit:** run a **spike** — install it into a host Horizon theme, feed it (a) a rendered screenshot of the Figma composition and (b) the resolved global settings, and judge JSON quality vs a hand-built `/configure-store`. If adequate, adopt it as the executor and build only a **thin bridge** translating `manifest.compositions` + `design-rules.json` into its input, reconciling `.agent/rules/` ↔ `.claude/` and routing its strict push through our **[SAFE-WRITE]** contract. If inadequate for design-system-driven writes, build `/configure-store` but **copy its discover-then-emit + validation discipline**. Either way pre-generate an `examples/horizon/` pack to tune output. Document the outcome as the config-lane ADR.

### Scope & Deliverables

- **New `/configure-store` skill** — the **inverse of `/compose-page`**: instead of reading `templates/{t}.json` to drive Figma, read the approved composition + `design-rules.componentMap` and **write** `templates/*.json` (`sections` object, `order`, per-section `block_order`, settings, `color_scheme`). `/compose-page` already proves every *reading* primitive; this runs that machinery in reverse and persists it. **JSON-only**, assembling from sections the theme already ships. Gated by `/validate-shopify` **before** writing and the Phase-5 **[SAFE-WRITE]** utility.
- **`⊕ DISCOVERED` Make `design-rules.json` trustworthy** — resolves **[DESIGN-RULES-TRUST]** (the config lane's input contract). Extend `/build-design-rules` to (1) Glob/Read `sections/ blocks/ snippets/` and mark each entry `exists: true|false` (guessed → verified; produce the "needs scaffold" list that becomes Phase 8's work-order), and (2) parse each resolved section's `{% schema %}` (reuse `/validate-shopify`'s regex) to record setting IDs/types/defaults, allowed block types, `max_blocks`, presets. This makes `componentMap` a true Liquid-side "Code Connect" record. *(Canonical statement; referenced again in Phase 8.)*
- **`⊕ DISCOVERED` Config-vs-code reachability classifier.** The boundary is genuinely fuzzy: setting *values* are config but *definitions* are code; `presets`/`enabled_on` live in schema (code) but gate config actions; a section without a `presets` entry cannot be theme-editor-added. Add a pass (in `/configure-store` or a `/classify-reachability` helper) that, per design property, checks the parsed schema: defined setting? accepted block type? has preset vs must hand-place? Emit `config-achievable` vs `code-required`. The code-required list is the explicit hand-off to Phase 8. Seed from `horizon.json`'s settings-vs-css-hardcoded source distinction, propagated to section/setting level.
- **`⊕ DISCOVERED` `settings_data.json` non-color global writer.** Realizing a design starts with a "global settings pass" (type scale, schemes, radii first). `/sync-colors` writes only the ~35 color fields; nothing pushes the *non-color* global tokens (typography scale, radii, border widths, spacing) that `manifest.foundations` already holds. Add a `/sync-settings` skill (or a global pass inside `/configure-store`) mapping `foundations` non-color tokens → their `settings_data.json` fields, respecting `horizon.json`'s settings-vs-css-hardcoded flags (css-hardcoded tokens route to the code lane), reusing the **[SAFE-WRITE]** diff/approve/verify pattern.
- **`⊕ DISCOVERED` Section-group + menu authoring.** Header/footer (and custom "aside") groups are the most-reused regions and the first place a new store diverges. `/compose-page` already *reads* `header-group.json`/`footer-group.json`; extend `/configure-store` to *write* these `*-group.json` files (different `type` wrapper than body templates). Section groups reference menu *handles*, so this step must also **create/populate the admin-side `linklists`** from `manifest.storeDesign.navigation` via `shopify-admin` — the group JSON is inert without them.
- **`⊕ DISCOVERED` App-block (`@app`) placement plan.** Real-store designs frequently depend on third-party app blocks (reviews, upsell, search/faceting). These **cannot be scaffolded as code or fabricated in JSON** — they appear only after the app is installed and expose `@app` block types at runtime. `/configure-store` must detect `@app`-typed design slots, place them where the app exposes them, and where the app is not yet installed **emit a merchant action item** rather than failing. Flag `@app` slots distinctly from `@theme` slots in the reachability classifier.
- **`⊕ DISCOVERED` Explicit out-of-scope boundary.** State plainly, in `/configure-store` docs, that **`checkout.liquid` / Checkout Extensibility / Customer Accounts UI are NOT theme-template territory** and are out of scope for this lane — they route to a different toolchain (`shopify-polaris-checkout-extensions`, `shopify-polaris-customer-account-extensions`). This prevents a reader assuming `/configure-store` realizes checkout.

### Reuses
`/compose-page` (all reading primitives, inverted), `/build-design-rules` (hardened `componentMap` + schema shape), `/validate-shopify` (schema/range/block-type pre-write gate; its `common-schema-gotchas.md` is a ready constraint set), `/sync-colors` (color fields), the Phase-5 **[SAFE-WRITE]** utility + **[THEMEROOT]** preflight, `theme-profiles/horizon.json` (`cssMapping`, source flags), `shopify-admin` (menus, `@app` introspection).

### Dependencies
Phase 5 (**[SAFE-WRITE]**, **[THEMEROOT]**, `compositions`), Phase 6 (approved compositions + content + catalog + navigation + `status==="approved"` gate), and the build-vs-adopt spike feeding `/configure-store` scope. **Ambient:** Shopify CLI, `shopify-admin` MCP.

### Tasks
- [ ] Harden `/build-design-rules`: verify paths (`exists` + needs-scaffold list) + capture per-section schema shape
- [ ] Run the BrickspaceLab/theme-skill spike; write the config-lane ADR (adopt-via-bridge vs build-in-house)
- [ ] `/configure-store` (or thin bridge): write `templates/*.json` sections/order/block_order/settings/scheme from compositions
- [ ] Reachability classifier → config-achievable vs code-required work-order; flag `@app` slots
- [ ] `/sync-settings` (non-color global settings) respecting source flags
- [ ] Section-group (`*-group.json`) authoring + admin `linklist` menu population
- [ ] `@app`-block placement plan / merchant action items; checkout/account out-of-scope boundary documented
- [ ] Wire `/validate-shopify` + safe-write as mandatory gates on every write

**Effort: L**

---

## Phase 8 — Build the Store via Code (Named Gap #2b)

The harder half: when the design needs a section/block/behavior the host theme cannot already express, author host `.liquid/.css/.js`, schemas, and `settings_schema.json`. **Greenfield** — no prior plan or research covers code generation. Highest blast radius in the repo: bad liquid can break the live storefront render, not just a setting value.

### Scope & Deliverables

- **New `/scaffold-section` and `/scaffold-block` skills** (`context: fork`). Inputs: the Phase-7 "needs scaffold" work-order (from **[DESIGN-RULES-TRUST]**), `manifest.components` (variant/instanceProperty/variableProperty buckets carry real Shopify setting IDs + enum values — invert "what to set" into "what to define"), Figma MCP `get_variable_defs`/`get_metadata`/`get_code` (structural start only, rewritten to Liquid). Emit a Horizon-shaped section: `{% schema %}` (settings from the three buckets, `blocks:[{type:'@theme'}]` for open content slots, `presets` so it appears in the editor 'Add' picker, `enabled_on` placement), markup using `{% content_for 'blocks' %}`, and a `{% stylesheet %}` using `rgb(var(--color-*))` tokens (never Tailwind, never hardcoded hex/px). Map Figma slots per [figma-slots-research.md](research/figma-slots-research.md): general slot → section body blocks, named slot → fixed block type, repeating slot → repeatable block + `block_order`, higher-order layout slot → JSON template section order.
- **`⊕ DISCOVERED` `/sync-css-variables` skill** (the CSS analog of `/sync-colors`). `tokenMap`/`textStyleMap`/`spacingMap` *presume* the theme already exposes `--color-*`, `--font-h1--size`, `--style-border-radius-*`. For a genuinely new design those vars may not exist, and nothing creates or verifies them. Diff the Figma Typography + Spacing & Layout collections against the theme's declared CSS custom properties (source file from the theme profile's `source.location`, e.g. `theme-styles-variables.liquid`); for css-hardcoded groups patch the liquid CSS, for settings-driven groups defer to `settings_schema.json`/`settings_data.json`. Promote `horizon.json`'s sporadic `cssMapping` (e.g. `horizontal_alignment left → flex-start`) into a first-class, complete setting-value→CSS map. Satisfies CLAUDE.md's "never hardcode — always bind to variables."
- **`⊕ DISCOVERED` Code safe-write contract + `shopify theme check`.** The JSON guardrail does not cover code: code edits are multi-file and create *new* files. Add a "safe code write" reference (per-file timestamped backup → change plan → full unified diff incl. new files → approval → targeted Edit/Write → re-read/verify) and wire `/validate-shopify` (pre-write, structural) + `shopify theme check` (post-write, liquid lint) as mandatory gates that **block on errors**. Reuses the Phase-5 **[THEMEROOT]** preflight and pull-before-write.
- **`⊕ DISCOVERED` Liquid-only templates + data-binding route.** Two code-only obligations fall outside the "design via instances" model: (1) the **[LIQUID-ONLY]** set has no Figma instances and must be authored as code, bypassing composition; (2) static Figma frames must become **data-bound** Liquid — product loops, collection grids, JSON-LD bound to *live* `product`/price/availability (hardcoding silently breaks rich results), metafield/metaobject wiring driven by the Phase-6 catalog model. Extend the work-order schema with a per-section `dataSource` hint that `/scaffold-section` consumes. Add the missing structural limits to `/validate-shopify` (≤25 sections/template, ≤50 blocks/section, loop truncation ~50 products/250 variants/1000 iterations, `product` setting returns only a handle, breaks >20). Use `shopify-liquid` / `shopify-dev` as the authoritative Liquid reference *(ambient skills — STOP-if-missing)*.
- **`⊕ DISCOVERED` Localizable theme content.** Realize Phase-6's locale-keyed content: section-schema labels via `t:` filters, strings into `locales/*.json` (default + each target locale), and RTL/Markets price states where the design specified them. Without this the generated copy is hardcoded English and cannot be translated downstream.
- **`⊕ DISCOVERED` `/build-store` orchestrator (config-first, then code).** The highest-leverage sequencing: run the config lane FIRST and have it report "what configuration could not express" as the precise code work-order, then loop config once new sections (with presets) exist so they become editor-composable. Manifest-driven checkpoints like `/build-design-system`. This shrinks code work to only the genuinely-novel parts and gives the code skills a self-contained spec instead of "build the whole store."

### Cost / runtime budget
`/build-store` (config-first then code loop) and `/scaffold-*` are long-running, image-heavy, opus-model agents. Plan for it: decompose per-section work into **forked subagents** so each scaffolds within its own context window; checkpoint to the manifest after every section so a context exhaustion resumes rather than restarts; cap per-run scope to the work-order rather than "the whole store." Record an expected run-cost envelope in the orchestrator docs.

### Reuses
`/build-design-rules` (verified `componentMap` + schema shape + needs-scaffold list), `manifest.components` three-bucket classification, Figma MCP, `/validate-shopify` (extended), `/sync-colors` (write-discipline template), `shopify-liquid`/`shopify-dev`/`shopify-custom-data` *(ambient)*, [figma-slots-research.md](research/figma-slots-research.md), Phase-5 **[SAFE-WRITE]** + **[THEMEROOT]**.

### Dependencies
Phase 5, Phase 7 (verified `design-rules.json` + reachability flags + code-required work-order), Shopify CLI authed in the host repo (STOP-if-missing). **Ambient:** Shopify CLI + `shopify theme check`, `shopify-liquid`/`shopify-dev` MCPs.

### Tasks
- [ ] Code safe-write contract + `shopify theme check` wiring + thin Shopify CLI wrapper reference
- [ ] `/scaffold-section` + `/scaffold-block` (schema from three buckets, `content_for 'blocks'`, stylesheet from token maps, slot→block mapping)
- [ ] `/sync-css-variables`; promote `cssMapping` to first-class + complete
- [ ] Liquid-only template route (`gift_card`/`robots`/`agents.md`/`llms*`) bypassing composition
- [ ] Data-binding: `dataSource` hint → loops + JSON-LD bound to live Liquid; add data-loop/structural limits to `/validate-shopify`
- [ ] Localizable content: `t:` schema labels + `locales/*.json` for default + target locales
- [ ] `/build-store` orchestrator: config-first → code work-order → code lane → re-run config loop; forked-subagent decomposition + per-section checkpoints

**Effort: XL**

---

## Phase 9 — Cross-Cutting Production Readiness

The lifecycle layer between "a designed store exists" and "a real, shippable, maintainable Shopify store is live." Mostly `⊕ DISCOVERED`. The repo already ships the MCPs to close several of these (Chrome DevTools incl. `lighthouse_audit`, Figma `get_screenshot`) but uses them only at design time.

### Scope & Deliverables

- **`⊕ DISCOVERED` `/visual-qa` — the canonical [VISUAL-DIFF] gate.** Today `/compose-page` screenshots the *existing live store* at design time; nothing renders the store the **build produced** and diffs it back to Figma — so a config/code write can pass `/validate-shopify` yet look nothing like the design. Build the mechanism once here: after any build write, push to a dev/preview theme → Chrome DevTools `navigate`/`resize_page`/`take_screenshot` at `config.viewports` → Figma `get_screenshot` of the matching frame (node id from `compositions`) → feed both images to the model for a section-by-section semantic diff. Start agentic (zero deps); optionally graduate to a UIMatch/pixelmatch+ΔE2000 score. **Block on anomalies** per the MEMORY rule "a thin sliver = broken layout"; mask known dynamic content; persist anomalies via `/learnings`. Invoked by both the Phase-6 design review and `/deploy-theme` below.
- **`⊕ DISCOVERED` `/deploy-theme` — dev → preview → publish, with rollback.** No skill invokes the Shopify CLI; `/validate-shopify` only *mentions* `theme push` in prose. Add a thin wrapper: **git-commit-per-build checkpoint** → pull-before (sync) → `/validate-shopify` (block on errors) → `theme push --unpublished` to a named dev theme → `/visual-qa` + `/audit-store` → user approval → `theme push --live`/`publish`. Support multi-`--environment` via `shopify.theme.toml`. **Rollback procedure (explicit):** record the previous published theme version before publish; on post-publish failure, restore via the git checkpoint and `theme push` of the prior version, plus an "undo last build" that reverts the multi-file config+code writes from the backup set. Never auto-publish live (see Open Questions).
- **`⊕ DISCOVERED` `/audit-store` — a11y / perf / SEO / i18n / consent gates.** Run `lighthouse_audit` at both viewports (flag LCP-image lazy-loaded, missing width/height, CLS); check WCAG from the rendered DOM (contrast, one h1 + order, focus, alt, 44px, lang, ARIA on dynamic price/cart); verify JSON-LD present and bound to *live* Liquid; i18n (no hardcoded URLs, locale-aware filters, market/currency sanity, locale coverage). *(The claim that Shopify gates Theme Store entry on Lighthouse ≥60 is plausible but **unverified from this codebase** — confirm before treating as a hard gate.)* Baseline, not certification.
- **`⊕ DISCOVERED` Legal / consent / privacy surfaces.** A shippable EU store needs a cookie/consent banner wired to Shopify's Customer Privacy API / consent mode and GDPR-compliant tracking gating — this affects both **design** (banner states, designed in Phase 6) and **code** (consent-aware script loading, authored in Phase 8). `/audit-store` must verify a consent surface exists and that analytics/marketing tags respect consent before they fire. Plan policy-page content (privacy, terms, returns) as human-reviewed legal text, not AI-final.
- **`⊕ DISCOVERED` Drift & round-trip + `/detect-drift`.** Realizes **[BIDIRECTIONAL-CLAIM]**: `settings_data.json`/`templates/*.json` are written by the theme editor AND auto-committed by Shopify's GitHub integration. With the Phase-5 `compositions` model carrying Figma node IDs as the stable ID-mapping layer, add `/detect-drift`: per template, compare current host JSON against the recorded compositions/realized state and report Figma-newer vs Shopify-newer per field. Mandate pull-before-write in every writer.
- **`⊕ DISCOVERED` Content / asset / metafield pipeline (build side).** The build executors for Phase 6's content + asset + catalog specs: emit `image_tag` with `srcset`/`sizes`/WebP + width/height (never lazy the LCP image), wire metafields, bind JSON-LD to live Liquid. Plan metafield/metaobject **definitions** (admin-side, in neither Figma nor theme files) via `shopify-custom-data` / `shopify-admin`, driven by the Phase-6 catalog model.
- **`⊕ DISCOVERED` Multi-client reuse.** The state model is single-client (one `manifest.json`, hardcoded store + one `figmaFileKey`). Building on **[THEMEROOT]** and Phase-6 `brands/{client}.md`, add a client/brand dimension so foundations/schemes/templates regenerate per tenant — reviving the prior-planned brand-onboarding spine for the agency use case.
- **`⊕ DISCOVERED` Skill-level test / dry-run harness.** This roadmap adds ~12 skills and a shared safe-write utility with the highest blast radius in the repo, yet skill behavior is untested beyond the `manifest-test.json` fixture. Add a dry-run mode to every writer (compute the diff, run all validators, **stop before writing**) plus golden-fixture tests: a sample host theme + expected JSON/Liquid output, run in CI so refactoring the shared utilities catches regressions. This is the safety net for the multi-file write blast radius.
- **`⊕ DISCOVERED` Acceptance-criteria handoff.** Promote `/build-design-rules` output into a formal handoff spec — per component all states, responsive specs, tokens, exported-asset list, explicit element→theme mapping — with a checkbox acceptance list `/audit-store` + `/visual-qa` must clear before `/deploy-theme` publishes. Closes the "build the store has no finish line" gap and finishes reconciling [github-pages-landing-plan.md](github-pages-landing-plan.md).

### Reuses
`/compose-page` (screenshot machinery — input side of `/visual-qa`), Chrome DevTools MCP (`take_screenshot`, `resize_page`, `navigate_page`, `lighthouse_audit`, `performance_start_trace`), Figma MCP (`get_screenshot`), `/validate-shopify`, `/sync-colors`, `/learnings`, `shopify-custom-data`/`shopify-admin`, Phase-5 `compositions` + versioning + **[SAFE-WRITE]**.

### Dependencies
Phases 7–8 (writers producing the artifacts under test), a host theme checkout with Shopify CLI auth, the Phase-5 `compositions` model + versioning. **Ambient:** Chrome DevTools + Figma MCP, Shopify CLI, `shopify-admin`/`shopify-custom-data`.

### Tasks
- [ ] `/visual-qa` post-build render-vs-Figma diff (agentic; persist anomalies via `/learnings`)
- [ ] `/deploy-theme` (commit checkpoint → pull → validate → push --unpublished → QA/audit → approve → --live) + rollback/undo-last-build
- [ ] `/audit-store` (Lighthouse + WCAG baseline + JSON-LD + i18n + consent)
- [ ] Legal/consent surface: banner states + Customer Privacy API wiring verification
- [ ] `/detect-drift` + mandatory pull-before-write
- [ ] Build-side content/asset/metafield emitters (image_tag/WebP, metafields, JSON-LD)
- [ ] Multi-client dimension (per-tenant manifest/brand)
- [ ] Skill dry-run mode + golden-fixture regression tests in CI
- [ ] Acceptance-criteria handoff spec + final docs reconciliation

**Effort: XL**

---

## Priority & Sequencing

Impact/risk per phase is in the **Overview** table — not repeated here. Sequencing:

- **Phase 5 is non-negotiable first.** The `compositions` model, **[SAFE-WRITE]** utility, and **[THEMEROOT]** preflight are prerequisites for *every* writer. Cheap (mostly S/M), low-risk, and several items (`install.sh`, docs honesty) are pure correctness fixes.
- **Phase 6 before 7/8.** The build lanes consume the machine-readable `compositions` + handoff. Without it they re-derive design from chat and the bridge stays broken.
- **Phase 7 before 8.** Config is the higher-leverage, more mechanical slice (inverts existing read primitives), and config-first sequencing *shrinks* the code work to only what configuration cannot express — handing Phase 8 a precise work-order.
- **Phase 9 trails the writers** because QA/deploy/drift need artifacts to test against — except the **versioning** and **honest-docs** items, which already live in Phase 5.

**Start NOW (no blockers):** the entire Phase 5 set, the BrickspaceLab spike, and the `/build-design-rules` hardening — none depend on an open question.

| Phase | Effort | Status |
|-------|--------|--------|
| 5 — Foundations | M | **Ready to start** |
| 6 — Design the store | XL | After Phase 5 |
| 7 — Build via config | L | After Phase 6 — **spike + design-rules hardening ready now** |
| 8 — Build via code | XL | After Phase 7 — needs host theme + Shopify CLI auth |
| 9 — Cross-cutting | XL | After Phases 7–8 — versioning/docs items already in Phase 5 |

---

## Discovered-Gaps Index (beyond the two named)

Pure cross-reference — each is argued in full at the cited location, not re-argued here.

**Phase 5 — Foundations:** persisted `compositions` model (§5) · incomplete/violated safe-write **[SAFE-WRITE]** (§5) · missing **[THEMEROOT]** (§5) · no design-system versioning (§5) · broken `install.sh` + dishonest docs (§5).

**Phase 6 — Design:** no structured brief/brand onboarding (§6.1) · no art-direction gate (§6.2) · **no catalog/merchandising model** (§6.3) · un-codified template coverage + missing account/section-group/contextual surfaces (§6.4) · **no navigation/menu plan** (§6.5) · no content/copy generation (§6) · localization-as-design (§6) · no imagery/asset-prep spec (§6) · no design-time states (§6) · no accessibility-by-design (§6) · responsive = two snapshots (§6) · no durable review/approval artifact (§6).

**Phase 7 — Config:** untrustworthy `design-rules.json` **[DESIGN-RULES-TRUST]** (§7) · no config-vs-code reachability classifier (§7) · no non-color global-settings writer (§7) · no section-group authoring (§7) · **no menu/`linklist` population** (§7) · **no `@app`-block placement plan** (§7) · **no checkout/account scope boundary** (§7) · unmade build-vs-adopt decision (§7).

**Phase 8 — Code:** no CSS-custom-property generation (§8) · no code safe-write / `shopify theme check` (§8) · **[LIQUID-ONLY]** templates + live-data binding (§8) · no localizable theme content (§8) · no config-first `/build-store` orchestrator (§8) · **no orchestrator cost/runtime budget** (§8).

**Phase 9 — Cross-cutting:** no built-store visual-QA **[VISUAL-DIFF]** (§9) · no deploy/release path + **no rollback** (§9) · no a11y/perf/SEO/i18n audits (§9) · **no legal/consent/privacy surfaces** (§9) · no drift/round-trip detection (§9) · no metafield/metaobject pipeline (§9) · single-client state model (§9) · **no skill-level test/dry-run harness** (§9) · no acceptance-criteria handoff (§9).

**Portability / sourcing risks flagged throughout:** ambient (non-portable) skill dependencies (Overview + Phases 6–9) · unverified external claims — BrickspaceLab capabilities, Lighthouse ≥60 gate, WCAG-coverage figure (Phases 6/7/9, marked *unverified*).

---

## Open Questions

Decisions the body has *not* taken — genuinely open, not rhetorical. (The config-lane build-vs-adopt and code-lane ambition are decided in the body via the spike and the config-first orchestrator; they are not re-litigated here.)

1. **Code-lane ambition gate.** Phase 8 ships `/scaffold-section` for genuinely-novel components only. Do you want full Liquid generation in scope from the start, or ship the *work-order* first and author code semi-manually until the scaffolder is proven?
2. **Responsive split list** (carried from implementation-plan.md, still unresolved). Which components use breakpoint variables vs viewport variants vs separate components? Phase 6 needs this to add a tablet viewport. Roadmap position: apply the [responsive-component-architecture-research.md](research/responsive-component-architecture-research.md) hybrid table per component — confirm.
3. **Publish authority.** Roadmap position: `/deploy-theme` never auto-publishes `--live`; it stops at an unpublished preview and requires explicit human publish. Confirm, or define conditions under which auto-publish is acceptable.
4. **Multi-client timing.** Lay the `brands/{client}.md` seam in Phase 6 but defer the full per-tenant manifest to Phase 9 — or invest in multi-tenant earlier for the agency workflow?
5. **Target locales & Markets.** Which locales and Markets/currencies must the *first* store support? This determines how much of the localization-as-design work (Phase 6) and `locales/*.json` realization (Phase 8) is in initial scope vs deferred.
6. **EU/consent scope.** Is a GDPR consent banner + Customer Privacy API wiring required for the first store (pulling Phase 9's legal/consent work forward into the design), or is the first target a non-EU store where it can wait?
