# Skills system review — full findings (companion data)

> Machine-generated companion to [`skills-review-2026-06-08.md`](skills-review-2026-06-08.md). Every verified finding, untruncated, grouped by severity then rubric dimension.
> Severity counts (live, post-verification): {"critical":5,"high":9,"medium":66,"low":48,"refuted":4,"raw":132,"live":128}.

## Counts by skill

- **analyze-theme**: 5
- **build-components**: 9
- **build-design-rules**: 7
- **build-foundations**: 9
- **compose-page**: 8
- **learnings**: 4
- **propose-components**: 6
- **refresh-figma-practices**: 3
- **setup**: 8
- **sync-colors**: 8
- **system**: 44
- **validate-instances**: 7
- **validate-shopify**: 10

## Counts by dimension

- `A1`: 9
- `A2`: 6
- `A3`: 3
- `A5`: 1
- `A6`: 4
- `A7`: 2
- `A8`: 5
- `A9`: 13
- `B1`: 2
- `B3`: 2
- `B4`: 2
- `B5`: 1
- `B6`: 2
- `B7`: 10
- `C1`: 8
- `C10`: 1
- `C2`: 6
- `C3`: 4
- `C4`: 13
- `C5`: 8
- `C6`: 3
- `C7`: 3
- `C8`: 7
- `C9`: 4
- `P1`: 3
- `P11`: 4
- `P2`: 1
- `P8`: 1

---

## 🔴 CRITICAL (5)

### Dimension `B1` (1)

**`system`** — `B1` · status: confirmed · confidence: high · effort: S

- **Evidence:** build-components/SKILL.md:35 'Verify `components.status === "confirmed"`. If not → "Run /propose-components first."' and build-design-system/SKILL.md:35 resume table row keyed on `components.status === "confirmed"`. Producer search: grep for 'confirmed' across .claude/skills + .claude/scripts shows propose-components/SKILL.md:164/195 only print the word 'confirmed' in prose; Step 8 (propose-components:162-168) writes the `components` object (atoms/blocks/sections/skippedSections/scope/summary) but NEVER sets `components.status`. Real manifest.json:475-812 has `components` with NO `status` key.
- **Problem:** The producer/consumer contract for `components.status` is broken. build-components and the orchestrator both READ `components.status === "confirmed"` as the gate to start building, but propose-components (the only writer of `components`) never WRITES a `status` field. Result: after a fully successful /propose-components run, /build-components will always fail its pre-flight with 'Run /propose-components first.', and the orchestrator's resume table can never advance past Phase 4 to Phase 5. This is the single most pipeline-breaking contract gap — the happy path is dead.
- **Recommendation:** Make propose-components Step 8 explicitly set `components.status = "confirmed"` when both phases are confirmed (add it to the required keys list alongside `scope` and `summary`). Alternatively, change the two consumers (build-components:35, build-design-system:35) to gate on `components !== null` to match what is actually written. Pick one canonical readiness signal and document it in CLAUDE.md.

### Dimension `B4` (1)

**`sync-colors`** — `B4` · status: confirmed · confidence: high · effort: S

- **Evidence:** SKILL.md:185-186 'Step 4: Write to Shopify ... Use the Edit tool to update `config/settings_data.json`.' — no backup anywhere in file (grep for 'backup' returns nothing).
- **Problem:** The skill writes config/settings_data.json (the live theme settings file) but never creates a backup before writing. CLAUDE.md line 19 mandates: 'ALL Shopify JSON writes require backup + diff preview + user approval.' The skill satisfies diff (Step 3) and approval ('Wait for user approval' line 183) but completely omits the backup. A bad conversion or a partial write to the merchant's settings_data.json is unrecoverable without a backup, and this file controls every color scheme on the storefront. This is a data-loss safety hole and a direct violation of a core project rule.
- **Recommendation:** Add an explicit backup substep before the write in Direction: Figma -> Shopify, e.g. 'Step 4a: Back up config/settings_data.json to .claude/figma-sync/backups/settings_data.<timestamp>.json (or config/settings_data.json.bak) before any modification.' Make backup a precondition of the write and reference it in the Error Handling section. Mirror whatever backup convention the writing siblings use (none currently do — see C6).

### Dimension `C4` (2)

**`build-components`** — `C4` · status: confirmed · confidence: high · effort: S

- **Evidence:** SKILL.md:35 "Verify `components.status === \"confirmed\"`. If not → \"Run `/propose-components` first.\"" — but the manifest has no components.status; verified via `'status' in m['components']` -> False, and propose-components SKILL.md:52 writes `components.scope`, not status.
- **Problem:** The Pre-flight gate that enforces the pipeline dependency (P8) reads a field that the upstream skill never writes. components.status is absent from the real manifest; propose-components records confirmation via components.scope / components.summary. As written, the gate will ALWAYS take the failure branch and tell the user to run /propose-components even when components are fully confirmed, making build-components unrunnable through the normal pipeline.
- **Recommendation:** Change the gate to a field propose-components actually writes on confirmation, e.g. verify components.scope exists and components.summary is present (propose-components SKILL.md:164-166 guarantees summary). If a status flag is desired, add a propose-components Step-8 write of components.status='confirmed' AND update this gate — but the two must agree.

**`propose-components`** — `C4` · status: confirmed · confidence: high · effort: S

- **Evidence:** .claude/skills/propose-components/SKILL.md:162-168 Step 8 'update the manifest with the full components object including atoms, blocks, sections ... skippedSections, and scope' — never writes a status field. Downstream contract: .claude/skills/build-components/SKILL.md:35 'Verify components.status === "confirmed". If not → "Run /propose-components first."' Live manifest confirms components.status is undefined.
- **Problem:** propose-components is the producer of the components.status='confirmed' checkpoint that build-components depends on, but Step 8 never sets it. After a fully successful, user-confirmed run of propose-components, /build-components will fail its pre-flight (status===undefined !== 'confirmed') and tell the user to re-run /propose-components — an infinite loop that breaks the pipeline. The current manifest in-repo reproduces this exactly (status: undefined despite a complete components object with summary).
- **Recommendation:** In Step 8, explicitly instruct writing components.status = "confirmed" (only after BOTH Phase A and Phase B user confirmations) as part of the manifest write. State the exact field name and value so it matches build-components' guard verbatim. Optionally add it to the Step 8 enumerated key list ('atoms, blocks, sections, skippedSections, scope, summary, AND status:"confirmed"').

### Dimension `C8` (1)

**`system`** — `C8` · status: confirmed · confidence: high · effort: S

- **Evidence:** sync-colors/SKILL.md:7 allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep] (no Edit); sync-colors/SKILL.md:186 "Use the Edit tool to update `config/settings_data.json`."; grep confirms NO skill declares Edit in allowed-tools.
- **Problem:** sync-colors' body instructs using the Edit tool for its only Shopify write, but Edit is not in allowed-tools (under-scoped). Two failure modes, both bad: (a) the Edit call is blocked and the skill cannot complete its Figma→Shopify direction at all; or (b) the agent falls back to the declared Write tool, which does a FULL-FILE overwrite of settings_data.json — far more dangerous than the surgical Edit the body intends ('Only modify color fields'), and with no backup (see sws-C6-01) a single serialization slip clobbers the entire theme settings file.
- **Recommendation:** Resolve the tool/body mismatch deliberately: either add Edit to sync-colors allowed-tools and keep the surgical-edit instruction (preferred — minimizes blast radius), or rewrite the body to do a validated read-modify-Write round-trip with an explicit 'preserve all non-color fields' guard plus the backup from sws-C6-01. Do not leave Write as the only available tool against a body that assumes Edit.

---

## 🟠 HIGH (9)

### Dimension `A6` (1)

**`validate-shopify`** — `A6` · status: confirmed · confidence: high · effort: L

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:86-96 "file_content = Read(sections/{type}.liquid)\nschema_match = regex(...)\nschema_json = JSON.parse(...)"; also :160-169 range modulo math and :188-193 ID-uniqueness pseudocode
- **Problem:** The entire validation is deterministic, repeated, multi-step computation (JSON.parse of templates, regex extraction of {% schema %} blocks, modulo step math, set-based ID-uniqueness, glob cross-reference resolution) but it is re-derived in prose/pseudocode that the model must reinterpret and re-execute by hand on every run. This is exactly the skill-creator anti-pattern A6 warns about: deterministic logic belongs in a bundled script, not in prose. Hand-execution is slow, non-reproducible, and error-prone (e.g. the model may mis-apply the modulo or skip a file).
- **Recommendation:** Add scripts/validate.js (Node) that implements Phases 1-5 deterministically and emits the report JSON/markdown. Reduce SKILL.md to: when to run, how to invoke the script, how to interpret results against the gotchas, and the human-judgement WARNING calls. Keep only the non-deterministic interpretation guidance in prose.

### Dimension `B3` (1)

**`validate-instances`** — `B3` · status: adjusted · confidence: high · effort: M

- **Evidence:** .claude/skills/validate-instances/SKILL.md:129-142 Step 4 Auto-Fix: '3. Create an instance... 6. Remove the inline frame...' with only '**Always ask before auto-fixing.** Show the list first, let the user confirm.'
- **Problem:** The auto-fix is destructive: it deletes inline frames and re-parents instances inside live design-system templates/sections. The only safeguard is one confirmation on the batch list. There is no per-fix screenshot verification that the substituted instance actually lays out correctly (correct size, FILL sizing applied, no collapsed/sliver frame), even though get_screenshot is granted. If overrides or FILL sizing don't carry over (Step 4 admits these are manual copies), a swap can silently break the composition's layout, and the original frame is already removed. The project's screenshot-validation learning exists precisely to catch this class of visual-anomaly-after-edit, but it is not invoked here.
- **Recommendation:** Make Step 4 safe and verified: (a) before removing each inline frame, capture enough state to reconstruct it, or operate on one violation at a time; (b) after each instance swap, call get_screenshot of the affected parent and critically evaluate it (legible, proportional, no sliver) before proceeding — explicitly cite the 'thin sliver = broken layout' rule; (c) if the screenshot looks wrong, stop and surface it rather than continuing the batch.

### Dimension `B6` (1)

**`system`** — `B6` · status: adjusted · confidence: high · effort: L

- **Evidence:** plans/pipeline-phase-enforcement.md prescribes 5 concrete changes. Verification greps return EMPTY across .claude/skills for: 'Pre-flight Gate', 'HARD FAIL', 'Zero Raw Frames', 'Visual Reference Capture', 'Completion Verification', 'Skill tool'/'invoke.*Skill tool'. build-design-system/SKILL.md:21 still says 'This skill does NOT call other skills … reading and following the corresponding skill file's instructions directly' and frontmatter line 6 still has `context: fork` (plan §1 said remove it). propose-components/SKILL.md has no Step 0. compose-page/SKILL.md has no raw-frame-prohibition section. build-components/SKILL.md has no quantitative Completion Verification section.
- **Problem:** The pipeline-phase-enforcement plan is entirely unimplemented. Every soft pre-flight check across the 5 skills is still advisory ('If not → tell user…') rather than a HARD FAIL/STOP gate, the orchestrator is still a passthrough that 'reads and follows' rather than invoking discrete Skill-tool operations, and none of the targeted guards (visual reference capture, zero-raw-frames, 100%-of-proposal completion checks) exist. The exact field-reported failure that motivated the plan — agent skips /propose-components, builds a fraction of atoms, composes with raw frames — remains fully reproducible. CLAUDE.md:17 'NEVER skip a pipeline phase' has no mechanical enforcement.
- **Recommendation:** Implement the plan, or formally close it. Minimum viable: add the 'Pre-flight Gate (MANDATORY)' block from plan §4 (with explicit point-4 'Do NOT attempt to do both phases. STOP.') to each of the 5 skills, and convert build-design-system to invoke phases via the Skill tool with post-write manifest verification (plan §1). If the plan is intentionally deferred, note that in the plan header so it isn't mistaken for done.

### Dimension `C4` (1)

**`build-components`** — `C4` · status: confirmed · confidence: high · effort: S

- **Evidence:** reference/validation.md:70-73 "const propArrays = Object.values(section.variants); const expectedCount = propArrays.reduce((acc, arr) => acc * arr.length, 1);". Verified hero.variants = { horizontal_alignment: {tier,values,reason,combinationCount}, vertical_alignment: {...} } — each value is an OBJECT, so arr.length is undefined and expectedCount becomes NaN. The manifest already carries section.totalVariantCombinations = {desktop:9,mobile:9}.
- **Problem:** The Variant Completeness Check computes expected variant count by treating section.variants values as flat arrays, but propose-components now stores them as rich objects ({tier,values[],combinationCount}). expectedCount evaluates to NaN, so the `actualCount < expectedCount` comparison is always false and the check never flags an incomplete component set — defeating the 'Do NOT skip variants' guarantee (SKILL.md:184).
- **Recommendation:** Update the math to the new shape: expectedCount = Object.values(section.variants).reduce((acc,v)=>acc*v.values.length,1), or simply read section.totalVariantCombinations.desktop / .mobile which the manifest already provides. Compare against node.children.length per orientation.

### Dimension `C5` (2)

**`setup`** — `C5` · status: confirmed · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:33 "Use Chrome DevTools MCP → `navigate_page`" and :53 "Use Figma MCP → `get_metadata`" — no preflight that the MCP servers/tools are available, and no instruction to stop if they are not.
- **Problem:** This is the FIRST pipeline skill and the gate that verifies the store and Figma file are reachable, yet it never checks that the required MCP tools (chrome-devtools, figma) are actually connected. If `mcp__chrome-devtools__navigate_page` or `mcp__figma__get_metadata` is missing, the agent will either silently skip verification or improvise — violating the explicit GLOBAL rule and the team learning `feedback_missing_tools` ("STOP if required tools missing — never proceed without required MCP tools, stop and ask user to fix"). Because every downstream phase trusts that setup validated access, a silent skip here corrupts the whole pipeline's starting assumptions.
- **Recommendation:** Add a Step 0 / pre-flight: "Confirm the required MCP tools are available before proceeding: Chrome DevTools (`navigate_page`, `take_screenshot`, `fill`, `click`) and Figma (`get_metadata`). If any required tool is not available, STOP and ask the user to connect/enable that MCP server before continuing — do not attempt to verify the store or Figma file without them." This mirrors the GLOBAL/C5 contract and the encoded learning.

**`validate-instances`** — `C5` · status: confirmed · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-instances/SKILL.md:30-32 'Use `use_figma` to scan all pages...' — no guard anywhere in the file for the case where mcp__figma__use_figma is unavailable. Compare analyze-theme/compose-page/build-* which all contain missing-tool handling.
- **Problem:** Violates the GLOBAL rule and team learning (feedback_missing_tools): if the required Figma MCP tool is not connected, Step 1's page scan silently fails or the agent improvises, instead of stopping and asking the user to fix the tooling. Every other Figma-touching skill encodes this; validate-instances does not.
- **Recommendation:** Add a pre-flight check: if mcp__figma__use_figma (and, if verification is added, get_screenshot) is not available, STOP and tell the user to connect/fix the Figma MCP server before proceeding. Never run a partial audit on a broken connection.

### Dimension `C6` (1)

**`system`** — `C6` · status: adjusted · confidence: high · effort: S

- **Evidence:** CLAUDE.md:19 "ALL Shopify JSON writes require backup + diff preview + user approval"; grep for "backup" across .claude/skills returns ZERO matches; sync-colors/SKILL.md:185-186 "### Step 4: Write to Shopify / Use the Edit tool to update `config/settings_data.json`."
- **Problem:** The single skill that writes Shopify JSON (sync-colors, Figma→Shopify) never creates a backup before writing config/settings_data.json. The word 'backup' does not appear in any skill file. The CLAUDE.md mandate's backup requirement is therefore universally unenforced — a bad write or interrupted write to settings_data.json (which holds all color schemes and theme settings) is unrecoverable, with no .bak artifact and no git-stash step.
- **Recommendation:** Add a mandatory pre-write backup step to sync-colors Step 4 (Figma→Shopify): copy config/settings_data.json to config/settings_data.json.bak (or a timestamped path) before any edit, and reference the backup in the summary so the user can roll back. Codify this as a shared 'Shopify write protocol' snippet so every future Shopify-writing skill inherits backup+diff+approval identically.

### Dimension `C9` (2)

**`system`** — `C9` · status: unverified · confidence: high · effort: M

