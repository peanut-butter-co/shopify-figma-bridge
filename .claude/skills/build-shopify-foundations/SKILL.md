---
name: build-shopify-foundations
description: >
  Use when: WRITING the design foundations (color schemes + typography) into the Shopify host theme FROM the reconstructed foundations in the manifest (requires foundations populated — e.g. by SP-1/analyze-theme — and config.themeRoot pointing at the host theme). Human-assisted: it inspects, proposes a plan and explains the gaps, you approve or correct, then it writes directly (Edit / set-by-path) and validates. Use ONLY for foundations (colors + fonts); the per-component build is a separate skill. Not for building Figma variables — that is build-foundations.
user-invocable: true
context: inline
allowed-tools: [Read, Write, Edit, Bash, Grep]
---

```sh
!cat .claude/skills/build-shopify-foundations/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Build Shopify Foundations

You are landing the reconstructed design foundations — **color schemes + typography** — into the Shopify host theme's **native** systems (Horizon `color_scheme_group` + `type_*` settings). You POPULATE what maps cleanly and PROPOSE schema extensions for the gaps. You never approximate silently; you present a plan and the developer approves.

**Manifest:** `.claude/figma-sync/aristopet/manifest.json` (the active foundations source).
**Host theme:** `config.themeRoot` (currently `"."` — the repo root). Files: `config/settings_schema.json`, `config/settings_data.json`.
**Logic (single-sourced, tested):** `.claude/scripts/foundations-map.js`, `.claude/scripts/elements-map.js`, `.claude/scripts/safe-shopify-write.js`.

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

Read the resulting plan: `schemeWrites` (4 schemes), `fontWrites`, `typeWrites`, `schemaExtensions`, `surplusSchemes`, `gaps`.

Also compute the **element-foundations** plan (buttons/inputs/badges/popovers/swatches/variant-pickers
radii, borders, text-case, font, page width):

```bash
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
```

## Step 2: Propose the plan to the developer (gap-transparent)

Present, in plain language:
- **Color schemes:** the 4 schemes and their role values being written (note alpha is preserved natively).
- **Typography:** fonts + type scale; **list every `schemaExtension`** ("add 80px to `type_size_h1`") and **every gap** (`orphan-role` `foreground_chip` dropped; `approx-line-height`/`approx-letter-spacing` token choices with the source value; `verify-font-availability` for Instrument Sans; `component-level-preset` overline/caption skipped; `surplusSchemes` — host extras left in place, NOT auto-deleted, since host sections may still reference them).
- **Element foundations:** present every `applied` element setting (`old → new`, e.g. `button_border_radius_primary 14 → 0`), and every gap (`no-design-token` left at host default; `generic-needs-confirm` for un-profiled themes; `value-out-of-domain`/`source-missing`). Fold these into the **same explicit approval gate** as colors/typography.
- **Explicit approval gate (HARD STOP).** Present the concrete change set being approved: the exact settings that will change (each scheme role and each `type_*`/font field, old → new) and every `settings_schema.json` modification (each ladder/option extension). Get explicit approval of *this diff* — do NOT fold the approval into an unrelated sub-question (e.g. a single-scheme detail), and do NOT proceed to Step 3 until the developer approves. Apply any corrections to the plan first; if the change set moved, re-present it.
- Also surface, per Step 1's gaps: `host-capacity` (design defines more than the host can express — e.g. multiple body sizes vs Horizon's single `type_size_paragraph`), `partial-scheme-coverage` + `scheme-contrast-risk` (sparse schemes inheriting host roles), and `type-level-not-in-foundations` (host heading levels left at default). Note corrections like "use 72 not 80", "keep scheme-5", "Instrument Sans isn't available → add a custom font source".

See `reference/mapping.md` for the full mapping reference; `reference/safe-write.md` for the write protocol.

## Step 3: Execute — edit directly (after approval)

No backups, no per-write verify substrate — git is the safety net and this is a dev theme served by
`shopify theme dev`, never prod. Write the approved plan straight to the two files, choosing the edit that
**preserves formatting**:

- **`config/settings_data.json`** (theme-wide settings — schemes + type/font values): write programmatically
  by *set-by-path*. `applyPlan(plan, schema, data)` (`foundations-map.js`) returns **`{ schema, data }`** —
  deep clones with the approved `schemeWrites`/`typeWrites`/`fontWrites` merged into `data.current`.
  **Destructure it** — `const { data: merged } = applyPlan(plan, schema, data)` — then chain the element
  writes onto that same object (`merged = applyElementPlan(eplan, merged)`) and write **`merged`** back as
  `settingsDataHeader(original) + JSON.stringify(merged, null, 2) + "\n"` (re-prepend the JSONC header so the
  auto-generated banner survives). Do **NOT** serialize the return value itself — `JSON.stringify(applyPlan(...))`
  writes the `{schema,data}` wrapper and corrupts the file. This file round-trips faithfully (LF, standard
  indent), so reserializing touches only the values you changed. (The returned **`.schema`** is only an
  in-memory reference for the surgical option-adds below — never write it verbatim; it is reserialized to LF
  and would reflow the CRLF schema.)
- **`config/settings_schema.json`** (only the `schemaExtensions` — e.g. add an `80px` option to
  `type_size_h1`): do a **surgical `Edit`** that inserts the new option in the exact sibling format. Do **NOT**
  reserialize this file — it is CRLF + hand-mixed formatting, so a full rewrite reflows every line.
- **Element foundations:** write the approved element `applied` with `applyElementPlan(plan, data)` from `elements-map.js` (merges into `data.current`, same `settings_data.json` write path as typography — re-prepend the JSONC header). Apply `schemaWidenings`/`schemaExtensions` as surgical edits to `settings_schema.json` (CRLF-safe), exactly as for the type-scale ladder.

**Fidelity guard (cheap, do it):** before writing a file programmatically, assert
`serialize(parse(original)) === original`. False → that file won't round-trip; switch to a surgical `Edit`.
(settings_data passes; settings_schema does not — hence the split above.)

## Step 3b: Validate + ask who spot-checks

1. `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass (0 errors). The `theme dev` you're
   running also pushes on save and surfaces an invalid value.
