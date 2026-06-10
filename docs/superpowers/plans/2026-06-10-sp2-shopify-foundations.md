# SP-2: Shopify Foundations Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A human-assisted `/build-shopify-foundations` skill that maps Aristopet's reconstructed foundations into crunchy-horizon's native color-scheme + typography systems — populating what maps cleanly, proposing schema extensions for the gaps — behind a backup→diff→approval safe write.

**Architecture:** Two tested, pure-logic scripts under `.claude/scripts/` (`foundations-map.js` = the deterministic mapping; `safe-shopify-write.js` = backup/verify/JSONC IO), validated by a new `skills-tests.js` group against a committed golden fixture (a real crunchy-horizon config snapshot). A prose skill (`.claude/skills/build-shopify-foundations/`) orchestrates: inspect → run the mapping → present the plan + gaps → approve → apply via safe-write → record `buildStatus`. Mirrors the Figma-side `build-foundations` skill shape.

**Tech Stack:** Node.js (zero-dependency, CommonJS, matches existing `.claude/scripts/*.js`); reuses `color-utils.js` (`shopifyHexToRGBA`/`rgbaToShopifyHex`) and `shopify-validate.js` (`validateTheme`). Skill prose runs the scripts via Bash (`node …`).

**Spec:** `docs/superpowers/specs/2026-06-10-sp2-shopify-foundations-design.md`

---

## Key facts the implementer needs (read once)

