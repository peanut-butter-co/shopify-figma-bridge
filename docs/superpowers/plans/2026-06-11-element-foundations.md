# Element Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `build-shopify-foundations` to configure the host theme's element primitives (button/input/badge/popover/swatch/variant-picker radii, borders, text-case, font, page-width) from the design — fixing e.g. Horizon's rounded buttons (radius 14 → 0) — using the same gap-transparent write mechanism it already uses for typography.

**Architecture:** A pure module `elements-map.js` (mirrors `foundations-map.js`) turns `manifest.foundations.spacing.{radii,borderWidths}` + typography presets + a per-element recommendation table in the theme profile into a write plan (`applied / schemaExtensions / schemaWidenings / gaps`). The `build-shopify-foundations` skill runs it after typography, presents the diff behind the explicit approval gate, and writes values into `config/settings_data.json`. Themes without a profile table get a best-effort generic fallback (everything flagged needs-confirm).

**Tech Stack:** Node.js (zero-dependency CommonJS modules under `.claude/scripts/`), the in-repo `skills-tests.js` harness (`group/check/ok/eq/tryRequire`), Shopify Horizon theme settings (`config/settings_schema.json` + `settings_data.json`).

**Spec:** `docs/superpowers/specs/2026-06-11-element-foundations-design.md`

**Commits:** This project commits only when the user asks (CLAUDE.md). Treat the per-task `commit` steps as checkpoints — run them if the user opts in, otherwise batch at the end. If on the default branch, branch first.

---

### Task 1: `elements-map.js` — the pure mapping module

**Files:**
- Create: `.claude/scripts/elements-map.js`
- Modify: `.claude/scripts/skills-tests.js` (add a `SP-2b: element foundations` group, after the existing `SP-2` foundations-map group)
- Test: same `skills-tests.js` (zero-dependency harness; run with `node .claude/scripts/skills-tests.js`)

- [ ] **Step 1: Write the failing tests**

