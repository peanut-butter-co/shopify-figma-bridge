# SP-0a — Design→Build Contract (data lane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define, document, and deterministically enforce the three artifacts of the design→build contract (hardened `componentMap`, `manifest.compositions`, derived work-order) so SP-1 (Aristopet inference) has a real target to fill — with no theme writes.

**Architecture:** Two new zero-dependency Node modules under `.claude/scripts/`. `reachability.js` holds the **deterministic** half of the reachability check (host-section resolution via `extractSchema`, schema-expressibility run *in reverse* via `settingValueIssue`/`blockTypeAccepted`/`maxBlocksIssue`, and the css-hardcoded→CODE lookup from `theme-profiles/horizon.json`) — it reuses `shopify-validate.js`, re-deriving no logic. `contract.js` holds the cross-artifact shape enforcer, the four §6 invariants, and `deriveWorkOrder()` (invariant 4 — the work-order is a pure function of `componentMap`+`compositions`, never hand-maintained). The fuzzy candidate-match half of reachability is SP-1's inference and is deliberately **not** built here. A committed fixture under `.claude/scripts/fixtures/contract/` makes the spec's worked Aristopet examples executable, and the invariants are wired into `skills-tests.js` in TDD red→green.

**Tech Stack:** Node.js (CommonJS, zero deps), the existing `skills-tests.js` harness (`group`/`check`/`ok`/`eq`), reuse of `.claude/scripts/shopify-validate.js`.

**Source spec:** [docs/research/2026-06-09-sp0-contract-design.md](../../research/2026-06-09-sp0-contract-design.md) (commit `2a800f3`). Decisions D1–D4, the §4 classifier, the §6 invariants, and the SP-0a/SP-0b split are **closed** — do not re-litigate.

---

## Scope (locked)

**In SP-0a (this plan):**
- The three contract shapes, defined as an executable fixture + enforced by `contractShapeIssues()`, documented in a durable reference doc.
- The **deterministic** reachability/expressibility helpers, reusing `shopify-validate.js` + the css-hardcoded lookup from `horizon.json`.
- The §6 invariants 1–4 in `skills-tests.js`, TDD red→green.

**Explicitly OUT (do not build here):**
- The fuzzy candidate-match (the inferred half of the verdict) — **SP-1**.
- Aristopet's actual contract instance — **SP-1**.
- `/configure-store` / any `templates/*.json` write — **SP-2**.
- `_shared/safe-shopify-write.md`, `config.themeRoot`, host-theme preflight — **SP-0b**.

**Hard rules (CLAUDE.md):** no theme writes in SP-0a (`resolveHostSection` is read-only). Keep `node .claude/scripts/skills-tests.js` green (exit 0) after every task.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `.claude/scripts/shopify-validate.js` | **Modify** | Extract the inline block-type acceptance into an exported, reusable `blockTypeAccepted()`; rewire `validateTheme()` to call it (behavior-preserving). |
| `.claude/scripts/reachability.js` | **Create** | Deterministic reachability: `resolveHostSection`, `expressibilityIssues`, `cssHardcodedPrefixes`/`isCssHardcoded`. Reuses `shopify-validate.js`. |
| `.claude/scripts/contract.js` | **Create** | `contractShapeIssues` (schema enforcer), `referentialIntegrityIssues`, `configRealityIssues`, `nonexistentNonConfigIssues`, `deriveWorkOrder`. Reuses `reachability.js`. |
| `.claude/scripts/fixtures/contract/design-rules.json` | **Create** | Canonical valid `componentMap` (the §3.1 shape, Aristopet examples). |
| `.claude/scripts/fixtures/contract/compositions.json` | **Create** | Canonical valid `manifest.compositions` (the §3.2 shape). |
| `.claude/scripts/fixtures/contract/work-order.expected.json` | **Create** | The expected `deriveWorkOrder()` output (invariant 4 golden). |
| `.claude/scripts/fixtures/contract/README.md` | **Create** | Documents the representative cases the fixture encodes. |
| `.claude/scripts/skills-tests.js` | **Modify** | Two new `group()`s + their `GROUP_STRENGTH` registrations + the §6 invariant checks. |
| `docs/contract/design-build-contract.md` | **Create** | The durable, human-readable contract reference (the three shapes, enums, deterministic-vs-inferred split). |
| `CLAUDE.md` | **Modify** | One pointer paragraph under the "Manifest state contract" section. |

**Module dependency direction:** `shopify-validate.js` ← `reachability.js` ← `contract.js`. No cycles.

---

## Conventions for every task