- **Harness API** (`.claude/scripts/skills-tests.js`): `group(title)`, `check(name, fn)`, `ok(cond, msg)`, `eq(a, b, msg)` (JSON.stringify deep-equal), `tryRequire('./x.js')` (require relative to `.claude/scripts/`, null on failure), `readJSON(relPathFromRepoRoot)`, `read(relPathFromRepoRoot)`. Fixtures live at `.claude/scripts/fixtures/`; reference them with `path.join(__dirname, 'fixtures', …)`.
- **HR-3 meta-check** (skills-tests.js ~line 839): every `group('…')` title MUST have a matching key in the `GROUP_STRENGTH` map (~line 803) and vice-versa (no stale keys). So the SP-2 group title and its `GROUP_STRENGTH` entry are added **together** in Task 1, and the title string must be **byte-identical** in both places: `SP-2: shopify-foundations build`.
- **Where the SP-2 group goes:** insert it after the SP-1 group's closing `}` and before the final `// ---…` separator that precedes the `RESULT:` print (currently ~line 1143–1144). All later tasks append `check(...)` calls into this same group block.
- **`color-utils.js` round-trips Aristopet colors to Horizon conventions:** `rgbaToShopifyHex(shopifyHexToRGBA('#00000000'))` → `'rgba(0,0,0,0)'` (Horizon's literal for transparent); `'#fffefd'` → `'#fffefd'`; `'#1e1b1814'` → `'#1e1b1814'` (8-digit alpha preserved). Use this as `normalizeColor`.
- **`settings_data.json` is JSONC:** it begins with a `/* … */` header comment, then JSON. Strip the header before `JSON.parse`; re-prepend it on write.
- **The live host** is at the repo root (`themeRoot: "."`): `config/settings_schema.json` (group `t:names.colors` → `color_scheme_group` id `color_schemes` with a `definition[]` of roles; group `t:names.typography` → `type_*` settings) and `config/settings_data.json` (`current.color_schemes.scheme-1..6` + a UUID scheme, plus `type_*` values). Read crunchy-horizon's real values there.
- **Aristopet foundations** input: `.claude/figma-sync/aristopet/manifest.json › foundations` (4 schemes with role colors; `typography.fontRoles.{body,label,heading}.raw`; `typography.presets.{h1,h2,h3,overline,paragraph,caption}`).

### The role map (Aristopet → Horizon), locked

```
background→background, foreground_heading→foreground_heading, foreground→foreground,
border→border, primary→primary,
primary_button_background→primary_button_background, primary_button_text→primary_button_text,
primary_button_border→primary_button_border,
secondary_button_background→secondary_button_background, secondary_button_text→secondary_button_text,
inputs_text→input_text_color, inputs_border→input_border_color,
inputs_hover_background→input_hover_background
```
`foreground_chip` has **no** Horizon role → emit an `orphan-role` gap, do not write it. Horizon roles Aristopet does not specify (`primary_hover`, `shadow`, all `*_hover_*`, `variant_*`, `selected_variant_*`) are left untouched (merge, not replace).

### Typography mapping rules, locked

- Presets `h1,h2,h3 → Horizon h1,h2,h3`; `paragraph → paragraph`. `overline`,`caption` → `component-level-preset` gap (skipped; handled in spec #3).
- `type_font_h{n}` = `'heading'` (Aristopet h1–h3 fontRole is `heading`).
- `type_size_h{n}` = `String(preset.size)`. If that value is **not** in the live `type_size_h{n}` options → push `{ setting:'type_size_h{n}', addOption:{ value:String(size), label:String(size)+'px' } }` to `schemaExtensions` (Aristopet h1=80 triggers this; h2=48, h3=32, paragraph=14 are already in the ladders).
- `type_line_height_h{n}` = nearest token: `bucket = pct<100?'tight':pct<=125?'normal':'loose'`, then pick the live option ending with `bucket` (handles `display-*` vs `body-*`). Aristopet `lineHeight` is a **percentage** (h1=94, h2=100, h3=110, paragraph=160).
- `type_letter_spacing_h{n}` = nearest token: `bucket = v<0?'tight':v===0?'normal':'loose'`, pick the live option ending with `bucket`. (h1=-2, h2=-1, h3=0.)
- `type_case_h{n}` = `preset.case === 'uppercase' ? 'uppercase' : 'none'`.
- paragraph: only `type_size_paragraph` + `type_line_height_paragraph` (no font/case/letter-spacing in the schema).
- Fonts: `type_body_font ← fontRoles.body.raw`, `type_subheading_font ← fontRoles.label.raw`, `type_heading_font ← fontRoles.heading.raw`. `type_accent_font` left at host default → `accent-left-default` gap. Emit a `verify-font-availability` gap for the heading font (Instrument Sans may not be in the Shopify library).
- Every tokenized line-height / letter-spacing mapping also pushes an `approx-…` gap recording the source value → token, so nothing is silently approximated (spec D3).

---

## Task 1: `foundations-map.js` — color schemes, role map, prune

**Files:**
- Create: `.claude/scripts/foundations-map.js`
- Modify: `.claude/scripts/skills-tests.js` (add the `GROUP_STRENGTH` entry + the SP-2 group with color checks)

- [ ] **Step 1: Register the group + write failing color tests**

In `.claude/scripts/skills-tests.js`, add to the `GROUP_STRENGTH` object (right after the `'SP-1: …'` line, ~824):

```javascript
  'SP-2: shopify-foundations build': 'contract',
```

Insert the SP-2 group **after the SP-1 group's closing `}` (~line 1143)** and before the final `// ---…` separator:

```javascript
// ---------------------------------------------------------------------------
// SP-2 — foundations build: pure mapping (foundations + live Horizon schema/data ->
//   plan) and safe-write substrate. Validated against a committed crunchy-horizon
//   config snapshot under fixtures/shopify-foundations/. Reuses color-utils.js.
// ---------------------------------------------------------------------------
group('SP-2: shopify-foundations build');
const fm = tryRequire('./foundations-map.js');
const ariFND = (() => { try { return readJSON('.claude/figma-sync/aristopet/manifest.json').foundations; } catch (e) { return null; } })();

check('foundations-map.js exists with the pure mapping helpers', () => {
  ok(fm && typeof fm.foundationsMap === 'function' && typeof fm.mapSchemes === 'function'
     && typeof fm.normalizeColor === 'function' && fm.ROLE_MAP && typeof fm.ROLE_MAP === 'object',
    'create .claude/scripts/foundations-map.js exporting foundationsMap, mapSchemes, normalizeColor, ROLE_MAP');
});
if (fm && fm.mapSchemes) {
  check('SP-2 normalizeColor: transparent -> rgba(0,0,0,0); alpha hex preserved; opaque untouched', () => {
    eq(fm.normalizeColor('#00000000'), 'rgba(0,0,0,0)');
    eq(fm.normalizeColor('#1e1b1814'), '#1e1b1814');
    eq(fm.normalizeColor('#fffefd'), '#fffefd');
  });
  check('SP-2 mapSchemes: scheme-1 roles renamed to Horizon ids, colors normalized', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { name: 'White', colors: {
      background: '#fffefd', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
      foreground_chip: '#1e1b1814', primary: '#af7d4f',
      primary_button_background: '#1e1b18', primary_button_text: '#fffefd', primary_button_border: '#1e1b18',
      secondary_button_background: '#00000000', secondary_button_text: '#1e1b18',
      inputs_text: '#1e1b18', inputs_border: '#c9a88280', inputs_hover_background: '#faf7f2' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {} } } } };
    const r = fm.mapSchemes(fnd, liveData);
    eq(r.schemeWrites['scheme-1'].settings, {
      background: '#fffefd', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
      primary: '#af7d4f',
      primary_button_background: '#1e1b18', primary_button_text: '#fffefd', primary_button_border: '#1e1b18',
      secondary_button_background: 'rgba(0,0,0,0)', secondary_button_text: '#1e1b18',
      input_text_color: '#1e1b18', input_border_color: '#c9a88280', input_hover_background: '#faf7f2' });
    ok(r.gaps.some((g) => g.kind === 'orphan-role' && /foreground_chip/.test(g.detail)), 'foreground_chip -> orphan gap');
  });
  check('SP-2 mapSchemes: host schemes not in foundations -> pruneSchemes', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { colors: { background: '#ffffff' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {} }, 'scheme-5': { settings: {} }, 'scheme-x': { settings: {} } } } };
    const r = fm.mapSchemes(fnd, liveData);
    eq([...r.pruneSchemes].sort(), ['scheme-5', 'scheme-x']);
  });
}
```

- [ ] **Step 2: Run the tests; verify they fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: FAIL — `foundations-map.js exists …` red (module missing). RESULT shows ≥1 failed.

- [ ] **Step 3: Implement the color half of `foundations-map.js`**

Create `.claude/scripts/foundations-map.js`:

```javascript
'use strict';
/**
 * SP-2 foundations build — PURE mapping from Aristopet foundations + a live crunchy-horizon
 * (Horizon) settings schema/data to a write plan. No IO, no side effects. The skill
 * (.claude/skills/build-shopify-foundations) runs this and presents the plan for approval.
 * Reuses color-utils.js so color conversion is single-sourced and tested.
 */
const { shopifyHexToRGBA, rgbaToShopifyHex } = require('./color-utils.js');

// Aristopet scheme role id -> Horizon color_scheme_group role id. Missing keys are orphans.
const ROLE_MAP = {
  background: 'background', foreground_heading: 'foreground_heading', foreground: 'foreground',
  border: 'border', primary: 'primary',
  primary_button_background: 'primary_button_background', primary_button_text: 'primary_button_text',
  primary_button_border: 'primary_button_border',
  secondary_button_background: 'secondary_button_background', secondary_button_text: 'secondary_button_text',
  inputs_text: 'input_text_color', inputs_border: 'input_border_color',
  inputs_hover_background: 'input_hover_background',
};

/** Normalize an Aristopet color string to Horizon's convention (rgba(0,0,0,0) for transparent, #rrggbb[aa] otherwise). */
function normalizeColor(c) { return rgbaToShopifyHex(shopifyHexToRGBA(c)); }

/** foundations + liveData -> { schemeWrites, pruneSchemes, gaps }. schemeWrites carry only mapped roles (partial, merged later). */
function mapSchemes(foundations, liveData) {
  const schemes = ((foundations || {}).colors || {}).schemes || {};
  const liveSchemes = (((liveData || {}).current || {}).color_schemes) || {};
  const schemeWrites = {};
  const gaps = [];
  for (const [id, scheme] of Object.entries(schemes)) {
    const settings = {};
    for (const [role, value] of Object.entries(scheme.colors || {})) {
      const target = ROLE_MAP[role];
      if (!target) { gaps.push({ kind: 'orphan-role', detail: `${id}.${role} (${value}) has no Horizon role — dropped` }); continue; }
      settings[target] = normalizeColor(value);
    }
    schemeWrites[id] = { settings };
  }
  const pruneSchemes = Object.keys(liveSchemes).filter((k) => !(k in schemes));
  return { schemeWrites, pruneSchemes, gaps };
}

module.exports = { ROLE_MAP, normalizeColor, mapSchemes };
```

- [ ] **Step 4: Run the tests; verify the color checks pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — the four SP-2 color checks green; HR-3 stays green (group is classified). RESULT failed count back to 0.

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/foundations-map.js .claude/scripts/skills-tests.js
git commit -m "SP-2: foundations-map color schemes (role map + normalize + prune)"
```

---

## Task 2: `foundations-map.js` — typography (fonts, type scale, extensions, tokens, gaps) + `foundationsMap`

**Files:**
- Modify: `.claude/scripts/foundations-map.js`
- Modify: `.claude/scripts/skills-tests.js` (append type checks inside the SP-2 group)

- [ ] **Step 1: Write failing typography tests**

Append inside the `if (fm && fm.mapSchemes) { … }` block in the SP-2 group:

```javascript
  check('SP-2 mapTypography: fonts + sizes + h1-80 schema extension + nearest tokens + skips', () => {
    const fnd = { typography: {
      fontRoles: { body: { raw: 'dm_sans_n4' }, label: { raw: 'dm_sans_n6' }, heading: { raw: 'instrument_sans_n7' } },
      presets: {
        h1: { fontRole: 'heading', size: 80, lineHeight: 94, letterSpacing: -2, case: 'none' },
        h3: { fontRole: 'heading', size: 32, lineHeight: 110, letterSpacing: 0, case: 'none' },
        paragraph: { fontRole: 'body', size: 14, lineHeight: 160, letterSpacing: 0, case: 'none' },
        overline: { fontRole: 'label', size: 13, lineHeight: 160, letterSpacing: 1.3, case: 'uppercase' } } } };
    const liveSchema = [ { name: 't:names.typography', settings: [
      { type: 'select', id: 'type_size_h1', options: [{ value: '72' }, { value: '88' }] },
      { type: 'select', id: 'type_line_height_h1', options: [{ value: 'display-tight' }, { value: 'display-normal' }, { value: 'display-loose' }] },
      { type: 'select', id: 'type_letter_spacing_h1', options: [{ value: 'heading-tight' }, { value: 'heading-normal' }, { value: 'heading-loose' }] },
      { type: 'select', id: 'type_size_h3', options: [{ value: '32' }] },
      { type: 'select', id: 'type_line_height_h3', options: [{ value: 'display-tight' }, { value: 'display-normal' }, { value: 'display-loose' }] },
      { type: 'select', id: 'type_letter_spacing_h3', options: [{ value: 'heading-tight' }, { value: 'heading-normal' }, { value: 'heading-loose' }] },
      { type: 'select', id: 'type_size_paragraph', options: [{ value: '14' }] },
      { type: 'select', id: 'type_line_height_paragraph', options: [{ value: 'body-tight' }, { value: 'body-normal' }, { value: 'body-loose' }] } ] } ];
    const r = fm.mapTypography(fnd, liveSchema);
    eq(r.fontWrites, { type_body_font: 'dm_sans_n4', type_subheading_font: 'dm_sans_n6', type_heading_font: 'instrument_sans_n7' });
    eq(r.typeWrites.type_font_h1, 'heading');
    eq(r.typeWrites.type_size_h1, '80');
    eq(r.typeWrites.type_line_height_h1, 'display-tight');   // 94% < 100 -> tight
    eq(r.typeWrites.type_letter_spacing_h1, 'heading-tight'); // -2 < 0 -> tight
    eq(r.typeWrites.type_case_h1, 'none');
    eq(r.typeWrites.type_line_height_h3, 'display-normal');   // 110% in [100,125] -> normal
    eq(r.typeWrites.type_letter_spacing_h3, 'heading-normal'); // 0 -> normal
    eq(r.typeWrites.type_line_height_paragraph, 'body-loose'); // 160% > 125 -> loose
    ok(r.schemaExtensions.some((e) => e.setting === 'type_size_h1' && e.addOption.value === '80'), 'h1 80 -> ladder extension');
    ok(!r.schemaExtensions.some((e) => e.setting === 'type_size_h3'), 'h3 32 already on ladder -> no extension');
    ok(r.gaps.some((g) => g.kind === 'component-level-preset' && /overline/.test(g.detail)), 'overline skipped -> gap');
    ok(r.gaps.some((g) => g.kind === 'verify-font-availability'), 'heading font availability flagged');
  });
  check('SP-2 foundationsMap: aggregates schemes + typography into one plan', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { colors: { background: '#fffefd' } } } },
      typography: { fontRoles: { body: { raw: 'dm_sans_n4' }, label: { raw: 'dm_sans_n6' }, heading: { raw: 'instrument_sans_n7' } }, presets: {} } };
    const liveSchema = [];
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {} }, 'scheme-9': { settings: {} } } } };
    const p = fm.foundationsMap(fnd, liveSchema, liveData);
    eq(p.schemeWrites['scheme-1'].settings.background, '#fffefd');
    eq(p.fontWrites.type_heading_font, 'instrument_sans_n7');
    eq(p.pruneSchemes, ['scheme-9']);
    ok(Array.isArray(p.gaps) && Array.isArray(p.schemaExtensions), 'plan carries gaps[] + schemaExtensions[]');
  });