- **Evidence:** install.sh:11-19 SKILLS array of `*.md` files + install.sh:52 `curl -sfL "$BASE_URL/.claude/commands/$skill"`; repo has NO .claude/commands/ (git ls-files shows only .claude/skills/<name>/SKILL.md). Confirmed: `git ls-files | grep commands/` returns nothing.
- **Problem:** The installer is non-functional. It downloads skills from https://raw.githubusercontent.com/.../main/.claude/commands/<skill>.md, but the repository stores skills as .claude/skills/<name>/SKILL.md. Every curl 404s. Because curl uses -f (fail silently) and the loop prints a red 'failed' but never sets a non-zero exit, the script still prints 'Done! Installed 7 skills' and exits 0, so a user running the documented `curl | bash` ends up with an empty .claude/commands/ and a false success message.
- **Recommendation:** Rewrite install.sh to fetch the real layout: iterate the 13 skill directories and download each .claude/skills/<name>/SKILL.md (plus gotchas.md / reference/*.md where present), OR better, `git clone`/sparse-checkout the repo and copy .claude/skills/. Make failed downloads set a non-zero exit so the success banner can't lie. Also reconcile the SKILLS list with the actual 13 skills.

**`system`** — `C9` · status: confirmed · confidence: high · effort: S

- **Evidence:** README.md:25-36 — 'Copy the `.claude/commands/` directory into your Shopify theme project' with `cp -r path/to/shopify-figma-bridge/.claude/commands/ .claude/commands/` and a symlink variant. No such directory exists in the repo.
- **Problem:** The README's primary Installation instructions reference a `.claude/commands/` directory that does not exist. A user following either the copy or the symlink command copies/links a nonexistent path, producing an empty or broken install. This is the same root cause as the install.sh defect: docs assume a legacy commands/ layout that was migrated to skills/.
- **Recommendation:** Update the Installation section to copy/symlink `.claude/skills/` instead of `.claude/commands/`. Keep it consistent with the corrected install.sh.

---

## 🟡 MEDIUM (66)

### Dimension `A1` (5)

**`analyze-theme`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:3-4 "description: >\n  Use when: extracting design tokens from a Shopify theme, or when manifest has no foundations data". Compare build-foundations SKILL.md:3-4 "Use when: creating Figma variables, text styles, or style guide from analyzed tokens".
- **Problem:** The description's first clause is good (concrete: 'extracting design tokens from a Shopify theme'). The second clause, 'when manifest has no foundations data', is a weak/ambiguous trigger: it describes an internal manifest state the user rarely phrases, and it overlaps conceptually with build-foundations' precondition (build-foundations needs 'analyzed tokens', i.e. foundations data). A user saying 'foundations aren't set up yet' could plausibly aim at either skill. The description also lacks common natural user phrasings (e.g., 'analyze the theme', 'pull the colors/fonts/spacing out of the theme', 'what tokens does this theme have'), so it risks under-triggering on real requests.
- **Recommendation:** Tighten and enrich the trigger phrasing, e.g.: 'Use when: analyzing a Shopify theme to extract design tokens (colors, fonts, spacing, radii) into the manifest before building Figma foundations; e.g. "analyze the theme", "extract the tokens", "pull colors/fonts out of the theme". This is the step BEFORE /build-foundations.' Replace the vague 'manifest has no foundations data' clause with the user-facing phrasings and an explicit ordering hint to disambiguate from build-foundations.

**`build-design-rules`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:3-4 "description: >\n  Use when: generating a design system rules file mapping Figma to code"
- **Problem:** The description correctly uses the 'Use when:' CSO pattern (P3/A1 pass on form), but it is thin on concrete trigger contexts and user phrasing, which risks under-triggering. It does not mention the output filename (design-rules.json), the downstream consumers, or natural user phrases ('generate the figma-to-code mapping', 'create the component-to-liquid map', 'after building components, link them to theme files'). Anthropic guidance asks descriptions to be slightly pushy and enumerate when to fire.
- **Recommendation:** Expand to e.g.: 'Use when: generating/refreshing the Figma-to-code design-system rules file (design-rules.json) that maps Figma components to theme liquid files and Figma variables/text-styles to CSS custom properties — typically after /build-components, and required by /compose-page, /sync-colors, and /build-components.' Keep it within the ~1-2 line house style used by sibling skills.

**`refresh-figma-practices`** — `A1` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/refresh-figma-practices/SKILL.md:4 "Use when: updating the Figma best practices cheatsheet"
- **Problem:** The description is a single thin trigger phrase. It correctly uses the 'Use when:' pattern (P3 passes) and states the artifact, but it gives the model only one phrasing to match against. A1 requires the description to be slightly 'pushy' with concrete trigger contexts / user utterances to avoid undertriggering. Realistic user phrasings this skill should fire on — 'update Figma best practices', 'is our Figma cheatsheet out of date?', 'research latest Figma features', 'refresh the design engineering reference', 'check for new Figma Plugin API changes' — are not surfaced, so the skill may undertrigger when the user describes the intent rather than naming the cheatsheet.
- **Recommendation:** Expand the description to enumerate concrete triggers while keeping the 'Use when:' form, e.g.: 'Use when: refreshing/updating the Figma best-practices cheatsheet (.claude/figma-best-practices.md), researching the latest Figma features / Plugin API changes / Config announcements, or checking whether the Figma engineering reference is stale.' Keep it under ~30 words.

**`setup`** — `A1` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:3-4 `description: > Use when: configuring a new Shopify-to-Figma pipeline, setting store URL, Figma file, or viewports` (14 words).
- **Problem:** The description follows the project's `Use when:` CSO pattern (P3 satisfied) but is thin and omits the most likely user phrasings, so it risks under-triggering. It never mentions the manifest, "first run", "initialize/configure the design system", store password, or the fact that this must run before every other skill. A user saying "set up the design system pipeline", "connect my store and Figma file", "the manifest doesn't exist yet", or "reconfigure my setup" may not reliably match. Skill-creator guidance says the description should be slightly pushy and enumerate concrete contexts.
- **Recommendation:** Broaden and make it pushier, e.g.: "Use when: configuring/initializing the Shopify-to-Figma pipeline for the first time, connecting a store URL + Figma file, setting design viewports, entering a store password, or when `.claude/figma-sync/manifest.json` does not yet exist or needs reconfiguring. Run this before any other design-system skill." Keep it under ~30 words.

**`validate-instances`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/validate-instances/SKILL.md:3-4 `description: > Use when: auditing Figma file for instance compliance`
- **Problem:** The description is a correctly-formed 'Use when:' trigger (passes P3) but is thin: a single context with no concrete user phrasings. The skill actually also audits text-style violations and unbound variable fills (Step 2.4, 2.5) and offers auto-fix, none of which are surfaced as triggers. Users saying 'check my text styles are applied', 'find hardcoded colors in Figma', 'audit variable bindings', or 'fix inline frames' may not trigger it. Per A1 the description should be slightly pushy and enumerate contexts to avoid undertriggering.
- **Recommendation:** Broaden the description, e.g.: 'Use when: auditing the Figma file for instance compliance — finding inline frames that should be component instances, text nodes missing a text style, or fills not bound to variables; also when asked to fix/clean up such violations or verify the design-system cascade is intact.'

### Dimension `A2` (1)

**`validate-instances`** — `A2` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-instances/SKILL.md:7 `allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, ...]` vs body: `grep` for screenshot/get_screenshot in the body returns only the frontmatter line — the workflow (Steps 1-5) never uses get_screenshot.
- **Problem:** get_screenshot is granted but the body never tells the agent to use it. For an audit-and-fix skill, the highest-value use of a screenshot is verifying that an auto-fixed layout is visually intact (the screenshot-validation learning). Granting the tool without any guidance on WHEN to use it is an unused capability and a missed verification hook.
- **Recommendation:** Add explicit screenshot guidance: take get_screenshot after auto-fix (and optionally during detection to visually confirm a suspected violation), and apply the critical-evaluation rule from gotchas.md. Either wire the tool into the workflow or drop it from allowed-tools — currently it is dead grant.

### Dimension `A3` (1)

**`validate-shopify`** — `A3` · status: unverified · confidence: high · effort: M

- **Evidence:** Duplication confirmed across files: range step math at SKILL.md:160-174 vs reference/common-schema-gotchas.md:9-33; select options count SKILL.md:178-184 vs reference:37-52; setting ID uniqueness SKILL.md:186-193 vs reference:139-164; font format SKILL.md:244-261 vs reference:83-105; max_blocks SKILL.md:135 vs reference:231-255; -1 sentinel SKILL.md:445-450 vs reference:167-194.
- **Problem:** Six validation topics are spelled out in full (rules, thresholds, examples, math) in BOTH SKILL.md and the reference file. The reference is described as the place for 'known edge cases and pitfalls', yet SKILL.md re-embeds the same rules inline. This bloats SKILL.md to 456 lines, raises maintenance cost (two places to update, easy to drift), and puts reference-grade detail at the wrong altitude in the orchestration file.
- **Recommendation:** Make SKILL.md state each check by name + severity and defer the rationale/examples/thresholds to common-schema-gotchas.md (which already has them). Or, if a script is added (A6 finding), the thresholds live in code and both docs shrink to interpretation guidance.

### Dimension `A5` (1)

**`system`** — `A5` · status: unverified · confidence: high · effort: M

- **Evidence:** All phase descriptions use the bare prefix "Use when:" with no negative scoping, e.g. analyze-theme/SKILL.md:4, build-foundations/SKILL.md:4, propose-components/SKILL.md:4, build-components/SKILL.md:4, compose-page/SKILL.md:4, build-design-rules/SKILL.md:4, validate-instances/SKILL.md:4, sync-colors/SKILL.md:4
- **Problem:** Systemic A5/A1 weakness underlying the C1 collisions: nine of the thirteen descriptions are single terse capability labels with (a) no "does NOT / not for…" exclusion clause, (b) no pipeline-ordinal anchor, and (c) no cross-reference to the sibling skill they are most confusable with. Because every skill shares the same vocabulary pool (Figma, Shopify, design system, components, sections, tokens, validate, build, colors), terse positive-only descriptions maximize keyword overlap and give the router no tie-breakers. This is the common cause that makes findings 01-08 possible rather than eight independent issues. By contrast learnings (literal trigger phrases) and validate-shopify (long, layer-specific, lists concrete file types) trigger far more reliably, demonstrating the fix pattern.
- **Recommendation:** Adopt a uniform description template across all 13 skills: "<verb-led scope sentence>. <pipeline position / precondition if any>. Not for <nearest-neighbor intent> — use <sibling skill> for that." Specifically: (1) lead with a distinctive verb (EXTRACT, CREATE-IN-FIGMA, PLAN, CONSTRUCT, ASSEMBLE, MAP, AUDIT, SYNC, CONSOLIDATE, RESEARCH); (2) add the one negative clause that excludes the most-confusable sibling; (3) for the 6 phase skills, add the ordinal and the "for a full build use build-design-system" pointer. This converts overlapping keyword clouds into mutually-exclusive routing signals and resolves findings 01-08 at the description layer instead of relying on body-level pre-flight rejections.

### Dimension `A6` (1)

**`build-foundations`** — `A6` · status: unverified · confidence: medium · effort: M

- **Evidence:** reference/alpha-variants.md:9-24 prose re-derives hex parsing (#RRGGBBAA → alpha=AA/255, rgba(), thresholds 0.99/0.01), RGB→variable matching, dedup with +/-1% tolerance, and name computation `round(alpha*100)`. SKILL.md:58 also asks to convert hex+opacity to {r,g,b,a} floats by hand.
- **Problem:** The alpha-variant computation is deterministic, repeated for every scheme color, and numerically error-prone (hex parsing, 0-1 normalization, percentage rounding, dedup tolerance). Re-deriving this in prose each run invites arithmetic mistakes (off-by-one on round, mis-normalized RGB) that then silently produce wrong variables or trip the Step-4 'no match → STOP' path. Per A6 this is exactly the kind of work that should be a bundled deterministic script in scripts/.
- **Recommendation:** Add scripts/compute-alpha-variants.(js|py) that reads foundations.colors from the manifest and emits the deduplicated list of {collection, name, r,g,b,a} alpha variants (and the base {r,g,b,a} conversions). Have SKILL.md Step 3.5 call the script and pass its output to use_figma, keeping alpha-variants.md as the explanation of the algorithm rather than the executable spec.

### Dimension `A7` (1)

**`system`** — `A7` · status: unverified · confidence: high · effort: S

- **Evidence:** compose-page/SKILL.md:92 hardcodes "Homepage / Mobile (375px wide)" in the layout example, but setup/SKILL.md:84,110 establishes the default mobileWidth as 390px (`| Mobile design width | 390px |` and `"mobileWidth": 390`). compose-page itself reads `config.mobileWidth` at lines 32,136 and uses the {mobileWidth} placeholder in its summary (line 209), so the literal 375 contradicts both the config-driven body and the setup default.
- **Problem:** A stale hardcoded viewport literal (375px) sits inside compose-page's ASCII layout diagram while the rest of the system is parameterized on config.mobileWidth (default 390px). A reader copying the diagram could build mobile frames at the wrong width, and it signals the example was written before the 390 default landed.
- **Recommendation:** Replace the literals in compose-page/SKILL.md:91-92 with placeholders to match the surrounding convention: "Homepage / Desktop ({desktopWidth}px wide)" and "Homepage / Mobile ({mobileWidth}px wide)". Never hardcode viewport pixels in body text — the codebase's canonical form is the config.* read + {placeholder} substitution used everywhere else in the same file.

### Dimension `A9` (8)

**`analyze-theme`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** Directory check: 'NO evals dir' for analyze-theme; sibling survey shows no skill ships evals/, so this is also a system-wide gap, but flagged here per scope. No evals/evals.json exists for this skill.
- **Problem:** There are no evals (evals/evals.json) with realistic test prompts for analyze-theme. This skill has highly testable, deterministic outputs (a manifest.foundations object with specific shape: colors.schemes, typography.fontRoles/presets, spacing.radii/borderWidths, hasMobilePresets flag) and several branchy behaviors (profile present vs absent, mobile presets vs CSS-clamp, foundations-already-exist overwrite path). Without evals, triggering accuracy and output-shape regressions cannot be measured.
- **Recommendation:** Add .claude/skills/analyze-theme/evals/evals.json with a few realistic prompts (e.g., 'extract design tokens from the theme', 'analyze the Horizon theme settings', plus a should-NOT-trigger control like 'build the Figma variables'), asserting on manifest.foundations structure and the createMobileStyles/hasMobilePresets flags. (Cross-cutting: consider a system-wide eval convention via skill-creator.)

**`build-components`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** No evals dir for build-components (ls .claude/skills/build-components/evals -> NO evals dir) and `find .claude -name evals.json` returns nothing repo-wide.
- **Problem:** There is no evals/evals.json with realistic trigger prompts for this skill (A9). Given build-components has a phase argument ($ARGUMENTS: atoms|blocks|sections-desktop|sections-mobile|all) and several hard guarantees (instance-only, text-FILL, variant completeness, stop-on-missing-tool), the absence of evals means triggering accuracy and the phase-routing/pre-flight guards are untested. No sibling skill has evals either, so this is a system-wide gap surfaced here.
- **Recommendation:** Add evals/evals.json with prompts that should fire build-components ('build the atoms in Figma', 'construct the hero section', 'create mobile section variants') plus near-miss negatives that should NOT fire ('propose which sections become components' → propose-components; 'create the Figma variables' → build-foundations) to guard the C1 triggering boundaries.

**`build-foundations`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** find .claude/skills/build-foundations -type d → no evals/ dir; system-wide grep: no skill has an evals/ directory. SKILL.md has no evals/evals.json.
- **Problem:** There is no evals/evals.json with realistic trigger prompts for this skill (none exist anywhere in the system). Per A9, skills should ship evals so triggering and output correctness are testable and regressions are caught when the description or steps change. This skill in particular has a precise pre-flight contract and many conditional branches (mobile styles, profile divergence) that are eval-worthy.
- **Recommendation:** Add .claude/skills/build-foundations/evals/evals.json with a few prompts that should trigger (e.g. 'build the Figma variables and text styles from the analyzed tokens', 'create the style guide page') and negative/edge cases (manifest foundations null → should route to /analyze-theme; figmaFileKey missing → route to /setup). Establish the convention across the pipeline skills.

**`learnings`** — `A9` · status: unverified · confidence: high · effort: S

- **Evidence:** `ls .claude/skills/learnings/evals/` → NO evals dir; learnings dir contains only SKILL.md (4121 bytes). Description at SKILL.md:3-6 triggers on discrete phrases ('review learnings', 'what have we learned', 'update gotchas').
- **Problem:** The skill is phrase-triggered and therefore highly amenable to triggering evals, but has no evals/evals.json. There is no automated guard against under/over-triggering (e.g. firing on unrelated 'review' requests, or missing 'consolidate feedback') and no test of its consolidation output.
- **Recommendation:** Add .claude/skills/learnings/evals/evals.json with realistic positive prompts ('review our learnings', 'update the gotchas', 'what have we learned from the last build') and negative/near-miss prompts ('review my PR', 'learn how to build components') to lock in trigger behavior.

**`propose-components`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** find .claude/skills/propose-components -name 'evals*' → none; find .claude/skills -name 'evals.json' → none system-wide. Skill directory contains only SKILL.md, gotchas.md, reference/.
- **Problem:** There is no evals/evals.json with realistic test prompts for this skill (nor anywhere in the system). For a skill whose correctness hinges on subtle judgement (does it set status, does it bucket a position setting as a variant vs an instance property, does it skip password/error pages but keep collection/cart), the absence of evals means regressions like the missing components.status are invisible until the pipeline breaks downstream.
- **Recommendation:** Add .claude/skills/propose-components/evals/evals.json with a few realistic prompts and assertions — at minimum: (a) after a confirmed run the manifest gets components.status='confirmed' and a summary sub-object; (b) a position/alignment select is classified Tier-1 variant; (c) section_width is classified as an instance property, not a variant; (d) color_scheme is never a variant. This also gives the missing-status break a regression guard.

**`sync-colors`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** Skill folder listing shows only SKILL.md (7628 bytes); `find ... -name 'evals*'` returns nothing. No evals/evals.json.
- **Problem:** There are no evals for sync-colors. This skill performs nontrivial, regression-prone deterministic logic — hex<->RGBA conversion incl. 8-digit alpha and rgba() strings (lines 119-145), the special-case 'rgba(0,0,0,0)' round-trip (line 139), the 0.005/0.01 match tolerances (line 148), and grey-shade rounding (line 207). None of this is covered by a realistic test prompt, and color-format bugs are exactly the kind of silent corruption that would write wrong values into the merchant's storefront.
- **Recommendation:** Add evals/evals.json with realistic prompts exercising both directions and the tricky conversions: a plain #rrggbb, an #rrggbbaa alpha color, an rgba() string, the fully-transparent round-trip, and a scheme-key-mismatch case (should warn+skip per line 197). This also makes the conversion functions independently testable.

**`validate-shopify`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** ls .claude/skills/validate-shopify/ shows only SKILL.md + reference/ (no evals/). This skill has the most testable, deterministic output of any skill in the system (pass/warn/error on fixture themes).
- **Problem:** There is no evals/evals.json with realistic prompts/fixtures, despite this being the single most eval-friendly skill in the repo: its output is a deterministic report over known-good and known-bad theme fixtures. Without evals, regressions in the validation logic (or in a future script) go undetected. (Note: no sibling has evals either, so this is partly a system-level gap, but it is most impactful and most achievable here.)
- **Recommendation:** Add evals/evals.json with a few fixture templates/sections that exercise each ERROR/WARNING class (bad range step, select>50, missing block file, missing color scheme, orphaned setting) and assert the report flags them. Pairs naturally with the A6 script.

**`system`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** Repo-wide search for evals: `find . -iname '*eval*'` returns nothing (only incidental matches of the substring 'eval' inside prose/JS like addEventListener). No evals/, no test/, no fixtures, no CI workflow under .github/. The generator generate-proposal-html.js has no accompanying test (a prior test file existed only transiently — settings.local.json:8 shows `rm -f .claude/scripts/generate-proposal-html-test.js`).
- **Problem:** There is zero automated eval/test coverage anywhere in the project. The 13 skills are prose specs with no behavioral checks, and the one piece of executable tooling (the HTML proposal generator) has its test explicitly deleted. For a pipeline whose correctness depends on manifest shape and strict Figma/Shopify invariants (per CLAUDE.md Rules), the absence of any eval harness means regressions in skills or the generator are undetectable except by manual run.
- **Recommendation:** Add at least a minimal eval/smoke layer: (1) a fixture manifest + a node test that runs generate-proposal-html.js and asserts the HTML contains expected sections and that injected `<script>`/HTML in fields is escaped; (2) consider skill-level evals (the skill-creator skill supports eval scaffolding) for the highest-risk phases. Restore a committed test for the generator rather than deleting it.

### Dimension `B1` (1)

**`system`** — `B1` · status: adjusted · confidence: high · effort: S

- **Evidence:** build-design-rules/SKILL.md:26 'Verify `buildStatus.foundations === "complete"` and `buildStatus.components` has at least one completed phase'. But build-components writes FLAT keys: buildStatus.atoms (SKILL.md:124), buildStatus.blocks (:150), buildStatus["sections-desktop"] (:187), buildStatus["sections-mobile"] (:215). grep for 'buildStatus.components' shows the ONLY occurrence is this read at build-design-rules:26 — no writer. Real manifest.json:813-815 buildStatus only has `foundations`.
- **Problem:** build-design-rules reads a `buildStatus.components` object/namespace that no skill ever writes. build-components records component progress under flat sibling keys (atoms, blocks, sections-desktop, sections-mobile), not nested under a `components` object. So build-design-rules' pre-flight check 'buildStatus.components has at least one completed phase' can never be satisfied and will always fail/short-circuit. The state shape the consumer expects (nested) and the shape the producer writes (flat) are contradictory.
- **Recommendation:** Align the contract: either (a) change build-design-rules:26 to check the flat keys (e.g., any of buildStatus.atoms/blocks/["sections-desktop"]/["sections-mobile"] === "complete"), or (b) have build-components nest its sub-phase status under buildStatus.components.{atoms,blocks,...}. Update both sides and the orchestrator resume table (build-design-system:35-40, which uses the flat keys) so a single convention is used everywhere.

### Dimension `B5` (1)

**`system`** — `B5` · status: unverified · confidence: high · effort: M

- **Evidence:** Pre-flight gates are READ-only assertions with no proof the upstream WRITE actually happened end-to-end: build-foundations:26 checks `foundations !== null` (set by analyze-theme:131) — OK. propose-components:32 checks buildStatus.foundations === 'complete' (set by build-foundations:228) — OK. build-components:35 checks components.status==='confirmed' (NEVER set — see B1-01). compose-page:29-30 checks buildStatus['sections-desktop'] AND ['sections-mobile'] === 'complete' (set by build-components:187/215) — OK. So the chain is: setup→analyze (ok) → foundations (ok) → propose (ok) → BUILD-COMPONENTS GATE BROKEN → compose (ok if gate bypassed). Plan §4 verification step 6 ('Dry-run: trace orchestrator with fresh all-null manifest') was never executed against the real skills.
- **Problem:** No end-to-end verification of the phase-handoff chain exists, and a dry-run trace immediately surfaces the B1-01 break: a fresh manifest can pass setup/analyze/foundations/propose and then deadlock at build-components because the readiness flag it waits for is never produced. The individual gates were authored locally per-skill without confirming each upstream phase writes exactly the key its downstream consumer reads. The orchestrator resume table (build-design-system:33-40) was likewise never validated against the skills' actual writes (it inherits the same components.status break at row :35).
- **Recommendation:** Add a single source-of-truth state-contract table (phase → keys written → keys read by next phase) to CLAUDE.md or the plan, then reconcile each skill to it. Perform the plan's §149 dry-run: trace the orchestrator from an all-null manifest and confirm every gate's read key has a matching upstream write. Fixing B1-01 unblocks the chain; this finding tracks the missing end-to-end verification that would have caught it.

### Dimension `B6` (1)

**`compose-page`** — `B6` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:191-199 Step 8 shows a JSON object with `buildStatus.composition-{template}` but gives no read-modify-write/merge or backup instruction; the snippet reads as if it could overwrite manifest.json.
- **Problem:** manifest.json is the single source of truth (CLAUDE.md). Step 8 presents only the delta JSON to write but does not tell the model to read the existing manifest, merge the new key into buildStatus, and write back. A literal reading risks clobbering existing keys (config, theme, foundations, components, and other composition-* statuses). Other pipeline phases set buildStatus keys via narrative 'Update buildStatus.X = complete', which is safer than showing a bare JSON object.
- **Recommendation:** Reword Step 8 to: 'Read manifest.json, set buildStatus["composition-{template}"] = "complete" (preserving all other keys), and write it back.' Optionally note a backup if the project convention is to snapshot manifest writes. Avoid presenting a standalone JSON object that implies a full-file overwrite.

### Dimension `B7` (6)

**`build-foundations`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** SKILL.md ends at Step 10 Summary (232-248) and Rollback (252-259). There is no 'After Completion' / self-learning step instructing to append user corrections to gotchas.md. Sibling check P11 expects this in pipeline skills.
- **Problem:** The skill injects gotchas.md at runtime (good) but has no closing step telling the model that if the user corrected the approach mid-run, it should append that correction (with date/context) to .claude/skills/build-foundations/gotchas.md. Without the write-back half of the loop, the dynamic-gotchas mechanism only ever consumes; new lessons from a session are lost unless the user separately runs /learnings.
- **Recommendation:** Add a final 'After Completion' section: 'If the user corrected your approach during this run (naming, binding, layout, alpha handling), append a dated bullet describing the correction to .claude/skills/build-foundations/gotchas.md so future runs inherit it.' Keep it consistent across pipeline skills.

**`propose-components`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** Grep across .claude/skills for self-update patterns ('append.*gotchas', 'After Completion', 'if the user corrected') returns only .claude/skills/learnings/SKILL.md. propose-components/SKILL.md ends at Step 10 Summary (lines 192-208) and Notes (212-221) with no After-Completion / learning-capture step.
- **Problem:** P11 requires pipeline skills to carry a self-updating 'After Completion' step: if the user corrected the approach during execution (e.g. overrode a skip/include decision or a variant classification), append the correction with date/context to this skill's gotchas.md. This skill makes many user-confirmed judgement calls (scope, include/skip, variant vs instance-property bucketing) — exactly the cases that generate corrections — but provides no mechanism to capture them. The standalone /learnings skill is a separate manual review pass, not the per-skill self-update the project's chosen mechanism prescribes.
- **Recommendation:** Add a short '## After Completion' section instructing: if the user overrode any selection or variant/instance-property classification during this run, append a dated note (decision, what the user preferred, why) to .claude/skills/propose-components/gotchas.md so future runs reflect it. Mirror the phrasing used elsewhere in the project's self-learning convention.

**`refresh-figma-practices`** — `B7` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/refresh-figma-practices/SKILL.md:127-140 (Step 6 'Summary' is the final section; no 'After Completion' learning step) and :11 injects gotchas.md but nothing writes to it
- **Problem:** The skill injects its own gotchas.md at invocation (line 11) but contains no 'After Completion' step instructing it to append a correction to that gotchas.md when the user overrides its approach during a run (P11 self-learning mechanism). The read side of the learning loop is wired; the write side is missing, so corrections are never persisted and the injected file stays empty forever. Note this is a system-wide pattern (only the 'learnings' skill has anything resembling a write-back step), so it is a convention gap rather than a regression unique to this skill.
- **Recommendation:** Add a short 'After Completion' section: 'If the user corrected the research scope, source selection, or how a change was applied during this run, append a dated note (date + context + correction) to .claude/skills/refresh-figma-practices/gotchas.md.' Apply the same step across pipeline/maintenance skills for consistency, ideally via the refresh/learnings loop.

**`setup`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md ends at Step 5 + "If manifest already exists" (line 157). No "After Completion" / self-learning section. Grep for "after completion" across all skills returns none.
- **Problem:** P11 expects pipeline skills to include an "After Completion" step instructing the agent to append user corrections (with date/context) to this skill's `gotchas.md` — the project's chosen self-learning mechanism. Setup lacks it. (Caveat: NO skill in the system currently has this section, so this is a system-wide gap, not unique to setup; I flag it here per the per-skill rubric.) Without it, corrections made during a setup run — e.g. a new Figma URL shape the parser missed — are lost rather than captured.
- **Recommendation:** Add a short final section: "## After Completion — If the user corrected your approach during setup (e.g. an unrecognized Figma URL format, a password-field selector, a URL-accessibility edge case), append the correction with today's date and brief context to `.claude/skills/setup/gotchas.md`." Recommend the team apply the same block consistently across all pipeline skills.

**`sync-colors`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** No 'After Completion' / learning-loop section in SKILL.md (grep for 'After Completion|corrected|append' returns nothing). Every other skill in the repo matches the learning-loop grep (analyze-theme, build-foundations, build-components, compose-page, propose-components, validate-instances, etc.).
- **Problem:** sync-colors is the only color-related skill with no self-updating 'After Completion' step instructing the model to append user corrections (with date/context) to this skill's gotchas.md. This is the project's chosen self-learning mechanism (criterion P11). Without it, lessons learned during a sync (e.g. a theme with a non-standard scheme key, an alpha-handling correction) are never captured, and the gotchas-cat line at the top has no producer feeding it.
- **Recommendation:** Add an 'After Completion' section mirroring the sibling skills: 'If the user corrected the approach during this sync (e.g. a mapping, a conversion edge case, a scheme-key mismatch), append the correction with date and context to .claude/skills/sync-colors/gotchas.md.' Create the gotchas.md (even a stub) so the cat on line 11 has a real sink.

**`validate-shopify`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:412-456 final section is 'Edge Cases and Special Handling'; there is no 'After Completion' / learning-capture step anywhere (grep for 'After Completion'/'append'/'gotchas.md' in body returns nothing relevant).
- **Problem:** SKILL.md has no 'After Completion' step instructing that if the user corrected the validation approach during execution (e.g. a false positive on a valid Shopify pattern), the correction should be appended with date/context to this skill's gotchas.md. This is the project's chosen self-learning loop and is missing here, so this skill cannot accumulate the kind of 'some violations are intentional patterns' knowledge it explicitly depends on.
- **Recommendation:** Add a short 'After Completion' section directing the model to append any user correction (date + context) to .claude/skills/validate-shopify/gotchas.md, mirroring the pipeline skills.

### Dimension `C1` (5)

**`system`** — `C1` · status: adjusted · confidence: high · effort: M

- **Evidence:** .claude/skills/build-design-system/SKILL.md:4 "Use when: running the full pipeline end-to-end" vs the 6 phase skills, e.g. build-foundations/SKILL.md:4 "Use when: creating Figma variables, text styles, or style guide from analyzed tokens" and build-components/SKILL.md:4 "Use when: constructing atoms, blocks, or sections in Figma"
- **Problem:** The orchestrator and the 6 phase skills share the same intent space ("build the Shopify-to-Figma design system") but the descriptions give the model no rule for choosing whole-pipeline vs single-phase. A broad user request such as "build my design system from the theme" or "create the Figma variables and components for this store" matches both the orchestrator ("full pipeline") and one or more phase skills (build-foundations, build-components) on overlapping keywords (build / Figma / design system). The model may pick a single phase skill and run only that phase, silently skipping the upstream phases the pipeline requires. The CLAUDE.md rule "NEVER skip a pipeline phase — each depends on the previous" is therefore enforced only by each skill body's manifest pre-flight, not by the trigger text, so the wrong-skill selection is not prevented at routing time — it only fails later with a "Run /X first" message, costing a round-trip and risking a partially-built file if the user overrides.
- **Recommendation:** Make the orchestrator the explicit default for any end-to-end/multi-phase request and scope each phase skill as a single-step, resume-only entry. E.g. build-design-system: "Use when the user wants to build or resume the ENTIRE Shopify-to-Figma design system, or names two or more phases, or gives no phase. Prefer this over any single phase skill unless the user explicitly scopes to one step." And prepend each phase description with an ordinal + exclusivity clause, e.g. build-foundations: "Pipeline phase 3 (after analyze-theme). Use ONLY when the user explicitly asks for foundations/variables/text-styles alone; for a full build use build-design-system." Repeat the "for a full build use build-design-system" cross-reference in all 6 phase descriptions.

**`system`** — `C1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/analyze-theme/SKILL.md:4 "Use when: extracting design tokens from a Shopify theme, or when manifest has no foundations data" vs build-foundations/SKILL.md:4 "Use when: creating Figma variables, text styles, or style guide from analyzed tokens"
- **Problem:** These are adjacent pipeline phases (analyze-theme extracts tokens into the manifest; build-foundations turns those tokens into Figma variables). The descriptions overlap on the token concept ("design tokens" / "analyzed tokens") and both reference foundations. A request such as "set up the design tokens / foundations from the theme" maps to both: analyze-theme owns extraction, build-foundations owns the Figma realization, but the user's mental model often conflates "get the tokens" with "create the variables." Mis-trigger risk: the model jumps straight to build-foundations when no foundations data exists yet, which its body would reject ("Run /analyze-theme first"), or runs analyze-theme when the user already has tokens and wanted the Figma variables built. The clause "or when manifest has no foundations data" in analyze-theme is a good machine-state anchor, but build-foundations has no symmetric "requires foundations data" anchor in its description.
- **Recommendation:** Add the reciprocal state anchor to build-foundations and sharpen the verb split: analyze-theme: "…EXTRACTS tokens from theme files into the manifest (no Figma writes)." build-foundations: "Use when creating Figma variables/text-styles/style-guide FROM already-extracted tokens; requires analyze-theme to have populated foundations in the manifest first." Leading each with its distinct verb (EXTRACT vs CREATE-IN-FIGMA) and stating the manifest precondition removes the conflation.

**`system`** — `C1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/propose-components/SKILL.md:4 "Use when: planning which sections/blocks become Figma components" vs build-components/SKILL.md:4 "Use when: constructing atoms, blocks, or sections in Figma"
- **Problem:** propose-components is the planning/selection phase (decide which sections/blocks to include and their variants); build-components is the construction phase. Both descriptions center on "sections/blocks" + "Figma components," differing only by the verbs planning vs constructing. A generic request — "let's do the components," "work on the Figma components for these sections" — does not state plan-vs-build and can route to build-components directly, skipping the proposal/confirmation step that build-components' own pre-flight requires (components.status === "confirmed"). Consequence: the construction skill is selected first, immediately bounces with "Run /propose-components first," wasting a turn; or if the model improvises it could attempt to build an unconfirmed inventory.
- **Recommendation:** Foreground the plan-vs-build verb and the handoff artifact. propose-components: "Use when DECIDING/PLANNING which sections & blocks become components and their variants (produces the confirmed inventory). Nothing is built in Figma here." build-components: "Use when ACTUALLY CONSTRUCTING the already-confirmed inventory in Figma (atoms/blocks/sections); requires propose-components to have confirmed the inventory first." The "produces the confirmed inventory" / "requires the confirmed inventory" pairing makes the ordering explicit to the router.

**`system`** — `C1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:4 "Use when: assembling page templates from section instances" vs build-components/SKILL.md:4 "Use when: constructing atoms, blocks, or sections in Figma"
- **Problem:** build-components has a sub-phase that builds SECTION components, while compose-page INSTANTIATES those section components into a full page. Both descriptions reference "sections"; build-components says "constructing … sections in Figma" and compose-page says "assembling page templates from section instances." A request like "build the homepage sections in Figma" is genuinely ambiguous between (a) creating the section components (build-components sections-desktop/mobile) and (b) composing the page from existing section instances (compose-page). Mis-trigger could run compose-page before sections exist (its pre-flight requires sections-desktop and sections-mobile complete) or run build-components when the user wanted the assembled page. The word "page" is the only differentiator and it is easy to miss when the user says "sections."
- **Recommendation:** Emphasize the instance-assembly-of-existing-components nature of compose-page and the create-the-component nature of build-components: compose-page: "Use when ASSEMBLING a full page/template by INSTANTIATING already-built section components in order; does not create new components — for that use build-components." build-components: "…CONSTRUCTS the section/atom/block components themselves (not page layouts; to lay out a page from sections use compose-page)." This converts the lone keyword "page" into an explicit cross-reference.

**`system`** — `C1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/sync-colors/SKILL.md:4 "Use when: syncing color schemes between Figma and Shopify" vs validate-instances/SKILL.md:4 "Use when: auditing Figma file for instance compliance" and validate-shopify/SKILL.md:4-6 (color_scheme / settings_data validation)
- **Problem:** sync-colors is a bidirectional color writer between Figma variables and Shopify settings_data.json. It overlaps the validators on the shared subject (color schemes live in both the Figma file that validate-instances audits and the settings_data.json that validate-shopify checks). A request like "make sure the colors match between Figma and Shopify" or "check the color schemes" can route to sync-colors (which would WRITE changes) when the user only wanted a read-only check, or to a validator when the user wanted an actual sync. The risk is asymmetric and higher-impact than the other color overlaps because sync-colors mutates files (settings_data.json writes require backup/diff/approval per CLAUDE.md), so a mis-trigger toward sync-colors on a "just check" request is a write where a read was intended.
- **Recommendation:** Mark sync-colors as a mutating, direction-taking action and steer read-only intents elsewhere: "Use when you want to actively COPY/WRITE color scheme values Figma->Shopify or Shopify->Figma (takes a direction; writes settings_data.json with backup+approval). To only CHECK colors without changing files, use validate-instances (Figma) or validate-shopify (theme JSON)." Adding "writes/changes files" vs "only check" disambiguates sync vs validate intents.

### Dimension `C2` (4)

**`build-foundations`** — `C2` · status: unverified · confidence: high · effort: S

- **Evidence:** SKILL.md:59 "Use `{Group}/Base` for the primary (fully opaque) swatch in each color group." vs reference/color-schemas.md:16 "Opaque colors (a >= 0.99) → alias to the base variable (e.g., `Grey/900`)" and reference/alpha-variants.md:19 "matching RGB to ... `Grey/900`". figma-best-practices.md:125 also uses `Grey/900` (no /Base).
- **Problem:** Inconsistent base-variable naming across the skill's own files. Step 2 renames the opaque primary to `{Group}/Base` (e.g. Grey/Base), but the alpha-variant matching (Step 3.5) and the Color Schemas alias procedure (Step 4) both assume the opaque variable is named `Grey/900`. If Step 2 is followed literally, the opaque scheme colors in Step 4 will fail RGB matching against a variable that no longer carries the numeric name, triggering the 'STOP and warn' path on legitimately-present colors. At minimum it is contradictory guidance; at worst it breaks alias binding.
- **Recommendation:** Pick one convention and apply it everywhere. Either (a) keep numeric names (Grey/900) for ALL swatches incl. the opaque base and drop the {Group}/Base rule, or (b) keep {Group}/Base and update color-schemas.md and alpha-variants.md examples to alias/match the base by its /Base name. Given the alpha-variant child naming is `Grey/900/81`, option (a) is the more internally consistent choice.

**`validate-shopify`** — `C2` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/validate-shopify/reference/common-schema-gotchas.md:1 title 'Common Shopify Schema Gotchas' lives under reference/ and is named common-schema-gotchas.md; meanwhile 4 sibling skills keep learnings in a top-level gotchas.md (build-components/, build-foundations/, compose-page/, propose-components/).
- **Problem:** The project convention splits two concerns: a per-skill gotchas.md (runtime-injected, self-updating learnings) vs reference/*.md (static domain detail). validate-shopify collapses them: a file literally about 'gotchas' lives in reference/ and there is no gotchas.md. This is a terminology/structure inconsistency that makes the self-learning convention not apply (see P2/P11 findings). Note validate-shopify is a maintenance/validation skill, not one of the pipeline skills P1 strictly mandates a gotchas.md for, so this is a consistency issue rather than a hard rule break.
- **Recommendation:** Keep common-schema-gotchas.md as static reference (it is genuinely domain reference — rename to e.g. reference/schema-rules.md to avoid the 'gotchas' name clash) and add a separate top-level gotchas.md for runtime learnings, aligning with the other skills.

**`system`** — `C2` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/build-foundations/SKILL.md:215-223 "### Figma API gotchas for this skill:" (createVariable pass OBJECT not ID / setBoundVariable lineHeight forces PIXELS / blendMode NORMAL / rejects HUG for primaryAxisSizingMode / text nodes FILL+HEIGHT) duplicates .claude/skills/build-foundations/gotchas.md:22-35 almost verbatim
- **Problem:** The same Figma Plugin API gotcha list lives twice inside one skill — once in SKILL.md Step 8 and once in gotchas.md. They are near-identical, so they will drift: a fix to one (e.g. the lineHeight value 110 vs X) silently leaves the other stale. The SKILL.md already loads gotchas.md at the top via the `!cat` header, so the inline copy is redundant on every run.
- **Recommendation:** Delete the inline "Figma API gotchas for this skill" block from build-foundations/SKILL.md:215-223. Keep gotchas.md as the single home (it is auto-prepended by the line-11 loader). If a few are load-bearing for a specific step, reference them by one line: "See gotchas.md (auto-loaded above) for lineHeight/blendMode/HUG quirks."

**`system`** — `C2` · status: unverified · confidence: high · effort: M

- **Evidence:** Figma-API quirks restated across files: lineHeight→PERCENT at build-foundations/SKILL.md:103,125,217 + gotchas.md:22-23; text-node FILL+HEIGHT at build-components/SKILL.md:60-65,140,204-208, compose-page/SKILL.md, build-foundations/SKILL.md:221, both gotchas.md, AND figma-best-practices.md; blendMode NORMAL at build-foundations/SKILL.md:218 + gotchas.md:33; primaryAxisSizingMode HUG→AUTO at build-foundations/SKILL.md:219 + gotchas.md:32 + compose-page/SKILL.md:137
- **Problem:** Plugin-API-level invariants (text nodes must FILL+HEIGHT after append; lineHeight must be PERCENT not a bound variable; shadows need blendMode NORMAL; primaryAxisSizingMode uses AUTO not HUG) are duplicated across 3-5 skills plus the cheatsheet. figma-best-practices.md is already declared the canonical "reference for building components programmatically via the Plugin API" (line 6) yet does not contain a consolidated 'use_figma MCP API gotchas' section, so each skill re-derives the same warnings.
- **Recommendation:** Add one canonical section to figma-best-practices.md, e.g. "## use_figma / Plugin API Gotchas", holding: text-node FILL+HEIGHT-after-append, lineHeight-PERCENT, blendMode NORMAL, primaryAxisSizingMode AUTO, createVariable-takes-object, paint-opacity-not-alpha, layout-flush. Then have each skill cite it (build-components already references the file at line 26 — extend that pattern) instead of restating. Keep at most a one-line pointer in skill-specific gotchas.md.

### Dimension `C3` (3)

**`system`** — `C3` · status: unverified · confidence: high · effort: M

- **Evidence:** Only 4 skills have gotchas.md (build-components, build-foundations, compose-page, propose-components) — verified via `find . -name gotchas.md`. 5 skills have reference/ (analyze-theme, build-components, build-foundations, propose-components, validate-shopify). The remaining (build-design-rules, build-design-system, learnings, refresh-figma-practices, setup, sync-colors, validate-instances) are flat. No README or CLAUDE.md rule states when each structure applies.
- **Problem:** There is no principled, documented rule for skill sub-structure. gotchas.md presence correlates loosely with 'Figma-mutating build skills' but is not stated anywhere, and the `!cat .../gotchas.md` loader is present in 10 of 13 SKILL.md (including 6 skills that have NO gotchas.md, where it always prints the 'No gotchas yet.' fallback), while 3 skills (build-design-system, learnings, validate-shopify) omit the loader entirely. This makes it ambiguous whether adding a gotcha to, say, sync-colors should create sync-colors/gotchas.md (the loader is there waiting) or not.
- **Recommendation:** Document the convention once in CLAUDE.md (Architecture section): e.g. 'Every user-invocable skill carries the gotchas.md loader header; reference/ holds long procedures hoisted out of SKILL.md.' Then make it true uniformly: add the standard line-11 `!cat .../gotchas.md` loader to build-design-system, learnings, and validate-shopify so all 13 share the identical header, OR explicitly state which skill classes are exempt and why. Canonical loader form is the one used by the 10 conforming skills (e.g. analyze-theme/SKILL.md:10-12).

**`system`** — `C3` · status: unverified · confidence: high · effort: M

- **Evidence:** validate-shopify/SKILL.md:14-17 loads its reference via a Markdown blockquote `> **Reference:** Before running validation, review .claude/skills/validate-shopify/reference/common-schema-gotchas.md`, and has NO `!cat` loader header and NO gotchas.md. Every other reference-bearing skill loads reference docs with inline prose `See .claude/skills/<skill>/reference/<file>.md ...` (analyze-theme/SKILL.md:49,57; build-components/SKILL.md:52,89,112; build-foundations/SKILL.md:77,85,188) and carries the line-11 gotchas loader.
- **Problem:** validate-shopify is a structural outlier on three axes at once: (a) it is the only reference/ skill whose reference file is named *common-schema-gotchas.md* yet is treated as a reference doc, not loaded by the gotchas loader; (b) it uses a blockquote idiom for the reference pointer rather than the inline-prose 'See ...' idiom used everywhere else; (c) it alone among reference-bearing skills lacks the `!cat gotchas.md` header. A reader cannot tell whether that file is a 'reference' or a 'gotchas' artifact.
- **Recommendation:** Normalize to the house style: rename validate-shopify/reference/common-schema-gotchas.md to a reference-style name (e.g. schema-edge-cases.md) to avoid the 'gotchas' overload, convert the blockquote at lines 14-17 into the standard inline `See .claude/skills/validate-shopify/reference/<file>.md for ...` form (matching build-components/build-foundations), and add the standard line-11 gotchas loader header so its top matches the other 10 skills.

**`system`** — `C3` · status: unverified · confidence: high · effort: S

- **Evidence:** sync-colors/SKILL.md:205 `- \`Color/Gray/{shade}\` in Primitives, or \`Grey/{shade}\` in Grey Scale collection` uses American "Gray". Every other occurrence uses British "Grey": build-foundations/SKILL.md:67-71 "Grey Scale Collection", build-design-rules/SKILL.md:136 "Grey Scale", figma-best-practices.md:113,115,125,138 "Grey/900", analyze-theme/SKILL.md:77 "grey scale".
- **Problem:** Spelling drift between 'Gray' and 'Grey' inside the SAME line of sync-colors. Because these strings are Figma variable/group names matched programmatically (e.g. sync-colors creates `Color/Gray/{shade}` while build-foundations creates the `Grey Scale` collection), the mismatch can produce two parallel grey groups or a failed lookup during round-trip sync.
- **Recommendation:** Standardize on 'Grey' everywhere (it is the dominant spelling and the one build-foundations actually creates). Change sync-colors/SKILL.md:205 `Color/Gray/{shade}` → `Color/Grey/{shade}`. Optionally note the canonical term in CLAUDE.md so future edits don't reintroduce 'Gray'.

### Dimension `C4` (6)

**`build-components`** — `C4` · status: adjusted · confidence: high · effort: M

- **Evidence:** SKILL.md:134 "Read source block files listed in `sourceBlocks`". Verified `'sourceBlocks' in json.dumps(manifest)` -> False. Actual block data is components.blocks.universal[] (each {name,type,usageCount,reason}) and components.blocks.sectionSpecific[slug][].
- **Problem:** The Blocks phase instructs reading source files from a manifest field (sourceBlocks) that does not exist. The agent has no defined path from a block entry to its liquid/snippet source, so it will either stall or improvise file lookups, undermining the 'reads from manifest as source of truth' contract (P7).
- **Recommendation:** Point the Blocks phase at the real structure: iterate components.blocks.universal and components.blocks.sectionSpecific[slug]; map each block by its `type` to the theme block/snippet file (e.g. blocks/{type}.liquid or the integrated section). Either store an explicit source path in propose-components' block objects and read it here, or document the type→file resolution rule. Remove the dangling `sourceBlocks` reference.

**`propose-components`** — `C4` · status: unverified · confidence: high · effort: M

- **Evidence:** SKILL.md:164 lists the components write as 'atoms, blocks, sections (with both variants and instanceProperties per section), skippedSections, and scope'. The generator at .claude/scripts/generate-proposal-html.js:413-419 also reads sec.variableProperties, sec.totalVariantCombinations (combos.desktop/mobile/note) and sec.reason per section, plus blocks.universal[].usageCount/usedInSections and atoms[].sourceFile/reason — none of which Step 8 tells the model to write.
- **Problem:** Step 8's manifest-write description under-specifies the schema the Step 9 generator actually consumes. variableProperties (the color_scheme bucket that Phase B Step 6 explicitly produces), per-section totalVariantCombinations, and the per-section/per-atom/per-block reason fields are rendered by the HTML but never listed as required outputs. A model following Step 8 literally can produce a manifest that passes the generator's only guard (summary present) yet renders an HTML proposal with empty Variables tabs, missing combo counts, and blank reasons — silently degraded output.
- **Recommendation:** Expand Step 8 to enumerate the full per-section shape the generator expects (variants, instanceProperties, variableProperties, totalVariantCombinations{desktop,mobile,note}, reason) and the per-atom (name, sourceFile?, reason) / per-universal-block (name, type, usageCount, usedInSections, reason) fields. Ideally point to a single documented manifest schema so Step 8 and the script cannot drift.

**`validate-instances`** — `C4` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-instances/SKILL.md:18 declares '**Manifest path:** `.claude/figma-sync/manifest.json`' but no step reads it or checks prerequisites; contrast analyze-theme/SKILL.md:22-24 'Pre-flight ... If it doesn't exist, tell the user: "Run `/setup` first"'.
- **Problem:** The skill names the manifest but never reads it, and has no pre-flight verifying that a built design system exists (e.g. buildStatus.foundations/components complete) before auditing. Run against an empty or pre-build Figma file, Step 1 returns an empty component registry and Step 2 reports a vacuously 'clean' result, giving false assurance. There is no routing to a prerequisite phase (e.g. 'Run /build-components first').
- **Recommendation:** Add a pre-flight: read manifest.json; if missing, tell the user to run /setup; if no components have been built (registry would be empty / buildStatus indicates components not complete), tell the user to run /build-components first instead of producing a misleading clean report. Either use the declared manifest path or remove the line.

**`system`** — `C4` · status: unverified · confidence: high · effort: M

- **Evidence:** build-design-rules/SKILL.md exists and writes buildStatus.designRules (:150) + design-rules.json. It is consumed: build-components/SKILL.md:28 and compose-page/SKILL.md:73 read design-rules.json. But grep for 'design-rules|build-design-rules|designRules' in CLAUDE.md and build-design-system/SKILL.md returns EMPTY. CLAUDE.md:24 pipeline line and :28-34 maintenance list omit it. build-foundations:247 and propose-components:207 'Next step' chains skip straight to the next build phase; build-components:265 'Next step' points to compose-page, never to build-design-rules.
- **Problem:** build-design-rules is an orphaned phase: it produces design-rules.json that build-components and compose-page opportunistically consume ('if exists'), yet no pipeline document, orchestrator, or skill 'Next step' ever tells the user/agent to run it, and it isn't listed under Pipeline or Maintenance in CLAUDE.md. In practice design-rules.json will essentially never exist when build-components/compose-page look for it, so the cross-reference logic (e.g. compose-page:73 componentMap name-matching fallback) is dead. Its own pre-flight (B1-02) is also unsatisfiable, compounding the orphaning.
- **Recommendation:** Decide build-design-rules' place in the contract: either insert it into the pipeline (e.g., after build-components, before compose-page) and list it in CLAUDE.md + orchestrator + the relevant 'Next step' footers, or explicitly document it as an optional standalone tool like /sync-colors. Then fix its pre-flight (B1-02) so it can actually run.

**`system`** — `C4` · status: unverified · confidence: high · effort: S

- **Evidence:** analyze-theme/reference/profile-validation.md:78 'Store `theme.profileValidation` in the manifest with the results so downstream skills know which parts of the profile are reliable'. build-foundations/SKILL.md:29 reads it: 'check `theme.profileValidation` in the manifest (set by /analyze-theme)… If a section shows "diverged" → ignore the profile'. But analyze-theme/SKILL.md Step 4 'Write to Manifest' (lines 126-163) documents writing ONLY the `foundations` object — its JSON block never includes `theme.profileValidation` or updating `theme.hasProfile`. Real manifest.json:19-25 DOES contain a populated profileValidation, so it works in practice, but the skill's own write spec omits it.
- **Problem:** The write contract for `theme.profileValidation` is split across files and under-specified in the authoritative skill. The behavior is mandated only in a reference doc (profile-validation.md) and in pre-flight prose (analyze-theme:31 sets hasProfile), while the skill's explicit Step 4 write block — the part an agent most directly follows — shows a manifest update containing only `foundations`. An agent following Step 4 literally would not persist profileValidation/hasProfile, silently breaking build-foundations' profile-divergence gating (it would treat absent validation as… undefined, neither 'match' nor 'diverged').
- **Recommendation:** In analyze-theme Step 4, make the documented manifest write explicitly include the `theme` updates: set theme.hasProfile and theme.profileValidation (the Step 1.5 results) alongside foundations. Mirror the same key set that the real manifest already demonstrates, so the skill text and the reference doc agree.

**`system`** — `C4` · status: unverified · confidence: high · effort: S

- **Evidence:** build-components/SKILL.md:46 '**Practices version check:** … Compare with `buildMeta.practicesVersion` in the manifest. If newer → warn'. grep 'buildMeta|practicesVersion' across .claude returns ONLY this single read at build-components:46 — no skill ever writes buildMeta or practicesVersion. Real manifest.json and manifest-test.json contain no `buildMeta` key. refresh-figma-practices updates .claude/figma-best-practices.md's Version date but does not stamp the manifest.
- **Problem:** `buildMeta.practicesVersion` is a read-only-by-no-writer field. build-components attempts to compare the best-practices doc's Version against buildMeta.practicesVersion to warn about stale builds, but nothing ever writes buildMeta.practicesVersion (not build-components after a build, not refresh-figma-practices). The staleness check is therefore inert: buildMeta is always undefined, so either the comparison no-ops or always 'warns', defeating its purpose.
- **Recommendation:** Either have build-components stamp `buildMeta.practicesVersion` (and likely buildMeta.builtAt) into the manifest when it completes a phase, and/or have refresh-figma-practices clear/flag it, so the comparison at build-components:46 has a real value to read. If the staleness feature isn't wanted, remove the dead check.

### Dimension `C5` (5)

**`build-foundations`** — `C5` · status: adjusted · confidence: high · effort: S

- **Evidence:** SKILL.md:23-31 Pre-flight checks manifest (foundations not null, figmaFileKey, buildStatus) but never verifies the Figma MCP tools are available. SKILL.md:19 "Method: Figma MCP (use_figma ... get_screenshot)". MEMORY index: 'STOP if required tools missing — never proceed without required MCP tools'.
- **Problem:** The skill's entire job depends on mcp__figma__use_figma and mcp__figma__get_screenshot, yet there is no guard that stops and asks the user to fix the connection if those tools are missing/unauthenticated. The project's encoded learning (feedback_missing_tools) and the global audit requirement mandate: if a required MCP tool is missing, STOP and ask the user — never silently proceed. Without this, a missing/disconnected Figma MCP leads to the model improvising (e.g., falling back to prose or partial work) instead of halting.
- **Recommendation:** Add a Pre-flight step 0: 'Verify the Figma MCP tools (use_figma, get_screenshot) are available. If not, STOP and tell the user to connect/authenticate the Figma MCP server — do not proceed or attempt workarounds.' Consider centralizing this as a shared instruction referenced by all Figma-building skills (build-components, compose-page) for consistency.

**`compose-page`** — `C5` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:21 "Figma MCP (`use_figma` + `get_screenshot`) for all Figma operations. Chrome DevTools MCP for final validation" — and the Pre-flight (lines 25-34) contains no tool-availability check; grep for "missing/STOP/unavailable" returns nothing in this skill.
- **Problem:** This skill depends on two MCP families (mcp__figma__* and mcp__chrome-devtools__*) but has no guard that STOPS and asks the user if a required MCP tool is missing. Its sibling build-components explicitly does this ('If any required MCP tool is missing → STOP immediately. Do NOT proceed without it.', build-components/SKILL.md:40). Per the GLOBAL check and CLAUDE.md/team-learning feedback_missing_tools, a skill must never silently proceed without required tools. Without Figma MCP nothing can be composed; without Chrome DevTools the Step 6 live-store comparison silently degrades.
- **Recommendation:** Add a Pre-flight step 0: 'Required tools: use_figma + get_screenshot (Figma build/verify), and Chrome DevTools MCP (navigate_page, take_screenshot, resize_page) for live-store validation. If any required MCP tool is missing → STOP immediately and ask the user to enable it. Do NOT proceed.' Mirror the wording already used in build-components for consistency.

**`compose-page`** — `C5` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:175 "Using Chrome DevTools MCP, navigate to the store URL + template path, take screenshots at both viewports, and compare section-by-section." — no handling of config.storePassword (which exists in manifest.config) and no 'store inaccessible → STOP' note.
- **Problem:** The live-store comparison navigates to storeUrl but ignores config.storePassword (present in the manifest). Shopify dev/unpublished themes are password-gated; navigating to such a store returns a password splash screen, which would be screenshotted and 'compared' against the Figma composition — producing a meaningless or misleading validation that may be silently rationalized as a discrepancy. build-components handles this with 'If the store is inaccessible at any point → STOP and ask user' (build-components/SKILL.md:247); compose-page has no equivalent.
- **Recommendation:** In Step 6, instruct: read config.storeUrl and config.storePassword; if a password is set, enter it on the storefront password page (or note the store must be made accessible) before capturing reference screenshots. If the store cannot be reached or only the password page loads → STOP and ask the user rather than comparing against a login screen.

**`refresh-figma-practices`** — `C5` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/refresh-figma-practices/SKILL.md:33 "Use web search to investigate:" (allowed-tools line 7 lists [WebSearch, WebFetch, ...])
- **Problem:** The skill's entire output depends on WebSearch/WebFetch, but there is no guard for the case where web tools are unavailable, blocked, or return no usable results. The GLOBAL rule and C5 require a skill to STOP and ask the user to fix missing/non-functional required tooling rather than silently proceeding. Without this, a failed or empty search could lead the skill to fabricate 'updates', invent sources, or rewrite the cheatsheet's Version/Last-researched dates (Step 5) with no real research behind them — actively degrading a trusted reference doc.
- **Recommendation:** Add a pre-flight/guard near Step 2: if WebSearch/WebFetch is unavailable or returns no results, STOP and tell the user (e.g. 'Web research tools are unavailable; cannot refresh practices — please enable web search'). Explicitly forbid bumping the Version / Last researched dates in Step 5 when no real sources were gathered, and require every proposed change to cite a fetched source URL.

**`system`** — `C5` · status: unverified · confidence: medium · effort: M

- **Evidence:** validate-shopify/SKILL.md (Execution Checklist, lines 384-409) has no tool-availability pre-flight; compose-page/SKILL.md:26-34 Pre-flight checks manifest fields but never verifies use_figma / chrome-devtools tools before use; contrast build-components/SKILL.md:37-40.
- **Problem:** compose-page and validate-shopify never verify their declared MCP tools before relying on them. compose-page depends on use_figma + chrome-devtools but its Pre-flight only checks manifest buildStatus; if the Figma or Chrome MCP is down it will fail mid-composition rather than stopping cleanly up front. This is the same class of gap as sws-C5-04 but on non-writing skills, confirming the missing-tool check is applied ad hoc rather than as a system property.
- **Recommendation:** Add the standardized pre-flight required-tools check to every MCP-dependent skill (compose-page, validate-instances, build-foundations, sync-colors, setup, build-design-rules), so 'STOP when a required tool is missing' becomes a uniform system invariant instead of a per-skill accident.

### Dimension `C6` (2)

**`sync-colors`** — `C6` · status: unverified · confidence: medium · effort: M

- **Evidence:** grep for backup/.bak/diff/approval across validate-shopify/SKILL.md and the skills tree returns no Shopify-write backup pattern in any skill; sync-colors:186 writes settings_data.json with none. CLAUDE.md:19 mandates it for ALL writes.
- **Problem:** Cross-cutting: the backup-before-write requirement appears to be enforced by no skill that writes Shopify JSON, not just sync-colors. This means the same critical gap (sync-colors-B4-01) likely recurs system-wide, so a fix limited to sync-colors leaves the convention unenforced and inconsistent across writing skills.
- **Recommendation:** Define one canonical backup convention (path + timestamp format) — ideally a shared scripts/backup-shopify.js or a documented step in figma-best-practices.md — and reference it from every skill that writes config/*.json (sync-colors and any other writer). Audit sibling writing skills to apply backup+diff+approval uniformly. (Flagged as cross-cutting; primary fix is sync-colors-B4-01.)

**`system`** — `C6` · status: unverified · confidence: medium · effort: M

- **Evidence:** sync-colors/SKILL.md:183 "Read current `config/settings_data.json` and compare. Show changed values only. **Wait for user approval.**"; SKILL.md:164 "Display new variables, changed aliases, and orphaned variables. **Wait for user approval.**"; no step reads back / unified-diffs the file post-write beyond "Step 5: Verify / Re-read the file and confirm values match" (line 188-189).
- **Problem:** The 'diff preview' required by CLAUDE.md:19 is implemented in sync-colors as a hand-assembled 'changed values only' list, not a true file/JSON diff. This can under-report damage: incidental edits to non-color keys, whitespace/key-order rewrites from a full Write (see sws-C8-02), or fields the change-plan logic doesn't classify as 'color' would not surface in the preview the user approves. Approval is thus granted against an incomplete representation of the actual write.
- **Recommendation:** Make the preview a real diff of the serialized before/after file (or at minimum assert that only the enumerated color keys changed by re-reading and diffing the JSON, failing loudly if any other key differs). Combined with the backup (sws-C6-01), this gives a trustworthy approval surface and a rollback path.

### Dimension `C7` (2)

**`system`** — `C7` · status: unverified · confidence: high · effort: S

- **Evidence:** CLAUDE.md:24 pipeline `/setup → … → /compose-page` and CLAUDE.md:28-34 Maintenance list. Actual skills (13) include build-design-rules, build-design-system, validate-shopify, learnings — none appear in CLAUDE.md's pipeline or maintenance sections (`grep build-design-rules CLAUDE.md` = NOT found). README.md:56 and README.md:71,91 DO document build-design-rules, so the two docs disagree.
- **Problem:** CLAUDE.md (the authoritative project-instruction file Claude loads every session) is out of sync with reality and with README. Its pipeline omits the final `/build-design-rules` phase that README documents as the last step, and its Maintenance list omits `/validate-shopify` and `/learnings` (both real, the latter even referenced in MEMORY.md). The pipeline one-liner also doesn't mention build-design-rules. This causes the agent to under-advertise available phases.
- **Recommendation:** Add `/build-design-rules` to CLAUDE.md's pipeline line (after /compose-page, matching README.md:56), and add `/validate-shopify` and `/learnings` to the Maintenance list. Cross-check the CLAUDE.md command set against `ls .claude/skills/` so all 13 are represented.

**`system`** — `C7` · status: unverified · confidence: high · effort: S

- **Evidence:** .gitignore:41 `.claude/figma-sync/theme-profiles/manifest.json`. The real runtime manifest is `.claude/figma-sync/manifest.json` (per CLAUDE.md:9 and manifest read at generate-proposal-html.js:13). `git check-ignore -v .claude/figma-sync/manifest.json` resolves to `.gitignore:6:*` (the wildcard), NOT line 41 — line 41's literal target path does not exist.
- **Problem:** The dedicated 'ignore runtime state' rule points at the wrong path (theme-profiles/manifest.json) and is therefore dead. The actual manifest is still correctly ignored, but only incidentally via the catch-all `*` on line 6. The rule is misleading to maintainers (it implies the manifest lives under theme-profiles/) and would silently fail to protect the manifest if the whitelist were ever restructured to un-ignore the figma-sync directory tree. Note: theme-profiles/ IS partially un-ignored (lines 35-38), so a stray manifest.json placed there would also not be caught by line 41's intent in a way consistent with the comment.
- **Recommendation:** Fix line 41 to `.claude/figma-sync/manifest.json` (and `.claude/figma-sync/proposal.html`, the generator's output, which is likewise only caught by `*`). This makes the protective intent explicit and robust against future whitelist changes.

### Dimension `C8` (5)

**`setup`** — `C8` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:43 "Save the password in the manifest" and :106 `"storePassword": "<password or null>"`. The store password is written verbatim into `.claude/figma-sync/manifest.json`.
- **Problem:** The skill captures the storefront password and persists it in plaintext in the manifest, with zero warning to the user about where their credential is being stored. (Good news verified: the manifest IS git-ignored — `git check-ignore` confirms `.gitignore:6 *` excludes `.claude/figma-sync/manifest.json`, and it is not in the negation re-includes — so it will not be committed. But this is incidental, not stated by the skill, and a user who force-adds or copies the manifest would leak the credential.) Storing a secret silently is a safety/usability gap even when not committed.
- **Recommendation:** Before writing the password: (a) tell the user it will be stored in plaintext at `.claude/figma-sync/manifest.json` and confirm it is git-ignored, and (b) offer to leave `storePassword: null` and re-prompt per session instead. At minimum add a one-line note in Step 1/Step 4 that this file holds a credential and must never be committed or shared. Consider linking the gitignore guarantee explicitly so the safety property is documented, not accidental.

**`setup`** — `C8` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:7 declares `mcp__figma__use_figma, mcp__figma__get_screenshot, ... Glob, Grep`. Body usage (grep) shows only `get_metadata`, `navigate_page`, `take_screenshot`, `fill`, `click`, `Read`, `Write` are ever invoked; `use_figma`, `get_screenshot`, `Glob`, and `Grep` are never used.
- **Problem:** Least-privilege violation: this read-only config skill grants `mcp__figma__use_figma` — the heavyweight Figma create/edit/write tool used by the build-* skills — even though setup only calls `get_metadata` to verify access. It also grants `get_screenshot`, `Glob`, and `Grep`, none of which the body uses. Over-granting the Figma write tool to a skill that should never mutate Figma is the most notable item (it widens blast radius if the model improvises), with the others being harmless-but-untidy.
- **Recommendation:** Drop `mcp__figma__use_figma` and `mcp__figma__get_screenshot` from `allowed-tools` (keep `mcp__figma__get_metadata`). Drop `Glob`/`Grep` unless you intend the manifest/profile-existence checks (lines 70, 100, 151) to use Glob — if so, keep `Glob` and use it explicitly in the body. Result should be a Figma-read + Chrome + Read/Write allowlist matching actual usage.

**`sync-colors`** — `C8` · status: adjusted · confidence: high · effort: S

- **Evidence:** SKILL.md:7 'allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]' vs SKILL.md:186 'Use the Edit tool to update `config/settings_data.json`.'
- **Problem:** The body's documented Shopify write path uses the Edit tool, but Edit is not in allowed-tools (only Write is). Following the instructions literally, the Edit call will be blocked or trigger a permission prompt, breaking the Figma->Shopify direction. This is an internal inconsistency between the allowlist and the procedure: either the allowlist is too restrictive (missing Edit) or the body should say Write. Since a surgical 'only modify color fields' edit of a large JSON file is exactly what Edit is for, the allowlist is the likely defect.
- **Recommendation:** Decide the write mechanism and make them agree. Preferred: add Edit to allowed-tools (Edit is the right tool for a targeted color-field-only change in a large file) and keep 'Use the Edit tool.' Alternatively, if full-file rewrite is intended, change the body to 'Use the Write tool' — but Write risks clobbering non-color fields, contradicting 'Only modify color fields' (line 186). Add Edit and keep the surgical-edit guarantee.

**`validate-shopify`** — `C8` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:9 'allowed-tools: [Read, Glob, Grep, Write]' but :408 instructs '9. **Write report** to stdout (do not write a file unless the user requests it)'.
- **Problem:** The body's core flow explicitly does NOT write files (report goes to stdout), yet Write is granted in allowed-tools. For a read-only validator this is a least-privilege violation: Write is only needed in the optional 'unless the user requests' path. Granting filesystem write to a validation skill widens its blast radius unnecessarily and is inconsistent with the skill's stated read-only purpose.
- **Recommendation:** Drop Write from allowed-tools (the sibling validate-instances keeps Write because it audits-and-can-fix, but this skill states it should not write). If an opt-in 'save report to file' path is genuinely wanted, keep Write but make the body justify it; otherwise restrict to [Read, Glob, Grep].

**`system`** — `C8` · status: unverified · confidence: high · effort: S

- **Evidence:** validate-shopify/SKILL.md:9 allowed-tools: [Read, Glob, Grep, Write]; validate-shopify/SKILL.md:408 "9. **Write report** to stdout (do not write a file unless the user requests it)"; the skill is purely read/validate (Phases 1-5) and never writes Shopify JSON.
- **Problem:** validate-shopify declares the Write tool but is a read-only validator whose own body says not to write a file. Granting Write to a validation skill is over-scoped (least-privilege violation) and slightly dangerous: a validator with filesystem-write capability could, on a misstep, modify the very theme files it is auditing.
- **Recommendation:** Drop Write from validate-shopify allowed-tools; keep [Read, Glob, Grep]. If on-request report-saving is desired, gate it behind an explicit user request and document it, rather than holding Write by default.

### Dimension `C9` (1)

**`sync-colors`** — `C9` · status: unverified · confidence: high · effort: S

- **Evidence:** SKILL.md:6 'context: fork'; sibling validate-instances/SKILL.md:6 'context: inline'. Project decision matrix (audit criterion P4) explicitly: 'Lightweight maintenance skills (sync-colors, validate-instances) are expected to run inline and need not fork.'
- **Problem:** sync-colors sets context: fork, but the project's own research decision matrix classifies sync-colors as a lightweight maintenance skill that should run inline (and its peer validate-instances is correctly inline). Forking a maintenance skill that needs an interactive approval gate ('Wait for user approval', lines 164/183) is counterproductive — the diff/approval interaction is best surfaced in the main conversation, and forking adds isolation overhead with no benefit here.
- **Recommendation:** Change 'context: fork' to 'context: inline' to match the decision matrix and the validate-instances precedent, and to keep the user-approval diff in the main thread. If forking was deliberate (e.g. large variable reads), document the rationale; otherwise align to inline.

### Dimension `P1` (2)

**`analyze-theme`** — `P1` · status: unverified · confidence: high · effort: S

- **Evidence:** Directory listing of .claude/skills/analyze-theme/ shows only SKILL.md and reference/ (no gotchas.md); contrast SKILL.md:11 "!cat .claude/skills/analyze-theme/gotchas.md 2>/dev/null || echo \"No gotchas yet.\"". Survey shows build-components, build-foundations, compose-page, propose-components all HAVE gotchas.md; analyze-theme does not.
- **Problem:** analyze-theme is a core pipeline skill (explicitly named in the P1 mandate alongside build-*, compose-page, propose-components) but has NO gotchas.md. It is the only pipeline skill missing one. The project convention (and the learnings skill, which states 'If no gotchas.md exists for the target skill, create one') treats a per-skill gotchas.md as the primary store for skill-scoped learnings. Without the file, the dynamic-context line on every invocation falls through to the 'No gotchas yet.' fallback and there is no on-disk place for token-extraction learnings (e.g., theme-fork quirks, font-decode edge cases) to accumulate.
- **Recommendation:** Create .claude/skills/analyze-theme/gotchas.md (seed it minimally, e.g. a header plus one real gotcha such as the CSS-vs-settings mobile-typography detection caveat already implied by token-extraction.md sec 2e). The cat path in SKILL.md:11 already points at the correct folder, so no SKILL.md change is needed.

**`setup`** — `P1` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:10-12 contains `!cat .claude/skills/setup/gotchas.md 2>/dev/null || echo "No gotchas yet."`, but `ls .claude/skills/setup/` shows only `SKILL.md` — no `gotchas.md` exists.
- **Problem:** The dynamic-context block references a per-skill `gotchas.md` (P1/P2 mechanism) that does not exist, so it always falls through to "No gotchas yet." Setup is not a `build-*`/analyze/compose skill, so P1 grants partial exemption — but setup has genuine, recurring failure points that warrant captured gotchas: Figma fileKey parsing across URL variants (design vs branch URLs, line 49-51), password-screen automation with `fill`/`click` against unknown selectors (line 38-41), localhost vs myshopify URL handling, and the settings_schema theme_info shape. With no `gotchas.md`, the `/learnings` loop (which Globs `gotchas.md` files) has nowhere to record setup-specific corrections.
- **Recommendation:** Create `.claude/skills/setup/gotchas.md` (even a stub with a header) so the `!cat` resolves to real content and the learnings loop has a target. Seed it with the known fileKey-parsing and password-automation caveats. If the team truly considers setup exempt, document that decision and remove the dangling `!cat` to avoid implying a file that never exists.

### Dimension `P11` (3)

**`analyze-theme`** — `P11` · status: unverified · confidence: high · effort: S

- **Evidence:** Grep for 'after completion|append.*gotchas|if.*corrected|self-updating' across SKILL.md returned NONE. SKILL.md ends at Step 5 Summary (lines 165-178) and a Notes section (182-213); there is no closing self-learning step.
- **Problem:** SKILL.md has no 'After Completion' / self-learning step instructing that if the user corrected the extraction approach during the run (e.g., a mis-parsed setting type, a wrong font decode, an unexpected color-scheme structure), the correction should be appended with date/context to this skill's gotchas.md. This is the project's chosen self-learning mechanism (it should appear in pipeline skills), and its absence means corrections made mid-run are lost rather than captured for next time.
- **Recommendation:** Add a final '## After Completion' section: if the user corrected your token-extraction approach during this run, append the correction (with date + brief context) to .claude/skills/analyze-theme/gotchas.md so future runs benefit. Mirror the wording used by the other pipeline skills for consistency.

**`build-components`** — `P11` · status: unverified · confidence: high · effort: S

- **Evidence:** Grep 'after completion|append.*gotchas|corrected|learning' in SKILL.md -> none. The Summary section (251-266) ends the skill with a status table and 'Next step', with no instruction to capture corrections.
- **Problem:** The skill lacks the project's self-updating 'After Completion' learning step (P11): if the user corrects the approach mid-run, the correction should be appended (with date/context) to this skill's gotchas.md. Without it, the runtime-injected gotchas.md never grows, and the very learnings the pipeline relies on (e.g. the missing screenshot-anomaly rule) won't be captured at the moment they're discovered. All four pipeline skills share this gap.
- **Recommendation:** Add a short 'After Completion' section: 'If the user corrected an approach during this build, append a dated bullet to .claude/skills/build-components/gotchas.md describing the gotcha and the fix, so future runs pick it up via the dynamic injection.'

**`build-design-rules`** — `P11` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:154-166 final section is 'Step 6: Summary' — no 'After Completion' learning step exists anywhere in the file.
- **Problem:** Project mandate P11 requires pipeline skills to include an 'After Completion' (or equivalent) step instructing that if the user corrected the approach during execution, the correction (with date/context) be appended to this skill's gotchas.md. The skill ends at the summary with no such self-learning hook, so the gotchas.md (once created) will never be fed by the skill itself — breaking the project's chosen self-learning loop.
- **Recommendation:** Add a final 'After Completion' section: 'If the user corrected the mapping approach (e.g. a Figma-name→file rule, a token→CSS-var mapping, or a collection name) during this run, append the correction with today's date and brief context to .claude/skills/build-design-rules/gotchas.md.'

### Dimension `P8` (1)

**`build-design-rules`** — `P8` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:26 "Verify `buildStatus.foundations === \"complete\"` and `buildStatus.components` has at least one completed phase"
- **Problem:** The pre-flight gates on `buildStatus.components`, but no skill in the pipeline ever writes that key. build-components/SKILL.md records completion as `buildStatus.atoms`, `buildStatus.blocks`, `buildStatus["sections-desktop"]`, and `buildStatus["sections-mobile"]` (lines 124/150/187/215). `buildStatus.components` will always be undefined, so the guard cannot evaluate as intended — depending on how the model interprets it, the skill will either always fail the pre-flight or (more likely) treat the undefined key loosely and proceed even when zero components were built. The gate that is supposed to enforce 'NEVER skip a pipeline phase' is broken.
- **Recommendation:** Change the check to look for at least one of the real component sub-status keys, e.g. 'Verify buildStatus.foundations === "complete" AND at least one of buildStatus.atoms / buildStatus.blocks / buildStatus["sections-desktop"] / buildStatus["sections-mobile"] is "complete"'. Update the failure message at line 27 to name the prerequisite skill: 'Run /build-foundations and /build-components first.'

---

## ⚪ LOW (48)

### Dimension `A1` (4)

**`build-foundations`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:3-4 description: 'Use when: creating Figma variables, text styles, or style guide from analyzed tokens'.
- **Problem:** The description correctly uses the CSO 'Use when:' trigger form (P3 pass) and lists the WHAT-areas, but it is on the thin side for trigger coverage: it omits concrete user phrasings and the key contextual cue that this is the post-analyze-theme phase. It could undertrigger when a user says e.g. 'set up the Figma color schemes / token collections' or 'build the foundations page' without saying 'variables/text styles'.
- **Recommendation:** Slightly broaden and make it pushier, e.g. 'Use when: building the Figma foundations after /analyze-theme — creating variable collections (theme colors, grey scale, color schemas, typography, spacing), text styles, or the visual style guide from analyzed tokens. Also when the user says build foundations / set up Figma variables / create token collections.' Keep metadata ~under 100 words.

**`learnings`** — `A1` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/learnings/SKILL.md:124-130 "### When to run this skill — After completing a full design system build / After encountering unexpected issues ... / Periodically (monthly) ..."
- **Problem:** These are 'when to use' triggers, which per A1/skill-creator must live in the description (so the model sees them at trigger time, not only after the skill is already loaded). Putting them in the body adds no triggering value and slightly bloats SKILL.md.
- **Recommendation:** Fold the useful contexts ('after a full build', 'after unexpected pipeline issues', 'monthly upkeep') into the frontmatter description, then delete the 'When to run this skill' subsection from the body.

**`propose-components`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:3-4 'description: > Use when: planning which sections/blocks become Figma components'.
- **Problem:** The description follows the project's CSO 'Use when:' convention (good — it is a trigger, not a workflow summary, satisfying P3) but is thin on concrete trigger contexts/user phrases and is not at all 'pushy', so it may under-trigger. It names only 'planning which sections/blocks become Figma components' and omits adjacent phrasings a user would actually say (e.g. 'decide which components/variants to build', 'after analyze-theme / build-foundations', 'plan the component inventory / atoms', 'propose Figma component variants').
- **Recommendation:** Broaden the trigger slightly while keeping the 'Use when:' form, e.g. 'Use when: deciding which Shopify sections/blocks/atoms to turn into Figma components and which settings become variants vs instance properties; run after /build-foundations and before /build-components.' Add a couple of natural user phrases to reduce under-triggering.

**`sync-colors`** — `A1` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:3-4 'description: > Use when: syncing color schemes between Figma and Shopify'.
- **Problem:** The description follows the correct 'Use when:' trigger pattern (passes P3) but is thin on concrete trigger contexts/user phrases, and omits direction cues that distinguish this skill from build-foundations (which also creates Figma color variables). A user saying 'push my Figma colors back to the theme' or 'update Shopify color schemes from Figma' or 'my theme and Figma colors drifted' may not reliably fire it. Skill-creator guidance favors a slightly pushy description rich in trigger phrasing to avoid undertriggering.
- **Recommendation:** Enrich the description with concrete bidirectional triggers, e.g. 'Use when: syncing color schemes between Figma and Shopify in either direction — e.g. pushing edited Figma color variables back into config/settings_data.json, pulling Shopify color_schemes into Figma variables, or reconciling drift between theme colors and the Figma file.' Keep it under ~100 words.

### Dimension `A2` (5)

**`build-components`** — `A2` · status: unverified · confidence: medium · effort: M

- **Evidence:** SKILL.md:184 "build it as a **Component Set** with all variant combinations. See the variant building procedure in the original instructions. Do NOT skip variants." — 'the original instructions' is not a file in reference/ (reference dir holds figma-api-gotchas, icon-library, instance-lookup, page-layout, reference-capture, upstream-errors, validation).
- **Problem:** Progressive-disclosure dangling pointer: the Section variants step defers the actual variant-building procedure to 'the original instructions', but no such reference file exists. The agent is told to build full variant combinations and not skip them, yet the detailed procedure it is pointed to is unreachable — so the most error-prone construction (cartesian variant sets) has no concrete guidance.
- **Recommendation:** Either inline a concise variant-building procedure or, better, add reference/section-variants.md (consistent with the reference/ split, P9) describing how to enumerate combinations from section.variants[].values, name them 'Prop=Value, Prop2=Value2', and create the COMPONENT_SET — then point line 184 at it.

**`compose-page`** — `A2` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:73 references design-rules.json/componentMap and :18 names manifest.json, but the body never points to gotchas.md with read-WHEN guidance; the only reference to gotchas is the (non-executing) cat at line 11.
- **Problem:** Progressive-disclosure nit: gotchas.md is a support file but SKILL.md gives no in-body pointer telling the model when to consult it (the intended auto-injection is broken per compose-page-P2-01). If the injection fix lands, this is moot; until then there is no path to the gotchas at all. design-rules.json IS referenced with good 'if it exists' guidance (line 73), which is the right pattern.
- **Recommendation:** Once the dynamic-cat is fixed it self-resolves; as a belt-and-suspenders, add one line in Pre-flight like 'Review .claude/skills/compose-page/gotchas.md for known pitfalls before composing.' so the reference is discoverable even if injection fails.

**`validate-shopify`** — `A2` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/reference/common-schema-gotchas.md is 306 lines (wc -l) with 10 numbered sections + a final table; no table of contents at the top (file opens at :1 with prose, sections start at :9 '## 1.').
- **Problem:** The reference file is just over the 300-line threshold at which skill-creator recommends a table of contents, but it has none. With 10 sections plus a priority table, a reader (or the model deciding what to load) has no index to jump to the relevant gotcha.
- **Recommendation:** Add a short bulleted TOC at the top linking to the 10 sections (Range math, Select options, Color schemes, Font format, Block filename, ID uniqueness, -1 padding, Conditional settings, max_blocks, Preset validation).

**`system`** — `A2` · status: unverified · confidence: high · effort: S

- **Evidence:** build-design-rules/SKILL.md:137 hardcodes `"Color Schemas": { "modes": 6, "type": "COLOR" }` in the generated rules template, and sync-colors/SKILL.md:46 says "Tokens collection (semantic aliases, 6 modes)". But build-foundations/SKILL.md:83 creates Color Schemas with "one mode per color scheme" (count = number of schemes the theme defines, theme-dependent), and analyze-theme reports {N} schemes dynamically.
- **Problem:** The mode count for Color Schemas is theme-dependent (one mode per detected scheme), yet two skills bake in the magic number 6. A theme with 4 or 8 schemes makes the build-design-rules output and the sync-colors architecture note factually wrong, even though the actual build (build-foundations) is correct and dynamic.
- **Recommendation:** In build-design-rules/SKILL.md:137 derive modes from the Figma scan / manifest scheme count (e.g. `"modes": {N schemes}`) rather than literal 6, and add a note that the value is populated from the scan. In sync-colors/SKILL.md:46, change "6 modes" to "one mode per scheme" to match build-foundations' canonical phrasing.

**`system`** — `A2` · status: unverified · confidence: medium · effort: S

- **Evidence:** compose-page/SKILL.md:90 hardcodes the page label as "Inter Bold 18px" and compose-page/gotchas.md:9 repeats "(Inter Bold 18px)". The mobile-placement gap constant 40px appears as a literal in build-components/SKILL.md:200, compose-page/SKILL.md:92,163, build-components/gotchas.md:27, compose-page/gotchas.md:8; build-components also abstracts it as MOBILE_X_OFFSET (line 213). 'Inter' as the label font is otherwise theme-agnostic — themes may not use Inter.
- **Problem:** Layout constants (40px gap, 120px group gap, 18px label) and the label typeface 'Inter' are sprinkled as bare literals across two SKILL.md and two gotchas.md, with build-components inconsistently using a named constant (MOBILE_X_OFFSET) for the same 40px gap that compose-page writes literally. Hardcoding 'Inter Bold' is also questionable in a theme-agnostic system that may not load Inter.
- **Recommendation:** Pick one representation for the placement gap and use it everywhere (either the literal 40px or the named MOBILE_X_OFFSET — build-components mixes both). State the page-label spec (font/size) once, ideally in compose-page's Notes or a shared layout-constants reference, and have gotchas.md point to it. Consider sourcing the label font from foundations (a heading font) instead of literal 'Inter' so password/non-Inter themes don't fail font load.

### Dimension `A3` (2)

**`compose-page`** — `A3` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:106-130 'Instance-Only Composition' + 'Text Audit After Composition' embed a JS createInstance() snippet and a findAll/textStyleId/boundVariables audit loop directly in SKILL.md; the same instance-only and text-binding rules are also duplicated in gotchas.md:11-16 and in CLAUDE.md:15-18.
- **Problem:** Minor altitude/DRY issue: the post-composition text-audit loop is a deterministic, repeated check that recurs across building skills, and the instance-only rule is stated in three places (SKILL body, gotchas.md, CLAUDE.md). At ~232 lines the file is well under the 500-line guideline, so this is polish, not bloat — but the audit loop is the kind of repeated programmatic check that belongs in a shared reference or a script rather than re-inlined per skill.
- **Recommendation:** Consider extracting the text-audit loop (unstyled / unbound-fill detection) to a shared reference (e.g. figma-best-practices.md or a build-components/reference helper) and link to it, keeping SKILL.md focused on the compose-specific flow. Leave the one-line instance-only reminder; drop the longer duplication.

**`validate-shopify`** — `A3` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:201 '3. Strip any namespace prefix ...' and :203 '3. Otherwise, look for: blocks/{type}.liquid ...' — two consecutive steps both numbered 3 (no step 4 in that list; numbering then implicitly off).
- **Problem:** In Phase 2.5 the ordered procedure has two steps labelled '3', so the block-resolution sequence is mis-numbered. Minor, but in a skill whose whole value is precise procedural correctness it undercuts trust and could cause a step to be read as a sub-note of the prior one.
- **Recommendation:** Renumber the Phase 2.5 list 1-4 sequentially.

### Dimension `A6` (2)

**`build-design-rules`** — `A6` · status: unverified · confidence: medium · effort: M

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:35-47 inline JS scan loop; lines 51-64 the Figma-name→liquid-file matching heuristics ('Header → sections/header.liquid', 'Product Card → blocks/_product-card.liquid + snippets/product-card.liquid').
- **Problem:** The component scan (Step 1) is a fixed, deterministic Figma traversal re-derived in prose each run, and the name→file matching (Step 2) is a repeatable heuristic. Per A6, deterministic multi-step work is better captured as a bundled script in scripts/ than re-inlined, both for reliability and to avoid the model improvising variations. This is a soft observation — the inline JS is small and the file-matching genuinely benefits from model judgment, so a script is optional.
- **Recommendation:** Consider extracting the Figma component-scan into a small bundled snippet/script (or referencing a shared one) so the traversal is identical every run; keep the name→file mapping in prose since it needs fuzzy judgment. Do not over-engineer if the inline block is working in practice.

**`sync-colors`** — `A6` · status: unverified · confidence: medium · effort: M

- **Evidence:** SKILL.md:118-148 embeds two JavaScript conversion functions (shopifyHexToRGBA, rgbaToShopifyHex) plus matching-tolerance prose inline in the SKILL body, to be re-derived/transcribed each run.
- **Problem:** The color-conversion routines are deterministic, repeated, multi-step logic that the skill expects the model to reproduce correctly on every invocation. Per skill-creator guidance (A6), deterministic repeated work belongs in a bundled script (scripts/), not re-emitted from prose — re-transcribing parseInt/padStart/tolerance logic each run invites subtle drift (e.g. dropping the rgba(0,0,0,0) special case or the alpha-byte branch).
- **Recommendation:** Move the two functions into scripts/color-convert.js (with both directions + the match() tolerance helper) and have SKILL.md call it, or at minimum reference it as the canonical implementation. Keeps SKILL.md shorter and guarantees identical conversion every run. Pair with the evals above.

### Dimension `A7` (1)

**`system`** — `A7` · status: unverified · confidence: high · effort: S

- **Evidence:** Header conventions are mostly uniform but partially applied: '**Manifest path:**' appears in 10 SKILL.md (all that need it) — good. '**Method:**' appears in only 3 (build-foundations:19, compose-page:21, sync-colors:20) though build-components, build-design-rules, setup, build-design-system are equally MCP-method skills. build-components instead uses a '**Methods:**' (plural) bulleted block at lines 21-24, and validate-shopify/build-design-rules omit a Method line entirely.
- **Problem:** The optional '**Method:**' preamble that tells the reader which MCP tools the skill drives is present in 3 skills, pluralized-and-restructured in a 4th (build-components '**Methods:**'), and absent in the other Figma/Chrome skills. This is minor but is exactly the kind of preamble drift that makes the skill set feel hand-assembled rather than templated.
- **Recommendation:** Standardize the post-title preamble block. Decide on a fixed set of bold labels in fixed order (e.g. **Manifest path:** → **Phase/Template:** → **Method(s):** → **References:**) and apply it to every skill that uses MCP tools. Canonical example to follow: build-components/SKILL.md:18-28 already has the fullest set (Manifest path, Phase, Methods, References) — promote that shape and reconcile build-foundations/compose-page/sync-colors '**Method:**' singular to match.

### Dimension `A8` (5)

**`analyze-theme`** — `A8` · status: unverified · confidence: medium · effort: S

- **Evidence:** reference/profile-validation.md:77 "- **NEVER blindly trust the profile** — always validate first". (Only one bare ALL-CAPS imperative across the whole skill; token-extraction.md:198 'Do NOT create a nested ...' is reasoned.)
- **Problem:** Minor skill-creator yellow-flag: the lone ALL-CAPS 'NEVER blindly trust the profile' is asserted as a bare imperative. It is largely justified by the surrounding paragraph (profiles may be stale/forked), so this is borderline rather than egregious — but the rubric prefers reasoned imperatives over ALL-CAPS commands. Overall the skill is clean on this dimension (token-extraction.md:198 already pairs its 'Do NOT' with a reason).
- **Recommendation:** Optional polish: soften to 'Always validate the profile against the real files before relying on it — profiles describe a base theme and the actual theme may be a customized fork.' (the file's opening paragraph already says this, so the ALL-CAPS line is somewhat redundant). Low priority.

**`build-components`** — `A8` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:65 "this is an instant-fire offense in any design system"; :58 "This is the #1 rule"; :71 "#2 rule"; 13 ALL-CAPS NEVER/ALWAYS/MUST/No-exceptions tokens (lines 60,65,73,160,181,208,244,245). e.g. :181 "**NEVER** use `layoutGrow = 1`..." with no reason on that line.
- **Problem:** Heavy reliance on ALL-CAPS absolutes and dramatized phrasing ('instant-fire offense', 'No exceptions', '#1 rule'/'#2 rule') is the skill-creator yellow-flag (A8): several imperatives assert the rule without the WHY on the line. The text-FILL rule does explain why (overflow), but the grid-wrap NEVER (181) and 'No exceptions' (208) do not, reducing the agent's ability to generalize.
- **Recommendation:** Trim the theatrics and pair each remaining NEVER/MUST with a brief reason (e.g. 'never layoutGrow on wrap children — it makes wrapped rows reflow unpredictably'). Prefer reasoned imperative over emphasis. Collapsing the near-duplicate text-FILL banner (also at line 140 and in gotchas) would cut redundancy.

**`build-foundations`** — `A8` · status: unverified · confidence: medium · effort: S

- **Evidence:** gotchas.md:7 'No exceptions.'; gotchas.md:5 'EVERY text node ... textStyleId'; SKILL.md:103 'Do NOT create line-height variables' (this one DOES give the why on :103/217); but several ALL-CAPS imperatives (EVERY/NEVER/Do NOT) appear without an inline reason.
- **Problem:** Minor skill-creator anti-pattern: a few ALL-CAPS absolutes ('No exceptions', 'EVERY') are stated without the WHY inline. Most rules here actually do explain their rationale (lineHeight→PIXELS, mobile-styles noise, layout flush), so this is light, but the bare absolutes read as over-constraint rather than reasoned imperative.
- **Recommendation:** Where an absolute lacks a reason, append a short because-clause (e.g. 'EVERY text node needs a textStyleId+bound fill because /validate-instances rejects unbound text and downstream components inherit these styles'). Low priority polish.

**`propose-components`** — `A8` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/propose-components/gotchas.md:7 'NEVER skip atoms that exist in the theme...'; reference/mandatory-atoms.md:46 'do NOT skip it'; reference/variant-analysis.md uses bare imperatives well, but gotchas.md:7 and SKILL.md:60 'excluding JSON group files' rely on bare ALL-CAPS NEVER without a why in one spot.
- **Problem:** Minor skill-creator anti-pattern: a couple of ALL-CAPS NEVER/critical directives (notably gotchas.md:7 'NEVER skip atoms...') assert the rule but the WHY ('critical for the instance-only architecture') is present only partially. Most of the skill does explain rationale well; this is polish, not a substantive defect. Flagging for consistency since the rubric calls out unexplained ALL-CAPS imperatives.
- **Recommendation:** Where a NEVER/ALWAYS appears, keep one short clause of rationale (the atoms gotcha already half-does this — make the link explicit: '...because /build-components composes every section from atom instances, so a missing atom blocks the instance-only build'). Low priority.

**`validate-shopify`** — `A8` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:445-450 'The -1 padding convention' lives in the Edge Cases section at the bottom, ~280 lines after the range rule it modifies at :160-169 / :103-104 which says value 'must be a number within [min, max]' with no inline mention of the -1 sentinel exception.
- **Problem:** The range-validation rule (Phase 1.4 and Phase 2.2) is stated without its own exception; the critical 'do not flag -1 when min is -1' caveat is far away in a separate section. A model executing Phase 1.4 top-to-bottom can emit a false-positive ERROR on a legitimate -1 default before ever reaching the edge-case note. This is over-fit/locality of behavior, an A8-style smell.
- **Recommendation:** Inline a one-line cross-reference at the range rule ('see Edge Cases: -1 padding convention') or fold the exception directly into the range check so the rule and its exception are co-located.

### Dimension `A9` (5)

**`build-design-rules`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** No evals/ directory or evals.json anywhere under .claude/skills/ (verified across all 13 skills); build-design-rules/ contains only SKILL.md.
- **Problem:** There are no evals for this skill (nor any sibling), so triggering accuracy and output correctness are untested. The skill produces a structured, verifiable artifact (design-rules.json with deterministic keys) that is well-suited to an eval, and its 'Use when' triggering could be regression-checked.
- **Recommendation:** Add evals/evals.json with a few realistic prompts (e.g. 'map our figma components to the theme code', 'generate design-rules.json') plus negative prompts that should NOT trigger this skill, and an output check asserting design-rules.json contains componentMap/tokenMap/textStyleMap/spacingMap. Lower priority since it is a project-wide gap, not unique to this skill.

**`compose-page`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** ls of .claude/skills/compose-page/ shows only SKILL.md and gotchas.md (no evals/). find across .claude/skills for 'evals*' returns nothing for the whole system.
- **Problem:** No evals/evals.json with realistic test prompts exists for this skill (e.g., '/compose-page index', '/compose-page all', running with sections-mobile incomplete to exercise the pre-flight). Triggering and pre-flight routing are untested. This is a system-wide absence, not unique to compose-page.
- **Recommendation:** Add evals/evals.json with a few realistic prompts: a happy-path single template, 'all', and a not-ready case (sections-mobile incomplete) asserting the skill reports the missing phase. Establish the convention once and reuse across pipeline skills.

**`system`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** find over .claude/skills for evals*/eval.json returned nothing; refresh-figma-practices/ contains only SKILL.md
- **Problem:** There is no evals/evals.json for this skill (and none anywhere in the skill system). A9 calls for realistic test prompts to verify triggering and output. This skill is actually a good eval candidate because its triggering is the main risk (thin description) and its output is checkable: it should propose a diff and refuse to edit the cheatsheet before approval. Tagged system-scope since the absence is system-wide, not unique to this skill.
- **Recommendation:** Add evals/evals.json with trigger prompts (e.g. 'update the figma best practices', 'is our figma cheatsheet stale?', 'research new Figma features') and at least one negative/output assertion that the cheatsheet is NOT modified before user approval (Step 4 gate) and that proposed changes carry source links.

**`setup`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** `find .claude -iname 'evals*'` returns nothing; `.claude/skills/setup/` contains only `SKILL.md`. No `evals/evals.json`.
- **Problem:** There are no evals for setup (nor anywhere in the system). Setup is highly testable in isolation — its branchy logic (manifest-exists vs not, password-protected vs open store, Figma access success/failure, profile found vs not, fileKey parsing for design vs branch URLs) is exactly the kind of input/output matrix an eval set should pin. Absence makes triggering and behavior regressions invisible.
- **Recommendation:** Add `.claude/skills/setup/evals/evals.json` with realistic prompts covering: first-time setup with both URLs, a branch-style Figma URL, a password-protected store, an unreachable localhost URL, a theme with an existing profile, and re-running when a manifest already exists. Assert the resulting manifest shape/keys. (Consider a system-wide eval rollout.)

**`validate-instances`** — `A9` · status: unverified · confidence: high · effort: M

- **Evidence:** `find .claude/skills/validate-instances -iname 'eval*'` returns nothing; folder listing shows only SKILL.md. (System-wide: no skill has evals.)
- **Problem:** No evals/evals.json with realistic prompts. This skill is unusually testable — its outputs are deterministic report tables and a before/after violation count — so it is a good candidate for evals (e.g. a fixture Figma state with N known inline-frame violations and asserting the report count). Absence is a low-severity, system-wide gap.
- **Recommendation:** Add evals/evals.json with a few realistic trigger prompts ('audit my Figma file for inline frames', 'check text styles and variable bindings') and, where feasible, expected violation counts against a known fixture, to guard the detection heuristics against regression.

### Dimension `B3` (1)

**`build-foundations`** — `B3` · status: adjusted · confidence: high · effort: S

- **Evidence:** reference/style-guide.md:44-45 "Variable name (text node) / Hex value (text node, secondary color)"; also :60-65 typography labels, :71 "Value label". No mention of textStyleId or variable-bound fill anywhere in style-guide.md. Contradicts gotchas.md:7-8 "EVERY text node must have a textStyleId ... No exceptions. EVERY text fill must be bound ... via setBoundVariableForPaint" and CLAUDE.md:18.
- **Problem:** Step 8 (8a-8d) instructs creating numerous text nodes (variable names, hex values, metadata labels, value labels) with fills described as 'secondary color' / 'neutral color' but gives NO instruction to (a) assign a textStyleId from the styles built in Step 7, or (b) bind the text fill to a Grey Scale / Theme Colors variable. This directly violates the project's hard rule 'EVERY text node must have a textStyleId AND a variable-bound fill' and the skill's own gotchas 'No exceptions'. The style-guide page is the FIRST set of text nodes the system ever produces, so it sets the precedent the rest of the pipeline inherits, and /validate-instances would flag every one of these.
- **Recommendation:** In reference/style-guide.md, add an explicit rule near the top: every text node created for the style guide MUST set textStyleId to one of the Step-7 text styles (e.g. Text/Body Small for labels) and MUST bind its fill via setBoundVariableForPaint to a Grey Scale variable (e.g. Grey/600 for secondary text). Update each of 8a-8d to name the style and variable to use. Mirror the rule in SKILL.md Step 8.

### Dimension `B4` (1)

**`system`** — `B4` · status: unverified · confidence: medium · effort: S

- **Evidence:** validate-shopify/SKILL.md:5,28 reference `shopify theme push` as the trigger context but only validate beforehand; no skill executes or gates the push. sync-colors writes settings_data.json (185-186) with no instruction to subsequently re-run /validate-shopify before the user pushes, though sync-colors:24 does chain to /validate-instances (Figma side only).
- **Problem:** The most destructive Shopify write — `shopify theme push`, which overwrites the live/remote theme — is never wrapped by the backup+diff+approval protocol; it is left entirely as an out-of-band user action. Additionally, after sync-colors edits settings_data.json it routes the user only to /validate-instances (Figma compliance), not /validate-shopify (which would catch a malformed color value or broken scheme reference) before that push.
- **Recommendation:** Document an explicit pre-push gate: after any Shopify JSON write (sync-colors Figma→Shopify), instruct running /validate-shopify and confirm a clean report before `shopify theme push`. State clearly that pushes operate on un-backed-up remote state so the local backup (sws-C6-01) is the only recovery path.

### Dimension `B7` (4)

**`build-components`** — `B7` · status: adjusted · confidence: high · effort: S

- **Evidence:** Grep for 'sliver|rationaliz|anomal|zero-size|broken layout' across .claude/skills/build-components/ returns only unrelated page-layout.md lines. The learning (feedback_screenshot_validation.md, also in MEMORY.md as 'Screenshot validation') is NOT present. SKILL.md's validation discipline (244-247) and gotchas.md 'Screenshot After Every Step' (19-24) cover zoom/'looking good' but never the 'thin sliver = broken, do not explain away' rule.
- **Problem:** A required team learning — never rationalize a visual anomaly in a Figma screenshot; a thin sliver / zero-size element is a broken layout and must be treated as a failure — is not encoded in this skill. This is exactly the build process where collapsed-height frames occur (the originating bug was a collapsed Color Schemas frame), and the resize()-height-1 gotcha (figma-api-gotchas.md:12-15) produces precisely these slivers, so the rule is directly applicable here.
- **Recommendation:** Add the rule to gotchas.md (so it is injected at runtime) and reference it in the Visual Validation Checklist: 'If a component screenshot looks like a thin bar or is mostly empty, treat it as BROKEN — do not rationalize as zoom/wide-frame; investigate (often the resize()-after-sizing-mode bug) and fix before continuing. Apply the same scrutiny uniformly to every component once you have fixed the pattern on one.'

**`learnings`** — `B7` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/learnings/SKILL.md ends at Step 5 Summary (108-120) + Notes (122-142); no 'After Completion' self-learning step. By contrast the project's self-learning convention appends user corrections to a skill's own gotchas.md.
- **Problem:** The skill whose entire job is curating learnings has no mechanism to capture corrections to its own process (e.g. user repeatedly fixes how it categorizes or words entries). It also has no own gotchas.md. Low severity because a meta/maintenance skill is a weak candidate for the per-phase gotchas pattern, but the gap is notable given the skill's subject matter.
- **Recommendation:** Optionally add a brief 'After Completion' note: if the user corrected how learnings were categorized/worded during the session, capture that as a process note (a learnings/gotchas.md or a meta entry) so the consolidation behavior improves over time.

**`validate-instances`** — `B7` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-instances/SKILL.md:146-158 ends at 'Step 5: Re-validate' with no 'After Completion' section; `grep` for 'After Completion'/append-to-gotchas in build-foundations also finds none — system-wide absence.
- **Problem:** No self-updating 'After Completion' step instructing that if the user corrected the audit/fix approach during the run, the correction be appended (with date/context) to this skill's gotchas.md. This is the project's chosen self-learning loop (P11). Marked low because it is absent system-wide, not unique to this skill — but this skill is precisely where a missed visual anomaly or a bad auto-fix should generate a durable learning.
- **Recommendation:** Add a brief 'After Completion' section: if the user corrected detection heuristics or an auto-fix during the run, append the correction (with date + short context) to .claude/skills/validate-instances/gotchas.md so the next run benefits.

**`validate-shopify`** — `B7` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:11-17 begins directly with a static '> **Reference:**' block; there is no '!cat .claude/skills/validate-shopify/gotchas.md ...' line. All 10 sibling SKILL.md files have it at line 11 (e.g. analyze-theme/SKILL.md:11 '!cat .claude/skills/analyze-theme/gotchas.md 2>/dev/null || echo "No gotchas yet."').
- **Problem:** validate-shopify is the single outlier among 11 skills that does NOT dynamically inject a per-skill gotchas.md at invocation, and the folder has no gotchas.md at all (confirmed: ls shows only SKILL.md + reference/). The project's chosen runtime-learning mechanism (read gotchas from disk at invocation) is therefore absent, so any future correction about this validator has nowhere convention-compliant to live and will not be surfaced at runtime.
- **Recommendation:** Create .claude/skills/validate-shopify/gotchas.md (seeded or empty) and add the standard line near the top of SKILL.md: a fenced ```sh block with `!cat .claude/skills/validate-shopify/gotchas.md 2>/dev/null || echo "No gotchas yet."`, matching the path/format of the other 10 skills.

### Dimension `C1` (3)

**`system`** — `C1` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/validate-shopify/SKILL.md:4-6 "Use when: writing or modifying Shopify template JSON files, section schemas, or settings_data.json. Also use before shopify theme push…" vs validate-instances/SKILL.md:4 "Use when: auditing Figma file for instance compliance"
- **Problem:** Both skills present as "validate the design system," share the verb family validate/audit, and sit under the same project umbrella. An ambiguous request — "validate the design system," "run the validations," "check everything before I push" — does not name Shopify-JSON vs Figma-instances, so the model must infer the target. validate-shopify's much longer, keyword-dense description (template JSON, schema, settings_data, theme push, range/step) gives it a strong surface for store-side requests, but the generic word "validate" plus "design system" can pull validate-instances when the user actually meant theme JSON, or pull validate-shopify when the user meant Figma compliance. Consequence: the wrong layer is checked and the user gets a clean bill of health for the layer they did not care about — e.g. they push a theme after only the Figma instance audit ran, missing schema/range errors validate-shopify exists to catch.
- **Recommendation:** Add a mutually-exclusive object phrase and a negative clause to each. validate-instances: "Use when auditing the FIGMA file for component-instance compliance (inline frames that should be instances, unbound fills). Not for Shopify/theme JSON — for that use validate-shopify." validate-shopify: keep its body but ensure the first line leads with the layer: "Use when validating SHOPIFY THEME CODE — template JSON, section schemas, settings_data.json — or before shopify theme push. Not for Figma instance audits — for that use validate-instances." The reciprocal "Not for X — use Y" pointers resolve the ambiguous "validate the design system" request deterministically.

**`system`** — `C1` · status: adjusted · confidence: medium · effort: S

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:4 "Use when: generating a design system rules file mapping Figma to code" vs build-components/SKILL.md:4 "Use when: constructing atoms, blocks, or sections in Figma" and compose-page/SKILL.md:4 "Use when: assembling page templates from section instances"
- **Problem:** build-design-rules produces a documentation artifact (design-rules.json mapping each Figma component to its theme code file). But its description phrase "mapping Figma to code" reads like an implementation/build step. A request like "connect the Figma components to the theme code" or "set up the Figma-to-code workflow" can mis-trigger toward build-components/compose-page (which share "Figma" + component/section language and are the obvious "do something with components" skills), or conversely a request to "build the components" could pull build-design-rules because both contain "design system" + "Figma". The shared, unscoped tokens (Figma, design system, components/sections) and the lack of any "generates a JSON reference, does not build anything in Figma" signal make the documentation-vs-construction boundary invisible to the router. Consequence: either the mapping file is generated when the user wanted Figma construction, or component building runs when the user only wanted the code-mapping reference.
- **Recommendation:** Re-scope build-design-rules to foreground that it emits a reference file and touches no Figma geometry: "Use when generating the design-rules.json REFERENCE that documents which theme code file each existing Figma component maps to. Read/scan only — does not create or modify Figma components (for that use build-components) and does not assemble pages (use compose-page)." Optionally drop the bare phrase "design system rules file" in favor of "component-to-code mapping reference" to remove the "design system" keyword collision with the build phases.

**`system`** — `C1` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/learnings/SKILL.md:4-6 "Use when: the user says \"review learnings\", \"what have we learned\", \"update gotchas\"…" vs refresh-figma-practices/SKILL.md:4 "Use when: updating the Figma best practices cheatsheet"
- **Problem:** Both are maintenance/knowledge-update skills. learnings consolidates per-skill gotchas.md files; refresh-figma-practices researches and proposes updates to figma-best-practices.md. They overlap on the verb "update" and the broad notion of "update our Figma knowledge/notes." A request like "update our Figma best-practice notes / learnings" could route either way. Impact is low (both are read-then-propose, non-destructive, and the user reviews changes), but the model could open the wrong corpus (gotchas vs the cheatsheet) and report nothing-to-do for the file the user cared about.
- **Recommendation:** Name the distinct artifact in each: learnings: "…consolidates the per-skill gotchas.md feedback files (internal lessons learned). Does not touch the figma-best-practices cheatsheet — for that use refresh-figma-practices." refresh-figma-practices: "…researches external Figma/Plugin-API changes and proposes edits to .claude/figma-best-practices.md (not the internal gotchas — for those use learnings)." learnings is already strongly keyword-anchored, so only the cross-reference is needed.

### Dimension `C10` (1)

**`system`** — `C10` · status: unverified · confidence: high · effort: S

- **Evidence:** generate-proposal-html.js:259-261 `${config.desktopWidth}px`, `${config.mobileWidth}px`, `${(config.pages || []).join(' / ')}`; :227-256 `${summary.atoms||0}` etc.; :431 `t${v.tier||1}`; :491 `${combos.desktop} combos`. These interpolate manifest values directly into HTML without esc(). esc() IS applied to all free-text fields (theme.name, storeUrl, reasons, notes, slugs).
- **Problem:** Minor HTML-injection / output-corruption surface: a handful of manifest fields expected to be numeric (config.desktopWidth/mobileWidth, summary.*, combos.desktop, v.tier) and the config.pages string array are written raw into the page. The manifest is a plain JSON state file written by the pipeline with no schema validation, so a malformed or maliciously-edited value (e.g. a string containing `</style>` or `<img onerror=…>` in config.pages) would break rendering or inject script. Real-world risk is low because the manifest is locally authored, not attacker-supplied — but it contradicts the project's own strict-escaping posture and the otherwise-careful esc() usage everywhere else.
- **Recommendation:** Wrap the remaining interpolations in esc() (and for numeric fields coerce with Number(x)||0). config.pages should be `(config.pages||[]).map(esc).join(' / ')`. The `formula`/`panelId` paths are already safe (built from esc()'d parts / regex-sanitized), so only the listed raw fields need fixing.

### Dimension `C2` (2)

**`learnings`** — `C2` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/learnings/SKILL.md:132-140 prescribes "- **What:** One-line description / - **Why:** Why it matters / - **Fix:** How to avoid"; but `grep -rl '\*\*What:\*\*' .claude/skills/*/gotchas.md` returns NONE — all four real files (e.g. build-foundations/gotchas.md:7 'EVERY text node must have a textStyleId') use `## Title` + free-form bullets.
- **Problem:** This skill is the single authority that consolidates and rewrites gotchas across the system, yet the canonical format it defines does not match the format every real gotchas.md actually uses. On 'Refine existing' (line 65-92) or 'Add new learnings' (line 76-84) it will draft/rewrite entries into the What/Why/Fix shape, churning or corrupting the established free-form style, and producing inconsistent files. It may also mislead the user into thinking existing entries are malformed.
- **Recommendation:** Change the 'Gotcha format' section (lines 132-142) to match the in-repo convention: `## {Short Title}` followed by terse free-form bullets (the first bullet bolded as the core rule, e.g. as in build-components/gotchas.md). Remove the What/Why/Fix template, or relegate it to an optional hint. Better: have the skill infer the format from the existing files it Globs in Step 1 rather than hardcoding one, so it stays self-consistent as the convention evolves.

**`system`** — `C2` · status: unverified · confidence: medium · effort: M

- **Evidence:** The 'instance-only' rule is stated in CLAUDE.md:15, then re-expanded as full instruction blocks in build-components/SKILL.md:69-89 ("CRITICAL: Instance-Only Architecture"), compose-page/SKILL.md:105-117 ("Instance-Only Composition"), validate-instances/SKILL.md:24, build-components/gotchas.md:14, compose-page/gotchas.md:13, and learnings/SKILL.md:45. The 'every text node needs textStyleId + bound fill' rule similarly repeats at CLAUDE.md:18, build-components/SKILL.md:204-208, build-foundations/gotchas.md:7, compose-page/SKILL.md:122-128, plus the cheatsheet.
- **Problem:** The two highest-level project invariants (instance-only architecture; every text node styled+bound) are each restated as multi-line blocks in 4-6 places. Some repetition is intentional reinforcement, but the wording diverges ("never as an inline frame" vs "NEVER build inline frames" vs "composed ENTIRELY from"), so there is no single authoritative phrasing to point auto-fixers (validate-instances) at.
- **Recommendation:** Treat CLAUDE.md Rules (lines 15-19) as the canonical statement of these two invariants and have each skill reference them tersely (e.g. 'Enforces the instance-only rule — see CLAUDE.md Rules') rather than re-prosing a unique variant. Keep the operational how-to (the createInstance code snippet) local to build-components/compose-page, but converge the normative wording on one source. Lower priority than the API-gotcha duplication since these are genuinely load-bearing reminders.

### Dimension `C3` (1)

**`build-foundations`** — `C3` · status: unverified · confidence: medium · effort: S

- **Evidence:** SKILL.md:215-223 'Figma API gotchas for this skill' (lineHeight/PIXELS, blendMode NORMAL, HUG→AUTO, paint alpha→opacity, layout flush) duplicate gotchas.md:21-35 AND overlap figma-best-practices.md (e.g. Fill/Hug rules at figma-best-practices.md:16-31, alpha-variant naming at :125).
- **Problem:** The same Figma API gotchas are stated in three places: the SKILL.md inline block (215-223), gotchas.md (21-35), and the central figma-best-practices.md. The inline SKILL.md block is the redundant one — it re-states what gotchas.md (auto-injected at runtime) already carries, costing SKILL.md context budget and creating drift risk (e.g. SKILL.md:217 references setBoundVariable('lineHeight') while gotchas.md:8 references setBoundVariableForPaint; they can fall out of sync).
- **Recommendation:** Remove the 'Figma API gotchas for this skill' block from SKILL.md (lines 215-223) since gotchas.md is injected at invocation and is the canonical per-skill store; keep only a one-line pointer if needed. Reserve generic Figma engineering rules (Fill/Hug) for figma-best-practices.md to satisfy DRY.

### Dimension `C4` (4)

**`build-components`** — `C4` · status: adjusted · confidence: high · effort: M

- **Evidence:** reference/page-layout.md:42 "Group by `foundations.requiredAtoms[].category`" and :53 "Group by `components.sections[].category`". Verified: foundations has key `atoms` (a flat list of strings like ["Button","Input Field"]), NOT requiredAtoms; components.atoms entries are {name,reason} with no category; components.sections is a slug-keyed dict whose entries have keys {reason,variants,instanceProperties,variableProperties,totalVariantCombinations} — no `category` and not an array.
- **Problem:** The page-layout grouping algorithm keys off fields that don't exist in the current manifest (foundations.requiredAtoms, an atom.category, a section.category, and array-shaped components.sections). The 'Arrange page layout' step — invoked at the end of every phase (SKILL.md:122,148,213) — cannot derive its category groups, so component arrangement (the fix for the NEVER-leave-at-0,0 overlap gotcha) silently degrades to a single ungrouped pile or fails.
- **Recommendation:** Reconcile page-layout.md with the real manifest: derive atom categories from a field that exists (add `category` to atom objects in propose-components, or supply an explicit interactive/content/utility mapping); iterate components.sections as Object.entries(dict) not an array, and add a section `category`/`group` field upstream if grouping is required. Until the upstream writes categories, the doc should fall back to the documented single-group behavior rather than referencing non-existent keys.

**`system`** — `C4` · status: unverified · confidence: high · effort: S

- **Evidence:** propose-components/SKILL.md:166 'The `components` object **must** also include a `summary` sub-object with counts: atoms, universalBlocks, sections, and desktopVariantCombinations.' generate-proposal-html.js:239 and :256 consume only `summary.desktopVariantCombinations`. manifest-test.json:299-300 writes BOTH desktopVariantCombinations:18 and mobileVariantCombinations:18; real manifest.json:810 writes ONLY desktopVariantCombinations:50 (no mobile). propose-components Step 10 summary template (:198-201) prints 'N sections x 2 viewports' and 'N total variant combinations' implying mobile is tracked, but the required-keys list and the generator ignore mobile.
- **Problem:** Field-naming/coverage drift in components.summary. The spec mandates only desktopVariantCombinations, the generator only reads desktop, yet the test manifest also carries mobileVariantCombinations (read by no one) and manifest-test.json:295-304 has a richer summary (instanceProperties, colorSchemeSettings, skipped) than the real manifest. So summary is inconsistently shaped across runs, mobileVariantCombinations is a write-nobody-reads field, and the proposal HTML silently omits mobile variant counts even though propose-components frames the system as desktop+mobile (Phase B:110-112).
- **Recommendation:** Pin a single canonical `summary` schema in propose-components Step 8 (list every required key once). Decide whether mobile variant combinations are tracked: if yes, have the generator render summary.mobileVariantCombinations; if no, drop it from manifest-test.json to stop emitting a dead field. Reconcile manifest-test.json's extra summary keys with the documented set.

**`system`** — `C4` · status: unverified · confidence: medium · effort: S

- **Evidence:** build-components/SKILL.md:134 'Read source block files listed in `sourceBlocks`'. grep shows NO skill writes `sourceBlocks`; propose-components never emits it. manifest-test.json uses `sourceFile` (singular, on atoms: :32,:37,:42…) not `sourceBlocks`, and the real manifest.json blocks (lines 496-562) carry neither sourceFile nor sourceBlocks. So build-components:134 references a key that no producer writes under that name.
- **Problem:** build-components instructs the agent to read block source files from a `sourceBlocks` field that propose-components never populates (the nearest thing produced is `sourceFile` on atoms in the test manifest, and nothing at all on blocks in the real manifest). The block-build step therefore has no reliable manifest-driven pointer to source liquid files and must improvise, weakening the propose→build handoff contract for blocks.
- **Recommendation:** Standardize a source-pointer field name (e.g., `sourceFiles`) and have propose-components write it for atoms AND blocks during Step 8; then update build-components:134 to read that exact key. Align manifest-test.json's `sourceFile` to the chosen name.

**`system`** — `C4` · status: unverified · confidence: high · effort: S

- **Evidence:** setup/SKILL.md:111-112 writes config.instancePolicy:'strict' and config.mobilePlacement:'adjacent'. grep 'instancePolicy' / 'mobilePlacement' across .claude/skills returns only the setup writer (and setup:7 allowed-tools is unrelated) — no consumer. By contrast config.mobileNaming IS read (build-components:199 'Follow config.mobileNaming'), and config.desktopWidth/mobileWidth are read widely, so the omission of instancePolicy/mobilePlacement consumers is notable.
- **Problem:** config.instancePolicy and config.mobilePlacement are written by setup but read by no skill. The instance-only architecture is instead hardcoded as prose rules in build-components (CRITICAL sections :69-89) and CLAUDE.md:15, and mobile placement is hardcoded ('40px gap', 'NEXT TO their desktop counterpart' build-components:200, compose-page:163). So these config fields give a false impression of being tunable knobs while having zero effect — a contract smell where state exists but is inert.
- **Recommendation:** Either wire the consumers (have build-components/compose-page branch on config.instancePolicy and config.mobilePlacement instead of hardcoding), or drop these fields from the setup write block and the manifests to avoid implying configurability that doesn't exist.

### Dimension `C5` (1)

**`system`** — `C5` · status: adjusted · confidence: high · effort: S

- **Evidence:** sync-colors/SKILL.md:32 "If `use_figma` fails → tell the user to check their Figma MCP connection"; sync-colors/SKILL.md:197 "If `use_figma` fails → check Figma MCP connection"; contrast build-components/SKILL.md:37-40 which enumerates required MCP tools and "If any required MCP tool is missing → **STOP immediately**. Do NOT proceed without it."
- **Problem:** Missing-tool handling is inconsistent across skills, and the inconsistency falls exactly on the data-mutating skills. build-components enforces a hard STOP with an upfront tool-availability check; sync-colors (which mutates Shopify JSON) only reacts AFTER a use_figma call fails and merely 'tells the user to check the connection' — a soft degrade, no pre-flight tool verification, and nothing preventing a half-completed sync. MEMORY.md explicitly records 'STOP if required tools missing — never proceed without required MCP tools', so the soft-degrade pattern violates a stated learning.
- **Recommendation:** Standardize a pre-flight 'required MCP tools' block (like build-components:37-40) across all skills that depend on MCP, especially sync-colors. For sync-colors, verify use_figma is present BEFORE reading/diffing and hard-STOP if absent, rather than discovering it mid-run.

### Dimension `C7` (1)

**`setup`** — `C7` · status: unverified · confidence: medium · effort: S

- **Evidence:** .claude/skills/setup/SKILL.md:63-66 "Read the theme's `config/settings_schema.json` and extract: theme_name ... theme_version ... theme_author". Compare analyze-theme/SKILL.md:16 "reads everything from the manifest" and its Pre-flight checks `config` exists.
- **Problem:** Doc/reality nuance worth noting: setup reads the live theme's `config/settings_schema.json` directly to detect theme name/version/author (lines 63-66), and analyze-theme later re-reads the same file plus does its own theme-profile detection (analyze-theme:18-30). This is acceptable for setup (it precedes analyze-theme and must populate `theme.*`), so P7 is not violated — but the theme-info detection and profile-existence check are duplicated across both skills, and the path-token differs (setup uses `{theme_name_lowercase}` at line 70; analyze-theme uses `{theme_slug}` at line 18). A theme whose display name differs from its profile filename (e.g. "Horizon" vs `horizon.json`) could be detected by one skill and missed by the other.
- **Recommendation:** Align the profile-lookup token wording between setup and analyze-theme (pick one of slug/lowercased-name and define how it's derived), so `theme.hasProfile` is computed consistently. Optionally note in setup that analyze-theme will re-derive theme details from the manifest/config rather than re-reading the theme, to make the read-vs-manifest contract explicit.

### Dimension `C8` (1)

**`build-design-rules`** — `C8` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/build-design-rules/SKILL.md:7 "allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, Read, Write, Glob, Grep]" — body never references screenshots (grep for 'screenshot' matches only the frontmatter line).
- **Problem:** mcp__figma__get_screenshot is granted but never used: the skill's only Figma operation is a programmatic component scan via use_figma (Step 1), and there is no visual validation step. This violates least-privilege (C8) — the allowlist should be a curated subset of what the body actually uses.
- **Recommendation:** Drop mcp__figma__get_screenshot from allowed-tools, OR (if a visual sanity-check of the mapped components is desired) add an explicit screenshot/validation step to the body so the grant is justified. Given the skill produces a JSON mapping with no visual output, removing it is the cleaner fix.

### Dimension `C9` (1)

**`system`** — `C9` · status: unverified · confidence: medium · effort: S

- **Evidence:** propose-components/SKILL.md:177 `node .claude/scripts/generate-proposal-html.js` (relative path). generate-proposal-html.js:12-14 resolves ROOT via `path.resolve(__dirname, '../..')` and reads/writes absolute paths — script itself is path-safe. But the invocation assumes cwd == project root.
- **Problem:** The script resolves its own paths correctly via __dirname (robust), but the skill instruction invokes it with a relative `node .claude/scripts/...` that only works when the working directory is the project root. If a future skill or a user runs the step from a subdirectory, `node` fails to find the file. Low severity since the script's internal path handling is correct and current callers run from root.
- **Recommendation:** Optional hardening: document/enforce running from project root, or have the skill resolve the script path relative to a known anchor. Not urgent.

### Dimension `P1` (1)

**`build-design-rules`** — `P1` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/build-design-rules/ contains only SKILL.md (no gotchas.md); SKILL.md:11 "!cat .claude/skills/build-design-rules/gotchas.md 2>/dev/null || echo \"No gotchas yet.\""
- **Problem:** This is a build-* pipeline skill, which per project rule P1 must have a dedicated gotchas.md as its primary store for skill-scoped learnings. The folder has no gotchas.md, while sibling pipeline skills build-foundations, build-components, compose-page, and propose-components all do. SKILL.md already references the file via the dynamic cat line, so the contract is declared but the file is missing — every run currently prints the 'No gotchas yet.' fallback and there is nowhere for corrections to accumulate.
- **Recommendation:** Create .claude/skills/build-design-rules/gotchas.md (it may start with a brief header and a placeholder bullet, mirroring the other build-* skills) so the dynamic-context injection has a real target and future learnings have a home.

### Dimension `P11` (1)

**`compose-page`** — `P11` · status: unverified · confidence: high · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md — Step 9 is the final section ('Summary', lines 203-218); there is no 'After Completion' step instructing to append user corrections to gotchas.md. grep across build-components/build-foundations/propose-components/analyze-theme also returns 0 matches.
- **Problem:** The project's chosen self-learning mechanism (P11) — an 'After Completion' step that appends any user-corrected approach (with date/context) to this skill's gotchas.md — is absent. This is the write-side of the loop whose read-side is already broken (see compose-page-P2-01), so encoded learnings neither get written nor injected. Note this gap is system-wide (no pipeline skill has it), so it is a convention not yet adopted rather than a compose-page-only regression.
- **Recommendation:** Add a final 'After Completion' step: 'If the user corrected the approach during this run (section order, color-scheme reading, pairing layout, etc.), append the correction with today's date and brief context to .claude/skills/compose-page/gotchas.md.' Roll out uniformly across pipeline skills.

### Dimension `P2` (1)

**`compose-page`** — `P2` · status: adjusted · confidence: high · effort: S

- **Evidence:** .claude/skills/compose-page/SKILL.md:10-12 — "```sh\n!cat .claude/skills/compose-page/gotchas.md 2>/dev/null || echo \"No gotchas yet.\"\n```"
- **Problem:** The dynamic gotchas-injection is placed INSIDE a fenced ```sh code block as the plain text line `!cat ...`. Claude Code's command-execution dynamic-context syntax requires a bare inline backtick-delimited form ( !`...` ) to actually run at invocation time. Wrapped in a code fence with no surrounding backticks, this is treated as literal display text and is NOT executed — so this skill's gotchas.md is never actually injected when the skill loads. The entire per-skill gotchas mechanism (the point of P1/P2 and the learning loop) silently does nothing. Note: every skill in the repo (build-components, build-foundations, propose-components, analyze-theme) repeats this exact broken pattern, so the defect is system-wide, but it nullifies P2 for compose-page specifically.
- **Recommendation:** Replace the fenced block with a real inline command-context line so it executes, e.g. a single line: Gotchas (read at runtime): !`cat .claude/skills/compose-page/gotchas.md 2>/dev/null || echo "No gotchas yet."` — with backticks wrapping the command, NOT inside a ```sh fence. Verify the path matches the skill's own folder (it does). Apply the same fix across all skills since the pattern is uniform.

---

## ❌ Refuted by adversarial verification (4)

These claims were rejected by an independent skeptic agent and are **not** counted as findings.

**`build-components`** — `P2` (severity claimed: high)

- **Claim (refuted):** The dynamic gotchas injection (P2) requires the !`cat ... gotchas.md` directive to execute at invocation so the skill's learnings are read from disk each run. Here it is rendered inside a fenced ```sh block. In Claude Code, the bang-execution dynamic-context substitution fires for an inline !`...` directive, not for shell shown as a fenced code sample — so the gotchas may be displayed as literal text rather than executed, meaning newly-appended learnings won't actually be injected. This pattern is identical across all four pipeline skills, so if intentional it is at least consistent (C2), but it diverges from the documented inline-bang mechanism.
- **Evidence cited:** SKILL.md:10-12 wraps the injection in a fenced code block: "```sh\n!cat .claude/skills/build-components/gotchas.md 2>/dev/null || echo \"No gotchas yet.\"\n```". The path is correct (matches the skill's own folder), but the `!cmd` dynamic-context directive is inside a ```sh fence.

**`propose-components`** — `C8` (severity claimed: high)

- **Claim (refuted):** This is the only skill in the system whose body shells out (node + open) to do real work (Step 9 generates and opens the visual proposal), yet Bash is not in its allowed-tools allowlist and is not pre-approved in settings.local.json. Under the declared least-privilege allowlist the Step 9 commands are not runnable, so the skill cannot complete its documented final deliverable without an out-of-band permission prompt/override. Sibling skills correctly omit Bash because they never shell out; here the omission is a genuine privilege/usage mismatch.
- **Evidence cited:** .claude/skills/propose-components/SKILL.md:7 'allowed-tools: [Read, Write, Glob, Grep]' vs SKILL.md:176-177 '```bash / node .claude/scripts/generate-proposal-html.js' and SKILL.md:182-183 '```bash / open .claude/figma-sync/proposal.html'. settings.local.json allow-list contains only narrow git/rm entries — no Bash(node...) or Bash(open...).

**`validate-instances`** — `B7` (severity claimed: high)

- **Claim (refuted):** The dynamic-context line injects the skill's gotchas.md at invocation, but that file does not exist, so it always resolves to the 'No gotchas yet.' fallback. The project's screenshot-validation learning ('never rationalize visual anomalies in Figma screenshots; a thin sliver = broken layout') — which is directly applicable to verifying auto-fixed instance swaps — is therefore encoded nowhere reachable by this skill. The skill's only persistent-learning channel is empty.
- **Evidence cited:** .claude/skills/validate-instances/SKILL.md:11 `!cat .claude/skills/validate-instances/gotchas.md 2>/dev/null || echo "No gotchas yet."` — but `ls` of the folder shows only `SKILL.md` exists; no gotchas.md on disk.

**`system`** — `C8` (severity claimed: high)

- **Claim (refuted):** propose-components Step 9 shells out to `node` and `open`, but Bash is not in its allowed-tools (under-scoped). The skill cannot execute its own mandatory Step 9 ('Step 9's proposal generator reads components.summary and aborts if missing' — referenced at line 166), so the documented visual-proposal step silently can't run as written.
- **Evidence cited:** propose-components/SKILL.md:7 allowed-tools: [Read, Write, Glob, Grep]; propose-components/SKILL.md:176-184 ```bash / node .claude/scripts/generate-proposal-html.js``` and ```bash / open .claude/figma-sync/proposal.html```; grep confirms NO skill declares Bash in allowed-tools; .claude/scripts/generate-proposal-html.js exists.
