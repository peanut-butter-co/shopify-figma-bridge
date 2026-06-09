# Aristopet — design→build contract instance (SP-1)

This directory is **both** the real Aristopet **handoff** and the **frozen golden fixture** that SP-2
(`/configure-store`) is built and validated against. It was produced by **SP-1 (AI inference)** because
Aristopet was designed off-process on an older skill-pack version and never emitted these deliverables.
It is validated by the `SP-1: Aristopet inference artifact set` group in `.claude/scripts/skills-tests.js`.

## Files

| File | What |
|---|---|
| `manifest.json` | `config` + `foundations` (4 color schemes + DM Sans / Instrument Sans type + spacing) + `compositions` (index / collection / product). |
| `design-rules.json` | `componentMap` — 22 distinct sections (deduped across templates) with Figma nodes, host `exists`/`schema`, and `reachability`. |
| `work-order.json` | **DERIVED** via `deriveWorkOrder()`. Regenerate it — never hand-edit (see below). |
| `_raw/` | Provenance: `SPIKE.md` (gate report), `skeleton.json` (deterministic order/node-ids), `sec-*.json` (per-section extracts), `build-manifest.js` (the P0+P2 generator), `variables.split-banner.json`, screenshots (gitignored). |

## Provenance

- **Figma:** `73Qy4BbWWqFUky9b5LXTGT` ("Aristopet-Design-v1 (PRUEBAS PABLO)"), page **`05 - Pages`** (`93:2`).
  Templates — Homepage `3436:1867`/`3520:3400`, Collection `3365:614`/`3370:1199`, Product `3627:5365`/`3626:4195`.
- **Host theme:** the bare Shopify **Skeleton** at `config.themeRoot` (0 color schemes; only stock page sections).

## Deterministic vs inferred

| Deterministic (Figma metadata + SP-0a helpers) | Inferred by AI (confidence) |
|---|---|
| section order, desktop/mobile node-ids, names, instance-vs-frame, D↔M pairing (`skeleton.json`) | `settings` values, text content (high) |
| `theme.exists` + parsed `schema` (`resolveHostSection`) | `colorScheme` per section (medium — clustered from backgrounds) |
| `reachability.verdict` for absent hosts (`no-candidate` → CODE) | candidate-match (footer config, reviews app) (medium) |
| `work-order` (`deriveWorkOrder`), invariants 1–5 | `mobileDivergence` type (medium) |

## Reachability outcome (honest)

The host is a bare Skeleton, so **20 / 22 sections have no host candidate → CODE** (anticipated by the
spec §10.4 — the store is mostly code-built). `footer` → **config** baseline (host `sections/footer.liquid`
exists) whose bespoke Aristopet design exceeds the 2-setting stub schema → **3 instance-deltas** to code.
`product-reviews` → **app** (canonically app-provided). **work-order: 23 code + 1 app + 0 out-of-scope.**

## Fidelity notes (v1)

- **Settings are representative:** one `get_design_context` extract per *distinct* section, reused across
  its occurrences (e.g. the two homepage `product-card-row`s share the extracted settings).
- **Spacing wrappers folded out:** the "Section Heading" / "Section Footer" wrappers are dropped from
  `compositions`; their standalone heading texts are not captured in v1.
- **Color schemes (4)** are clustered from section backgrounds (White / Warm White / Sand / Espresso),
  confidence medium — not the full 33-role Shopify palette.
- **Chrome** (header / footer / newsletter) is kept in each composition's `order`; the
  `header-group.json` / `footer-group.json` placement is an SP-2 concern.

## Visual cross-check

Homepage + Product desktop renders (`_raw/shot-*.png`) were compared against the inferred `compositions`
order top-to-bottom — **PASS**, every section appears in the right position.

## Regenerate the work-order (never hand-edit)

```bash
node -e "const {deriveWorkOrder}=require('./.claude/scripts/contract.js');const fs=require('fs');const m=require('./.claude/figma-sync/aristopet/manifest.json');const cm=require('./.claude/figma-sync/aristopet/design-rules.json').componentMap;fs.writeFileSync('.claude/figma-sync/aristopet/work-order.json',JSON.stringify(deriveWorkOrder(cm,m.compositions),null,2)+'\n')"
```

`compositions` + `foundations` can be regenerated from the `_raw/` captures with
`node .claude/figma-sync/aristopet/_raw/build-manifest.js`.