```

- [ ] **Step 2: Run; verify the new checks fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: FAIL — `mapTypography` / `foundationsMap` are not functions yet.

- [ ] **Step 3: Implement typography + aggregator**

Add to `.claude/scripts/foundations-map.js` (before `module.exports`):

```javascript
const PRESET_LEVEL = { h1: 'h1', h2: 'h2', h3: 'h3', paragraph: 'paragraph' };

/** Find a setting by id anywhere in the live schema; return its option value array (or null). */
function optionValues(liveSchema, id) {
  for (const grp of liveSchema || []) {
    for (const s of (grp.settings || [])) {
      if (s && s.id === id && Array.isArray(s.options)) return s.options.map((o) => o.value);
    }
  }
  return null;
}
function nearestToken(bucket, options) {
  const hit = (options || []).find((o) => String(o).endsWith(bucket));
  return hit || null;
}
function lineHeightBucket(pct) { return pct < 100 ? 'tight' : pct <= 125 ? 'normal' : 'loose'; }
function letterSpacingBucket(v) { return v < 0 ? 'tight' : v === 0 ? 'normal' : 'loose'; }

/** foundations + liveSchema -> { fontWrites, typeWrites, schemaExtensions, gaps }. */
function mapTypography(foundations, liveSchema) {
  const typ = (foundations || {}).typography || {};
  const roles = typ.fontRoles || {};
  const presets = typ.presets || {};
  const gaps = [];
  const schemaExtensions = [];
  const typeWrites = {};
  const fontWrites = {};
  if (roles.body) fontWrites.type_body_font = roles.body.raw;
  if (roles.label) fontWrites.type_subheading_font = roles.label.raw;
  if (roles.heading) {
    fontWrites.type_heading_font = roles.heading.raw;
    gaps.push({ kind: 'verify-font-availability', detail: `confirm "${roles.heading.family || roles.heading.raw}" is in the Shopify font library; else add a custom font source` });
  }
  gaps.push({ kind: 'accent-left-default', detail: 'type_accent_font left at host default (Aristopet has no accent role)' });

  for (const [presetKey, preset] of Object.entries(presets)) {
    const level = PRESET_LEVEL[presetKey];
    if (!level) { gaps.push({ kind: 'component-level-preset', detail: `${presetKey} is a component-level text style — not a theme heading level (handled in spec #3)` }); continue; }
    if (level === 'paragraph') {
      typeWrites.type_size_paragraph = String(preset.size);
      const lhOpts = optionValues(liveSchema, 'type_line_height_paragraph');
      const lh = nearestToken(lineHeightBucket(preset.lineHeight), lhOpts);
      if (lh) { typeWrites.type_line_height_paragraph = lh; gaps.push({ kind: 'approx-line-height', detail: `paragraph line-height ${preset.lineHeight}% -> token ${lh}` }); }
      continue;
    }
    typeWrites['type_font_' + level] = preset.fontRole === 'accent' ? 'accent' : 'heading';
    const sizeStr = String(preset.size);
    typeWrites['type_size_' + level] = sizeStr;
    const sizeOpts = optionValues(liveSchema, 'type_size_' + level);
    if (sizeOpts && !sizeOpts.includes(sizeStr)) {
      schemaExtensions.push({ setting: 'type_size_' + level, addOption: { value: sizeStr, label: sizeStr + 'px' } });
      gaps.push({ kind: 'size-ladder-extension', detail: `${level} size ${sizeStr}px is not on the host ladder — proposing to add it` });
    }
    const lh = nearestToken(lineHeightBucket(preset.lineHeight), optionValues(liveSchema, 'type_line_height_' + level));
    if (lh) { typeWrites['type_line_height_' + level] = lh; gaps.push({ kind: 'approx-line-height', detail: `${level} line-height ${preset.lineHeight}% -> token ${lh}` }); }
    const ls = nearestToken(letterSpacingBucket(preset.letterSpacing), optionValues(liveSchema, 'type_letter_spacing_' + level));
    if (ls) { typeWrites['type_letter_spacing_' + level] = ls; gaps.push({ kind: 'approx-letter-spacing', detail: `${level} letter-spacing ${preset.letterSpacing} -> token ${ls}` }); }
    typeWrites['type_case_' + level] = preset.case === 'uppercase' ? 'uppercase' : 'none';
  }
  return { fontWrites, typeWrites, schemaExtensions, gaps };
}

