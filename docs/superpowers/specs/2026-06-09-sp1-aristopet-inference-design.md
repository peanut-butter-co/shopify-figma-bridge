# SP-1 — Aristopet inference (one-off)

**Date:** 2026-06-09
**Status:** Approved design (brainstorming) — ready for implementation plan
**Parent:** [SP-0 contract design](../../research/2026-06-09-sp0-contract-design.md) · [roadmap.md](../../roadmap.md) Phase 7/8
**Contract reference:** [docs/contract/design-build-contract.md](../../contract/design-build-contract.md)

---

## 1. Context

SP-0a delivered the design→build **contract** (shapes + deterministic helpers + invariants). SP-1 is
the **first real instance of that contract**: an AI reconstruction of **Aristopet**, a store whose
Figma design was produced *off-process* on an older skill-pack version and therefore never emitted the
machine-readable deliverables the pipeline would have. SP-1's output serves **two roles at once**:

1. **The real handoff** — the build-facing deliverables (`foundations`, `componentMap`,
   `compositions`, `work-order`) that SP-2 (config lane) and SP-3 (code lane) consume to actually build
   Aristopet's store.
2. **The golden fixture** — a real, complete, valid contract instance that SP-2 is built and validated
   against. (The synthetic `fixtures/contract/` fixture stays for pure unit invariants; this is the
   real one.)

SP-1 immediately follows SP-0a because it is also the contract's **first validation against real
design**: if the contract's readability assumptions don't hold, SP-1 reports back and we adjust the
contract **before locking it** (SP-0 spec §8).

### Inputs (verified during the brainstorm spike)

- **Figma design file:** `73Qy4BbWWqFUky9b5LXTGT` — *"Aristopet-Design-v1 (PRUEBAS PABLO)"*. The page
  frames live on page **`05 - Pages`** (node `93:2`). (An earlier-referenced key,
  `iIsa2oaPlbi6f7JH8eY2cx`, was a stale atoms-only file — **do not use it**.)
- **Host theme:** the Google-Drive path
  `…/Peanut Butter Drive/7. Diseño/AI Design/shopify-figma-bridge`. Verified to be a **bare Shopify
  Skeleton theme**: `config/settings_data.json` has `current: {}` (**0 color schemes**),
  `settings_schema.json` has **no `color_scheme_group`**, and only 2 theme blocks (`group`, `text`).
  **Implication:** Aristopet's foundations exist **only in Figma** — nothing build-consumable exists yet.

### What Aristopet actually designed (from `05 - Pages`)

- **3 page templates, each at Desktop + Mobile** (not 12 — the 12 stock `templates/*.json` in the host
  theme are Skeleton defaults, the wrong source):
  | Template | Desktop node | Mobile node |
  |---|---|---|
  | **Homepage** (`index`) | `3436:1867` | `3520:3400` |
  | **Collection** | `3365:614` | `3370:1199` |
  | **Product** | `3627:5365` | `3626:4195` |
- **Global chrome** (recurs on every template): Header Utility Bar, **Header (two variants — v1 / v2)**,
  Footer, Newsletter Signup.
- **Overlay / interaction states** (UI documentation, **not** Shopify templates): Dropdown Menu v1/v2,
  Menu Drawer L1/L2, **Cart Drawer** (desktop+mobile), Sticky Add to Cart, "Above the Fold" crop.
- **~27 distinct sections** (the `componentMap` universe), incl. the bespoke ones the contract
  anticipated: Split Banner (hero), Trust Bar, Sub-Collection-Navigation, **UGC — Captions Below**,
  **Product Reviews**, Promo Banner, Brand Logos, plus the Aristopet **"Section Heading / Section
  Footer"** spacing-wrapper idiom.

---

## 2. Decisions

### D1 — Scope: all 3 designed templates, complete
Homepage + Collection + Product, **desktop + mobile**, including global chrome. This is the entire
designed store (tractable because it is 3, not 12) and yields the richest fixture: it naturally
contains every contract case SP-2 must handle — `config` (Split Banner → host hero), instance-delta
(e.g. a row exceeding `max_blocks`), `code`/no-candidate (UGC), `app` (Reviews, if app-slot), and
section-level `mobileDivergence`.

### D2 — Output: a self-contained Aristopet artifact set
Everything lands under **`.claude/figma-sync/aristopet/`**; the dev `manifest.json` (Skills-01 project)
is **not touched**. The set doubles as the SP-2 golden fixture (committed, frozen). The `manifest.json`
in this set mirrors the real manifest shape so SP-2's code reads `manifest.compositions` /
`manifest.foundations` unchanged whether pointed at the real manifest or this one.

