# Remediation progress — skills review 2026-06

> Durable backlog for the `/goal` remediation loop. Findings source:
> [`skills-review-2026-06-08-findings.md`](skills-review-2026-06-08-findings.md).
> **Each iteration:** read this file + `gh pr list --state merged` + `git log --oneline main`
> to see what is left → fix ONE cluster per PR (TDD via `.claude/scripts/skills-tests.js`)
> → `/code-review` clean + harness green → merge → tick the items here → commit.

**Scope:** critical + high + medium (80 findings). Low (48) is out of scope — optional polish.

**Progress:** 61 / 80 done · 19 remaining

**Cluster order:** state-contract → triggering → write-safety → evals → consistency → docs-infra → rest

**Legend:** `[x]` merged · `[ ]` pending · each row = `ID · severity · skill · dimension · effort — summary`

---

## 1. state-contract (11) — 11 done, 0 left

- [x] **F001** · 🔴 crit · `system` · B1 · S — The producer/consumer contract for `components.status` is broken. · ✅ #8
- [x] **F003** · 🔴 crit · `build-components` · C4 · S — The Pre-flight gate that enforces the pipeline dependency (P8) reads a field that the upstream skill never writes. · ✅ #8
- [x] **F004** · 🔴 crit · `propose-components` · C4 · S — propose-components is the producer of the components.status='confirmed' checkpoint that build-components depends… · ✅ #8
- [x] **F009** · 🟠 high · `build-components` · C4 · S — The Variant Completeness Check computes expected variant count by treating section.variants values as flat array… · ✅ #8
- [x] **F033** · 🟡 med · `system` · B1 · S — build-design-rules reads a `buildStatus.components` object/namespace that no skill ever writes. · ✅ #9
- [x] **F054** · 🟡 med · `build-components` · C4 · M — The Blocks phase instructs reading source files from a manifest field (sourceBlocks) that does not exist. · ✅ #9
- [x] **F055** · 🟡 med · `propose-components` · C4 · M — Step 8's manifest-write description under-specifies the schema the Step 9 generator actually consumes. · ✅ #9
- [x] **F056** · 🟡 med · `validate-instances` · C4 · S — The skill names the manifest but never reads it, and has no pre-flight verifying that a built design system exis… · ✅ #9
- [x] **F057** · 🟡 med · `system` · C4 · M — build-design-rules is an orphaned phase: it produces design-rules.json that build-components and compose-page op… · ✅ #9
- [x] **F058** · 🟡 med · `system` · C4 · S — The write contract for `theme.profileValidation` is split across files and under-specified in the authoritative… · ✅ #9
- [x] **F059** · 🟡 med · `system` · C4 · S — `buildMeta.practicesVersion` is a read-only-by-no-writer field. · ✅ #9

## 2. triggering / descriptions (10) — 10 done, 0 left