/** Full plan: foundations + live schema/data -> { schemeWrites, typeWrites, fontWrites, schemaExtensions, gaps, pruneSchemes }. */
function foundationsMap(foundations, liveSchema, liveData) {
  const c = mapSchemes(foundations, liveData);
  const t = mapTypography(foundations, liveSchema);
  return {
    schemeWrites: c.schemeWrites,
    pruneSchemes: c.pruneSchemes,
    typeWrites: t.typeWrites,
    fontWrites: t.fontWrites,
    schemaExtensions: t.schemaExtensions,
    gaps: [...c.gaps, ...t.gaps],
  };
}
```

Update the export line:

```javascript
module.exports = { ROLE_MAP, normalizeColor, mapSchemes, mapTypography, foundationsMap, optionValues };
```

- [ ] **Step 4: Run; verify pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — all SP-2 mapping checks green.

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/foundations-map.js .claude/scripts/skills-tests.js
git commit -m "SP-2: foundations-map typography (fonts, scale, ladder extension, tokens, gaps)"
```

---

## Task 3: `safe-shopify-write.js` — JSONC IO, backup, verifyOnlyChanged

**Files:**
- Create: `.claude/scripts/safe-shopify-write.js`
- Modify: `.claude/scripts/skills-tests.js` (append safe-write checks inside the SP-2 group)

