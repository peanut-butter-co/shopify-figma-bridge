# SP-1 — Aristopet Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Note:** the Figma-reading tasks (1, 3, 4, 5, 8) require live Figma MCP access + whole-design consistency and are **controller-executed inline** (hybrid A→B, per the spec's D3); the pure-code tasks (2, 7) are subagent-dispatchable.

**Goal:** Reconstruct Aristopet's design→build contract instance — `foundations`, `componentMap`, `compositions`, `work-order` — as a self-contained, validated artifact set that is both the real handoff and the SP-2 golden fixture.

**Architecture:** Four inference passes (P0 foundations → P1 componentMap → P2 compositions → P3 work-order) read the Figma design (file `73Qy4BbWWqFUky9b5LXTGT`, page `05 - Pages` node `93:2`) and resolve against the bare Skeleton host theme. Deterministic fields come from Figma metadata + the merged SP-0a helpers (`reachability.js`, `contract.js`); only the fuzzy half (settings/colorScheme values, candidate-match, divergence type) is AI-inferred, biased to CODE. A new contract invariant (5: colorScheme referential integrity) + a real-set validation group enforce correctness.

**Tech Stack:** Node (zero-dep scripts), the Figma MCP (`get_metadata`, `get_variable_defs`, `get_screenshot`, `get_design_context`), `.claude/scripts/{reachability,contract,shopify-validate}.js`, the `skills-tests.js` harness.

**Spec:** [docs/superpowers/specs/2026-06-09-sp1-aristopet-inference-design.md](../specs/2026-06-09-sp1-aristopet-inference-design.md)

---

## File Structure

| Path | Responsibility |
|---|---|
| `.claude/figma-sync/aristopet/_raw/` | Captured Figma MCP outputs (metadata per template, variable defs, screenshots) — parser input + provenance. |
| `.claude/figma-sync/aristopet/manifest.json` | `config` + `foundations` + `compositions` (mirrors the real manifest shape). |
| `.claude/figma-sync/aristopet/design-rules.json` | The hardened `componentMap` (one entry per distinct section). |
| `.claude/figma-sync/aristopet/work-order.json` | DERIVED via `deriveWorkOrder()`; never primary state. |
| `.claude/figma-sync/aristopet/README.md` | Provenance, deterministic-vs-inferred split, regen command, frozen-fixture note. |
| `.claude/scripts/contract.js` | MODIFY: add invariant 5 `colorSchemeIntegrityIssues(compositions, foundations)` + export. |
| `.claude/scripts/skills-tests.js` | MODIFY: add invariant-5 unit checks to the SP-0a group; add a new `SP-1` real-set validation group + `GROUP_STRENGTH` key. |
| `docs/contract/design-build-contract.md` | MODIFY: document invariant 5 + the resolved idioms (§8 of the spec). |
| `docs/research/2026-06-09-sp0-contract-design.md` | MODIFY: add invariant 5 to §6. |

**Deterministic vs inferred (governs every pass):** order, node-ids, names, instance-vs-frame, D↔M pairing (`/ Desktop` `/ Mobile`), `theme.exists`/`schema` (`resolveHostSection`), `expressibilityIssues`, `deriveWorkOrder` are **deterministic**. `settings` values, `colorScheme` mapping, candidate-match, `mobileDivergence` type are **inferred** (mark `reachability.confidence`; bias to CODE — never claim `config` without schema proof).

---

## Task 1: Scaffold + capture Figma raw data + run the spike gate

**Files:**
- Create: `.claude/figma-sync/aristopet/_raw/` (directory) + `.claude/figma-sync/aristopet/_raw/SPIKE.md`

**This task is controller-executed (Figma MCP).** It is the spec §6 GATE — a failed assumption STOPS the plan and routes to a contract adjustment before any artifact is built.

- [ ] **Step 1: Create the directory scaffold**

```bash
mkdir -p ".claude/figma-sync/aristopet/_raw"
```

- [ ] **Step 2: Capture the page + per-template metadata**

