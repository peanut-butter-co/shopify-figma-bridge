# Next-phase backlog — follow-ups after the 80/80 remediation

> Standalone spec for the work that remains **after** the 2026-06 skills review was fully
> remediated (all 80 critical/high/medium findings closed across PRs #8–#26). These items
> were **discovered during** that remediation (self-reviews of each PR) and are **not** part
> of the original 80 — they're tracked in the "Follow-ups" section of
> [`remediation-progress.md`](remediation-progress.md); this file is the actionable version.
>
> **How to work this:** same loop as the 80. Per item → branch `fix/<item>` → TDD (extend
> `.claude/scripts/skills-tests.js` red→green) → gate = harness `exit 0` + `/code-review`
> clean → push → `gh pr create` → `gh pr merge --squash` on green → tick it here. One item
> (or cohesive sub-cluster) per PR. Read this + `gh pr list --state merged` + `git log --oneline main` each iteration.
>
> **Baseline:** `node .claude/scripts/skills-tests.js` → 105 passed, 0 failed (as of #26).

---

## Batch 1 — harness-rigor + cleanup (small/medium, auto-merge-on-green OK)

Do these first: cheap, and they harden the harness before the big items lean on it.

- [x] **HR-1 · harness-rigor · M — single-source the extracted utils vs the prose the agent runs.**
  The tested scripts (`color-utils.js`, `variant-utils.js`, `alpha-variants.js`, `shopify-validate.js`)
  duplicate JS that *also* lives as prose inside the skills (`sync-colors/SKILL.md`,
  `build-components/reference/validation.md`, `build-foundations/reference/alpha-variants.md`).
  The unit tests cover the **utils**, but the agent runs the **prose** (it can't `require()` a
  Node module inside the Figma sandbox). They can drift. Mitigated today by mirroring fixes +
  prose-lint asserts, not eliminated.
  **DoD:** add a harness helper that extracts a named function from a fenced ` ```javascript `
  block in a `.md` and `eval`s it, then runs the *same* unit-test vectors against BOTH the util
  AND the extracted prose function (so a fix to one fails the test until the other matches).
  Start with `rgbaToShopifyHex`/`shopifyHexToRGBA` in sync-colors. That kills the drift class.

- [x] **HR-2 · harness-rigor · S — broaden the resource-availability guard beyond the frontmatter regex.**
  The HIGH-C check selects MCP-dependent skills via `/mcp__figma__|mcp__chrome-devtools__/` in
  frontmatter. Skills that depend on other resources are silently unchecked — notably
  `refresh-figma-practices` (WebSearch/WebFetch; it *got* a web-tools STOP in #18 but HIGH-C
  never verifies it), and any future skill declaring tools differently.
  **DoD:** generalize the check to "every skill whose work depends on an external resource
  (MCP **or** WebSearch/WebFetch) must have an availability STOP pre-flight," and include
  `refresh-figma-practices` in the guarded set with a dedicated assertion.

- [x] **HR-3 · harness-rigor · S — audit the remaining substring-loose asserts.**
  Tightened CRIT-A/CRIT-B/HIGH-F/HIGH-C in #8. Sweep the rest of `skills-tests.js` for
  `/.../i.test(md)` checks that a reworded-but-correct prose change could false-pass (or a
  correct rewrite could false-red). Tighten the load-bearing ones; leave a comment marking each
  remaining check as "lint-strength" vs "contract-strength" so the distinction is explicit.

- [x] **BL-1 · build-components · M — pin the section node-naming so the completeness check resolves.**
  `validation.md`'s variant-completeness lookup matches `n.name === section.name || n.name === slug`,
  but the build phase never guarantees the built `COMPONENT_SET` is named by the slug. If sections
  are built with PascalCase names (e.g. "Hero", "Image with text"), `findOne` returns null and every
  section reports `MISSING` — masking real incomplete-variant problems.
  **DoD:** make build-components' "Sections" phase name the created component(-set) node exactly the
  slug (or `section.name`), document the convention, and add a harness assertion that build-components
  states it. Relates to C4 / F054–F057.

**`/goal` for Batch 1** (paste after `/clear`):

```
/goal Remediar el Batch 1 del backlog en docs/research/next-phase-backlog.md (HR-1, HR-2, HR-3, BL-1). No parar hasta que Batch 1 esté completo.

Estado durable: docs/research/next-phase-backlog.md (spec) — marca cada item [x] ahí. Al empezar cada iteración lee ese fichero + `gh pr list --state merged` + `git log --oneline main`.

Por item: rama fix/<item> desde main, TDD (extiende .claude/scripts/skills-tests.js rojo→verde), gate = `node .claude/scripts/skills-tests.js` exit 0 Y /code-review sin issues relevantes (corrige hasta limpio), push, gh pr create, gh pr merge --squash en verde, marca el item done. 1 item (o sub-cluster cohesivo) por PR.

NO toques BL-2 ni BL-3 en este loop (son grandes, sesión propia). No toques el theme. Respeta CLAUDE.md. Si un gate falla tras 2-3 intentos → para y avísame.
```

---

## Big items — one focused session each (NOT in the Batch-1 loop)

- [ ] **BL-3 · validate-shopify · L — finish the validation scriptify + trim the SKILL.md.**
  #26 extracted the 5 core deterministic checks into `shopify-validate.js` + made
  `reference/schema-rules.md` the canonical detail. Deferred: extend the script to **every**
  Phase 1–5 deterministic edge case (1.x template structural, 2.6 presets, 3.x settings_data,
  4.x setting dependencies, 5.x cross-file refs) and reduce the 465-line `validate-shopify/SKILL.md`
  to *name + severity* that defers to `schema-rules.md`.
  **DoD:** `shopify-validate.js` covers all deterministic Phase 1–5 checks, unit-tested against a
  small committed theme fixture; SKILL.md = "when to run + `node .claude/scripts/shopify-validate.js`
  + how to interpret"; all detail lives in `schema-rules.md`.
  **Watch-outs:** needs a tiny theme fixture (sample `templates/*.json` + section schema +
  `settings_data.json`) to unit-test end-to-end — commit it under a whitelisted fixtures path and
  update `.gitignore` (the repo ignores theme files by default). Trimming a 465-line file is careful
  surgery — verify `schema-rules.md` covers each removed block before deleting it.

- [ ] **BL-2 · build-design-system · L — rearchitect the orchestrator into discrete, verified phase invocations.**
  #25 made the per-skill pre-flights HARD gates (F008 MVP). Deferred (enforcement plan §1): convert
  `build-design-system` from "read each skill and follow it" into invoking each phase as a **discrete
  Skill-tool operation**, and **verify the expected manifest keys** (the state-contract table in
  CLAUDE.md, added in #20) were actually written **after each phase** before advancing — STOP on a
  missing key. Add the plan's targeted guards: visual reference capture, zero-raw-frames, and a
  100%-of-proposal completion check.
  **DoD:** the orchestrator invokes phases discretely, post-write-verifies against the state-contract,
  and refuses to advance on a contract miss; the three completion guards exist.
  **RECOMMENDED process:** brainstorm the design first; and change the gate from "auto-merge on green"
  to **"human reviews before merge"** — the harness pins contracts but cannot validate a control-flow
  rearchitecture without running the real Figma pipeline. This is the one item where auto-merge is
  not advisable.

---

## Optional later — the 48 LOW findings

Deliberately excluded from the 80 (scope was critical/high/medium). They're real polish, listed in
the `⚪ LOW` section of [`skills-review-2026-06-08-findings.md`](skills-review-2026-06-08-findings.md).
Worth a dedicated "polish" loop someday; not blocking anything.