- [ ] **Step 1: Write failing safe-write tests**

Append inside the SP-2 group (after the typography checks). These use Node's `os.tmpdir()` so they touch no repo files:

```javascript
const sw = tryRequire('./safe-shopify-write.js');
check('safe-shopify-write.js exists with backup + verifyOnlyChanged + parseSettingsData', () => {
  ok(sw && typeof sw.backup === 'function' && typeof sw.verifyOnlyChanged === 'function'
     && typeof sw.parseSettingsData === 'function',
    'create .claude/scripts/safe-shopify-write.js exporting backup, verifyOnlyChanged, parseSettingsData');
});
if (sw && sw.verifyOnlyChanged) {
  check('SP-2 parseSettingsData: strips the JSONC header comment then parses', () => {
    const txt = '/*\n * auto-generated\n */\n{ "current": { "a": 1 } }';
    eq(sw.parseSettingsData(txt), { current: { a: 1 } });
  });
  check('SP-2 verifyOnlyChanged: [] when only an approved path changes; violation when not', () => {
    const before = { current: { color_schemes: { 'scheme-1': { settings: { background: '#000' } } }, x: 1 } };
    const okAfter = { current: { color_schemes: { 'scheme-1': { settings: { background: '#fff' } } }, x: 1 } };
    eq(sw.verifyOnlyChanged(before, okAfter, ['current.color_schemes']), []);
    const badAfter = { current: { color_schemes: { 'scheme-1': { settings: { background: '#fff' } } }, x: 2 } };
    const v = sw.verifyOnlyChanged(before, badAfter, ['current.color_schemes']);
    ok(v.length === 1 && /current\.x/.test(v[0]), 'unapproved current.x change is a violation: ' + JSON.stringify(v));
  });
  check('SP-2 backup: copies a file to destDir/<base>.<stamp>.json with identical content', () => {
    const os = require('os'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp2-'));
    const src = path.join(tmp, 'settings_data.json'); fs.writeFileSync(src, '{"k":1}');
    const out = sw.backup(src, tmp, '20260610-120000');
    ok(out.endsWith('settings_data.20260610-120000.json'), 'backup path: ' + out);
    eq(fs.readFileSync(out, 'utf8'), '{"k":1}');
  });
}
```

- [ ] **Step 2: Run; verify fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: FAIL — `safe-shopify-write.js` missing.

- [ ] **Step 3: Implement `safe-shopify-write.js`**

Create `.claude/scripts/safe-shopify-write.js`:

```javascript
'use strict';
/**
 * SP-2 safe-write substrate for Shopify theme JSON (settings_schema.json / settings_data.json).
 * Deterministic, unit-tested mechanics; the interactive diff + approval live in the skill prose.
 * Reused by the per-component build (spec #3).
 */
const fs = require('fs');
const path = require('path');

// settings_data.json is JSONC: a leading block-comment header then JSON. Strip the header, then JSON.parse.
function stripJsoncHeader(text) { return String(text).replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, ''); }
function parseSettingsData(text) { return JSON.parse(stripJsoncHeader(text)); }
// Extract the leading header comment (so a write can re-prepend it); '' if none.
function settingsDataHeader(text) { const m = String(text).match(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/); return m ? m[0] : ''; }

/** Copy srcPath to destDir/<basename-without-ext>.<stamp>.json; mkdir -p destDir; return the backup path. */
function backup(srcPath, destDir, stamp) {
  fs.mkdirSync(destDir, { recursive: true });
  const base = path.basename(srcPath).replace(/\.json$/i, '');
  const out = path.join(destDir, `${base}.${stamp}.json`);
  fs.copyFileSync(srcPath, out);
  return out;
}

/** Collect dot-paths whose leaf values differ between before/after. */
function diffPaths(before, after, prefix, acc) {
  acc = acc || [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    const p = prefix ? prefix + '.' + k : k;
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    const objA = a && typeof a === 'object' && !Array.isArray(a);
    const objB = b && typeof b === 'object' && !Array.isArray(b);
    if (objA && objB) diffPaths(a, b, p, acc);
    else if (JSON.stringify(a) !== JSON.stringify(b)) acc.push(p);
  }
  return acc;
}
/** Paths that changed but are not covered by any approved prefix. Empty array = safe. */
function verifyOnlyChanged(before, after, approvedPrefixes) {
  const changed = diffPaths(before, after, '', []);
  return changed.filter((p) => !(approvedPrefixes || []).some((pre) => p === pre || p.startsWith(pre + '.')));
}

module.exports = { stripJsoncHeader, parseSettingsData, settingsDataHeader, backup, diffPaths, verifyOnlyChanged };
```

- [ ] **Step 4: Run; verify pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — the three safe-write checks green.

- [ ] **Step 5: Commit**

```bash
git add .claude/scripts/safe-shopify-write.js .claude/scripts/skills-tests.js
git commit -m "SP-2: safe-shopify-write substrate (JSONC IO, backup, verifyOnlyChanged)"
```

---

