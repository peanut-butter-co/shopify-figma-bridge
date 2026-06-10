# SP-3 — Per-component Shopify build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship `/build-shopify-component` — one human-assisted step per component (config + code unified) that inspects, proposes a gap-transparent plan, and executes behind the SP-2 safe-write substrate.

**Architecture:** A tested deterministic spine (`component-build.js`) + a safe-write extension (`injectSchemaSettings`) + a thin orchestrating skill, mirroring SP-2's `build-shopify-foundations`. Reuses `reachability.js`, `shopify-validate.js`, `safe-shopify-write.js`.

**Tech Stack:** Node (zero-dep), the `skills-tests.js` harness (`group/check/ok/eq`), Shopify Liquid `{% schema %}` + theme JSON.

**Spec:** `docs/superpowers/specs/2026-06-10-sp3-shopify-component-build-design.md`. Host = crunchy-horizon at the repo root (`themeRoot:"."`).

---

## File structure

- Create `.claude/scripts/component-build.js` — `nextComponent`, `inspectComponent`, `configPlan` (pure).
- Modify `.claude/scripts/safe-shopify-write.js` — add `injectSchemaSettings(liquidSource, newSettings)`.
- Modify `.claude/scripts/skills-tests.js` — group `SP-3: component build` + `GROUP_STRENGTH` + `EVAL_SKILLS` + `SELF_LEARN`.
- Create `.claude/skills/build-shopify-component/{SKILL.md, gotchas.md, reference/plan.md, reference/execute.md, evals/evals.json}`.
- Modify `CLAUDE.md` — downstream-build paragraph + manifest state-contract row.

---

### Task 1: `component-build.js` — `nextComponent` + `inspectComponent`

**Files:** Create `.claude/scripts/component-build.js`; Test: new group in `skills-tests.js`.

- [ ] **Step 1 — failing tests** (in the `SP-3: component build` group):

```js
const cb = tryRequire('./component-build.js');
const CM = { a: { type:'section', theme:{kind:'section'}, schema:{settings:[{id:'h',type:'text'}]},
                  reachability:{verdict:'config',basis:'schema-expressible',candidate:'sections/a.liquid'} },
             b: { type:'section', theme:{kind:'section'}, schema:null,
                  reachability:{verdict:'code',basis:'no-candidate',candidate:null} } };
const COMP = { index:{order:[{component:'a',desktopNodeId:'d1',mobileNodeId:'m1',colorScheme:'scheme-1',settings:{h:'Hi'},blocks:[],mobileDivergence:null}]},
               product:{order:[{component:'a',desktopNodeId:'d2',mobileNodeId:'m2',colorScheme:'scheme-2',settings:{h:'Yo'},blocks:[{type:'x'}],mobileDivergence:{type:'behavior',note:'n'}}]} };
// nextComponent
eq(cb.nextComponent(CM, {}).key, 'a');                                  // first un-built
eq(cb.nextComponent(CM, {components:{a:'complete'}}).key, 'b');         // skip completed
eq(cb.nextComponent(CM, {components:{a:'complete',b:'complete'}}), null); // all done
eq(cb.nextComponent(CM, {}).candidate, 'sections/a.liquid');           // carries reachability
// inspectComponent
const ins = cb.inspectComponent('a', CM, COMP);
eq(ins.usages.length, 2);                                              // gathered across templates
eq(ins.usages[1].mobileDivergence.type, 'behavior');
eq(ins.hostSchema.settings[0].id, 'h');
ok(/not a componentMap key/.test((()=>{try{cb.inspectComponent('zz',CM,COMP);return''}catch(e){return e.message}})()), 'throws on unknown key');
```

- [ ] **Step 2 — run, expect FAIL** (`cb` undefined). `node .claude/scripts/skills-tests.js`.
- [ ] **Step 3 — implement** `nextComponent` + `inspectComponent` per spec §3.1 (iterate `componentMap`; skip `buildStatus.components[key]==='complete'`; gather `usages` where `o.component===key`; throw on unknown key).
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(component-build): nextComponent + inspectComponent (SP-3 T1)`.

### Task 2: `component-build.js` — `configPlan`

**Files:** Modify `.claude/scripts/component-build.js`; Test: same group.

- [ ] **Step 1 — failing tests:**

```js
const HS = { settings: [ {id:'heading',type:'text'},
                         {id:'size',type:'select',options:[{value:'s'},{value:'l'}]},
                         {id:'pad',type:'range',min:0,max:100,step:4},
                         {id:'on',type:'checkbox'} ] };