- [x] **F015** · 🟡 med · `analyze-theme` · A1 · S — The description's first clause is good (concrete: 'extracting design tokens from a Shopify theme'). · ✅ #10
- [x] **F016** · 🟡 med · `build-design-rules` · A1 · S — The description correctly uses the 'Use when:' CSO pattern (P3/A1 pass on form), but it is thin on concrete trig… · ✅ #10
- [x] **F017** · 🟡 med · `refresh-figma-practices` · A1 · S — The description is a single thin trigger phrase. · ✅ #10
- [x] **F018** · 🟡 med · `setup` · A1 · S — The description follows the project's `Use when:` CSO pattern (P3 satisfied) but is thin and omits the most like… · ✅ #10
- [x] **F019** · 🟡 med · `validate-instances` · A1 · S — The description is a correctly-formed 'Use when:' trigger (passes P3) but is thin: a single context with no conc… · ✅ #10
- [x] **F042** · 🟡 med · `system` · C1 · M — The orchestrator and the 6 phase skills share the same intent space ("build the Shopify-to-Figma design system")… · ✅ #10
- [x] **F043** · 🟡 med · `system` · C1 · S — These are adjacent pipeline phases (analyze-theme extracts tokens into the manifest; build-foundations turns tho… · ✅ #10
- [x] **F044** · 🟡 med · `system` · C1 · S — propose-components is the planning/selection phase (decide which sections/blocks to include and their variants);… · ✅ #10
- [x] **F045** · 🟡 med · `system` · C1 · S — build-components has a sub-phase that builds SECTION components, while compose-page INSTANTIATES those section c… · ✅ #10
- [x] **F046** · 🟡 med · `system` · C1 · S — sync-colors is a bidirectional color writer between Figma variables and Shopify settings_data.json. · ✅ #10

## 3. write-safety (4) — 4 done, 0 left

- [x] **F002** · 🔴 crit · `sync-colors` · B4 · S — The skill writes config/settings_data.json (the live theme settings file) but never creates a backup before writ… · ✅ #8
- [x] **F012** · 🟠 high · `system` · C6 · S — The single skill that writes Shopify JSON (sync-colors, Figma→Shopify) never creates a backup before writing con… · ✅ #8
- [x] **F065** · 🟡 med · `sync-colors` · C6 · M — Cross-cutting: the backup-before-write requirement appears to be enforced by no skill that writes Shopify JSON,… · ✅ #8
- [x] **F066** · 🟡 med · `system` · C6 · M — The 'diff preview' required by CLAUDE.md:19 is implemented in sync-colors as a hand-assembled 'changed values on… · ✅ #11

## 4. evals (8) — 8 done, 0 left

- [x] **F025** · 🟡 med · `analyze-theme` · A9 · M — There are no evals (evals/evals.json) with realistic test prompts for analyze-theme. · ✅ #12
- [x] **F026** · 🟡 med · `build-components` · A9 · M — There is no evals/evals.json with realistic trigger prompts for this skill (A9). · ✅ #12
- [x] **F027** · 🟡 med · `build-foundations` · A9 · M — There is no evals/evals.json with realistic trigger prompts for this skill (none exist anywhere in the system). · ✅ #12
- [x] **F028** · 🟡 med · `learnings` · A9 · S — The skill is phrase-triggered and therefore highly amenable to triggering evals, but has no evals/evals.json. · ✅ #12
- [x] **F029** · 🟡 med · `propose-components` · A9 · M — There is no evals/evals.json with realistic test prompts for this skill (nor anywhere in the system). · ✅ #12
- [x] **F030** · 🟡 med · `sync-colors` · A9 · M — There are no evals for sync-colors. · ✅ #12
- [x] **F031** · 🟡 med · `validate-shopify` · A9 · M — There is no evals/evals.json with realistic prompts/fixtures, despite this being the single most eval-friendly s… · ✅ #12
- [x] **F032** · 🟡 med · `system` · A9 · M — There is zero automated eval/test coverage anywhere in the project. · ✅ #8

## 5. consistency / DRY (29) — 18 done, 11 left

- [x] **F005** · 🔴 crit · `system` · C8 · S — sync-colors' body instructs using the Edit tool for its only Shopify write, but Edit is not in allowed-tools (un… · ✅ #8
- [ ] **F007** · 🟠 high · `validate-instances` · B3 · M — The auto-fix is destructive: it deletes inline frames and re-parents instances inside live design-system templat…
- [ ] **F008** · 🟠 high · `system` · B6 · L — The pipeline-phase-enforcement plan is entirely unimplemented.
- [x] **F010** · 🟠 high · `setup` · C5 · S — This is the FIRST pipeline skill and the gate that verifies the store and Figma file are reachable, yet it never… · ✅ #8
- [x] **F011** · 🟠 high · `validate-instances` · C5 · S — Violates the GLOBAL rule and team learning (feedback_missing_tools): if the required Figma MCP tool is not conne… · ✅ #8
- [x] **F013** · 🟠 high · `system` · C9 · M — The installer is non-functional. · ✅ #13
- [x] **F014** · 🟠 high · `system` · C9 · S — The README's primary Installation instructions reference a `.claude/commands/` directory that does not exist. · ✅ #13
- [ ] **F034** · 🟡 med · `system` · B5 · M — No end-to-end verification of the phase-handoff chain exists, and a dry-run trace immediately surfaces the B1-01…
- [ ] **F035** · 🟡 med · `compose-page` · B6 · S — manifest.json is the single source of truth (CLAUDE.md).
- [ ] **F047** · 🟡 med · `build-foundations` · C2 · S — Inconsistent base-variable naming across the skill's own files.
- [ ] **F048** · 🟡 med · `validate-shopify` · C2 · S — The project convention splits two concerns: a per-skill gotchas.md (runtime-injected, self-updating learnings) v…
- [x] **F049** · 🟡 med · `system` · C2 · S — The same Figma Plugin API gotcha list lives twice inside one skill — once in SKILL.md Step 8 and once in gotchas… · ✅ #17
- [ ] **F050** · 🟡 med · `system` · C2 · M — Plugin-API-level invariants (text nodes must FILL+HEIGHT after append; lineHeight must be PERCENT not a bound va…
- [x] **F051** · 🟡 med · `system` · C3 · M — There is no principled, documented rule for skill sub-structure. · ✅ #17
- [ ] **F052** · 🟡 med · `system` · C3 · M — validate-shopify is a structural outlier on three axes at once: (a) it is the only reference/ skill whose refere…
- [x] **F053** · 🟡 med · `system` · C3 · S — Spelling drift between 'Gray' and 'Grey' inside the SAME line of sync-colors. · ✅ #17
- [x] **F060** · 🟡 med · `build-foundations` · C5 · S — The skill's entire job depends on mcp__figma__use_figma and mcp__figma__get_screenshot, yet there is no guard th… · ✅ #8
- [x] **F061** · 🟡 med · `compose-page` · C5 · S — This skill depends on two MCP families (mcp__figma__* and mcp__chrome-devtools__*) but has no guard that STOPS a… · ✅ #8
- [ ] **F062** · 🟡 med · `compose-page` · C5 · S — The live-store comparison navigates to storeUrl but ignores config.storePassword (present in the manifest).
- [ ] **F063** · 🟡 med · `refresh-figma-practices` · C5 · S — The skill's entire output depends on WebSearch/WebFetch, but there is no guard for the case where web tools are…
- [ ] **F064** · 🟡 med · `system` · C5 · M — compose-page and validate-shopify never verify their declared MCP tools before relying on them.
- [x] **F067** · 🟡 med · `system` · C7 · S — CLAUDE.md (the authoritative project-instruction file Claude loads every session) is out of sync with reality an… · ✅ #14
- [x] **F068** · 🟡 med · `system` · C7 · S — The dedicated 'ignore runtime state' rule points at the wrong path (theme-profiles/manifest.json) and is therefo… · ✅ #14
- [x] **F069** · 🟡 med · `setup` · C8 · S — The skill captures the storefront password and persists it in plaintext in the manifest, with zero warning to th… · ✅ #15
- [x] **F070** · 🟡 med · `setup` · C8 · S — Least-privilege violation: this read-only config skill grants `mcp__figma__use_figma` — the heavyweight Figma cr… · ✅ #15
- [x] **F071** · 🟡 med · `sync-colors` · C8 · S — The body's documented Shopify write path uses the Edit tool, but Edit is not in allowed-tools (only Write is). · ✅ #8
- [x] **F072** · 🟡 med · `validate-shopify` · C8 · S — The body's core flow explicitly does NOT write files (report goes to stdout), yet Write is granted in allowed-to… · ✅ #15
- [x] **F073** · 🟡 med · `system` · C8 · S — validate-shopify declares the Write tool but is a read-only validator whose own body says not to write a file. · ✅ #15
- [x] **F074** · 🟡 med · `sync-colors` · C9 · S — sync-colors sets context: fork, but the project's own research decision matrix classifies sync-colors as a light… · ✅ #15

## 6. docs / infra (9) — 1 done, 8 left

- [ ] **F006** · 🟠 high · `validate-shopify` · A6 · L — The entire validation is deterministic, repeated, multi-step computation (JSON.parse of templates, regex extract…
- [ ] **F020** · 🟡 med · `validate-instances` · A2 · S — get_screenshot is granted but the body never tells the agent to use it.
- [ ] **F021** · 🟡 med · `validate-shopify` · A3 · M — Six validation topics are spelled out in full (rules, thresholds, examples, math) in BOTH SKILL.md and the refer…
- [ ] **F022** · 🟡 med · `system` · A5 · M — Systemic A5/A1 weakness underlying the C1 collisions: nine of the thirteen descriptions are single terse capabil…
- [ ] **F023** · 🟡 med · `build-foundations` · A6 · M — The alpha-variant computation is deterministic, repeated for every scheme color, and numerically error-prone (he…
- [ ] **F024** · 🟡 med · `system` · A7 · S — A stale hardcoded viewport literal (375px) sits inside compose-page's ASCII layout diagram while the rest of the…
- [ ] **F075** · 🟡 med · `analyze-theme` · P1 · S — analyze-theme is a core pipeline skill (explicitly named in the P1 mandate alongside build-*, compose-page, prop…
- [ ] **F076** · 🟡 med · `setup` · P1 · S — The dynamic-context block references a per-skill `gotchas.md` (P1/P2 mechanism) that does not exist, so it alway…
- [x] **F080** · 🟡 med · `build-design-rules` · P8 · S — The pre-flight gates on `buildStatus.components`, but no skill in the pipeline ever writes that key. · ✅ #9

## 7. rest (self-learning loop) (9) — 9 done, 0 left

- [x] **F036** · 🟡 med · `build-foundations` · B7 · S — The skill injects gotchas.md at runtime (good) but has no closing step telling the model that if the user correc… · ✅ #16
- [x] **F037** · 🟡 med · `propose-components` · B7 · S — P11 requires pipeline skills to carry a self-updating 'After Completion' step: if the user corrected the approac… · ✅ #16
- [x] **F038** · 🟡 med · `refresh-figma-practices` · B7 · S — The skill injects its own gotchas.md at invocation (line 11) but contains no 'After Completion' step instructing… · ✅ #16
- [x] **F039** · 🟡 med · `setup` · B7 · S — P11 expects pipeline skills to include an "After Completion" step instructing the agent to append user correctio… · ✅ #16
- [x] **F040** · 🟡 med · `sync-colors` · B7 · S — sync-colors is the only color-related skill with no self-updating 'After Completion' step instructing the model… · ✅ #16
- [x] **F041** · 🟡 med · `validate-shopify` · B7 · S — SKILL.md has no 'After Completion' step instructing that if the user corrected the validation approach during ex… · ✅ #16
- [x] **F077** · 🟡 med · `analyze-theme` · P11 · S — SKILL.md has no 'After Completion' / self-learning step instructing that if the user corrected the extraction ap… · ✅ #16
- [x] **F078** · 🟡 med · `build-components` · P11 · S — The skill lacks the project's self-updating 'After Completion' learning step (P11): if the user corrects the app… · ✅ #16
- [x] **F079** · 🟡 med · `build-design-rules` · P11 · S — Project mandate P11 requires pipeline skills to include an 'After Completion' (or equivalent) step instructing t… · ✅ #16

---

## PR log

| PR | Cluster(s) | Findings closed | Status |
|----|-----------|-----------------|--------|
| #8 | foundation: state-contract + write-safety + consistency(MCP-STOP/Edit) + evals(harness) | F001 F002 F003 F004 F005 F009 F010 F011 F012 F032 F060 F061 F065 F071 (14) | merged ✅ |
| #9 | state-contract: manifest producer/consumer field agreements (C4/B1) | F033 F054 F055 F056 F057 F058 F059 F080 (8) | merged ✅ |
| #10 | triggering: rewrite + mutually disambiguate 11 skill descriptions (C1/A1) | F015 F016 F017 F018 F019 F042 F043 F044 F045 F046 (10) | merged ✅ |
| #11 | write-safety: sync-colors real diff + verify-only-color-keys (C6) | F066 (1) | merged ✅ |
| #12 | evals: per-skill evals/evals.json triggering + behavior suites (A9) | F025 F026 F027 F028 F029 F030 F031 (7) | merged ✅ |
| #13 | consistency/installer: install.sh + README target .claude/skills (C9) | F013 F014 (2) | merged ✅ |
| #14 | consistency/docs: CLAUDE.md + .gitignore reflect reality (C7) | F067 F068 (2) | merged ✅ |
| #15 | consistency/least-privilege: allowed-tools + inline context (C8/C9) | F069 F070 F072 F073 F074 (5) | merged ✅ |
| #16 | rest/self-learning: After-Completion gotchas-append step x9 (P11/B7) | F036 F037 F038 F039 F040 F041 F077 F078 F079 (9) | merged ✅ |
| #17 | consistency/hygiene: dedup gotchas + Grey naming + structure doc (C2/C3) | F049 F051 F053 (3) | merged ✅ |

---

## Follow-ups discovered during remediation (not in the original 80)

Surfaced by the self-review (`/code-review`) of each PR. Tracked separately so the
"N / 80" counter above stays faithful to the original review's scope.

- [ ] **HR-1** · harness-rigor · M — Extracted utils (`color-utils.js`, `variant-utils.js`) duplicate the prose JS the agent actually runs (`sync-colors/SKILL.md`, `validation.md`); unit tests cover the utils, not the runtime prose. Mitigated in #8 by mirroring fixes + prose-sync lints; the real fix is single-source (harness extracts & evals the prose block, or skills load the util).
- [ ] **HR-2** · harness-rigor · S — HIGH-C scope is gated by a frontmatter regex (`mcp__figma__|mcp__chrome-devtools__`); skills that declare MCP tools differently or depend on WebSearch/WebFetch (e.g. `refresh-figma-practices`, see F063) are silently skipped. Broaden the detector.
- [ ] **HR-3** · harness-rigor · S — Some contract checks remain substring-loose (false-green if prose is reworded). Tightened CRIT-A/CRIT-B/HIGH-F/HIGH-C in #8; audit the remaining asserts as the harness grows.
- [ ] **BL-1** · build-components · M — `validation.md` variant-completeness node lookup matches `n.name === section.name || n.name === slug`, but the build phase never guarantees the built node is named by slug; PascalCase-named sections would all report MISSING. Pin the section node-naming convention (relates to C4 / F054–F057).