## Task 4: `applyPlan` + golden-fixture integration test

**Files:**
- Modify: `.claude/scripts/foundations-map.js` (add `applyPlan`)
- Create: `.claude/scripts/fixtures/shopify-foundations/settings_schema.json` (snapshot)
- Create: `.claude/scripts/fixtures/shopify-foundations/settings_data.json` (snapshot)
- Modify: `.claude/scripts/skills-tests.js` (integration check)

- [ ] **Step 1: Snapshot the real crunchy-horizon config into the fixture**

Run (copies the live host config the skill will run against — committed for a reproducible harness):

```bash
mkdir -p .claude/scripts/fixtures/shopify-foundations
cp config/settings_schema.json .claude/scripts/fixtures/shopify-foundations/settings_schema.json
cp config/settings_data.json   .claude/scripts/fixtures/shopify-foundations/settings_data.json
```

(These land under the already-whitelisted `!.claude/scripts/fixtures/**`, so they commit.)

- [ ] **Step 2: Write the failing integration test**

Append inside the SP-2 group:

```javascript
const FND_FIX = path.join(__dirname, 'fixtures', 'shopify-foundations');
if (fm && fm.applyPlan && ariFND) {
  check('SP-2 integration: foundationsMap over the real crunchy-horizon snapshot', () => {
    const liveSchema = JSON.parse(fs.readFileSync(path.join(FND_FIX, 'settings_schema.json'), 'utf8'));
    const liveData = sw.parseSettingsData(fs.readFileSync(path.join(FND_FIX, 'settings_data.json'), 'utf8'));
    const plan = fm.foundationsMap(ariFND, liveSchema, liveData);
    ok(Object.keys(plan.schemeWrites).length === 4, 'maps Aristopet 4 schemes: ' + Object.keys(plan.schemeWrites));
    ok(plan.schemaExtensions.some((e) => e.setting === 'type_size_h1' && e.addOption.value === '80'), 'proposes adding 80px to type_size_h1');
    ok(plan.pruneSchemes.length >= 1, 'prunes host surplus schemes: ' + plan.pruneSchemes);
    const out = fm.applyPlan(plan, liveSchema, liveData);
    eq(out.data.current.color_schemes['scheme-1'].settings.background, '#fffefd');
    eq(out.data.current.type_size_h1, '80');
    ok(!(plan.pruneSchemes[0] in out.data.current.color_schemes), 'pruned scheme removed from data');
    const h1 = out.schema.flatMap((g) => g.settings || []).find((s) => s.id === 'type_size_h1');
    ok(h1.options.some((o) => o.value === '80'), 'schema ladder now includes 80');
  });
}
```

- [ ] **Step 3: Run; verify fail**

Run: `node .claude/scripts/skills-tests.js`
Expected: FAIL — `fm.applyPlan` is not a function.

- [ ] **Step 4: Implement `applyPlan`**

Add to `.claude/scripts/foundations-map.js` (before `module.exports`) and add `applyPlan` to the exports:

```javascript
/** Apply a plan to deep clones of the live schema/data; return { schema, data } ready to serialize. */
function applyPlan(plan, liveSchema, liveData) {
  const schema = JSON.parse(JSON.stringify(liveSchema));
  const data = JSON.parse(JSON.stringify(liveData));
  data.current = data.current || {};
  data.current.color_schemes = data.current.color_schemes || {};
  // schemes: merge mapped roles into existing scheme settings (preserve host-only roles)
  for (const [id, write] of Object.entries(plan.schemeWrites || {})) {
    const slot = data.current.color_schemes[id] || (data.current.color_schemes[id] = { settings: {} });
    slot.settings = Object.assign({}, slot.settings, write.settings);
  }
  for (const id of (plan.pruneSchemes || [])) delete data.current.color_schemes[id];
  Object.assign(data.current, plan.fontWrites || {}, plan.typeWrites || {});
  // schema: append missing select options
  for (const ext of (plan.schemaExtensions || [])) {
    for (const grp of schema) {
      const s = (grp.settings || []).find((x) => x && x.id === ext.setting);
      if (s && Array.isArray(s.options) && !s.options.some((o) => o.value === ext.addOption.value)) s.options.push(ext.addOption);
    }
  }
  return { schema, data };
}
```

- [ ] **Step 5: Run; verify pass**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — integration check green; RESULT pass count up, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add .claude/scripts/foundations-map.js .claude/scripts/skills-tests.js ".claude/scripts/fixtures/shopify-foundations/"
git commit -m "SP-2: applyPlan + golden fixture (crunchy-horizon snapshot) integration test"
```

---

## Task 5: The `build-shopify-foundations` skill

**Files:**
- Create: `.claude/skills/build-shopify-foundations/SKILL.md`
- Create: `.claude/skills/build-shopify-foundations/gotchas.md`
- Create: `.claude/skills/build-shopify-foundations/reference/mapping.md`
- Create: `.claude/skills/build-shopify-foundations/reference/safe-write.md`
- Create: `.claude/skills/build-shopify-foundations/evals/evals.json`

The harness already lints every skill: `A9` (evals well-formed), `B7/P11` (After-Completion step), `C8/C9` (least-privilege `allowed-tools` + `context` mode), `C5/HIGH-C` (resource/tool guards). Creating this skill correctly keeps those groups green — that is this task's test.

- [ ] **Step 1: Write `SKILL.md`**

Create `.claude/skills/build-shopify-foundations/SKILL.md` (mirrors `build-foundations`: frontmatter, gotchas loader, HARD pre-flight gates, numbered steps, After Completion):

````markdown
---
name: build-shopify-foundations
description: >
  Use when: WRITING the design foundations (color schemes + typography) into the Shopify host theme FROM the reconstructed foundations in the manifest (requires foundations populated, e.g. by SP-1/analyze-theme, and config.themeRoot pointing at the host theme). Human-assisted: proposes a plan, you approve, it writes. Use ONLY for foundations; per-component build is a separate skill.
user-invocable: true
context: fork
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

```sh
!cat .claude/skills/build-shopify-foundations/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Build Shopify Foundations