2. **Ask the developer (AskUserQuestion) who validates the render:** (a) the developer validates it themselves
   (against the live preview / Figma), or (b) you validate via MCP. Only run the agent spot-check below if they pick (b).
3. **Agent spot-check (only if the developer chose it):** the live preview (`:9292`) — prefer **chrome-devtools**
   (attaches to the running Chrome; fast). Confirm the palette/fonts landed: `getComputedStyle` on `:root`
   `--color-background/foreground/primary` + `--font-*--family`, and `document.fonts.check('700 24px "<heading
   font>"')` to confirm a font actually loaded vs fell back. A render anomaly = broken; never rationalize it
   (project rule — **measured evidence over a visual glance**, the shared verify norm with build-shopify-component).
   Fast sanity check, not a hard gate.

## Step 4: Record state

Set `buildStatus.shopifyFoundations = "complete"` and `buildMeta.builtAt` in the manifest; write it back.

## Step 5: Summary

```
Shopify foundations written to {themeRoot}.
  Color schemes:  {N} populated (alpha native), {M} surplus left in place
  Fonts:          body / subheading / heading set
  Type scale:     {K} levels set, {E} schema extensions (e.g. type_size_h1 += 80px)
  Elements:       {A} settings applied (e.g. button radius → 0), {G} gaps
  Gaps surfaced:  {G} (approximations + skips, all listed above)
  Validated:      shopify-validate 0/0 + preview spot-check
Next: per-component build (spec #3).
```

## After Completion

If the user corrected your approach during this run — a wrong mapping, a token choice, a font-source decision, a write/format gotcha — append it as a short **dated bullet** to this skill's `gotchas.md` (`.claude/skills/build-shopify-foundations/gotchas.md`; create it if missing). That file is injected at the top of this skill on every invocation, so the next run starts with the lesson. This is the project's self-updating learning loop (P11/B7).
