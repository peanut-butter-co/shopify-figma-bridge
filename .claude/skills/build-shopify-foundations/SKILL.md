---
name: build-shopify-foundations
description: >
  Use when: WRITING the design foundations (color schemes + typography) into the Shopify host theme FROM the reconstructed foundations in the manifest (requires foundations populated — e.g. by SP-1/analyze-theme — and config.themeRoot pointing at the host theme). Human-assisted: it inspects, proposes a plan and explains the gaps, you approve or correct, then it writes behind a backup+diff. Use ONLY for foundations (colors + fonts); the per-component build is a separate skill. Not for building Figma variables — that is build-foundations.
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
- **Color schemes:** the 4 schemes and their role values being written (note alpha is preserved natively).
- **Typography:** fonts + type scale; **list every `schemaExtension`** ("add 80px to `type_size_h1`") and **every gap** (`orphan-role` `foreground_chip` dropped; `approx-line-height`/`approx-letter-spacing` token choices with the source value; `verify-font-availability` for Instrument Sans; `component-level-preset` overline/caption skipped; `pruneSchemes` to remove).
- Ask the developer to approve or correct (e.g. "use 72 not 80", "keep scheme-5", "Instrument Sans isn't available → add a custom font source"). Apply any corrections to the plan object before executing.

See `reference/mapping.md` for the full mapping reference; `reference/safe-write.md` for the write protocol.

## Step 3: Execute via the safe write

Only after approval. For BOTH `config/settings_schema.json` and `config/settings_data.json`:

1. **Backup** each file to `.claude/figma-sync/backups/` (use `safe-shopify-write.js` `backup(src, destDir, stamp)`).
2. **Apply** the approved plan with `foundations-map.js` `applyPlan(plan, schema, data)` → `{ schema, data }`.
3. **Write** the results. For `settings_data.json`, re-prepend the original JSONC header (`safe-shopify-write.js` `settingsDataHeader`) so the auto-generated banner survives.
4. **Verify** with `verifyOnlyChanged(beforeData, afterData, approvedPrefixes)` where `approvedPrefixes` covers exactly `current.color_schemes`, plus the written `type_*`/font keys. If it returns violations → **restore from backup** and STOP.
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