You are landing the reconstructed design foundations — **color schemes + typography** — into the Shopify host theme's **native** systems (Horizon `color_scheme_group` + `type_*` settings). You POPULATE what maps cleanly and PROPOSE schema extensions for the gaps. You never approximate silently; you present a plan and the developer approves.

**Manifest:** `.claude/figma-sync/aristopet/manifest.json` (the active foundations source).
**Host theme:** `config.themeRoot` (currently `"."` — the repo root). Files: `config/settings_schema.json`, `config/settings_data.json`.
**Logic (single-sourced, tested):** `.claude/scripts/foundations-map.js`, `.claude/scripts/safe-shopify-write.js`.

---

## Pre-flight — HARD GATES (MANDATORY)

If any check fails, **STOP**, tell the user the exact prerequisite, and do NOT improvise or partially write (CLAUDE.md: "NEVER skip a pipeline phase"; every gate is a HARD STOP).

1. Read the manifest. Verify `foundations` is not null. If null → "Run the foundations reconstruction (SP-1 / `/analyze-theme`) first."
2. Read `config.themeRoot`. Verify `<themeRoot>/config/settings_schema.json` exists. If missing → "config.themeRoot does not point at a Shopify theme — fix it (the crunchy-horizon host should be at the repo root)."
3. Verify the host schema contains a `color_scheme_group` (search `config/settings_schema.json`). If absent → **STOP**: "Host theme has no native color-scheme system — wrong host. This skill targets Horizon/crunchy-horizon."
4. If `buildStatus.shopifyFoundations === "complete"` → warn: "Foundations were already written. Re-running will re-propose. Proceed?"

---

## Step 1: Inspect + compute the plan

Run the tested mapping over the live host (prints the plan as JSON):

```bash
node -e '
const fm=require("./.claude/scripts/foundations-map.js"), sw=require("./.claude/scripts/safe-shopify-write.js"), fs=require("fs");
const root=require("./.claude/figma-sync/aristopet/manifest.json");
const tr=root.config.themeRoot;
const schema=JSON.parse(fs.readFileSync(tr+"/config/settings_schema.json","utf8"));
const data=sw.parseSettingsData(fs.readFileSync(tr+"/config/settings_data.json","utf8"));
console.log(JSON.stringify(fm.foundationsMap(root.foundations, schema, data),null,2));
'
```

Read the resulting plan: `schemeWrites` (4 schemes), `fontWrites`, `typeWrites`, `schemaExtensions`, `pruneSchemes`, `gaps`.

## Step 2: Propose the plan to the developer (gap-transparent)

Present, in plain language:
- **Color schemes:** the 4 schemes and their role values being written (note alpha preserved natively).
- **Typography:** fonts + type scale; **list every `schemaExtension`** ("add 80px to `type_size_h1`") and **every gap** (`orphan-role` foreground_chip dropped; `approx-line-height`/`approx-letter-spacing` token choices with the source value; `verify-font-availability` for Instrument Sans; `component-level-preset` overline/caption skipped; `pruneSchemes` to remove).
- Ask the developer to approve or correct (e.g. "use 72 not 80", "keep scheme-5", "Instrument Sans isn't available → add a custom font source"). Apply any corrections to the plan object before executing.

See `reference/mapping.md` for the full mapping reference; `reference/safe-write.md` for the write protocol.

## Step 3: Execute via the safe write

Only after approval. For BOTH `config/settings_schema.json` and `config/settings_data.json`:

1. **Backup** each file to `.claude/figma-sync/backups/` (use `safe-shopify-write.js` `backup(src, destDir, stamp)`).
2. **Apply** the approved plan with `foundations-map.js` `applyPlan(plan, schema, data)` → `{ schema, data }`.
3. **Write** the results. For `settings_data.json`, re-prepend the original JSONC header (`safe-shopify-write.js` `settingsDataHeader`) so the auto-generated banner survives.
4. **Verify** with `verifyOnlyChanged(beforeData, afterData, approvedPrefixes)` where `approvedPrefixes` covers exactly `current.color_schemes`, the written `type_*`/font keys. If it returns violations → **restore from backup** and STOP.
5. **Validate:** `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass.

## Step 4: Record state

Set `buildStatus.shopifyFoundations = "complete"` and `buildMeta.builtAt` in the manifest; write it back.

## Step 5: Summary

```
Shopify foundations written to {themeRoot}.
  Color schemes:  {N} populated (alpha native), {M} pruned
  Fonts:          body / subheading / heading set
  Type scale:     {K} levels set, {E} schema extensions (e.g. type_size_h1 += 80px)
  Gaps surfaced:  {G} (approximations + skips, all listed above)
