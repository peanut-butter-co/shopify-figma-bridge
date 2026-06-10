# Executing a component build (reference)

Mechanics live in `.claude/scripts/safe-shopify-write.js` + `.claude/scripts/shopify-validate.js` (tested).
The interactive diff + approval live in the skill. This satisfies the hard rule *"all Shopify JSON writes
require backup + diff preview + user approval"* and reuses SP-2's substrate
(`build-shopify-foundations/reference/safe-write.md`). Execute **config first, then code — then verify visually
against the live preview**.

## a. Config

1. **Backup** every file you will touch — `backup(absPath, destDir, stamp)` →
   `.claude/figma-sync/backups/<base>.<stamp>.json` (`stamp` = `YYYYMMDD-HHMMSS`). The theme editor can
   overwrite these files; the backup is mandatory.
2. **Schema edits** (from `configPlan`):
   - **New settings** (`schemaExtensions`) → `injectSchemaSettings(liquidSource, schemaExtensions)` appends
     them to the section `{% schema %}` (dedup by id; surrounding liquid byte-identical).
   - **Widenings** (`schemaWidenings`) → edit the EXISTING setting's option list / min-max in the parsed
     schema, then re-serialize. Do NOT pass these to `injectSchemaSettings` — it dedups by id, so a widening
     of an existing id silently no-ops. (`configPlan` keeps the two buckets apart for exactly this reason.)
   - New section → write the `{% schema %}` block directly.
3. **Instance + settings** — write the section instance(s) into the placement JSON with the `applied`
   settings/blocks:
   - Page sections → `templates/<template>.json` (add to `sections` + `order`).
   - Chrome (header/footer/announcement) → `sections/<group>.json` (e.g. `header-group.json`).
   Inspect the host's existing placement first to pick the right target and key.
4. **Diff + approval** — show before→after at key level; block until approved.
5. **Verify (JSON writes)** — `verifyOnlyChanged(beforeJSON, afterJSON, approvedPrefixes)`; a non-empty
   result means an unexpected change slipped in → **restore from backup** and STOP.

## b. Code (the `codeGaps`)

6. Author/edit `sections/<slug>.liquid` (+ `blocks/<name>.liquid`) for the gaps. Markup bound to foundations
   variables (scheme colors via `color_scheme`; type via the foundations text styles) — never hardcode
   colors/sizes. Behind **backup → diff → approval**. The liquid for `.liquid` files is compared textually
   (not `verifyOnlyChanged`, which is for JSON).

## c. Validate

7. `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass (schema + template JSON + section-type
   resolution + block checks). If red → fix or restore from backup, then STOP. Never leave the host theme in
   a state validate-shopify rejects.

## d. Visual verify (live preview)

Static validation proves the JSON/schema are well-formed; it does NOT prove the component *renders*. Close the
loop against the running `shopify theme dev` preview (SKILL Step 0 — the developer starts it and gives you the
URL, default `http://127.0.0.1:9292`).

8. **Render.** Open the preview with the browser MCP — Playwright (`browser_navigate` / `browser_resize` /
   `browser_take_screenshot`) or chrome-devtools (`navigate_page` / `resize_page` / `take_screenshot`),
   whichever is connected (availability is enforced at SKILL pre-flight gate 7 — a missing browser/Figma MCP
   hard-STOPs the run). Navigate to the template that renders the component and screenshot it at desktop
   (~1440) and mobile (~390).
9. **Compare to intent.** `mcp__figma__get_screenshot` on the usage's `desktopNodeId` / `mobileNodeId`. Put the
   two side by side. A thin sliver, a collapsed/absent section, missing text, a raw (unbound) color, or wrong
   type = **broken** — never rationalize it (project memory: a visual anomaly is real, not a quirk). On
   divergence, fix the code and re-run **b → c → d**, or surface the gap. Only a faithful render at both
   breakpoints is "done".

## Order matters

Config first means the host section + its schema exist before you write its template instance, and the
schema extensions exist before any code references them. If config verify fails, you restore before
touching code — the theme never ends a run half-written. And visual verify is **last**: nothing is "done"
until the running preview matches the design intent at both breakpoints — `shopify-validate` green is
necessary, not sufficient.