const plan = cb.configPlan([
  { intentKey:'left_title', target:'heading', type:'text', value:'X' },     // applied
  { intentKey:'eyebrow',    target:'eyebrow', type:'text', value:'E' },      // new setting -> extension
  { intentKey:'sz',         target:'size',    type:'select', value:'xl' },   // off-domain select -> widen
  { intentKey:'p',          target:'pad',     type:'range', value:999 },     // off-range -> widen
  { intentKey:'flag',       target:'on',      type:'checkbox', value:'yes' },// bad checkbox, not select/range -> code
  { intentKey:'badge',      target:null,      value:'NUEVO' },               // pure code
], HS);
eq(plan.applied, [{ id:'heading', value:'X' }]);
eq(plan.schemaExtensions.map(e=>e.id).sort(), ['eyebrow','pad','size']);
eq(plan.codeGaps.map(c=>c.intentKey).sort(), ['badge','flag']);
```

- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** `configPlan` per spec §3.1: `target==null`→codeGap; `target` not in schema→schemaExtension(new); in-schema + `settingValueIssue` ok→applied; off-domain select/radio→widen option, range→widen range, else→codeGap. Reuse `settingValueIssue` from `shopify-validate.js`.
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(component-build): configPlan partition (SP-3 T2)`.

### Task 3: `safe-shopify-write.js` — `injectSchemaSettings`

**Files:** Modify `.claude/scripts/safe-shopify-write.js`; Test: same group.

- [ ] **Step 1 — failing tests:**

```js
const sw3 = tryRequire('./safe-shopify-write.js');
const LIQ = '<div>{{ section.settings.heading }}</div>\n{% schema %}\n{\n  "name": "Foo",\n  "settings": [{ "type": "text", "id": "heading" }]\n}\n{% endschema %}\n';
const out = sw3.injectSchemaSettings(LIQ, [{ type:'text', id:'eyebrow' }, { type:'text', id:'heading' }]);
const reparsed = require('./shopify-validate.js').extractSchema(out);
eq(reparsed.settings.map(s=>s.id), ['heading','eyebrow']);     // appended + dedup (heading not duplicated)
ok(out.startsWith('<div>{{ section.settings.heading }}</div>'), 'leading liquid byte-identical');
ok(out.trimEnd().endsWith('{% endschema %}'), 'trailing liquid preserved');
ok(/not a function|no \{% schema/.test((()=>{try{sw3.injectSchemaSettings('<div>no schema</div>',[{id:'x'}]);return''}catch(e){return e.message}})()) , 'throws when no schema block');
```

- [ ] **Step 2 — run, expect FAIL.**
- [ ] **Step 3 — implement** `injectSchemaSettings` per spec §3.2: match the `{% schema %}…{% endschema %}` block, `JSON.parse` its body, append `newSettings` deduped by `id`, re-serialize ONLY the block, splice back leaving surrounding liquid intact. Export it.
- [ ] **Step 4 — run, expect PASS.**
- [ ] **Step 5 — commit** `feat(safe-write): injectSchemaSettings for section schema extension (SP-3 T3)`.

### Task 4: harness wiring — `GROUP_STRENGTH` + `EVAL_SKILLS` + `SELF_LEARN`

**Files:** Modify `.claude/scripts/skills-tests.js`.

- [ ] **Step 1** — add `'SP-3: component build': 'contract'` to `GROUP_STRENGTH`; add `'build-shopify-component'` to `EVAL_SKILLS` and `SELF_LEARN`.
- [ ] **Step 2 — run** `node .claude/scripts/skills-tests.js`. Expected: HR-3 green (group classified); A9/B7 will FAIL until Task 5 creates the skill's `evals.json` + `## After Completion` + `gotchas.md`. That is the expected red that Task 5 closes.
- [ ] **Step 3 — commit** with Task 5 (the skill files close the A9/B7 reds).

### Task 5: the skill `build-shopify-component`

**Files:** Create `.claude/skills/build-shopify-component/{SKILL.md, gotchas.md, reference/plan.md, reference/execute.md, evals/evals.json}`.

