# SP-0 — The design→build contract

**Date:** 2026-06-09
**Status:** Approved design (brainstorming) — ready for implementation plan
**Parent:** [roadmap.md](../roadmap.md) — Phase 5 (`compositions` model, `[SAFE-WRITE]`, `[THEMEROOT]`) + Phase 7 (config-vs-code reachability classifier)

---

## 1. Context

We are building the **downstream tooling** the roadmap calls Phase 7 (build via configuration) and Phase 8 (build via code), and driving it with a real project — **Aristopet** — whose Figma design was produced *off-process* on an older version of the skill-pack. Because Aristopet never produced the machine-readable deliverables the complete pipeline would have, we will **reconstruct them by AI inference** and feed them to the new tooling.

That whole effort decomposes into four sub-projects, sequenced **contract-first**:

| | Sub-project | Role |
|---|---|---|
| **SP-0** | **The design→build contract** (this spec) | The data shapes every later piece reads/writes. |
| SP-1 | Aristopet inference (one-off) | AI reconstructs Aristopet's instance of the contract = the real handoff **and** the golden fixture. |
| SP-2 | Phase 7 — `/configure-store` (config lane) | Writes `templates/*.json` etc. for what's *config-achievable*. Built/validated against the SP-1 fixture. |
| SP-3 | Phase 8 — `/scaffold-*` (code lane) | Authors `.liquid/.css/.js` for the *code-required* sections. |

SP-0 is first because the contract is the **load-bearing seam** between "design" and "build": get its shape wrong and every consumer re-derives design from chat, which is the exact failure the roadmap exists to fix.

### Today's boundary (verified)

- `design-rules.json`'s `componentMap` **assumes** `sections/{name}.liquid` exists — no `exists` check, no parsed schema, no config/code classification. This is the roadmap's `[DESIGN-RULES-TRUST]` gap.
- The machine-readable **layout does not exist anywhere**: `manifest.compositions` is absent; `components.templates` is only a priority list. Section order / scheme / settings live solely in Figma frames + free-text `buildStatus` notes.
- Aristopet has **three layers that do not line up**: (1) a built component library (`components.sections` — ~21 standard-ish sections), (2) pages composed with **bespoke from-scratch sections** not all in that library (hero-split, UGC, reviews, wishlist, sub-collection-nav, trust-bar, cart-drawer…), and (3) a host Horizon theme shipping **only 14 standard sections**. The contract must reconcile all three.

---

## 2. Decisions

### D1 — Artifact layout: **Approach A (normalized)**

Three artifacts, each with one owner:

- `design-rules.json` › `componentMap` (hardened) = the **single reference**: Figma component → theme code, with `exists`, parsed `schema`, and a `reachability` verdict.
- `manifest.compositions` = the **layout** per template; references `componentMap` **by key** (does not duplicate the mapping).
- **work-order** = **derived** view (the `code-required` / `app` / `out-of-scope` set) consumed by SP-3.

**Why A over the alternatives:**

| Dimension | A — Normalized | B — Denormalized in compositions | C — Single `handoff.json` |
|---|:---:|:---:|:---:|
| Mapping defined once (no duplication) | ✅ | ❌ repeated per use | ✅ if internally structured |
| Per-template read ergonomics | ⚠️ 1 key lookup | ✅ inline | ✅ one file |
| Layout vs mapping lifecycles separated | ✅ | ❌ entangled | ❌ same file |
| Fits the skills that already own these | ✅ | ⚠️ compositions bloats | ❌ must rewire both |
| SP-1 inference cost | ✅ map 1×, layout N× | ❌ repeats map | ✅ one artifact |
| Divergence risk | ✅ low | ❌ high | ✅ low if normalized |
| Is it "the single reference"? | ✅ `componentMap` | ❌ scattered | ✅ literal |

B loses on duplication/divergence. The real contest was A vs C; A wins because (1) we are building *tooling*, and the skills it touches — `/compose-page` (which SP-2 inverts, owns `compositions`) and `/build-design-rules` (which SP-2 hardens, owns `design-rules.json`) — already embody this split, so A means minimal rewiring; (2) layout (changes per design tweak) and mapping (changes per theme/component build) have different lifecycles that A keeps independent; (3) the manifest is already the single source of truth (CLAUDE.md) and `compositions` belongs there, while `design-rules.json` is legitimately a separate Figma↔code record.