Call `mcp__figma__get_metadata` (fileKey `73Qy4BbWWqFUky9b5LXTGT`) for each of these nodeIds and save each XML response verbatim to `_raw/meta-<name>.xml`:
- `93:2` → `_raw/meta-05-pages.xml` (the page; gives the top-level template frames + chrome)
- `3436:1867` → `_raw/meta-home-desktop.xml`
- `3520:3400` → `_raw/meta-home-mobile.xml`
- `3365:614` → `_raw/meta-collection-desktop.xml`
- `3370:1199` → `_raw/meta-collection-mobile.xml`
- `3627:5365` → `_raw/meta-product-desktop.xml`
- `3626:4195` → `_raw/meta-product-mobile.xml`

- [ ] **Step 3: Capture variable definitions (foundations source)**

Call `mcp__figma__get_variable_defs` (fileKey `73Qy4BbWWqFUky9b5LXTGT`, nodeId `3436:1867` — the homepage frame, which references the color/type/spacing variables) and save to `_raw/variables.json`. If color modes (schemes) are not fully surfaced from one frame, also call it on a section that carries a distinct scheme and merge.

- [ ] **Step 4: Capture screenshots for the §7 visual cross-check**

Call `mcp__figma__get_screenshot` for each template at both viewports (`3436:1867`, `3520:3400`, `3365:614`, `3370:1199`, `3627:5365`, `3626:4195`), `maxDimension: 1400`, download each PNG to `_raw/shot-<name>.png` via the returned curl URL.

- [ ] **Step 5: Run the four spike assertions and write the report**