In `.claude/scripts/skills-tests.js`, find the end of the SP-2 foundations-map group (search for `const fm = tryRequire('./foundations-map.js');` and scroll to the end of that group's `check(...)` calls). **Append** this block right after it:

```javascript
// ---------------------------------------------------------------------------
// SP-2b — element foundations (elements-map.js): button/input/badge/... primitives.
// Pure mapper: (foundations, profileElements, liveSchema, liveData) -> write plan.
// ---------------------------------------------------------------------------
group('SP-2b: element foundations (elements-map.js)');
const em = tryRequire('./elements-map.js');

check('elements-map.js exists with elementsMap + applyElementPlan + resolveSource', () => {
  ok(em && typeof em.elementsMap === 'function' && typeof em.applyElementPlan === 'function'
    && typeof em.resolveSource === 'function',
    'create .claude/scripts/elements-map.js exporting elementsMap, applyElementPlan, resolveSource');
});

if (em && em.elementsMap) {
  const emFoundations = {
    spacing: {
      radii: { button_primary: 0, button_secondary: 0, input: 0, card: 0 },
      borderWidths: { button_secondary: 1, input: 1 },
    },
    typography: { presets: { overline: { case: 'uppercase' }, paragraph: { case: 'none' } } },
  };
  const emProfile = {
    button_primary_radius:   { source: 'spacing.radii.button_primary',   host: ['button_border_radius_primary'] },
    button_secondary_radius: { source: 'spacing.radii.button_secondary', host: ['button_border_radius_secondary'] },
    input_radius:            { source: 'spacing.radii.input',            host: ['inputs_border_radius'] },
    card_radius:             { source: 'spacing.radii.card',             host: ['card_corner_radius', 'product_corner_radius'] },
    secondary_button_border: { source: 'spacing.borderWidths.button_secondary', host: ['secondary_button_border_width'] },
    button_case:             { source: 'typography.preset:overline.case', transform: 'case', host: ['button_text_case_primary'] },
    button_font:             { source: 'typography.role:body', transform: 'fontRole', host: ['type_font_button_primary'] },
  };
  const emSchema = { settings: [
    { id: 'button_border_radius_primary', type: 'range', min: 0, max: 100, step: 1 },
    { id: 'button_border_radius_secondary', type: 'range', min: 0, max: 100, step: 1 },
    { id: 'inputs_border_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'card_corner_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'product_corner_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'secondary_button_border_width', type: 'range', min: 0, max: 4, step: 1 },
    { id: 'button_text_case_primary', type: 'select', options: [{ value: 'default' }, { value: 'uppercase' }] },
    { id: 'type_font_button_primary', type: 'select', options: [{ value: 'body' }, { value: 'accent' }] },
    { id: 'badge_corner_radius', type: 'range', min: 0, max: 100, step: 1 }, // in scope, no rule -> no-design-token
  ] };
  const emData = { current: { button_border_radius_primary: 14, button_border_radius_secondary: 14, inputs_border_radius: 4, card_corner_radius: 4 } };

  check('SP-2b Horizon path: radii map to 0 with old value captured (the rounded-button fix)', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    const prim = r.applied.find((a) => a.id === 'button_border_radius_primary');
    eq(prim, { id: 'button_border_radius_primary', value: 0, old: 14 });
    const card = r.applied.find((a) => a.id === 'card_corner_radius');
    eq(card.value, 0); eq(card.old, 4);
    const prod = r.applied.find((a) => a.id === 'product_corner_radius');
    eq(prod, { id: 'product_corner_radius', value: 0, old: null }); // not in current -> old null
  });

  check('SP-2b transforms: case -> uppercase, fontRole -> body', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    eq(r.applied.find((a) => a.id === 'button_text_case_primary').value, 'uppercase');
    eq(r.applied.find((a) => a.id === 'type_font_button_primary').value, 'body');
  });

  check('SP-2b no-design-token gap for an in-scope host setting with no rule', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    const nd = r.gaps.filter((g) => g.kind === 'no-design-token').map((g) => g.detail.split(' ')[0]).sort();
    eq(nd, ['badge_corner_radius']);
  });

  check('SP-2b source-missing gap when a rule points at an absent token', () => {
    const r = em.elementsMap(emFoundations, { x: { source: 'spacing.radii.nope', host: ['button_border_radius_primary'] } }, emSchema, emData);
    ok(r.gaps.some((g) => g.kind === 'source-missing'), 'absent source must emit source-missing');
    ok(!r.applied.some((a) => a.id === 'button_border_radius_primary'), 'nothing applied for a missing source');
  });

  check('SP-2b off-domain -> widening (range) / option (select); absent id -> schemaExtension', () => {
    const f2 = { spacing: { radii: { big: 999 } }, typography: { presets: {} } };
    const sch = { settings: [
      { id: 'r', type: 'range', min: 0, max: 10, step: 1 },
      { id: 's', type: 'select', options: [{ value: 'a' }] },
    ] };
    const prof = {
      rrad: { source: 'spacing.radii.big', host: ['r'] },        // 999 out of [0-10] -> widen range
      ssel: { source: 'spacing.radii.big', host: ['s'] },        // 999 not an option -> widen option
      newx: { source: 'spacing.radii.big', host: ['brand_new'] },// absent id -> schemaExtension
    };
    const r = em.elementsMap(f2, prof, sch, { current: {} });
    ok(r.schemaWidenings.some((w) => w.id === 'r' && w.widen === 'range'), 'range over max -> widen range');
    ok(r.schemaWidenings.some((w) => w.id === 's' && w.widen === 'option'), 'select miss -> widen option');
    ok(r.schemaExtensions.some((e) => e.id === 'brand_new'), 'absent id -> schemaExtension');
  });

  check('SP-2b generic fallback (no profile): nothing applied, every proposal needs-confirm', () => {
    const r = em.elementsMap(emFoundations, null, emSchema, emData);
    eq(r.applied, []);
    ok(r.gaps.length > 0 && r.gaps.every((g) => g.kind === 'generic-needs-confirm'),
      'fallback proposes only generic-needs-confirm gaps');
    ok(r.gaps.some((g) => /button_border_radius_primary/.test(g.detail)), 'fallback notices radius settings');
  });

  check('SP-2b applyElementPlan: merges applied into data.current, non-destructive + clones', () => {
    const data = { current: { button_border_radius_primary: 14, keep_me: 'x' } };
    const out = em.applyElementPlan({ applied: [{ id: 'button_border_radius_primary', value: 0 }] }, data);
    eq(out.current.button_border_radius_primary, 0);
    eq(out.current.keep_me, 'x', 'host-only settings preserved');
    eq(data.current.button_border_radius_primary, 14, 'original input not mutated (cloned)');
  });
}
```

**Also register the new group in `GROUP_STRENGTH`** (near the top of `skills-tests.js`): the `HR-3` meta-test requires every `group()` title to be classified, so add `'SP-2b: element foundations (elements-map.js)': 'contract',` beside the existing `'SP-2: shopify-foundations build': 'contract'` entry. Without it `HR-3` reds out.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: the new group prints `✗ elements-map.js exists ...` (module missing) and the `if (em && em.elementsMap)` block is skipped; final line shows failures > 0.

- [ ] **Step 3: Implement the module**

Create `.claude/scripts/elements-map.js` with exactly this content:

```javascript
'use strict';
/**
 * SP-2 element-foundations mapper (pure, no IO). Mirrors foundations-map.js: turns design tokens
 * (manifest.foundations.spacing.{radii,borderWidths} + typography presets) plus a theme-profile
 * recommendation table into a write plan for the host theme's element settings (button/input/badge/...
 * radii, border widths, text-case, font, page width). Consumed by build-shopify-foundations after the
 * typography step. Value-domain checks are single-sourced through shopify-validate.settingValueIssue.
 */
const { settingValueIssue } = require('./shopify-validate.js');

// Host element settings considered "in scope" (Horizon). Any present in the live schema but covered by
// NO recommendation rule -> a `no-design-token` gap (left at host default, surfaced — never invented).
const SCOPE_HOST_SETTINGS = [
  'button_border_radius_primary', 'button_border_radius_secondary', 'pills_border_radius',
  'primary_button_border_width', 'secondary_button_border_width',
  'type_font_button_primary', 'type_font_button_secondary',
  'button_text_case_primary', 'button_text_case_secondary',
  'inputs_border_radius', 'input_border_width',
  'badge_corner_radius', 'badge_position', 'badge_font_family', 'badge_text_transform',
  'page_width',
  'popover_border_radius', 'popover_border', 'popover_border_width', 'popover_border_opacity',
  'variant_swatch_radius', 'variant_swatch_width', 'variant_swatch_height',
  'variant_swatch_border_style', 'variant_swatch_border_width', 'variant_swatch_border_opacity',
  'variant_button_radius', 'variant_button_border_width', 'variant_button_width',
  'product_corner_radius', 'card_corner_radius', 'icon_stroke',
];

// design value -> host option value
const TRANSFORMS = {
  case: (v) => (v === 'uppercase' ? 'uppercase' : 'default'),
  fontRole: (v) => (v === 'heading' || v === 'accent' ? 'accent' : 'body'),
};

/** Read a value out of manifest.foundations using a profile `source` string. undefined when absent. */
function resolveSource(foundations, source) {
  if (!foundations || typeof source !== 'string') return undefined;
  let m = source.match(/^typography\.preset:([^.]+)\.(.+)$/);
  if (m) {
    const ps = (foundations.typography && foundations.typography.presets) || {};
    const list = Array.isArray(ps) ? ps : Object.entries(ps).map(([k, v]) => Object.assign({ key: k }, v));
    const p = list.find((x) => x && (x.key === m[1] || x.name === m[1]));
    return p ? p[m[2]] : undefined;
  }
  m = source.match(/^typography\.role:(.+)$/);
  if (m) return m[1]; // the role name; the `fontRole` transform maps it to a host option
  let cur = foundations;
  for (const seg of source.split('.')) { if (cur == null) return undefined; cur = cur[seg]; }
  return cur;
}

function applyTransform(name, value) {
  if (!name) return value;
  return TRANSFORMS[name] ? TRANSFORMS[name](value) : value;
}

/** Crude name-similarity: pick the token key sharing the most underscore-separated parts with `id`. */
function bestKeyMatch(id, keys) {
  const a = String(id).toLowerCase().split(/[_-]/).filter(Boolean);
  let best = null, score = 0;
  for (const k of keys) {
    const b = k.toLowerCase().split(/[_-]/).filter(Boolean);
    const s = b.filter((t) => a.includes(t)).length;
    if (s > score) { best = k; score = s; }
  }
  return best;
}

/**
 * Build the element write plan. `profileElements` is theme-profile recommendations.elements, or null.
 * Returns { applied:[{id,value,old}], schemaExtensions:[{id,value,reason}],
 *           schemaWidenings:[{id,type,value,widen}], gaps:[{kind,detail}] }.
 */
function elementsMap(foundations, profileElements, liveSchema, liveData) {
  const applied = [], schemaExtensions = [], schemaWidenings = [], gaps = [];
  const byId = {};
  for (const s of ((liveSchema && Array.isArray(liveSchema.settings)) ? liveSchema.settings : [])) {
    if (s && s.id != null) byId[s.id] = s;
  }
  const cur = (liveData && liveData.current && typeof liveData.current === 'object') ? liveData.current : {};

  if (!profileElements || typeof profileElements !== 'object') {
    // generic fallback (unknown theme): best-effort name match, nothing auto-applied — all needs-confirm.
    const radii = (foundations && foundations.spacing && foundations.spacing.radii) || {};
    const bw = (foundations && foundations.spacing && foundations.spacing.borderWidths) || {};
    for (const id of Object.keys(byId)) {
      if (/radius/.test(id)) { // any radius id — Horizon suffixes variants AFTER "radius" (button_border_radius_primary)
        const k = bestKeyMatch(id, Object.keys(radii));
        gaps.push({ kind: 'generic-needs-confirm', detail: `${id} ~ radii.${k || '?'} (${k != null ? radii[k] : '?'}) — confirm` });
      } else if (/_border_width$/.test(id)) {
        const k = bestKeyMatch(id, Object.keys(bw));
        gaps.push({ kind: 'generic-needs-confirm', detail: `${id} ~ borderWidths.${k || '?'} (${k != null ? bw[k] : '?'}) — confirm` });
      }
    }
    return { applied, schemaExtensions, schemaWidenings, gaps };
  }

  const covered = new Set();
  for (const [concept, rule] of Object.entries(profileElements)) {
    const raw = resolveSource(foundations, rule && rule.source);
    if (raw === undefined || raw === null) {
      gaps.push({ kind: 'source-missing', detail: `${concept}: source "${rule && rule.source}" not found in foundations` });
      continue;
    }
    const value = applyTransform(rule.transform, raw);
    for (const id of (rule.host || [])) {
      covered.add(id);
      const def = byId[id];
      if (!def) { schemaExtensions.push({ id, value, reason: `new setting for ${concept}` }); continue; }
      const issue = settingValueIssue(def, value);
      if (!issue) { applied.push({ id, value, old: (id in cur ? cur[id] : null) }); continue; }
      if (def.type === 'select' || def.type === 'radio') schemaWidenings.push({ id, type: def.type, value, widen: 'option' });
      else if (def.type === 'range') schemaWidenings.push({ id, type: 'range', value, widen: 'range' });
      else gaps.push({ kind: 'value-out-of-domain', detail: `${id}: ${issue}` });
    }
  }
  // in-scope host settings present in the schema but covered by no rule -> honest no-design-token gap
  for (const id of SCOPE_HOST_SETTINGS) {
    if (!covered.has(id) && byId[id]) {
      gaps.push({ kind: 'no-design-token', detail: `${id} has no design token (left at host default ${JSON.stringify(id in cur ? cur[id] : byId[id].default)})` });
    }
  }
  return { applied, schemaExtensions, schemaWidenings, gaps };
}

/** Merge `applied` into a clone of settings_data, writing into data.current (like foundations-map.applyPlan). */
function applyElementPlan(plan, liveData) {
  const data = JSON.parse(JSON.stringify(liveData || {}));
  data.current = data.current || {};
  for (const w of ((plan && plan.applied) || [])) data.current[w.id] = w.value;
  return data;
}

module.exports = { elementsMap, applyElementPlan, resolveSource, applyTransform, bestKeyMatch, SCOPE_HOST_SETTINGS };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: the `SP-2b` group prints all `✓`; final line `RESULT: N passed, 0 failed` (N = prior 206 + the new checks).

- [ ] **Step 5: Commit** (checkpoint — per the commit rule in the header)

```bash
git add .claude/scripts/elements-map.js .claude/scripts/skills-tests.js
git commit -m "feat(sp-2): element-foundations mapper (elements-map.js) + tests"
```

---

### Task 2: Theme-profile recommendation table (`recommendations.elements`)

**Files:**
- Modify: `.claude/figma-sync/theme-profiles/horizon.json` (add `recommendations.elements`)
- Modify: `.claude/scripts/skills-tests.js` (add an integration check to the `SP-2b` group)

- [ ] **Step 1: Write the failing integration test**

In the `SP-2b` group in `.claude/scripts/skills-tests.js`, **inside** the `if (em && em.elementsMap) { ... }` block (before its closing brace), append:

```javascript
  check('SP-2b horizon.json recommendations.elements resolves against the real Aristopet foundations', () => {
    const profile = readJSON('.claude/figma-sync/theme-profiles/horizon.json');
    const manifest = readJSON('.claude/figma-sync/aristopet/manifest.json');
    const elements = profile && profile.recommendations && profile.recommendations.elements;
    ok(elements && typeof elements === 'object' && Object.keys(elements).length > 0,
      'horizon.json must define recommendations.elements');
    for (const [concept, rule] of Object.entries(elements)) {
      ok(Array.isArray(rule.host) && rule.host.length > 0 && rule.host.every((h) => typeof h === 'string'),
        `${concept}.host must be a non-empty string[]`);
      ok(em.resolveSource(manifest.foundations, rule.source) !== undefined,
        `${concept}.source "${rule.source}" must resolve against the real foundations (no source-missing)`);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node .claude/scripts/skills-tests.js`
Expected: `✗ ... recommendations.elements resolves ...` ("horizon.json must define recommendations.elements") because the key does not exist yet.

- [ ] **Step 3: Add the recommendation table**

Edit `.claude/figma-sync/theme-profiles/horizon.json`: inside the existing top-level `"recommendations"` object, add an `"elements"` key (sibling of the existing `components`/`organization`/`templates` keys). Insert exactly:

```jsonc
"elements": {
  "button_primary_radius":   { "source": "spacing.radii.button_primary",          "host": ["button_border_radius_primary"] },
  "button_secondary_radius": { "source": "spacing.radii.button_secondary",        "host": ["button_border_radius_secondary"] },
  "input_radius":            { "source": "spacing.radii.input",                   "host": ["inputs_border_radius"] },
  "card_radius":             { "source": "spacing.radii.card",                    "host": ["card_corner_radius", "product_corner_radius"] },
  "secondary_button_border": { "source": "spacing.borderWidths.button_secondary", "host": ["secondary_button_border_width"] },
  "input_border":            { "source": "spacing.borderWidths.input",            "host": ["input_border_width"] },
  "button_case":             { "source": "typography.preset:overline.case", "transform": "case",     "host": ["button_text_case_primary", "button_text_case_secondary"] },
  "button_font":             { "source": "typography.role:body",            "transform": "fontRole", "host": ["type_font_button_primary", "type_font_button_secondary"] }
}
```

Note: real JSON (no comments) — drop the `//`-free `jsonc` styling; ensure a trailing comma on the preceding key and valid JSON overall. Verify with: `node -e "JSON.parse(require('fs').readFileSync('.claude/figma-sync/theme-profiles/horizon.json','utf8'))" && echo OK`.

- [ ] **Step 4: Run to verify it passes**

Run: `node .claude/scripts/skills-tests.js`
Expected: the integration check passes; `RESULT: N passed, 0 failed`.

- [ ] **Step 5: Commit** (checkpoint)

```bash
git add .claude/figma-sync/theme-profiles/horizon.json .claude/scripts/skills-tests.js
git commit -m "feat(sp-2): horizon element-foundations recommendation table"
```

---

### Task 3: Wire the element step into `build-shopify-foundations`

**Files:**
- Modify: `.claude/skills/build-shopify-foundations/SKILL.md`
- Modify: `.claude/scripts/skills-tests.js` (add a skill-contract check to the `SP-2b` group)

- [ ] **Step 1: Write the failing contract test**

In the `SP-2b` group (top level, not inside the `if (em...)` block), append:

```javascript
check('SP-2b build-shopify-foundations SKILL.md wires the element-foundations step', () => {
  const md = readFile('.claude/skills/build-shopify-foundations/SKILL.md');
  ok(/elements-map\.js/.test(md), 'SKILL.md must reference elements-map.js');
  ok(/element foundations|element-foundations|element primitives/i.test(md), 'SKILL.md must describe the element step');
});
```

(If the harness has no `readFile` helper, use the same file-reading helper the other SKILL.md checks use — search for `readFile`/`fs.readFileSync` near the existing skill-contract checks and match it.)

- [ ] **Step 2: Run to verify it fails**

Run: `node .claude/scripts/skills-tests.js`
Expected: `✗ ... wires the element-foundations step` (SKILL.md does not mention elements-map yet).

- [ ] **Step 3: Edit the skill**

In `.claude/skills/build-shopify-foundations/SKILL.md`:

(a) Under **Logic (single-sourced, tested)** add `elements-map.js` to the listed modules.

(b) In **Step 1: Inspect + compute the plan**, after the typography plan paragraph, add:

```markdown
Also compute the **element-foundations** plan (buttons/inputs/badges/popovers/swatches/variant-pickers
radii, borders, text-case, font, page width):

​```bash
node -e '
const em=require("./.claude/scripts/elements-map.js"), sw=require("./.claude/scripts/safe-shopify-write.js"), fs=require("fs");
const root=require("./.claude/figma-sync/aristopet/manifest.json");
const profile=require("./.claude/figma-sync/theme-profiles/horizon.json"); // resolve by manifest.theme; null -> generic fallback
const tr=root.config.themeRoot;
const schema=JSON.parse(fs.readFileSync(tr+"/config/settings_schema.json","utf8"));
// flatten the grouped schema to { settings:[...] } the mapper expects:
const flat={settings:[].concat(...schema.map(g=>g&&g.settings||[]))};
const data=sw.parseSettingsData(fs.readFileSync(tr+"/config/settings_data.json","utf8"));
const elements=(profile.recommendations&&profile.recommendations.elements)||null;
console.log(JSON.stringify(em.elementsMap(root.foundations, elements, flat, data),null,2));
'
​```
```

(c) In **Step 2: Propose the plan**, add a bullet: "**Element foundations:** present every `applied` element setting (`old → new`, e.g. `button_border_radius_primary 14 → 0`), and every gap (`no-design-token` left at host default; `generic-needs-confirm` for un-profiled themes; `value-out-of-domain`/`source-missing`). Fold these into the **same explicit approval gate** as colors/typography."

(d) In **Step 3: Execute**, add: "Write the approved element `applied` with `applyElementPlan(plan, data)` from `elements-map.js` (merges into `data.current`, same `settings_data.json` write path as typography — re-prepend the JSONC header). Apply `schemaWidenings`/`schemaExtensions` as surgical edits to `settings_schema.json` (CRLF-safe), exactly as for the type-scale ladder."

(e) In **Step 5: Summary**, add a line: `  Elements:       {A} settings applied (e.g. button radius → 0), {G} gaps`.

- [ ] **Step 4: Run to verify it passes**

Run: `node .claude/scripts/skills-tests.js`
Expected: the contract check passes; `RESULT: N passed, 0 failed`.

- [ ] **Step 5: Commit** (checkpoint)

```bash
git add .claude/skills/build-shopify-foundations/SKILL.md .claude/scripts/skills-tests.js
git commit -m "feat(sp-2): wire element-foundations step into build-shopify-foundations"
```

---

## Self-Review

**1. Spec coverage**
- `recommendations.elements` data shape → Task 2 (with the exact table from the spec).
- `elements-map.js` (resolveSource DSL, transforms `case`/`fontRole`, buckets, no-design-token, generic fallback, applyElementPlan) → Task 1.
- Skill integration (compute → present under F8 gate → write → summary) → Task 3.
- Gap kinds (`no-design-token`, `source-missing`, `value-out-of-domain`, `generic-needs-confirm`) → all asserted in Task 1 tests.
- Worked example (button radii 14→0; badges = no-design-token) → Task 1 Horizon test + Task 2 integration test.
- Testing section → Tasks 1–3 tests. **No gaps found.**

**2. Placeholder scan** — no TBD/TODO; every code step carries complete code. The `jsonc` table in Task 2 Step 3 is flagged "real JSON, no comments" with a parse-verify command. The `readFile`/`readFile` helper note in Task 3 Step 1 points the engineer at the existing convention rather than inventing one. No bare "add error handling"/"write tests for the above".

**3. Type consistency** — `elementsMap(foundations, profileElements, liveSchema, liveData)`, `applyElementPlan(plan, liveData)`, `resolveSource(foundations, source)` used identically across module, tests, and the skill snippet. Plan shape `{applied,schemaExtensions,schemaWidenings,gaps}` consistent everywhere. `applied` items are `{id,value,old}` in both the module and the tests. Source DSL strings (`spacing.radii.*`, `typography.preset:overline.case`, `typography.role:body`) match between the horizon.json table and `resolveSource`'s parser.

**Note for the executor (host-schema shape):** `config/settings_schema.json` is an **array of groups**, each `{name, settings:[...]}`. `elementsMap` expects a flat `{settings:[...]}` — the Step-1 skill snippet flattens it (`[].concat(...schema.map(g=>g.settings||[]))`). The unit tests already pass the flat shape directly.