- **Harness invariant:** introducing a new `group('…')` in `skills-tests.js` makes the **HR-3 meta-check** (line ~823) go red unless the *exact* title string is also added to the `GROUP_STRENGTH` object (line ~790). Therefore: whenever a task adds a new `group()`, that SAME task adds the matching `GROUP_STRENGTH` key in its first step — so the only intended red is "function not defined," never the meta-check.
- **Group titles are ASCII** (no `—`/`→`) to avoid any byte-mismatch between the `group()` call and its `GROUP_STRENGTH` key. Prose docs/fixtures may use unicode.
- **Commit cadence:** commit after each task reaches green. (Per the `mutation-test-commit-first` learning, anything that does `git checkout` discards uncommitted edits — so never leave a task's work uncommitted before a verification that restores files.)
- **Run the harness** with: `node .claude/scripts/skills-tests.js` — exit 0 = all green.

---

### Task 1: Extract `blockTypeAccepted()` in `shopify-validate.js` (reuse-enabler)

The contract's expressibility check needs the *same* block-type acceptance logic `validateTheme()` already has inline. Extract it to one exported, unit-tested function and rewire `validateTheme()` to call it — behavior-preserving, so the BL-3 end-to-end fixture still reports exactly 3 errors.

**Files:**
- Modify: `.claude/scripts/shopify-validate.js` (add function near `blockTypeFileIssue` ~line 46; export ~line 351-356; rewire `validateTheme` ~lines 304-317)
- Test: `.claude/scripts/skills-tests.js` (existing group `A6: deterministic Shopify validation checks (scripted + unit-tested)`, ~line 585)

- [ ] **Step 1: Write the failing unit test**

In `.claude/scripts/skills-tests.js`, inside the existing `if (sv && sv.rangeStepIssue) { … }` block (after the `blockTypeFileIssue` check, ~line 607), add:

```javascript
  check('blockTypeAccepted mirrors validateTheme acceptance (declared / block-file / @app opt-in / unknown)', () => {
    ok(typeof sv.blockTypeAccepted === 'function', 'export blockTypeAccepted(type, schemaBlocks, blockFiles)');
    ok(sv.blockTypeAccepted('text', [{ type: 'text' }], []));     // declared in schema.blocks (object form)
    ok(sv.blockTypeAccepted('text', ['text'], []));               // declared (string-array form, as in componentMap.schema.blocks)
    ok(sv.blockTypeAccepted('text', [], ['text.liquid']));        // resolves to blocks/text.liquid
    ok(sv.blockTypeAccepted('promo', [], ['_promo.liquid']));     // private/static block file (_-prefixed)
    ok(sv.blockTypeAccepted('anything', [{ type: '@app' }], [])); // section opts into @app blocks
    ok(!sv.blockTypeAccepted('ghost', [{ type: 'text' }], []));   // not declared, no file, no @app
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .claude/scripts/skills-tests.js`
Expected: one new RED line — `blockTypeAccepted mirrors validateTheme acceptance … -> export blockTypeAccepted(type, schemaBlocks, blockFiles)` (and `RESULT: … 1 failed`).

- [ ] **Step 3: Add the function + export**

In `.claude/scripts/shopify-validate.js`, immediately AFTER `blockTypeFileIssue` (after line 46) insert:

```javascript
/**
 * Is a template/composition block `type` ACCEPTED by a section schema? Mirrors the inline
 * acceptance validateTheme() uses, extracted so the contract's expressibility check (reachability.js)
 * reuses the exact same rule. Accepted if: the schema declares the type, OR the section opts into
 * @app blocks, OR the type resolves to a real blocks/<type>.liquid (or _<type>.liquid static block).
 * `schemaBlocks` may be the raw {% schema %} array of objects, OR a string[] (as componentMap.schema.blocks).
 */
function blockTypeAccepted(type, schemaBlocks, blockFiles) {
  const t = String(type);
  const defs = new Set();
  for (const b of (schemaBlocks || [])) {
    const bt = typeof b === 'string' ? b : (b && b.type);
    if (bt) defs.add(bt);
  }
  const hasFile = (x) => (blockFiles || []).includes(`${x}.liquid`) || (blockFiles || []).includes(`_${x}.liquid`);
  return defs.has(t) || hasFile(t) || defs.has('@app');
}
```

Then add `blockTypeAccepted` to `module.exports` — change the line (currently line 352):

```javascript
  rangeStepIssue, selectLimitIssue, blockTypeFileIssue, colorSchemeRefIssues, orphanedSettingIssues,
```

to:

```javascript
  rangeStepIssue, selectLimitIssue, blockTypeFileIssue, blockTypeAccepted, colorSchemeRefIssues, orphanedSettingIssues,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node .claude/scripts/skills-tests.js`
Expected: the new check is GREEN; total failures unchanged from baseline (0).

- [ ] **Step 5: Rewire `validateTheme()` to use the extracted function (behavior-preserving)**

In `.claude/scripts/shopify-validate.js`, in `validateTheme()`, DELETE these two now-redundant local declarations (currently lines 304-305):

```javascript
        const acceptsAppBlocks = '@app' in blockDefsByType;
        const hasBlockFile = (t) => blockFiles.includes(`${t}.liquid`) || blockFiles.includes(`_${t}.liquid`);
```

and change the `allowed` computation (currently line 317) from:

```javascript
          const allowed = (t in blockDefsByType) || hasBlockFile(t) || acceptsAppBlocks;
```

to:

```javascript
          const allowed = blockTypeAccepted(t, schemaBlocks, blockFiles);
```

(`blockDefsByType` is still built above and still used below for `bDef`/`bSettingsById` — leave it. `schemaBlocks` is already in scope from line 301.)

- [ ] **Step 6: Run the FULL harness — BL-3 end-to-end must still report exactly 3 errors**

Run: `node .claude/scripts/skills-tests.js`
Expected: all GREEN, including `BL-3: validateTheme() runs over the committed fixture and reports its planted issues` (still `3 errors, 0 warnings`). `RESULT: … 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add .claude/scripts/shopify-validate.js .claude/scripts/skills-tests.js
git commit -m "refactor(shopify-validate): extract reusable blockTypeAccepted() (SP-0a enabler)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `reachability.js` — `resolveHostSection()` (deterministic exists + schema)

The `[DESIGN-RULES-TRUST]` gap: today `componentMap` *assumes* `sections/{name}.liquid` exists. This resolves it for real — `exists` from the filesystem, `schema` parsed via `extractSchema`. SP-1 will call this instead of guessing. Read-only.

**Files:**
- Create: `.claude/scripts/reachability.js`
- Test: `.claude/scripts/skills-tests.js` (NEW group, inserted before the final RESULT print ~line 835)

- [ ] **Step 1: Write the failing test + register the new group in `GROUP_STRENGTH`**

First, in `.claude/scripts/skills-tests.js`, register the new group title in the `GROUP_STRENGTH` object. After the line (~line 808):

```javascript
  'HR-1: sync-colors prose color JS is single-sourced with color-utils.js': 'contract',
```

add:

```javascript
  'SP-0a: reachability (deterministic expressibility + host resolution)': 'contract',
  'SP-0a: design-build contract invariants': 'contract',
```

(Both new SP-0a group titles are registered now, so the HR-3 meta-check never goes red as the groups are added across Tasks 2 and 6.)

Then insert this block immediately BEFORE the final separator line (`console.log('\n' + '-'.repeat(60));`, ~line 835):

```javascript
// ---------------------------------------------------------------------------
// SP-0a — reachability: the DETERMINISTIC half of the design->build contract.
//   resolveHostSection (exists + schema via extractSchema), expressibilityIssues
//   (settingValueIssue / blockTypeAccepted / maxBlocksIssue run in REVERSE against a
//   parsed host schema), and the css-hardcoded -> CODE lookup from horizon.json.
//   Reuses .claude/scripts/shopify-validate.js (no logic re-derived). The FUZZY half
//   (candidate-match) is SP-1's inference and is intentionally NOT here.
// ---------------------------------------------------------------------------
group('SP-0a: reachability (deterministic expressibility + host resolution)');
const rc = tryRequire('./reachability.js');
const THEME_FIX = path.join(__dirname, 'fixtures', 'theme');
check('reachability.js exists with the deterministic helpers', () => {
  ok(rc && typeof rc.resolveHostSection === 'function' && typeof rc.expressibilityIssues === 'function'
     && typeof rc.isCssHardcoded === 'function',
    'create .claude/scripts/reachability.js exporting resolveHostSection, expressibilityIssues, isCssHardcoded');
});
if (rc && rc.resolveHostSection) {
  check('resolveHostSection: existing slug -> exists:true + parsed schema (extractSchema reuse)', () => {
    const r = rc.resolveHostSection(THEME_FIX, 'hero');
    eq(r.file, 'sections/hero.liquid');
    eq(r.exists, true);
    ok(r.schema && Array.isArray(r.schema.settings), 'must parse the {% schema %} block');
    ok(r.schema.settings.some((s) => s.id === 'heading_size'), 'parsed schema must expose the hero settings');
  });
  check('resolveHostSection: missing slug -> exists:false, schema:null (no guess; [DESIGN-RULES-TRUST])', () => {
    const r = rc.resolveHostSection(THEME_FIX, 'ghost');
    eq(r.exists, false);
    eq(r.schema, null);
    eq(r.file, 'sections/ghost.liquid');
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .claude/scripts/skills-tests.js`
Expected: RED on `reachability.js exists with the deterministic helpers -> create .claude/scripts/reachability.js …`. The HR-3 meta-check stays GREEN (group already registered).

- [ ] **Step 3: Create `reachability.js` with `resolveHostSection`**

Create `.claude/scripts/reachability.js`:

```javascript
'use strict';
/**
 * SP-0a — the DETERMINISTIC half of the design->build reachability check.
 *
 * "Deterministic" = calculable yes/no, no AI inference. Reuses .claude/scripts/shopify-validate.js
 * so the schema math lives in exactly one place. The FUZZY half (does a bespoke detached Figma
 * frame correspond to a candidate host section at all?) is SP-1's inference and is NOT here.
 *
 * All functions are pure except resolveHostSection, which reads the host theme from disk (read-only).
 */
const fs = require('fs');
const path = require('path');
const { extractSchema, settingValueIssue, maxBlocksIssue, blockTypeAccepted } = require('./shopify-validate.js');

/**
 * Resolve a section slug against a host theme dir: { file, exists, schema }. `exists` is the real
 * filesystem answer (closes [DESIGN-RULES-TRUST]); `schema` is the parsed {% schema %} (null when the
 * file is absent or its schema block is malformed/absent — caller biases to CODE on null, per D3).
 */
function resolveHostSection(themeRoot, slug) {
  const file = `sections/${slug}.liquid`;
  const abs = path.join(themeRoot, file);
  if (!fs.existsSync(abs)) return { file, exists: false, schema: null };
  let schema = null;
  try { schema = extractSchema(fs.readFileSync(abs, 'utf8')); } catch (e) { schema = null; }
  return { file, exists: true, schema };
}

module.exports = { resolveHostSection };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node .claude/scripts/skills-tests.js`
Expected: `resolveHostSection: …` checks GREEN. (The `reachability.js exists …` umbrella check still RED until `expressibilityIssues`/`isCssHardcoded` land — that is expected and resolved in Tasks 3-4.) `RESULT: … 2 failed` is acceptable mid-task; do not commit yet.

- [ ] **Step 5: Commit (after Task 4 closes the umbrella check)**

Defer the commit to the end of Task 4 so the harness is green at the commit boundary. (Tasks 2-4 build one module; they share a single green commit.)

---

### Task 3: `reachability.js` — `expressibilityIssues()` (validate-shopify in reverse)

The deterministic core: given a parsed host schema and an instance's `{ settings, blocks }`, does every setting value sit in its domain, every block type get accepted, and the block count fit `max_blocks`? Returns structured issues (empty = expressible). This is `validate-shopify`'s logic run *in reverse* against the host schema.

**Files:**
- Modify: `.claude/scripts/reachability.js`
- Test: `.claude/scripts/skills-tests.js` (same SP-0a reachability group from Task 2)

- [ ] **Step 1: Write the failing tests**

In `.claude/scripts/skills-tests.js`, inside the SP-0a reachability group, AFTER the `resolveHostSection` block, add:

```javascript
if (rc && rc.expressibilityIssues) {
  // In-memory mirror of fixtures/theme/sections/hero.liquid, plus a max_blocks cap.
  const HERO = {
    settings: [
      { type: 'range', id: 'padding_top', min: 0, max: 100, step: 4 },
      { type: 'select', id: 'heading_size', options: [{ value: 'small' }, { value: 'large' }] },
      { type: 'color_scheme', id: 'color_scheme' },
    ],
    blocks: ['text'],
    max_blocks: 5,
  };
  check('expressibilityIssues: a fully in-domain instance is expressible (-> [])', () => {
    eq(rc.expressibilityIssues(HERO, { settings: { padding_top: 20, heading_size: 'small', color_scheme: 'scheme-1' }, blocks: [{ type: 'text' }] }), []);
  });
  check('expressibilityIssues: out-of-domain select value -> value-out-of-domain', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { heading_size: 'huge' }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: off-step range value -> value-out-of-domain', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { padding_top: 22 }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: an unknown setting id is NOT expressible (bias-to-code, D3)', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { totally_made_up: 'x' }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: a block type the schema does not declare -> block-type-unsupported', () => {
    const is = rc.expressibilityIssues(HERO, { settings: {}, blocks: [{ type: 'video' }] });
    eq(is.length, 1); eq(is[0].kind, 'block-type-unsupported');
  });
  check('expressibilityIssues: @app/@theme block instance types are accepted (no false code-route)', () => {
    eq(rc.expressibilityIssues(HERO, { settings: {}, blocks: [{ type: '@app' }, { type: '@theme/icon' }] }), []);
  });
  check('expressibilityIssues: more blocks than max_blocks -> max-blocks-exceeded', () => {
    const is = rc.expressibilityIssues(HERO, { settings: {}, blocks: Array.from({ length: 6 }, () => ({ type: 'text' })) });
    eq(is.length, 1); eq(is[0].kind, 'max-blocks-exceeded');
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: the `expressibilityIssues` block is skipped (function absent) so these specific checks don't run yet — the umbrella `reachability.js exists …` check is still RED. Confirm no crash. (If you prefer a hard red here, the umbrella check already covers "function not defined.")

- [ ] **Step 3: Implement `expressibilityIssues`**

In `.claude/scripts/reachability.js`, add BEFORE `module.exports`:

```javascript
/**
 * Run the deterministic schema-expressibility check in REVERSE: can `schema` express this instance's
 * settings/blocks? Returns [{ kind, detail }] (empty = expressible). kind in
 * {value-out-of-domain, block-type-unsupported, max-blocks-exceeded}. Conservative per D3: an
 * instance setting id NOT in the schema is treated as not-expressible (we cannot PROVE config), and an
 * unparseable/absent schema (null) yields no positive proof -> caller routes to CODE.
 */
function expressibilityIssues(schema, instance) {
  const issues = [];
  if (!schema || typeof schema !== 'object') return issues; // no schema -> no positive proof (caller biases to code)
  const settingsById = {};
  for (const s of (Array.isArray(schema.settings) ? schema.settings : [])) if (s && s.id) settingsById[s.id] = s;
  for (const [id, val] of Object.entries((instance && instance.settings) || {})) {
    const def = settingsById[id];
    if (!def) { issues.push({ kind: 'value-out-of-domain', detail: `setting "${id}" is not in the host schema` }); continue; }
    const v = settingValueIssue(def, val); // null for in-domain / structurally-unconstrained types
    if (v) issues.push({ kind: 'value-out-of-domain', detail: v });
  }
  const blocks = Array.isArray(instance && instance.blocks) ? instance.blocks : [];
  for (const b of blocks) {
    if (!b || !b.type) continue;
    const t = String(b.type);
    if (t.startsWith('@') || t.includes('://')) continue; // @app / @theme/* / shopify://… instances are accepted
    if (!blockTypeAccepted(t, schema.blocks, [])) issues.push({ kind: 'block-type-unsupported', detail: `block type "${t}" is not accepted by the host schema` });
  }
  const mb = maxBlocksIssue(blocks.length, schema.max_blocks, 'section');
  if (mb) issues.push({ kind: 'max-blocks-exceeded', detail: mb });
  return issues;
}
```

and change the export line to:

```javascript
module.exports = { resolveHostSection, expressibilityIssues };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: all `expressibilityIssues: …` checks GREEN. The umbrella check is still RED only on `isCssHardcoded` (Task 4). Do not commit yet.

---

### Task 4: `reachability.js` — css-hardcoded lookup (`horizon.json`)

§4 step 2 of the classifier: a property that is CSS-hardcoded in the theme profile routes to CODE (the merchant cannot change it via settings). Horizon marks its spacing scale `source: "css-hardcoded"` with pattern `--margin-{size}, --padding-{size}, --gap-{size}`.

**Files:**
- Modify: `.claude/scripts/reachability.js`
- Test: `.claude/scripts/skills-tests.js` (same SP-0a reachability group)

- [ ] **Step 1: Write the failing tests**

In `.claude/scripts/skills-tests.js`, inside the SP-0a reachability group, AFTER the `expressibilityIssues` block, add:

```javascript
if (rc && rc.isCssHardcoded) {
  const profile = readJSON('.claude/figma-sync/theme-profiles/horizon.json');
  check('isCssHardcoded: the horizon spacing scale (margin/padding/gap) routes to CODE', () => {
    ok(rc.isCssHardcoded(profile, '--padding-lg'), 'padding scale is source:css-hardcoded -> CODE');
    ok(rc.isCssHardcoded(profile, '--gap-md'), 'gap is part of the css-hardcoded scale');
    ok(rc.isCssHardcoded(profile, '--margin-2xl'), 'margin is part of the css-hardcoded scale');
  });
  check('isCssHardcoded: settings-driven / unrelated properties are NOT css-hardcoded', () => {
    ok(!rc.isCssHardcoded(profile, 'button_border_radius_primary'), 'radii are source:settings -> not css-hardcoded');
    ok(!rc.isCssHardcoded(profile, 'padding_top'), 'a section setting is not the hardcoded CSS scale');
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: the `isCssHardcoded` block is skipped (function absent); umbrella `reachability.js exists …` still RED.

- [ ] **Step 3: Implement the css-hardcoded lookup**

In `.claude/scripts/reachability.js`, add BEFORE `module.exports`:

```javascript
/**
 * Collect the CSS-custom-property prefixes a theme profile marks `source: "css-hardcoded"`. For
 * Horizon's spacing scale (pattern "--margin-{size}, --padding-{size}, --gap-{size}") this yields
 * ["--margin-", "--padding-", "--gap-"]. Walks the whole profile so future hardcoded regions are
 * picked up without special-casing.
 */
function cssHardcodedPrefixes(profile) {
  const prefixes = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.source === 'css-hardcoded' && typeof o.pattern === 'string') {
      for (const p of o.pattern.split(',')) {
        const m = p.trim().match(/^(--[a-z0-9]+-)\{/i); // "--padding-{size}" -> "--padding-"
        if (m) prefixes.push(m[1]);
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
  };
  walk(profile);
  return [...new Set(prefixes)];
}

/** Is a demanded CSS property hardcoded (i.e. NOT settings-changeable) in this theme profile? -> CODE. */
function isCssHardcoded(profile, property) {
  const p = String(property).trim();
  return cssHardcodedPrefixes(profile).some((pre) => p.startsWith(pre));
}
```

and change the export line to:

```javascript
module.exports = { resolveHostSection, expressibilityIssues, cssHardcodedPrefixes, isCssHardcoded };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: ALL SP-0a reachability checks GREEN (including the umbrella `reachability.js exists …`). `RESULT: … 0 failed`.

- [ ] **Step 5: Commit the whole `reachability.js` module**

```bash
git add .claude/scripts/reachability.js .claude/scripts/skills-tests.js
git commit -m "feat(reachability): deterministic expressibility + host resolution + css-hardcoded lookup (SP-0a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Author the contract fixture (canonical valid instance)

A committed fixture makes the spec's worked Aristopet examples (§4) executable and gives every invariant test a real, valid input. Encodes: `hero` (config, in-domain), `slideshow` (config baseline, but the instance uses 6 slides > `max_blocks:5` -> instance delta), `homepage-marquee-promo` (config baseline, but the composition has a `behavior` mobile divergence -> code), `pdp-ugc-section` (code, no-candidate), `reviews` (app, app-slot).

**Files:**
- Create: `.claude/scripts/fixtures/contract/design-rules.json`
- Create: `.claude/scripts/fixtures/contract/compositions.json`
- Create: `.claude/scripts/fixtures/contract/work-order.expected.json`
- Create: `.claude/scripts/fixtures/contract/README.md`

- [ ] **Step 1: Create `design-rules.json` (the `componentMap`)**

Create `.claude/scripts/fixtures/contract/design-rules.json`:

```json
{
  "generatedAt": "2026-06-09T00:00:00Z",
  "componentMap": {
    "hero": {
      "type": "section",
      "figma": { "name": "hero", "isInstance": true, "representation": "variant-set",
        "desktop": { "nodeId": "2120:2", "page": "04 - Sections" },
        "mobile": { "nodeId": "2122:5", "page": "04 - Sections" } },
      "theme": { "file": "sections/hero.liquid", "exists": true, "kind": "section" },
      "schema": {
        "settings": [
          { "type": "range", "id": "padding_top", "min": 0, "max": 100, "step": 4 },
          { "type": "select", "id": "heading_size", "options": [ { "value": "small" }, { "value": "large" } ] },
          { "type": "color_scheme", "id": "color_scheme" }
        ],
        "blocks": ["text"],
        "max_blocks": 5, "presets": true, "enabledOn": null
      },
      "reachability": { "verdict": "config", "basis": "instance-of-library", "confidence": "high", "candidate": "sections/hero.liquid" }
    },
    "slideshow": {
      "type": "section",
      "figma": { "name": "slideshow", "isInstance": true, "representation": "variant-set",
        "desktop": { "nodeId": "2200:1", "page": "04 - Sections" },
        "mobile": { "nodeId": "2200:9", "page": "04 - Sections" } },
      "theme": { "file": "sections/slideshow.liquid", "exists": true, "kind": "section" },
      "schema": { "settings": [], "blocks": ["slide"], "max_blocks": 5, "presets": true, "enabledOn": null },
      "reachability": { "verdict": "config", "basis": "instance-of-library", "confidence": "high", "candidate": "sections/slideshow.liquid" }
    },
    "homepage-marquee-promo": {
      "type": "section",
      "figma": { "name": "marquee", "isInstance": true, "representation": "variant-set",
        "desktop": { "nodeId": "2300:1", "page": "04 - Sections" },
        "mobile": { "nodeId": "2300:7", "page": "04 - Sections" } },
      "theme": { "file": "sections/marquee.liquid", "exists": true, "kind": "section" },
      "schema": { "settings": [], "blocks": ["text"], "max_blocks": 10, "presets": true, "enabledOn": null },
      "reachability": { "verdict": "config", "basis": "instance-of-library", "confidence": "medium", "candidate": "sections/marquee.liquid" }
    },
    "pdp-ugc-section": {
      "type": "section",
      "figma": { "name": "Section / UGC", "isInstance": false, "representation": "separate-components",
        "desktop": { "nodeId": "3480:2100", "page": "04 - Sections" },
        "mobile": { "nodeId": "3484:2601", "page": "04 - Sections" } },
      "theme": { "file": null, "exists": false, "kind": "section" },
      "schema": null,
      "reachability": { "verdict": "code", "basis": "no-candidate", "confidence": "high", "candidate": null }
    },
    "reviews": {
      "type": "section",
      "figma": { "name": "Section / Reviews", "isInstance": false, "representation": "separate-components",
        "desktop": { "nodeId": "3500:10", "page": "04 - Sections" },
        "mobile": null },
      "theme": { "file": null, "exists": false, "kind": "app-block" },
      "schema": null,
      "reachability": { "verdict": "app", "basis": "app-slot", "confidence": "high", "candidate": null }
    }
  }
}
```

- [ ] **Step 2: Create `compositions.json` (the layout)**

Create `.claude/scripts/fixtures/contract/compositions.json`:

```json
{
  "compositions": {
    "index": {
      "template": "index",
      "figmaNodeId": "3436:1867",
      "figmaNodeIdMobile": "3520:3400",
      "order": [
        { "component": "hero",
          "desktopNodeId": "3436:1900", "mobileNodeId": "3520:3450",
          "colorScheme": "scheme-1",
          "settings": { "padding_top": 20, "heading_size": "small", "color_scheme": "scheme-1" },
          "blocks": [ { "type": "text", "order": 0, "settings": { "content": "Welcome" } } ],
          "mobileDivergence": null },
        { "component": "slideshow",
          "desktopNodeId": "3436:1950", "mobileNodeId": "3520:3500",
          "colorScheme": "scheme-2",
          "settings": {},
          "blocks": [
            { "type": "slide", "order": 0, "settings": {} },
            { "type": "slide", "order": 1, "settings": {} },
            { "type": "slide", "order": 2, "settings": {} },
            { "type": "slide", "order": 3, "settings": {} },
            { "type": "slide", "order": 4, "settings": {} },
            { "type": "slide", "order": 5, "settings": {} }
          ],
          "mobileDivergence": null },
        { "component": "homepage-marquee-promo",
          "desktopNodeId": "3436:1990", "mobileNodeId": "3520:3550",
          "colorScheme": "scheme-2",
          "settings": {},
          "blocks": [],
          "mobileDivergence": { "type": "behavior", "note": "grid (desktop) -> 1.5-card carousel (mobile) needs responsive CSS/JS" } }
      ]
    },
    "product": {
      "template": "product",
      "figmaNodeId": "3600:1000",
      "figmaNodeIdMobile": "3600:2000",
      "order": [
        { "component": "pdp-ugc-section",
          "desktopNodeId": "3600:1100", "mobileNodeId": "3600:2100",
          "colorScheme": "scheme-1",
          "settings": {},
          "blocks": [],
          "mobileDivergence": null },
        { "component": "reviews",
          "desktopNodeId": "3600:1200", "mobileNodeId": "3600:2200",
          "colorScheme": "scheme-1",
          "settings": {},
          "blocks": [],
          "mobileDivergence": null }
      ]
    }
  }
}
```

- [ ] **Step 3: Create `work-order.expected.json` (the invariant-4 golden)**

Create `.claude/scripts/fixtures/contract/work-order.expected.json`. Note the `delta` strings must match `deriveWorkOrder()` output byte-for-byte: the slideshow delta is exactly what `maxBlocksIssue(6, 5, 'section')` returns, and the marquee delta is the composition's `mobileDivergence.note`.

```json
{
  "codeRequired": [
    { "component": "pdp-ugc-section", "basis": "no-candidate", "usedIn": ["product"] },
    { "component": "slideshow", "basis": "max-blocks-exceeded", "usedIn": ["index"], "delta": "section: 6 blocks exceeds max_blocks 5" },
    { "component": "homepage-marquee-promo", "basis": "mobile-divergence", "usedIn": ["index"], "delta": "grid (desktop) -> 1.5-card carousel (mobile) needs responsive CSS/JS" }
  ],
  "appBlocks": [
    { "component": "reviews", "basis": "app-slot", "usedIn": ["product"] }
  ],
  "outOfScope": []
}
```

- [ ] **Step 4: Create the fixture README**

Create `.claude/scripts/fixtures/contract/README.md`:

```markdown
# design->build contract fixture

A committed, **valid** instance of the SP-0 contract (see
`docs/contract/design-build-contract.md`). `.claude/scripts/skills-tests.js` runs the §6
invariants against it: the shape enforcer and invariants 1-3 must report **zero** issues, and
`deriveWorkOrder(componentMap, compositions)` must equal `work-order.expected.json`.

Three files mirror the three artifacts:
- `design-rules.json` -> `componentMap` (one entry per component, §3.1 shape).
- `compositions.json` -> `manifest.compositions` (layout, references componentMap by key, §3.2 shape).
- `work-order.expected.json` -> the DERIVED work-order (§3.3); never hand-maintained in production.

## The representative cases (the spec's worked Aristopet examples, made executable)

| Component | Verdict | What it exercises in the work-order |
|---|---|---|
| `hero` | config | in-domain instance -> **absent** from the work-order |
| `slideshow` | config (baseline) | composition uses 6 slides > schema `max_blocks:5` -> **instance delta** (`max-blocks-exceeded`) |
| `homepage-marquee-promo` | config (baseline) | composition has a `behavior` mobile divergence -> **code** (`mobile-divergence`) |
| `pdp-ugc-section` | code | no host target -> **whole-component** code (`no-candidate`) |
| `reviews` | app | app slot -> **appBlocks** (`app-slot`) |

This is the all-green baseline. The invariant tests ALSO feed crafted *invalid* inputs inline
(bad enum, dangling reference, config-with-null-schema, exists:false+config) to prove each check
has teeth. To add a case, extend these files AND `work-order.expected.json` together.
```

- [ ] **Step 5: Verify the fixtures parse**

Run:
```bash
node -e "['design-rules','compositions','work-order.expected'].forEach(f=>{const o=require('./.claude/scripts/fixtures/contract/'+f+'.json'); console.log(f, 'OK')})"
```
Expected:
```
design-rules OK
compositions OK
work-order.expected OK
```

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/fixtures/contract/
git commit -m "test(contract): canonical valid contract fixture (Aristopet worked examples) (SP-0a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `contract.js` — `contractShapeIssues()` (the schema enforcer)

This is where "define the three schemas" becomes executable: required keys present, enum values valid (`verdict`, `basis`, `representation`, `mobileDivergence.type`). The valid fixture passes clean; crafted bad shapes flag.

**Files:**
- Create: `.claude/scripts/contract.js`
- Test: `.claude/scripts/skills-tests.js` (NEW group, inserted after the SP-0a reachability group)

- [ ] **Step 1: Write the failing tests (introduces the new group — already registered in `GROUP_STRENGTH` in Task 2)**

In `.claude/scripts/skills-tests.js`, immediately AFTER the SP-0a reachability group block and BEFORE the final separator line, add:

```javascript
// ---------------------------------------------------------------------------
// SP-0a — contract invariants (§6 of the SP-0 spec): the four cross-artifact rules that
//   keep the normalized contract honest, the schema-shape enforcer, and the work-order
//   DERIVATION (invariant 4: the work-order is a pure function of componentMap + compositions,
//   never hand-maintained). Run against the committed fixture (.claude/scripts/fixtures/contract).
// ---------------------------------------------------------------------------
group('SP-0a: design-build contract invariants');
const ct = tryRequire('./contract.js');
const CONTRACT_FIX = '.claude/scripts/fixtures/contract';
const loadFix = (rel) => { try { return readJSON(CONTRACT_FIX + '/' + rel); } catch (e) { return null; } };
const fixCM = (loadFix('design-rules.json') || {}).componentMap || null;
const fixComp = (loadFix('compositions.json') || {}).compositions || null;
const fixWO = loadFix('work-order.expected.json');
check('contract.js exists with the shape + invariant + derivation helpers', () => {
  ok(ct && ['contractShapeIssues', 'referentialIntegrityIssues', 'configRealityIssues', 'nonexistentNonConfigIssues', 'deriveWorkOrder'].every((f) => typeof ct[f] === 'function'),
    'create .claude/scripts/contract.js exporting the five contract helpers');
});
check('the contract fixture loaded (componentMap + compositions + expected work-order)', () => {
  ok(fixCM && typeof fixCM === 'object', 'fixtures/contract/design-rules.json must carry a componentMap');
  ok(fixComp && typeof fixComp === 'object', 'fixtures/contract/compositions.json must carry compositions');
  ok(fixWO && Array.isArray(fixWO.codeRequired), 'fixtures/contract/work-order.expected.json must carry codeRequired[]');
});
if (ct && ct.contractShapeIssues) {
  check('inv-shape: the valid fixture satisfies the contract shape (-> [])', () => {
    eq(ct.contractShapeIssues(fixCM, fixComp), []);
  });
  check('inv-shape: a bad verdict enum value flags', () => {
    const bad = { hero: { type: 'section',
      figma: { name: 'hero', isInstance: true, representation: 'variant-set', desktop: { nodeId: '1:1' }, mobile: null },
      theme: { file: 'sections/hero.liquid', exists: true, kind: 'section' },
      schema: { settings: [], blocks: [] },
      reachability: { verdict: 'maybe', basis: 'instance-of-library', confidence: 'high', candidate: 'sections/hero.liquid' } } };
    ok(ct.contractShapeIssues(bad, {}).some((m) => /verdict/.test(m)), 'verdict not in {config,code,app,out-of-scope} must flag');
  });
  check('inv-shape: a bad mobileDivergence type flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [],
        mobileDivergence: { type: 'teleport', note: 'x' } } ] } };
    ok(ct.contractShapeIssues(fixCM, comp).some((m) => /mobileDivergence/.test(m)));
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: RED on `contract.js exists with the shape + invariant + derivation helpers …`. HR-3 meta-check GREEN (group registered in Task 2).

- [ ] **Step 3: Create `contract.js` with `contractShapeIssues`**

Create `.claude/scripts/contract.js`:

```javascript
'use strict';
/**
 * SP-0a — the design->build CONTRACT: the cross-artifact shape enforcer, the four §6 invariants,
 * and the work-order DERIVATION. Pure functions; reuses reachability.js for the deterministic
 * expressibility check (so invariant 4's "instances failing the check" stays single-sourced).
 *
 * Artifacts (see docs/contract/design-build-contract.md):
 *   componentMap   (design-rules.json) — the single reference: Figma component -> theme code.
 *   compositions   (manifest.compositions) — the layout, references componentMap by key.
 *   work-order     — DERIVED from the two above; never primary state.
 */
const { expressibilityIssues } = require('./reachability.js');

const VERDICTS = ['config', 'code', 'app', 'out-of-scope'];
const BASES = ['instance-of-library', 'css-hardcoded', 'schema-expressible', 'no-candidate',
  'block-type-unsupported', 'value-out-of-domain', 'max-blocks-exceeded', 'mobile-divergence', 'app-slot', 'liquid-only'];
const REPRESENTATIONS = ['variant-set', 'separate-components'];
const DIVERGENCE_TYPES = ['reorder', 'viewport-only', 'behavior'];

/** Schema-shape enforcer: required keys present + enum members valid. Returns [] for a valid contract. */
function contractShapeIssues(componentMap, compositions) {
  const issues = [];
  const req = (cond, msg) => { if (!cond) issues.push(msg); };
  for (const [slug, e] of Object.entries(componentMap || {})) {
    const at = `componentMap["${slug}"]`;
    if (!e || typeof e !== 'object') { issues.push(`${at}: not an object`); continue; }
    req(typeof e.type === 'string', `${at}.type missing`);
    req(e.figma && typeof e.figma === 'object', `${at}.figma missing`);
    if (e.figma) {
      req(REPRESENTATIONS.includes(e.figma.representation), `${at}.figma.representation "${e.figma.representation}" not in {${REPRESENTATIONS.join(',')}}`);
      req('isInstance' in e.figma, `${at}.figma.isInstance missing`);
      req(e.figma.desktop && typeof e.figma.desktop === 'object', `${at}.figma.desktop missing`);
      req('mobile' in e.figma, `${at}.figma.mobile missing (use null when no distinct mobile frame)`);
    }
    req(e.theme && typeof e.theme === 'object', `${at}.theme missing`);
    if (e.theme) {
      req('file' in e.theme, `${at}.theme.file missing`);
      req(typeof e.theme.exists === 'boolean', `${at}.theme.exists must be boolean`);
      req(typeof e.theme.kind === 'string', `${at}.theme.kind missing`);
    }
    req('schema' in e, `${at}.schema missing (use null when exists:false)`);
    req(e.reachability && typeof e.reachability === 'object', `${at}.reachability missing`);
    if (e.reachability) {
      req(VERDICTS.includes(e.reachability.verdict), `${at}.reachability.verdict "${e.reachability.verdict}" not in {${VERDICTS.join(',')}}`);
      req(BASES.includes(e.reachability.basis), `${at}.reachability.basis "${e.reachability.basis}" not in the basis enum`);
      req(['high', 'medium', 'low'].includes(e.reachability.confidence), `${at}.reachability.confidence "${e.reachability.confidence}" not in {high,medium,low}`);
      req('candidate' in e.reachability, `${at}.reachability.candidate missing (null when code)`);
    }
  }
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    const order = Array.isArray(comp && comp.order) ? comp.order : [];
    order.forEach((o, i) => {
      const at = `compositions["${tpl}"].order[${i}]`;
      req(o && typeof o.component === 'string', `${at}.component missing`);
      req(o && ('desktopNodeId' in o), `${at}.desktopNodeId missing`);
      req(o && ('mobileNodeId' in o), `${at}.mobileNodeId missing`);
      req(o && ('colorScheme' in o), `${at}.colorScheme missing`);
      req(o && o.settings && typeof o.settings === 'object', `${at}.settings missing`);
      req(o && Array.isArray(o.blocks), `${at}.blocks must be an array`);
      req(o && ('mobileDivergence' in o), `${at}.mobileDivergence missing (null or {type,note})`);
      if (o && o.mobileDivergence != null) {
        req(DIVERGENCE_TYPES.includes(o.mobileDivergence.type),
          `${at}.mobileDivergence.type "${o.mobileDivergence && o.mobileDivergence.type}" not in {${DIVERGENCE_TYPES.join(',')}}`);
      }
    });
  }
  return issues;
}

module.exports = { contractShapeIssues, VERDICTS, BASES, REPRESENTATIONS, DIVERGENCE_TYPES };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: the `contract fixture loaded` and all `inv-shape: …` checks GREEN. The umbrella `contract.js exists …` is still RED until Tasks 7-8 add the remaining four functions. Do not commit yet.

---

### Task 7: `contract.js` — invariants 1-3

Invariant 1 (referential integrity): every `compositions[*].order[*].component` is a `componentMap` key. Invariant 2 (config ⇒ real): a `config` verdict requires `theme.exists === true ∧ candidate != null ∧ schema != null`. Invariant 3 (nonexistent ⇒ non-config): `exists === false ⇒ verdict ∈ {code, app, out-of-scope}`.

**Files:**
- Modify: `.claude/scripts/contract.js`
- Test: `.claude/scripts/skills-tests.js` (same SP-0a invariants group)

- [ ] **Step 1: Write the failing tests**

In `.claude/scripts/skills-tests.js`, inside the SP-0a invariants group, AFTER the `inv-shape` block, add:

```javascript
if (ct && ct.referentialIntegrityIssues) {
  check('inv-1 referential integrity: every composition component is a componentMap key (fixture clean)', () => {
    eq(ct.referentialIntegrityIssues(fixCM, fixComp), []);
  });
  check('inv-1: a composition referencing an unknown component flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'ghost-section', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null } ] } };
    ok(ct.referentialIntegrityIssues(fixCM, comp).some((m) => /ghost-section/.test(m)));
  });
}
if (ct && ct.configRealityIssues) {
  check('inv-2 config=>real: every config verdict has exists:true + candidate + schema (fixture clean)', () => {
    eq(ct.configRealityIssues(fixCM), []);
  });
  check('inv-2: a config verdict with schema:null flags', () => {
    const bad = { x: { theme: { file: 'sections/x.liquid', exists: true, kind: 'section' }, schema: null,
      reachability: { verdict: 'config', basis: 'schema-expressible', confidence: 'medium', candidate: 'sections/x.liquid' } } };
    ok(ct.configRealityIssues(bad).some((m) => /schema/.test(m)));
  });
}
if (ct && ct.nonexistentNonConfigIssues) {
  check('inv-3 nonexistent=>non-config: exists:false => verdict in {code,app,out-of-scope} (fixture clean)', () => {
    eq(ct.nonexistentNonConfigIssues(fixCM), []);
  });
  check('inv-3: exists:false with verdict:config flags', () => {
    const bad = { x: { theme: { file: null, exists: false, kind: 'section' }, schema: null,
      reachability: { verdict: 'config', basis: 'no-candidate', confidence: 'low', candidate: null } } };
    ok(ct.nonexistentNonConfigIssues(bad).some((m) => /x/.test(m)));
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail (or skip)**

Run: `node .claude/scripts/skills-tests.js`
Expected: the three `if (ct && ct.xxx)` blocks are skipped (functions absent); umbrella `contract.js exists …` still RED.

- [ ] **Step 3: Implement invariants 1-3**

In `.claude/scripts/contract.js`, add BEFORE `module.exports`:

```javascript
/** Invariant 1 — referential integrity: every composition order component is a componentMap key. */
function referentialIntegrityIssues(componentMap, compositions) {
  const keys = new Set(Object.keys(componentMap || {}));
  const issues = [];
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (o && o.component && !keys.has(o.component)) issues.push(`compositions["${tpl}"] references "${o.component}" which is not a componentMap key`);
    }
  }
  return issues;
}

/** Invariant 2 — config => real: verdict "config" requires theme.exists && candidate != null && schema != null. */
function configRealityIssues(componentMap) {
  const issues = [];
  for (const [slug, e] of Object.entries(componentMap || {})) {
    if (!e || !e.reachability || e.reachability.verdict !== 'config') continue;
    if (!(e.theme && e.theme.exists === true)) issues.push(`${slug}: verdict=config but theme.exists !== true`);
    if (e.reachability.candidate == null) issues.push(`${slug}: verdict=config but candidate is null`);
    if (e.schema == null) issues.push(`${slug}: verdict=config but schema is null`);
  }
  return issues;
}

/** Invariant 3 — nonexistent => non-config: exists === false forbids the "config" verdict. */
function nonexistentNonConfigIssues(componentMap) {
  const issues = [];
  for (const [slug, e] of Object.entries(componentMap || {})) {
    if (e && e.theme && e.theme.exists === false && e.reachability && e.reachability.verdict === 'config') {
      issues.push(`${slug}: theme.exists=false but verdict=config (must be code/app/out-of-scope)`);
    }
  }
  return issues;
}
```

and update the export line to add the three functions:

```javascript
module.exports = { contractShapeIssues, referentialIntegrityIssues, configRealityIssues, nonexistentNonConfigIssues, VERDICTS, BASES, REPRESENTATIONS, DIVERGENCE_TYPES };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: all `inv-1`/`inv-2`/`inv-3` checks GREEN. Umbrella `contract.js exists …` still RED on `deriveWorkOrder` (Task 8). Do not commit yet.

---

### Task 8: `contract.js` — `deriveWorkOrder()` (invariant 4)

The work-order is a **pure derivation**: components with `verdict ∈ {code, app, out-of-scope}` (whole-component) ∪ config-component instances failing the deterministic expressibility check (instance delta) ∪ composition entries with a non-null section-level `mobileDivergence` (mobile divergence). No manual entries.

**Files:**
- Modify: `.claude/scripts/contract.js`
- Test: `.claude/scripts/skills-tests.js` (same SP-0a invariants group)

- [ ] **Step 1: Write the failing tests**

In `.claude/scripts/skills-tests.js`, inside the SP-0a invariants group, AFTER the inv-3 block, add:

```javascript
if (ct && ct.deriveWorkOrder) {
  // Order-independent compare: the derivation is set-like per bucket.
  const norm = (wo) => ({
    codeRequired: [...((wo && wo.codeRequired) || [])].map((e) => JSON.stringify(e)).sort(),
    appBlocks: [...((wo && wo.appBlocks) || [])].map((e) => JSON.stringify(e)).sort(),
    outOfScope: [...((wo && wo.outOfScope) || [])].map((e) => JSON.stringify(e)).sort(),
  });
  check('inv-4 work-order = pure derivation: deriveWorkOrder(cm, compositions) === committed expected', () => {
    eq(norm(ct.deriveWorkOrder(fixCM, fixComp)), norm(fixWO));
  });
  check('inv-4: derivation is idempotent (no manual/sticky entries)', () => {
    const once = ct.deriveWorkOrder(fixCM, fixComp);
    eq(norm(ct.deriveWorkOrder(fixCM, fixComp)), norm(once));
  });
  check('inv-4: nulling one mobileDivergence drops exactly one mobile-divergence code entry', () => {
    const stripped = JSON.parse(JSON.stringify(fixComp));
    let removed = 0;
    for (const t of Object.values(stripped)) for (const o of t.order) if (o.mobileDivergence) { o.mobileDivergence = null; removed++; }
    ok(removed >= 1, 'fixture must contain at least one mobileDivergence entry to exercise this');
    const before = ct.deriveWorkOrder(fixCM, fixComp).codeRequired.filter((e) => e.basis === 'mobile-divergence').length;
    const after = ct.deriveWorkOrder(fixCM, stripped).codeRequired.filter((e) => e.basis === 'mobile-divergence').length;
    eq(before - after, removed, 'each nulled mobileDivergence must drop exactly one mobile-divergence code entry');
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail (or skip)**

Run: `node .claude/scripts/skills-tests.js`
Expected: the `if (ct && ct.deriveWorkOrder)` block is skipped (function absent); umbrella `contract.js exists …` still RED.

- [ ] **Step 3: Implement `deriveWorkOrder`**

In `.claude/scripts/contract.js`, add BEFORE `module.exports`:

```javascript
/** component -> [templateKeys] it is used in (deterministic, insertion order of compositions). */
function usedInIndex(compositions) {
  const idx = {};
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (!o || !o.component) continue;
      (idx[o.component] = idx[o.component] || []).push(tpl);
    }
  }
  return idx;
}

/**
 * Invariant 4 — the work-order is a PURE function of componentMap + compositions. Three contributors:
 *   (A) component baselines: verdict in {code, app, out-of-scope} -> whole-component entry.
 *   (B) instance deltas: a config component whose THIS usage fails expressibilityIssues -> code delta.
 *   (C) mobile divergence: a composition entry with a non-null section-level mobileDivergence -> code.
 * A divergent entry routes whole to code (skips the expressibility delta to avoid double-counting).
 */
function deriveWorkOrder(componentMap, compositions) {
  const idx = usedInIndex(compositions);
  const usedOf = (slug) => idx[slug] || [];
  const codeRequired = [], appBlocks = [], outOfScope = [];

  // (A) baselines
  for (const [slug, e] of Object.entries(componentMap || {})) {
    const r = (e && e.reachability) || {};
    if (r.verdict === 'code') codeRequired.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
    else if (r.verdict === 'app') appBlocks.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
    else if (r.verdict === 'out-of-scope') outOfScope.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
  }

  // (B)+(C) per composition entry
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (!o || !o.component) continue;
      const e = (componentMap || {})[o.component];
      if (!e) continue; // dangling reference -> invariant 1 reports it; not a work-order entry
      if (o.mobileDivergence && o.mobileDivergence.type) { // (C)
        codeRequired.push({ component: o.component, basis: 'mobile-divergence', usedIn: [tpl], delta: o.mobileDivergence.note });
        continue;
      }
      if (e.reachability && e.reachability.verdict === 'config' && e.schema) { // (B)
        const issues = expressibilityIssues(e.schema, { settings: o.settings, blocks: o.blocks });
        if (issues.length) {
          codeRequired.push({ component: o.component, basis: issues[0].kind, usedIn: [tpl], delta: issues.map((i) => i.detail).join('; ') });
        }
      }
    }
  }
  return { codeRequired, appBlocks, outOfScope };
}
```

and update the export line to its final form:

```javascript
module.exports = { contractShapeIssues, referentialIntegrityIssues, configRealityIssues, nonexistentNonConfigIssues, deriveWorkOrder, usedInIndex, VERDICTS, BASES, REPRESENTATIONS, DIVERGENCE_TYPES };
```

- [ ] **Step 4: Run the FULL harness to verify everything passes**

Run: `node .claude/scripts/skills-tests.js`
Expected: ALL GREEN — `contract.js exists …`, all `inv-shape`/`inv-1`/`inv-2`/`inv-3`/`inv-4` checks, AND the HR-3 meta-check (`every group() … is classified in GROUP_STRENGTH`). `RESULT: … 0 failed`.

If `inv-4 … === committed expected` is RED with an `expected/got` diff, the mismatch is almost always a `delta` string: re-check `work-order.expected.json` against exactly what `maxBlocksIssue(6, 5, 'section')` returns (`"section: 6 blocks exceeds max_blocks 5"`) and the marquee `mobileDivergence.note` (copied verbatim).

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/contract.js .claude/scripts/skills-tests.js
git commit -m "feat(contract): §6 invariants + work-order derivation (SP-0a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Document the contract (reference doc + CLAUDE.md pointer)

Sub-task 1's human-readable deliverable: a durable reference for the three shapes that SP-1/2/3 read, plus a one-paragraph pointer from CLAUDE.md's state-contract section.

**Files:**
- Create: `docs/contract/design-build-contract.md`
- Modify: `CLAUDE.md` (under "## Manifest state contract")

- [ ] **Step 1: Write the contract reference doc**

Create `docs/contract/design-build-contract.md`:

```markdown
# The design->build contract

The load-bearing seam between "design" and "build". Three normalized artifacts (SP-0 / Approach A);
the design spec is [docs/research/2026-06-09-sp0-contract-design.md](../research/2026-06-09-sp0-contract-design.md).
Enforced by `.claude/scripts/contract.js` + `.claude/scripts/reachability.js`; the canonical valid
instance is `.claude/scripts/fixtures/contract/`. **Producing Aristopet's instance is SP-1, not this contract.**

## 1. `design-rules.json` > `componentMap` (the single reference)

One entry per component, keyed by slug (sections) or component name (atoms/blocks). `exists` is
VERIFIED from the filesystem (never guessed — closes `[DESIGN-RULES-TRUST]`); `schema` is the parsed
`{% schema %}`; `reachability` is the component-level baseline verdict.

- `figma.representation`: `variant-set` | `separate-components`.
- `figma.desktop` / `figma.mobile`: the two design frames (D4); `mobile` is `null` when there is no distinct mobile frame.
- `theme.exists`: boolean (from `resolveHostSection`). `theme.kind`: `section` | `theme-block` | `app-block` | `snippet`.
- `schema`: `null` when `exists:false`; else `{ settings, blocks, max_blocks, presets, enabledOn }`.
- `reachability.verdict`: `config` | `code` | `app` | `out-of-scope`.
- `reachability.basis` enum: `instance-of-library` · `css-hardcoded` · `schema-expressible` · `no-candidate`
  · `block-type-unsupported` · `value-out-of-domain` · `max-blocks-exceeded` · `mobile-divergence` · `app-slot` · `liquid-only`.
- `reachability.confidence`: `high` | `medium` | `low`. `reachability.candidate`: host section if config, else `null`.

## 2. `manifest.compositions` (the layout)

Order + values per template; references `componentMap` **by key** (the normalized indirection). No
provenance fields. Each `order[*]` carries BOTH frame node-ids (`desktopNodeId` / `mobileNodeId`) and a
`mobileDivergence`:
- `null` when desktop & mobile differ only in settings (handled by `_mobile`-suffixed keys in the same `settings` blob);
- `{ type: "reorder" | "viewport-only" | "behavior", note }` when they diverge at the SECTION level — which
  is not expressible in a single JSON `order`/blob and routes that section to the work-order as code (D4).

## 3. work-order (DERIVED — never primary state)

`deriveWorkOrder(componentMap, compositions)` = a pure function. Three contributors:
- whole-component: `verdict ∈ {code, app, out-of-scope}`;
- instance delta: a config component whose specific composition fails the deterministic expressibility check
  (carries `delta` + `usedIn`);
- mobile divergence: a composition entry with a non-null section-level `mobileDivergence`.

`{ codeRequired: [...], appBlocks: [...], outOfScope: [...] }`. Regenerable; consumed by SP-3.

## 4. Reachability: deterministic vs inferred

Two-part check (D3): `(deterministic schema-expressibility) + (fuzzy candidate-match)`. **Only the
deterministic half lives in this repo today** (`reachability.js`); the fuzzy half is SP-1's AI inference.

| Deterministic (`reachability.js`, reuses `shopify-validate.js`) | Inferred by SP-1 (best-effort) |
|---|---|
| `resolveHostSection` -> `exists` + parsed `schema` | candidate-match for bespoke detached sections |
| `expressibilityIssues` (settingValueIssue / blockTypeAccepted / maxBlocks, run in reverse) | `settings` / `blocks` values |
| `isCssHardcoded` (horizon.json) -> CODE | order + colorScheme read from Figma frames |
| invariants 1-4 (`contract.js`) | the fuzzy half of the verdict (biased to CODE) |

**Bias to CODE (D3):** never claim `config` without proof against the schema. An unknown setting id, an
unparseable/absent schema, or any expressibility failure routes to CODE — a false `code` is visible and
cancelable; a false `config` ships a silently-broken store.

## 5. Invariants (enforced in `skills-tests.js`)

1. Referential integrity: every `compositions[*].order[*].component` is a `componentMap` key.
2. config => real: `verdict === "config"` => `theme.exists === true ∧ candidate != null ∧ schema != null`.
3. nonexistent => non-config: `exists === false` => `verdict ∈ {code, app, out-of-scope}`.
4. work-order = pure derivation (no manual entries).

The shape enforcer `contractShapeIssues()` additionally checks required keys + enum membership.
```

- [ ] **Step 2: Add the CLAUDE.md pointer**

In `CLAUDE.md`, find the "## Manifest state contract" section. Immediately AFTER its table (after the `/compose-page` row), add this paragraph:

```markdown

SP-0 hardens this seam with the **design→build contract**: `design-rules.json › componentMap`
(now carrying `exists` + parsed `schema` + a `reachability` verdict), `manifest.compositions` (the
per-template layout, referencing `componentMap` by key), and a **derived** work-order. Shapes,
enums, and the deterministic-vs-inferred split live in
[docs/contract/design-build-contract.md](docs/contract/design-build-contract.md); the invariants are
enforced in `skills-tests.js` (group `SP-0a: design-build contract invariants`) against the fixture
under `.claude/scripts/fixtures/contract/`.
```

- [ ] **Step 3: Verify docs land and the harness stays green**

Run:
```bash
grep -q "design-build-contract" CLAUDE.md && grep -q "manifest.compositions" CLAUDE.md && echo "CLAUDE.md OK"
test -f docs/contract/design-build-contract.md && echo "doc OK"
node .claude/scripts/skills-tests.js
```
Expected: `CLAUDE.md OK`, `doc OK`, and `RESULT: … 0 failed` (the `F067`/`F034` CLAUDE.md checks remain GREEN — nothing was removed).

- [ ] **Step 4: Commit**

```bash
git add docs/contract/design-build-contract.md CLAUDE.md
git commit -m "docs(contract): durable design→build contract reference + CLAUDE.md pointer (SP-0a)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Final verification + self-review

**Files:** none (verification only)

- [ ] **Step 1: Full green harness**

Run: `node .claude/scripts/skills-tests.js`
Expected: `RESULT: … 0 failed`, exit code 0. Confirm the two new groups appear in the output and the HR-3 meta-check is GREEN.

- [ ] **Step 2: Confirm the contract modules load standalone (no harness)**

Run:
```bash
node -e "const rc=require('./.claude/scripts/reachability.js'); const ct=require('./.claude/scripts/contract.js'); const dr=require('./.claude/scripts/fixtures/contract/design-rules.json'); const co=require('./.claude/scripts/fixtures/contract/compositions.json'); console.log('shape', ct.contractShapeIssues(dr.componentMap, co.compositions).length); console.log('workorder', JSON.stringify(ct.deriveWorkOrder(dr.componentMap, co.compositions)))"
```
Expected: `shape 0` and a `workorder {...}` line with `pdp-ugc-section`, `slideshow` (max-blocks-exceeded), `homepage-marquee-promo` (mobile-divergence) in `codeRequired` and `reviews` in `appBlocks`.

- [ ] **Step 3 (OPTIONAL, read-only): smoke against the real Aristopet host theme**

Only if the Google Drive host theme is mounted (per the `validate-against-real-theme` learning — catches false positives before SP-1 relies on these helpers). Pick a real section slug present in that theme's `sections/`:
```bash
node -e "const rc=require('./.claude/scripts/reachability.js'); const root='/Users/pablo/Library/CloudStorage/GoogleDrive-pablo@peanutbutter.es/Shared drives/Peanut Butter Drive/7. Diseño/AI Design/shopify-figma-bridge'; const r=rc.resolveHostSection(root,'hero'); console.log(JSON.stringify({exists:r.exists, file:r.file, hasSchema:!!r.schema, settings:r.schema&&r.schema.settings&&r.schema.settings.length}))"
```
Expected: `exists:true` with a non-null parsed schema for a section that exists in the real theme (sanity only — do NOT block SP-0a on this; real-instance work is SP-1).

- [ ] **Step 4: Self-review against the spec**

Confirm each spec section maps to a task: §3.1→Tasks 5/6/9, §3.2→Tasks 5/6/9, §3.3→Tasks 5/8/9, §4 deterministic half→Tasks 2/3/4, D4 mobile divergence→Tasks 5/6/8, §6 invariants 1-4→Tasks 7/8, §7 reuse→Tasks 1/2/3. Confirm nothing from the OUT-OF-SCOPE list (fuzzy match, Aristopet instance, config writes, safe-write) was built. If a gap is found, add a task; otherwise SP-0a is complete and SP-1 can begin.

---

## Self-Review (author's pass)

**1. Spec coverage** — every § section has a task (mapping in Task 10 Step 4). The fuzzy candidate-match (§4 step 3 inference), Aristopet's instance (§9), config writes (§9), and safe-write/`config.themeRoot` (SP-0b) are deliberately excluded and called out in the Scope section. No gaps.

**2. Placeholder scan** — every code step contains complete, runnable code; every run step states the exact command and expected output. No TBD/TODO/"similar to"/"add error handling".

**3. Type consistency** — function names are stable across tasks: `blockTypeAccepted(type, schemaBlocks, blockFiles)`, `resolveHostSection(themeRoot, slug) -> {file, exists, schema}`, `expressibilityIssues(schema, instance) -> [{kind, detail}]`, `isCssHardcoded(profile, property)`, `contractShapeIssues(componentMap, compositions)`, `referentialIntegrityIssues`, `configRealityIssues`, `nonexistentNonConfigIssues`, `deriveWorkOrder(componentMap, compositions) -> {codeRequired, appBlocks, outOfScope}`. Module dependency direction (`shopify-validate ← reachability ← contract`) is acyclic. The `delta` strings in `work-order.expected.json` are pinned to the exact `maxBlocksIssue` output and the verbatim composition `note`, so the invariant-4 deep-equal is deterministic.