- [ ] **Step 1 — `SKILL.md`** mirroring `build-shopify-foundations/SKILL.md`: gotchas `!cat` loader header; frontmatter (`user-invocable:true`, `context:inline`, `allowed-tools:[Read, Write, Edit, Bash, Grep]`, a `description` with "Use when" + "Not for" the Figma-side build); HARD pre-flight gates (manifest; `buildStatus.shopifyFoundations==="complete"` else route to `/build-shopify-foundations`; `work-order.json`+`design-rules.json` present; `componentMap[key]` exists; host valid; `app`→record+skip); the Step-by-step protocol (spec §3.3): Inspect (`inspectComponent` one-liner) → Propose gap-transparent (config: mapping + `configPlan`; code: new section; list every gap) → Execute config-first (`injectSchemaSettings` + template/section-group instance write via `safe-shopify-write` backup→diff→verify→validate; then guided liquid behind backup→diff→approval→validate) → Record `buildStatus.components[key]="complete"` → Continue (`nextComponent`); `## After Completion` self-learning step.
- [ ] **Step 2 — `gotchas.md`** seed (e.g. "section instances live in templates/section-groups, not settings_data"; "edit only the `{% schema %}` block, never hand-reflow the liquid").
- [ ] **Step 3 — `reference/plan.md`** (config-reach + code-reach planning: how `configPlan` partitions; new-section authoring bound to foundations vars) and **`reference/execute.md`** (the safe config + code write protocol, reusing SP-2's `reference/safe-write.md`).
- [ ] **Step 4 — `evals/evals.json`** (≥4 cases: trigger "build the footer component into the host theme"; route→`build-shopify-foundations` when foundations not built; no-trigger on "build the Figma components"; trigger on next-component continue). `ev.skill='build-shopify-component'`.
- [ ] **Step 5 — run** `node .claude/scripts/skills-tests.js`. Expected: A9/B7/C7 green now.
- [ ] **Step 6 — commit** `feat(build-shopify-component): the per-component build skill + harness wiring (SP-3 T4+T5)`.

### Task 6: docs — CLAUDE.md + manifest contract

**Files:** Modify `CLAUDE.md`; Modify `.claude/figma-sync/aristopet/manifest.json` (add `buildStatus.components: {}` only if absent — do not fabricate completion).

- [ ] **Step 1** — CLAUDE.md "Downstream build" section: add a bullet for `/build-shopify-component` (per-component, config+code one human step). Add the manifest state-contract row: `| /build-shopify-component (downstream) | buildStatus.components.<key> = "complete", buildMeta.builtAt | per-component resumability |`. Ensure the skill dir name appears (C7/F067).
- [ ] **Step 2 — run** `node .claude/scripts/skills-tests.js` → all green.
- [ ] **Step 3 — commit** `docs(sp3): CLAUDE.md downstream + manifest component build-status`.

### Task 7: verify + review + PR + merge

- [ ] **Step 1** — full suite green; generator sanity (`inspectComponent`/`configPlan` over the real Aristopet set via a node one-liner — e.g. inspect `footer` shows 3 usages).
- [ ] **Step 2** — adversarial review of `component-build.js` + `injectSchemaSettings` (focus: `configPlan` partition correctness, `injectSchemaSettings` liquid-preservation + JSON edge cases, gate completeness). Fix confirmed findings.
- [ ] **Step 3** — `git push -u origin sp3-component-build`; `gh pr create`; `gh pr merge --squash --delete-branch`.

---

## Self-review

**Spec coverage:** D1 (one step) → Task 5 protocol. D2 (tested spine) → Tasks 1-3. D3 (validated mapping) → Task 2 `configPlan`. D4 (safe exec) → Task 3 + Task 5 execute. D5 (gap-transparent) → Task 5 propose. D6 (guided code) → Task 5 execute (b). D7 (buildStatus) → Tasks 5-6. Testing §5 → Tasks 1-5. ✓
**Placeholders:** none — every code step shows the test/shape. ✓
**Type consistency:** `nextComponent(componentMap, buildStatus)`, `inspectComponent(key, componentMap, compositions)`, `configPlan(mapping, hostSchema)→{applied,schemaExtensions,codeGaps}`, `injectSchemaSettings(liquidSource, newSettings)` — consistent across tasks + spec. ✓