Backups:          .claude/figma-sync/backups/
Next: per-component build (spec #3).
```

## After Completion

If the user corrected your approach during this run — a wrong mapping, a token choice, a font-source decision, a write/verify gotcha — append it as a short **dated bullet** to this skill's `gotchas.md` (`.claude/skills/build-shopify-foundations/gotchas.md`; create it if missing). That file is injected at the top of this skill on every invocation, so the next run starts with the lesson. This is the project's self-updating learning loop (P11/B7).
````

- [ ] **Step 2: Write `gotchas.md` (seed)**

Create `.claude/skills/build-shopify-foundations/gotchas.md`:

```markdown
# build-shopify-foundations — gotchas

(Plugin-API / theme-write gotchas accumulate here; injected at the top of SKILL.md each run.)

- 2026-06-10: `config/settings_data.json` is **JSONC** — it opens with a `/* auto-generated */` header. Strip it before `JSON.parse` (use `safe-shopify-write.js` `parseSettingsData`) and re-prepend it on write (`settingsDataHeader`), or the theme editor banner is lost.
- 2026-06-10: Horizon color roles are all `"alpha": true`, so Aristopet alpha colors (`#rrggbbaa`, `rgba(0,0,0,0)`) write directly — do NOT strip alpha.
```

- [ ] **Step 3: Write the reference docs**

Create `.claude/skills/build-shopify-foundations/reference/mapping.md` — the full Aristopet→Horizon role map, the typography rules (size ladder + nearest line-height/letter-spacing tokens + case), and the gap kinds (`orphan-role`, `size-ladder-extension`, `approx-line-height`, `approx-letter-spacing`, `verify-font-availability`, `accent-left-default`, `component-level-preset`). Copy the locked tables from the SP-2 spec §5 and this plan's "Key facts" section verbatim.

Create `.claude/skills/build-shopify-foundations/reference/safe-write.md` — the write protocol: pull → backup → applyPlan → write (re-prepend JSONC header) → verifyOnlyChanged (restore on violation) → shopify-validate. State that it reuses `.claude/scripts/safe-shopify-write.js` and `.claude/scripts/shopify-validate.js`.

- [ ] **Step 4: Write `evals/evals.json`**

Create `.claude/skills/build-shopify-foundations/evals/evals.json` matching the existing eval shape (check `.claude/skills/build-foundations/evals/evals.json` for the schema the A9 harness validates):

```json
{
  "skill": "build-shopify-foundations",
  "evals": [
    {
      "name": "triggers on writing foundations to the theme",
      "prompt": "Write the Aristopet color schemes and fonts into the Shopify theme",
      "expect_triggered": true
    },
    {
      "name": "does not trigger on Figma foundations build",
      "prompt": "Build the Figma variables and text styles for the design system",
      "expect_triggered": false
    },
    {
      "name": "STOPs when foundations are missing from the manifest",
      "prompt": "Run build-shopify-foundations but foundations is null in the manifest",
      "expect_behavior": "STOP and tell the user to run the foundations reconstruction first"
    }
  ]
}
```

- [ ] **Step 5: Verify the skill passes the existing skill lints**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — `A9` (evals well-formed), `B7/P11` (After-Completion present), `C8/C9` (allowed-tools/context), `C5/HIGH-C` (guards) all green WITH the new skill scanned. RESULT 0 failed. If any of those groups reds on the new skill, fix the offending field and re-run.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/build-shopify-foundations/
git commit -m "SP-2: build-shopify-foundations skill (inspect -> propose -> approve -> safe-write)"
```

---

## Task 6: Docs — manifest state contract + pipeline mention

**Files:**
- Modify: `CLAUDE.md` (state-contract table + pipeline/maintenance mention)

- [ ] **Step 1: Add the buildStatus row + pipeline note**

In `CLAUDE.md`, add a row to the "Manifest state contract" table for the downstream foundations phase:

```
| `/build-shopify-foundations` (downstream) | `buildStatus.shopifyFoundations = "complete"`, `buildMeta.builtAt` | consumed by the per-component build (spec #3) |
```

Add a one-line note under the pipeline section that the downstream build runs foundations-first (`/build-shopify-foundations`) then per-component (spec #3), mirroring the Figma side.

- [ ] **Step 2: Verify docs-reality lints stay green**

Run: `node .claude/scripts/skills-tests.js`
Expected: PASS — `C7: CLAUDE.md + .gitignore reflect reality` stays green. RESULT 0 failed.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "SP-2: document downstream foundations phase (buildStatus.shopifyFoundations)"
```

---

## Task 7: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole harness**

Run: `node .claude/scripts/skills-tests.js`
Expected: `RESULT: <N> passed, 0 failed`, where `<N>` is greater than the pre-SP-2 baseline of 170 (the SP-2 group added several checks). HR-3 green (group classified). No reds.

- [ ] **Step 2: Sanity-run the skill's plan command against the live host**

Run the Step-1 `node -e` block from the skill (above). Expected: prints a JSON plan with 4 `schemeWrites`, a `type_size_h1` extension to `80`, ≥1 `pruneSchemes`, and a populated `gaps[]`. (This does NOT write anything — it only computes the plan.)

- [ ] **Step 3: Hand off to finishing**

Implementation complete. Use `superpowers:finishing-a-development-branch` to open the PR.

---

## Self-review notes (author)

- **Spec coverage:** §4 behavior → Task 5 skill steps; §5.1 colors → Task 1; §5.2 fonts + §5.3 type → Task 2; §6 safe-write → Task 3; §7 tests → Tasks 1–4 (unit + golden fixture); §8 state/structure → Tasks 5–6; §9 follow-ups → out of scope (SP-1 reachability recompute is a separate sub-project, intentionally not a task here); §10 risks → encoded as `gaps` (`verify-font-availability`, `approx-*`).
- **No-placeholder check:** every code/test step carries full code; thresholds (line-height buckets, letter-spacing sign) and the role map are locked literals.
- **Type consistency:** `foundationsMap`/`mapSchemes`/`mapTypography`/`applyPlan`/`normalizeColor`/`optionValues` (foundations-map.js); `backup`/`verifyOnlyChanged`/`parseSettingsData`/`settingsDataHeader` (safe-shopify-write.js); plan keys `schemeWrites`/`pruneSchemes`/`typeWrites`/`fontWrites`/`schemaExtensions`/`gaps` are used identically across tasks.