A's only cost — the `compositions → componentMap` indirection — is a feature: the work-order derives from it for free, and the two consumers *want* the split (config lane reads layout+mapping; code lane reads only the `code-required` subset).

### D2 — Inference rigor: **best-effort, no contract-verification gate** (one exception)

The contract is filled by retroactive AI inference with uneven reliability. Decision: **no per-value provenance fields, no draft/verified state machine, no mandatory contract-verification pass.** The safety net lives downstream at write time, not in the contract:

- `/validate-shopify` (pre-write, deterministic) — catches schema-invalid output.
- **Write-time diff + approval** (CLAUDE.md hard rule, built in SP-0b) — the human eyeballs a concrete diff. **Preserved.**
- visual-QA (roadmap Phase 9) — catches "schema-valid but looks wrong."

**The one exception:** `reachability` is a *routing* decision (config vs code), not a value, and its failure modes are asymmetric (see D3). It therefore carries `{ verdict, basis, confidence }` — the *why* of the verdict, not per-value provenance. This does not reintroduce the rejected machinery.

### D3 — Reachability is a two-part check with a conservative default

`reachability = (deterministic schema-expressibility) + (fuzzy candidate-match)`.

- **Deterministic half** (not inference): does a host section's `{% schema %}` accept the required block-types, with every value within its setting's domain, within `max_blocks`? This is `validate-shopify`'s logic (`settingValueIssue`, block-type acceptance, `maxBlocksIssue`) run **in reverse** against the parsed host schema. Calculable yes/no.
- **Fuzzy half** (the only place AI infers): does this bespoke detached Figma frame *correspond to* a candidate host section at all?

**Asymmetric cost → bias to CODE.** A false `config` ships a silently-broken store; a false `code` only produces redundant scaffold work that is visible and cancelable. Therefore: **default to `code` whenever the deterministic check cannot *prove* `config`.** Never claim `config` without proof against the schema.

---

## 3. The three artifacts

### 3.1 `design-rules.json` › `componentMap` (hardened) — the single reference

One entry per component, keyed by slug (sections) or component name (atoms/blocks). The existing `tokenMap` / `textStyleMap` / `spacingMap` / `collections` are unchanged.

```jsonc
"hero": {
  "type": "section",                                   // section | block | atom
  "figma":  { "name": "hero", "nodeId": "2120:2",
              "page": "04 - Sections", "isInstance": true },
  "theme":  { "file": "sections/hero.liquid",
              "exists": true,                           // VERIFIED with Glob — not guessed ([DESIGN-RULES-TRUST])
              "kind": "section" },                      // section | theme-block | app-block | snippet
  "schema": {                                           // null when exists:false; else parsed via extractSchema()
    "settings": [ { "id": "heading", "type": "text" },
                  { "id": "color_scheme", "type": "color_scheme" },
                  { "id": "layout", "type": "select", "options": ["overlay","split"] } ],
    "blocks":   ["text","button","@theme/icon"],
    "maxBlocks": 5, "presets": true, "enabledOn": null
  },
  "reachability": {                                     // COMPONENT-LEVEL baseline (see §4)
    "verdict": "config",                               // config | code | app | out-of-scope
    "basis":   "instance-of-library",                  // see basis enum below
    "confidence": "high",                              // high | medium | low
    "candidate":  "sections/hero.liquid"               // host section if config; null if code
  }
},

"pdp-ugc-section": {
  "type": "section",
  "figma":  { "name": "Section / UGC", "nodeId": "3484:2601",
              "page": "04 - Sections", "isInstance": false },   // detached → bespoke signal
  "theme":  { "file": null, "exists": false, "kind": "section" },
  "schema": null,
  "reachability": { "verdict": "code", "basis": "no-candidate",
                    "confidence": "high", "candidate": null }
}
```

**`basis` enum:** `instance-of-library` · `css-hardcoded` · `schema-expressible` · `no-candidate` · `block-type-unsupported` · `value-out-of-domain` · `max-blocks-exceeded` · `app-slot` · `liquid-only`.