### D3 — Execution: hybrid A→B (deterministic-first, controller-driven; fan-out when heavy)
Most of `componentMap` + `compositions` is **already determined** by the Figma metadata (section order,
desktop/mobile node-ids, names, instance-vs-detached-frame, D↔M pairing by `/ Desktop` `/ Mobile`
suffix). The controller drives a single context (natural section **dedup** + cross-template
consistency), reserving **subagent fan-out only for genuinely heavy steps** (e.g. reading `settings`
across ~27 sections). The fuzzy half (candidate-match, `settings`/`colorScheme` values, divergence
type) is the only AI inference, and it is **biased to CODE** (D3 of SP-0): never claim `config` without
proof against the host schema.

### D4 — Foundations: full reconstruction (from Figma)
Because the host theme is empty, Aristopet's **color schemes, typography, and spacing/radii/borders**
are reconstructed **from Figma** (variable modes + text styles + spacing tokens) into
`manifest.foundations`. Color schemes are **load-bearing**: `compositions[*].colorScheme` references
them, so without them SP-2 would write a store with broken colors. **Collections / catalog / navigation
/ content remain out of scope** (roadmap Phase 6 — content, not build deliverables).

---

## 3. Output artifacts (`.claude/figma-sync/aristopet/`)

```
.claude/figma-sync/aristopet/
├── manifest.json        # config + foundations + compositions
├── design-rules.json    # componentMap (+ tokenMap/textStyleMap/spacingMap derived from foundations)
├── work-order.json      # DERIVED via deriveWorkOrder()
└── README.md            # provenance + "frozen golden fixture for SP-2"
```

- **`manifest.json`**
  - `config`: `{ themeRoot: "<Drive host-theme path>", figmaFileKey: "73Qy4BbWWqFUky9b5LXTGT",
    mobileNaming, mobilePlacement, desktopWidth: 1680, mobileWidth: 392 }`.
  - `foundations`: same shape as the existing `manifest.foundations` (`colors.schemes`,
    `semanticGroups`, `typography.fontRoles`/`presets`, `spacing.scale`/`radii`/`borderWidths`).
    Reconstructed from Figma (D4).
  - `compositions`: one entry per template (`index`, `collection`, `product`) per
    [contract §2](../../contract/design-build-contract.md) — `order[*]` referencing `componentMap` **by
    key**, each carrying `desktopNodeId`/`mobileNodeId`, `colorScheme`, `settings`, `blocks`, and
    `mobileDivergence`.
- **`design-rules.json`** — the hardened `componentMap` ([contract §1](../../contract/design-build-contract.md)):
  one entry per **distinct** section (deduplicated across templates), with `figma`
  (desktop/mobile nodes + `representation`), `theme` (`exists`/`kind` from `resolveHostSection`),
  `schema` (parsed or `null`), and `reachability` (`verdict`/`basis`/`confidence`/`candidate`).
  `tokenMap`/`textStyleMap`/`spacingMap` derived from foundations; `collections` omitted.
- **`work-order.json`** — `deriveWorkOrder(componentMap, compositions)`; never primary state.
- **`README.md`** — what this is, how it was produced (inference + which parts are deterministic), and
  that it is the frozen SP-2 golden fixture.

---

## 4. The inference pipeline (4 passes)

| Pass | Produces | How |
|---|---|---|
| **P0 · foundations** | `manifest.foundations` | `get_variable_defs` → color modes = `schemes`; Figma text styles → `fontRoles` + `presets`; spacing/radii/border tokens → `scale`. From Figma (host theme is empty). |
| **P1 · componentMap** | `design-rules.json` | Enumerate **distinct** sections across all 3 templates (dedup). Classify `instance` (library) vs detached `frame` (bespoke). Resolve host via `resolveHostSection(themeRoot, slug)` → `exists` + `schema`. Verdict = deterministic `expressibilityIssues` + fuzzy candidate-match, **biased to CODE**. |
| **P2 · compositions** | `manifest.compositions` | Per template ×3: read `order` + per-instance `settings` + `colorScheme` + desktop/mobile node-ids + `mobileDivergence`, referencing `componentMap` by key. |
| **P3 · work-order** | `work-order.json` | `deriveWorkOrder()` — deterministic, no AI. |

Execution = D3 (controller-driven; fan-out per-section/per-template only where a pass is heavy).

---

## 5. Deterministic vs inferred (the honesty layer — SP-0 §7)