For the Homepage slice, confirm via `mcp__figma__get_design_context` (nodeId `3436:1867`) + the captured metadata:
1. Each composed section reports `instance` + a resolvable `mainComponent` (library) OR is a detached `frame` (bespoke).
2. `colorScheme` is readable from the frame's variable mode and maps to a `_raw/variables.json` scheme id.
3. `settings` / text overrides are readable on an instance (e.g. the Split Banner heading text).
4. Decide the **"Section Heading / Section Footer"** wrapper modeling (fold into the wrapped section's settings vs distinct component).

Write `_raw/SPIKE.md` recording each assertion's outcome (PASS / contract-adjustment-needed) and the wrapper decision.

**GATE:** if any of 1–3 fails as the contract assumes, STOP and report a proposed contract adjustment (do not improvise). Only proceed when `_raw/SPIKE.md` shows the assumptions hold (or the contract has been adjusted).

- [ ] **Step 6: Commit**

```bash
git add .claude/figma-sync/aristopet/_raw
git commit -m "feat(sp1): capture Aristopet Figma raw data + spike gate report"
```

---

## Task 2: Invariant 5 — colorScheme referential integrity (contract.js + tests + docs)

**Files:**
- Modify: `.claude/scripts/contract.js` (add `colorSchemeIntegrityIssues`, export it)
- Modify: `.claude/scripts/skills-tests.js` (add unit checks to the existing `SP-0a: design-build contract invariants` group — its title is unchanged, so no `GROUP_STRENGTH` edit)
- Modify: `docs/contract/design-build-contract.md` (§5), `docs/research/2026-06-09-sp0-contract-design.md` (§6)

**Subagent-dispatchable** (pure code, TDD).

- [ ] **Step 1: Write the failing tests**

Insert into `skills-tests.js` inside the `if (ct && ct.deriveWorkOrder) { … }` region's sibling area — directly after the closing `}` of that block (currently line ~1088, before the `every basis…` check). Add:

```javascript
if (ct && ct.colorSchemeIntegrityIssues) {
  const FND = { colors: { schemes: { 'scheme-1': { name: 'White' }, 'scheme-2': { name: 'Grey' } } } };
  check('inv-5 colorScheme integrity: every order colorScheme is a foundations scheme (clean -> [])', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null },
      { component: 'hero', desktopNodeId: 'c', mobileNodeId: 'd', colorScheme: 'scheme-2', settings: {}, blocks: [], mobileDivergence: null } ] } };
    eq(ct.colorSchemeIntegrityIssues(comp, FND), []);
  });
  check('inv-5: a colorScheme not defined in foundations flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-9', settings: {}, blocks: [], mobileDivergence: null } ] } };
    ok(ct.colorSchemeIntegrityIssues(comp, FND).some((m) => /scheme-9/.test(m)), 'dangling scheme ref must flag');
  });
  check('inv-5: a null colorScheme is skipped (not every section carries a scheme)', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'divider', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: null, settings: {}, blocks: [], mobileDivergence: null } ] } };
    eq(ct.colorSchemeIntegrityIssues(comp, FND), []);
  });
}
```

- [ ] **Step 2: Run to verify failure**

Run: `node .claude/scripts/skills-tests.js 2>&1 | grep -i "inv-5\|colorSchemeIntegrity\|RESULT"`
Expected: the inv-5 checks are absent/failing (function not yet exported) — non-zero exit.

- [ ] **Step 3: Implement `colorSchemeIntegrityIssues` in contract.js**

Add this function before `module.exports` and append it to the exports list:

```javascript
/**
 * Invariant 5 — colorScheme referential integrity: every compositions[*].order[*].colorScheme
 * (when non-null) must be a key of foundations.colors.schemes. A dangling scheme ref ships a store
 * with undefined colors. Null/absent colorScheme is skipped (not every section carries a scheme).
 */
function colorSchemeIntegrityIssues(compositions, foundations) {
  const schemes = new Set(Object.keys(((foundations || {}).colors || {}).schemes || {}));
  const issues = [];
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    (Array.isArray(comp && comp.order) ? comp.order : []).forEach((o, i) => {
      if (o && o.colorScheme != null && !schemes.has(o.colorScheme)) {
        issues.push(`compositions["${tpl}"].order[${i}] colorScheme "${o.colorScheme}" is not in foundations.colors.schemes`);
      }
    });
  }
  return issues;
}
```

Update the exports line to include `colorSchemeIntegrityIssues`.

- [ ] **Step 4: Run to verify pass**

Run: `node .claude/scripts/skills-tests.js 2>&1 | tail -3`
Expected: `RESULT: <n> passed, 0 failed` (exit 0), with the three new inv-5 checks counted.

- [ ] **Step 5: Document invariant 5**

In `docs/contract/design-build-contract.md` §5 (Invariants), add:
```
5. colorScheme integrity: every `compositions[*].order[*].colorScheme` (non-null) ∈ keys(`foundations.colors.schemes`).
```
In `docs/research/2026-06-09-sp0-contract-design.md` §6, add the same as item 5 (note it was introduced by SP-1 when foundations entered scope).

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/contract.js .claude/scripts/skills-tests.js docs/contract/design-build-contract.md docs/research/2026-06-09-sp0-contract-design.md
git commit -m "feat(contract): invariant 5 — colorScheme referential integrity (SP-1)"
```

---

## Task 3: P0 foundations → `aristopet/manifest.json`

**Files:**
- Create: `.claude/figma-sync/aristopet/manifest.json` (`config` + `foundations`; compositions added in Task 5)

**Controller-executed.** Reconstruct Aristopet's foundations from `_raw/variables.json` (the host theme is empty — Figma is the only source).

- [ ] **Step 1: Build `config` + `foundations`**

Author `manifest.json` with this shape (values from `_raw/variables.json`; mirror the existing `manifest.foundations` structure):

```jsonc
{
  "config": {
    "themeRoot": "/Users/pablo/Library/CloudStorage/GoogleDrive-pablo@peanutbutter.es/Shared drives/Peanut Butter Drive/7. Diseño/AI Design/shopify-figma-bridge",
    "figmaFileKey": "73Qy4BbWWqFUky9b5LXTGT",
    "figmaFileName": "Aristopet-Design-v1 (PRUEBAS PABLO)",
    "desktopWidth": 1680,
    "mobileWidth": 392,
    "mobileNaming": "{name} / Mobile",
    "mobilePlacement": "adjacent"
  },
  "foundations": {
    "colors": { "schemes": { "scheme-1": { "name": "…", "colors": { "background": "#…", "foreground": "#…", "primary": "#…" /* full role set */ } } },
                "semanticGroups": [ /* … */ ], "uniqueColors": { /* … */ } },
    "typography": { "fontRoles": { /* body/heading/accent … */ }, "presets": { /* h1..h6, paragraph */ } },
    "spacing": { "scale": [ /* … */ ], "radii": { /* … */ }, "borderWidths": { /* … */ } }
  }
}
```

Every Figma color **mode** becomes one `schemes` entry keyed by a stable scheme id (`scheme-1`, `scheme-2`, …); record the human name. These ids are what `compositions[*].colorScheme` will reference (invariant 5).

- [ ] **Step 2: Validate the foundations block**

Run:
```bash
node -e "const m=require('./.claude/figma-sync/aristopet/manifest.json'); const s=Object.keys((m.foundations.colors.schemes)||{}); console.log('schemes',s.length, s.join(',')); if(!s.length){console.error('NO SCHEMES');process.exit(1)} if(!m.config.themeRoot||!m.config.figmaFileKey){console.error('config incomplete');process.exit(1)} console.log('config OK')"
```
Expected: `schemes <n> …` (n ≥ 1) and `config OK`.

- [ ] **Step 3: Commit**

```bash
git add .claude/figma-sync/aristopet/manifest.json
git commit -m "feat(sp1): P0 foundations — Aristopet color schemes/type/spacing from Figma"
```

---

## Task 4: P1 componentMap → `aristopet/design-rules.json`

**Files:**
- Create: `.claude/figma-sync/aristopet/design-rules.json` (`{ "componentMap": { … } }`)

**Controller-executed** (fan out per-section subagents only if reading ~27 sections in one context gets heavy).

- [ ] **Step 1: Enumerate the distinct sections (dedup) and resolve each**

From the `_raw/meta-*.xml` captures, list every distinct `Section / …` used across the 3 templates (dedup — e.g. one `product-card-row` entry even though it appears as an instance on Homepage and a detached frame on Collection; key on the resolved component, not the node type). For each, build a `componentMap` entry per [contract §1](../../contract/design-build-contract.md):

```jsonc
"split-banner": {
  "type": "section",
  "figma": { "name": "Section / Split Banner", "isInstance": true, "representation": "variant-set",
             "desktop": { "nodeId": "3436:1954", "page": "05 - Pages" },
             "mobile":  { "nodeId": "3520:3457", "page": "05 - Pages" } },
  "theme":  { "file": "sections/<slug>.liquid", "exists": <from resolveHostSection>, "kind": "section" },
  "schema": <parsed schema or null>,
  "reachability": { "verdict": "<config|code|app|out-of-scope>", "basis": "<basis enum>",
                    "confidence": "<high|medium|low>", "candidate": "<host file or null>" }
}
```

Determine `theme.exists` + `schema` **deterministically** with `resolveHostSection(themeRoot, slug)`; do not guess. Reachability: a library instance whose slug resolves to an existing host section → `config` (`instance-of-library`); a bespoke detached frame with no host candidate → `code` (`no-candidate`); an app slot → `app` (`app-slot`). **Bias to CODE** whenever `config` cannot be proven against a schema (D3). Helper to fetch `exists`+`schema` for a slug while authoring:

```bash
node -e "const {resolveHostSection}=require('./.claude/scripts/reachability.js'); const root=require('./.claude/figma-sync/aristopet/manifest.json').config.themeRoot; console.log(JSON.stringify(resolveHostSection(root, process.argv[1]),null,2))" <slug>
```

- [ ] **Step 2: Validate the componentMap (shape + invariants 2 & 3)**

Run:
```bash
node -e "const {contractShapeIssues,configRealityIssues,nonexistentNonConfigIssues}=require('./.claude/scripts/contract.js'); const cm=require('./.claude/figma-sync/aristopet/design-rules.json').componentMap; const s=contractShapeIssues(cm,{}),c=configRealityIssues(cm),n=nonexistentNonConfigIssues(cm); console.log('shape',s.length,'config-real',c.length,'nonexist',n.length); if(s.length+c.length+n.length){console.log(JSON.stringify({s,c,n},null,2));process.exit(1)}"
```
Expected: `shape 0 config-real 0 nonexist 0`.

- [ ] **Step 3: Commit**

```bash
git add .claude/figma-sync/aristopet/design-rules.json
git commit -m "feat(sp1): P1 componentMap — distinct Aristopet sections + host reachability"
```

---

## Task 5: P2 compositions → `aristopet/manifest.json`

**Files:**
- Modify: `.claude/figma-sync/aristopet/manifest.json` (add `compositions`)

**Controller-executed.**

- [ ] **Step 1: Author the 3 template compositions**

Add a `compositions` key with one entry per template (`index`, `collection`, `product`). Each `order[*]` references a `componentMap` key and carries both frame node-ids, the `colorScheme` (a `foundations.colors.schemes` id), `settings`, `blocks`, and `mobileDivergence` per [contract §2](../../contract/design-build-contract.md):

```jsonc
"compositions": {
  "index": {
    "template": "index",
    "figmaNodeId": "3436:1867", "figmaNodeIdMobile": "3520:3400",
    "order": [
      { "component": "split-banner", "desktopNodeId": "3436:1954", "mobileNodeId": "3520:3457",
        "colorScheme": "scheme-1", "settings": { "heading": "…" }, "blocks": [], "mobileDivergence": null }
      /* trust-bar, marquee, product-card-row, image-with-text, collection-list-grid, promo-banner,
         brand-logos, ugc (code), newsletter, footer … in design order */
    ]
  },
  "collection": { "template": "collection", "figmaNodeId": "3365:614", "figmaNodeIdMobile": "3370:1199", "order": [ /* … */ ] },
  "product":    { "template": "product",    "figmaNodeId": "3627:5365", "figmaNodeIdMobile": "3626:4195", "order": [ /* … */ ] }
}
```

Section order, node-ids, and D↔M pairing are deterministic from the metadata; `settings`/`colorScheme`/`mobileDivergence` are inferred. Set `mobileDivergence` non-null only for **section-level** divergence (reorder / viewport-only / behaviour); a settings-only difference is `null` (use `_mobile`-suffixed setting keys).

- [ ] **Step 2: Validate compositions (shape + invariants 1 & 5)**

Run:
```bash
node -e "const {contractShapeIssues,referentialIntegrityIssues,colorSchemeIntegrityIssues}=require('./.claude/scripts/contract.js'); const m=require('./.claude/figma-sync/aristopet/manifest.json'); const cm=require('./.claude/figma-sync/aristopet/design-rules.json').componentMap; const s=contractShapeIssues(cm,m.compositions),r=referentialIntegrityIssues(cm,m.compositions),c=colorSchemeIntegrityIssues(m.compositions,m.foundations); console.log('shape',s.length,'refint',r.length,'colorscheme',c.length); if(s.length+r.length+c.length){console.log(JSON.stringify({s,r,c},null,2));process.exit(1)}"
```
Expected: `shape 0 refint 0 colorscheme 0`.

- [ ] **Step 3: Commit**

```bash
git add .claude/figma-sync/aristopet/manifest.json
git commit -m "feat(sp1): P2 compositions — index/collection/product layouts"
```

---

## Task 6: P3 work-order → `aristopet/work-order.json`

**Files:**
- Create: `.claude/figma-sync/aristopet/work-order.json` (DERIVED)

**Controller-executed** (pure derivation; no inference).

- [ ] **Step 1: Derive and write the work-order**

Run:
```bash
node -e "const {deriveWorkOrder}=require('./.claude/scripts/contract.js'); const fs=require('fs'); const m=require('./.claude/figma-sync/aristopet/manifest.json'); const cm=require('./.claude/figma-sync/aristopet/design-rules.json').componentMap; const wo=deriveWorkOrder(cm,m.compositions); fs.writeFileSync('.claude/figma-sync/aristopet/work-order.json', JSON.stringify(wo,null,2)+'\n'); console.log('codeRequired',wo.codeRequired.length,'appBlocks',wo.appBlocks.length,'outOfScope',wo.outOfScope.length)"
```
Expected: prints the three bucket counts (a Skeleton host means `codeRequired` is expected to be large — that is the honest outcome, not a bug, per spec §10.4).

- [ ] **Step 2: Verify idempotent derivation**

Run:
```bash
node -e "const {deriveWorkOrder}=require('./.claude/scripts/contract.js'); const m=require('./.claude/figma-sync/aristopet/manifest.json'); const cm=require('./.claude/figma-sync/aristopet/design-rules.json').componentMap; const a=JSON.stringify(deriveWorkOrder(cm,m.compositions)); const b=require('./.claude/figma-sync/aristopet/work-order.json'); console.log(a===JSON.stringify(b)?'MATCH':'DRIFT'); process.exit(a===JSON.stringify(b)?0:1)"
```
Expected: `MATCH`.

- [ ] **Step 3: Commit**

```bash
git add .claude/figma-sync/aristopet/work-order.json
git commit -m "feat(sp1): P3 work-order — derived from componentMap + compositions"
```

---

## Task 7: SP-1 real-set validation group (skills-tests.js)

**Files:**
- Modify: `.claude/scripts/skills-tests.js` (new group + `GROUP_STRENGTH` key)

**Subagent-dispatchable.** This is the comprehensive acceptance gate: the real Aristopet set satisfies the whole contract.

- [ ] **Step 1: Register the GROUP_STRENGTH key**

In the `GROUP_STRENGTH` object (line ~803), add after the two `SP-0a` keys:
```javascript
  'SP-1: Aristopet inference artifact set (real contract instance)': 'contract',
```

- [ ] **Step 2: Add the validation group**

Insert immediately before the final separator + `RESULT` block (currently the `// ---` at line ~1094):

```javascript
// ---------------------------------------------------------------------------
// SP-1 — the REAL contract instance (Aristopet). The synthetic fixtures/contract set proves the
//   invariants in isolation; this proves the actual handoff satisfies them end-to-end.
// ---------------------------------------------------------------------------
group('SP-1: Aristopet inference artifact set (real contract instance)');
const ARI = '.claude/figma-sync/aristopet';
const loadAri = (rel) => { try { return readJSON(ARI + '/' + rel); } catch (e) { return null; } }; // mirrors loadFix
const ariCM = (loadAri('design-rules.json') || {}).componentMap || null;
const ariMan = loadAri('manifest.json') || null;
const ariWO = loadAri('work-order.json') || null;
const ariComp = ariMan && ariMan.compositions;
check('the Aristopet artifact set exists (design-rules + manifest + work-order)', () => {
  ok(ariCM && typeof ariCM === 'object', 'aristopet/design-rules.json must carry a componentMap');
  ok(ariComp && typeof ariComp === 'object', 'aristopet/manifest.json must carry compositions');
  ok(ariMan && ariMan.foundations && ariMan.foundations.colors, 'aristopet/manifest.json must carry foundations.colors');
  ok(ariWO && Array.isArray(ariWO.codeRequired), 'aristopet/work-order.json must carry codeRequired[]');
});
if (ct && ariCM && ariComp) {
  check('SP-1 inv-shape: the real set satisfies the contract shape (-> [])', () => eq(ct.contractShapeIssues(ariCM, ariComp), []));
  check('SP-1 inv-1: referential integrity (every composition component is a componentMap key)', () => eq(ct.referentialIntegrityIssues(ariCM, ariComp), []));
  check('SP-1 inv-2: config => real (exists + candidate + schema)', () => eq(ct.configRealityIssues(ariCM), []));
  check('SP-1 inv-3: nonexistent => non-config', () => eq(ct.nonexistentNonConfigIssues(ariCM), []));
  check('SP-1 inv-5: every colorScheme is a foundations scheme', () => eq(ct.colorSchemeIntegrityIssues(ariComp, ariMan.foundations), []));
  check('SP-1 inv-4: committed work-order.json equals deriveWorkOrder(componentMap, compositions)', () => {
    const norm = (wo) => ({ codeRequired: [...(wo.codeRequired||[])].map((e)=>JSON.stringify(e)).sort(),
      appBlocks: [...(wo.appBlocks||[])].map((e)=>JSON.stringify(e)).sort(),
      outOfScope: [...(wo.outOfScope||[])].map((e)=>JSON.stringify(e)).sort() });
    eq(norm(ct.deriveWorkOrder(ariCM, ariComp)), norm(ariWO));
  });
}
```

`ct` and `readJSON` are already defined earlier in the file (the SP-0a contract group); reuse them — no new global helper.

- [ ] **Step 3: Run the full harness**

Run: `node .claude/scripts/skills-tests.js 2>&1 | tail -4`
Expected: `RESULT: <n> passed, 0 failed` (exit 0), including the HR-3 meta-check (the new group is classified, no stale keys).

- [ ] **Step 4: Commit**

```bash
git add .claude/scripts/skills-tests.js
git commit -m "test(sp1): real-set validation group — Aristopet satisfies the contract end-to-end"
```

---

## Task 8: Visual cross-check + README + contract feedback finalize

**Files:**
- Create: `.claude/figma-sync/aristopet/README.md`
- Modify: `docs/contract/design-build-contract.md` (record the resolved idioms from spec §8)

**Controller-executed** (visual cross-check uses the `_raw/shot-*.png` captures).

- [ ] **Step 1: Visual cross-check**

For each template, compare `_raw/shot-<name>.png` against the inferred `order` in `compositions`. Every screenshot section must appear in `order` at the right position; a missing/extra section or a thin-sliver anomaly = broken inference → fix the composition (per the screenshot-validation learning: never rationalize an anomaly). Record the check outcome in the README.

- [ ] **Step 2: Write the README**

`.claude/figma-sync/aristopet/README.md` covering: what this set is (real handoff + frozen SP-2 golden fixture); provenance (Figma file `73Qy4BbWWqFUky9b5LXTGT` page `05 - Pages`, host theme path); the deterministic-vs-inferred table; the work-order regen command (`node -e "…deriveWorkOrder…"` from Task 6); and that artifacts must not be hand-edited downstream (regenerate the work-order).

- [ ] **Step 3: Record the resolved idioms in the contract doc**

In `docs/contract/design-build-contract.md`, add a short subsection capturing the spec §8 decisions as resolved in `_raw/SPIKE.md` + the build: the "Section Heading / Section Footer" wrapper modeling, the two-Header-variant rule, that overlay states (Cart Drawer / menus / Sticky ATC) are not templates, and the instance-vs-detached dedup rule (key on resolved component).

- [ ] **Step 4: Run the full harness + commit**

Run: `node .claude/scripts/skills-tests.js 2>&1 | tail -3`
Expected: `RESULT: <n> passed, 0 failed`.

```bash
git add .claude/figma-sync/aristopet/README.md docs/contract/design-build-contract.md
git commit -m "docs(sp1): Aristopet set README + visual cross-check + resolved contract idioms"
```

---

## Final verification (before PR)

- [ ] `node .claude/scripts/skills-tests.js` → `RESULT: <n> passed, 0 failed` (exit 0).
- [ ] `node .claude/scripts/shopify-validate.js` against the artifacts' `themeRoot` shows no regression (sanity; the host is the Skeleton).
- [ ] The four artifacts exist under `.claude/figma-sync/aristopet/` and the work-order is a clean derivation.
- [ ] `_raw/SPIKE.md` documents the gate outcome; any contract adjustment it forced is reflected in the contract doc + spec.
- [ ] Final code review (Workflow), then `superpowers:finishing-a-development-branch` → PR.