### 3.2 `manifest.compositions` — the layout

Order + values only; references `componentMap` by key. No provenance fields (D2).

```jsonc
"index": {
  "template": "index",
  "figmaNodeId":       "3436:1867",        // Desktop page frame
  "figmaNodeIdMobile": "3520:3400",        // Mobile page frame
  "order": [
    { "component": "hero",                  // ← KEY into componentMap (the normalized indirection)
      "instanceNodeId": "…",
      "colorScheme": "scheme-1",
      "settings": { "heading": "…", "layout": "split", "image": "<asset-ref>" },
      "blocks":   [ { "type": "button", "order": 0, "settings": { "label": "Comprar" } } ] },

    { "component": "homepage-marquee-promo", "instanceNodeId": "…",
      "colorScheme": "scheme-2", "settings": { }, "blocks": [ ] }
  ]
}
```

**Mobile divergence** (sections hidden/reordered on mobile) is an *optional* per-entry overlay `mobile: { hidden?: bool, order?: int }`. `order` is the canonical (Desktop) layout. Detail deferred until a real Aristopet template needs it — see Open Questions.

### 3.3 work-order — derived (not hand-maintained)

Computed from `componentMap` + `compositions`; the input to SP-3. Regenerable; never primary state.

```jsonc
{
  "codeRequired": [
    // whole component has no host target
    { "component": "pdp-ugc-section", "basis": "no-candidate",
      "usedIn": ["product"], "note": "new section: UGC carousel + image blocks" },
    // instance-level delta: component is config-achievable in general, but THIS usage exceeds the schema
    { "component": "slideshow", "basis": "max-blocks-exceeded",
      "usedIn": ["index"], "delta": "index uses 6 slides; sections/slideshow.liquid max_blocks=5" }
  ],
  "appBlocks":    [ { "component": "reviews", "basis": "app-slot",
                      "usedIn": ["product"], "action": "merchant installs reviews app" } ],
  "outOfScope":   [ ]
}
```