| Deterministic (Figma metadata + merged SP-0a helpers) | Inferred by AI (best-effort, marked with `confidence`) |
|---|---|
| section `order`, desktop/mobile node-ids, names | `settings` values per instance |
| `instance` vs detached `frame` | `colorScheme` (read from variable mode, but mode→scheme-id mapping inferred) |
| D↔M pairing (`/ Desktop` `/ Mobile` suffix) | candidate-match for bespoke detached sections |
| `theme.exists`, parsed `schema` (`resolveHostSection`) | `mobileDivergence` type (`reorder`/`viewport-only`/`behavior`) |
| `expressibilityIssues`, `deriveWorkOrder` (invariants 1–4) | the fuzzy half of each `reachability.verdict` (biased to CODE) |

A misclassification is **caught downstream** (validate-shopify at write time, visual-QA), never silently
shipped (SP-0 D2 — no contract-verification gate in SP-1).

---

## 6. The assumption-check spike (GATE — runs first)

Before the full build, confirm the contract's readability assumptions on a representative slice
(Homepage). **Already verified in the brainstorm:** page `05 - Pages` exists ✓; D↔M pairing by name
suffix ✓; host theme is the empty Skeleton ✓ (drove D4). **Still to verify in the spike:**

1. `instance` + `mainComponent` are readable per composed section (library-vs-bespoke signal).
2. `colorScheme` is readable from the frame's variable mode (`get_variable_defs`) and maps to a
   foundations scheme id.
3. `settings` / text overrides are readable (`get_design_context`).
4. How to model the **"Section Heading / Section Footer"** wrapper idiom (Aristopet spacing wrappers,
   not host sections) — fold into the wrapped section's settings, or treat as a distinct component?

**Gate criterion:** if any assumption fails as the contract assumes, **stop, report, and adjust the
SP-0 contract before locking** — do not improvise around it. This is the entire reason SP-1 follows
SP-0a.

---

## 7. Validation & acceptance

1. **Contract invariants green** on the real Aristopet set — `contractShapeIssues()` + invariants 1–4,
   run against `.claude/figma-sync/aristopet/` (add a `skills-tests.js` group that loads the real set,
   not only the synthetic fixture).
2. **Every `config` proven against the host schema** — for each `verdict === "config"`,
   `expressibilityIssues` returns `[]` against the candidate's parsed schema (validate-shopify "in
   reverse"). No unproven `config`.
3. **Visual cross-check** — `get_screenshot` of each template (desktop + mobile) vs the inferred
   `order`/structure; a thin sliver or missing section = broken inference (per the screenshot-validation
   learning — never rationalize anomalies).
4. **Human diff review** of the produced artifacts (D2 safety net; no auto-trust).

No contract-verification state machine (SP-0 D2) — the safety net is downstream (SP-2 write-time
diff+approval, validate-shopify, visual-QA).

---

## 8. Contract feedback (proposed adjustments to SP-0, before locking)

The spike + build are expected to surface these; each is a candidate contract adjustment to land in
**this** sub-project (small edits to the SP-0 spec + `skills-tests.js`):

- **New invariant 5 — colorScheme referential integrity:** every `compositions[*].order[*].colorScheme`
  ∈ `foundations.colors.schemes`. (Foundations entering scope introduces this; without it, dangling
  scheme refs ship broken colors.)
- **The "Section Heading / Section Footer" wrapper idiom** — decide the canonical modeling and record it
  in the contract doc.
- **Two Header variants (v1/v2) per template** — one `componentMap` entry with a variant axis, or two
  entries? Record the rule.
- **Overlay states (Cart Drawer, menus, Sticky ATC) are not templates** — note how they map (header/cart
  features, theme settings, or app), so they aren't mistaken for compositions.
- **Detached `Product Card Row`** (instance on Homepage, detached frame on Collection) — confirm the
  instance-vs-frame dedup rule keys on the resolved component, not the node type.

---

## 9. Out of scope

- Collections / catalog / navigation / content (roadmap Phase 6 — content, not build deliverables).
- The overlay states as Shopify templates.
- Writing any host-theme file — config writes are SP-2, code is SP-3.
- Write safety (`safe-shopify-write`, `config.themeRoot` preflight) — that is **SP-0b**, just before SP-2.

---

## 10. Open questions / risks

1. **Wrapper idiom** (§6.4 / §8) — the highest-uncertainty modeling decision; resolved in the spike.
2. **Reviews = app vs code** — `Product Reviews` may be an app-slot (`app`) or bespoke (`code`); decided
   by candidate-match + whether the host exposes an `@app` block, biased to CODE if unproven.
3. **colorScheme fidelity** — variable mode → scheme-id mapping is inferred; mismatches are caught by
   invariant 5 + visual cross-check.
4. **Skeleton host coverage** — with a near-empty host theme, most bespoke sections will route to
   `code`; that is the correct, honest outcome (the store is mostly code-built), not a bug. The
   work-order will be large and that is expected.