A `codeRequired` entry is either a **whole component** (no host target) or an **instance delta** (a config-achievable component whose specific composition exceeds the candidate's schema — carries `delta` + `usedIn`). Both kinds satisfy invariant 4 (§6).

---

## 4. Reachability: component baseline vs instance expressibility

Two distinct levels, kept separate to keep SP-1 bounded and the contract normalized:

- **Component-level (`componentMap.reachability`)** = the *baseline*: is there any host target for this component? (`config` / `code` / `app` / `out-of-scope`). Stored **once** per component.
- **Instance-level expressibility** = do *this* composition's `settings`/`blocks` fit the candidate's schema? (e.g. `slideshow` is config in general, but an instance with 6 slides breaks `max_blocks: 5`.) **Computed deterministically by SP-2** against `componentMap.schema` at configure-time; failing instances are **lifted into the work-order** as a "code delta."

So SP-1 stores the baseline + the raw `settings`/`blocks`; the per-instance check is derived and deterministic.

### The classifier (decision tree, not a single guess)

```
For each composed section S on a page:
  1. Is S an instance of a library component whose slug → sections/*.liquid exists?
        → CONFIG (high)                                          [signal: instance-of-library]
  2. Is the property it needs CSS-hardcoded in horizon.json?
        → CODE (high)                                            [signal: css-hardcoded]
  3. Bespoke/detached → find a candidate host section (name + structure):
        a. no candidate can host the structure (markup/behaviour the theme lacks)
              → CODE (high)                                      [no-candidate]
        b. candidate exists AND the deterministic check passes
           (every element → a setting or allowed block-type; every value in domain; fits max_blocks)
              → CONFIG (medium)                                  [schema-expressible]
        c. candidate exists but the check fails
              → CODE for the delta (or APP if it is an app slot)  ← the concrete failure IS the work-order
  4. Special routes: @app slot → APP (merchant action) · [LIQUID-ONLY] → CODE · checkout/account → OUT-OF-SCOPE
```

### Worked Aristopet examples

| Composed section | Decisive signal | Verdict |
|---|---|---|
| `hero` (library instance) | resolves to `sections/hero.liquid`, exists | **CONFIG** (high) |
| `homepage-marquee-promo` (instance of `marquee`) | `sections/marquee.liquid` exists; schema covers settings/blocks | **CONFIG** (medium) |
| `slideshow` with 6 slides | instance, but schema `max_blocks: 5` | **CODE** delta — *deterministic failure* |
| `pdp-ugc-section` (detached) | no library component, no `sections/ugc.liquid`, carousel/masonry is not a setting | **CODE** (high) |

### Where it is genuinely hard (honest)

Risk concentrates in 3b/3c — bespoke detached sections where *maybe* a generic `custom-section` + creative block composition could express it. And Figma frames are **static**: behaviour (carousel, sticky, hover) is invisible in pixels — it must be read from the candidate's schema/liquid, never inferred from the frame. The conservative default (D3) plus downstream gates (D2) contain this: a misclassification is caught at `/validate-shopify` or visual-QA, never silently shipped.

---

## 5. SP-0a / SP-0b split

- **SP-0a — data contract. Unblocks SP-1. No theme writes.**
  Define the three shapes (above) + the deterministic reachability/expressibility logic, **reusing `validate-shopify`** (`extractSchema`, `settingValueIssue`, block-type acceptance, `maxBlocksIssue`) + the css-hardcoded lookup from `theme-profiles/horizon.json`. Add the contract invariants (§6) to `skills-tests.js`.
- **SP-0b — write safety. Needed just before SP-2.**
  `_shared/safe-shopify-write.md` (pull → backup → change plan → diff → approval → targeted Edit → re-read/verify → `/validate-shopify`) + `config.themeRoot` + host-theme preflight. Out of scope for unblocking SP-1.

---

## 6. Contract invariants (test targets for `skills-tests.js`)

1. **Referential integrity:** every `compositions[*].order[*].component` ∈ keys(`componentMap`).
2. **config ⇒ real:** `verdict === "config"` ⇒ `theme.exists === true` ∧ `candidate != null` ∧ `schema != null`.
3. **nonexistent ⇒ non-config:** `exists === false` ⇒ `verdict ∈ {code, app, out-of-scope}`.
4. **work-order = pure derivation:** ≡ components with `verdict ∈ {code, app, out-of-scope}` ∪ instances failing the deterministic expressibility check. No manual entries.

---

## 7. Deterministic vs inferred (the honesty layer)

| Deterministic (reuse existing code) | Inferred by SP-1 (best-effort) |
|---|---|
| `exists` (Glob), `schema` (extractSchema) | candidate-match for bespoke detached sections |
| expressibility (settingValueIssue / block-type / maxBlocks) | `settings` / `blocks` values |
| css-hardcoded (horizon.json) → CODE | order + colorScheme read from Figma frames |
| invariants 1–4 | the fuzzy half of the verdict (biased to CODE) |

---

## 8. Assumptions SP-1 must verify first

The contract assumes that, per composed section, Figma exposes: whether it is an **instance** and its `mainComponent`; the **color scheme** (the frame's variable mode); and **setting/text overrides**; and that page frames live on "05 - Pages". SP-1's first task is to confirm these are readable as expected; if not, it reports back and we adjust the contract before locking it. (This is *why* SP-1 immediately follows SP-0a — it validates the contract shape against the real design.)

---

## 9. Out of scope for SP-0

- Producing Aristopet's actual contract instance — that is SP-1.
- Writing any host theme file — config writes are SP-2, code is SP-3, write safety is SP-0b.
- Brief / art-direction / catalog / navigation / content (roadmap Phase 6) — Aristopet's design already exists; only the build-facing deliverables are reconstructed.

---

## 10. Open questions (minor — do not block the plan)

1. **work-order home:** a regenerable derived file (`work-order.json`) vs `manifest.workOrder` vs computed on demand. Leaning: regenerable derived file, so it is never stale primary state.
2. **Mobile overlay shape:** the `mobile:{hidden?,order?}` per-entry overlay is sketched, not finalized; finalize when a real Aristopet template needs mobile divergence.
3. **`basis` enum:** the proposed set covers the known routes; may gain entries as SP-1 meets real cases.
