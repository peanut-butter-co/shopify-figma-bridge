---
name: build-shopify-component
description: >
  Use when: BUILDING one design component into the Shopify host theme (config + code, as a single
  human-assisted step) — after foundations are built (SP-2) and the SP-1.1 work-order exists. The skill
  inspects the design intent + the host candidate section + schema, proposes a plan explaining how far
  settings reach and what needs code, the developer approves or corrects, then it executes (config first
  via the safe-write substrate + schema extensions, then code) behind backup+diff+approval+validate. One
  component per cycle, then offers the next. Gap-transparent; never silently approximates. Not for building
  Figma components — that is build-components. Not for foundations — that is build-shopify-foundations.
user-invocable: true
context: inline
allowed-tools: [Read, Write, Edit, Bash, Grep, mcp__figma__get_screenshot, mcp__playwright__browser_navigate, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_resize, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__resize_page]
---

```sh
!cat .claude/skills/build-shopify-component/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Build Shopify Component

You are building **one** design component into the Shopify host theme — **config and code as a single
human-assisted step** (the user's fixed model: "config y código son un único paso, pero human assisted").
You INSPECT, you PROPOSE a plan and explain every gap, the developer APPROVES or corrects, then you
EXECUTE (config first, then code) behind a backup+diff+approval safe write. You never approximate silently.

**Manifest:** `.claude/figma-sync/aristopet/manifest.json` (the active design source).
**Host theme:** `config.themeRoot` (currently `"."` — the repo root, crunchy-horizon). Sections live in
`<themeRoot>/sections/`, blocks in `<themeRoot>/blocks/`, placements in `<themeRoot>/templates/*.json` and
`<themeRoot>/sections/*-group.json`.
**Inputs:** `design-rules.json` (componentMap — verdict + host candidate + schema), `work-order.json`,
`manifest.compositions` (the design intent per template), `manifest.foundations` (already built by SP-2).
**Logic (single-sourced, tested):** `.claude/scripts/component-build.js`, `.claude/scripts/safe-shopify-write.js`,
`.claude/scripts/shopify-validate.js`.

---

## Pre-flight — HARD GATES (MANDATORY)

If any check fails, **STOP**, tell the user the exact prerequisite, and do NOT improvise or partially write
(CLAUDE.md: "NEVER skip a pipeline phase"; every gate is a HARD STOP).

1. Read the manifest. If unreadable or `compositions` is null → "Run the design reconstruction (SP-1) first."
2. **Foundations gate:** `buildStatus.shopifyFoundations === "complete"`. If not → **STOP**: "Build
   foundations first — run `/build-shopify-foundations`." (Colors + fonts must exist before components bind to them.)
3. `design-rules.json` + `work-order.json` exist. If not → "Run the SP-1.1 recompute (`recompute-aristopet.js`) first."
4. Resolve the target component: the named argument, else `nextComponent(componentMap, buildStatus)`. If the
   key is not a `componentMap` key → **STOP** and list the valid keys.
5. Verify the host theme: `<themeRoot>/config/settings_schema.json` exists. If not → "config.themeRoot does
   not point at a Shopify theme."
6. If `componentMap[key].reachability.verdict === "app"` → this is app-provided. Record the app-slot
   (`buildStatus.components[key] = "complete"`), tell the developer where the app block goes, and offer the
   next component. Do NOT write code.
7. **Visual-validation tools (HARD STOP):** the render gate (Step 3d) needs `mcp__figma__get_screenshot` AND a
   browser MCP (Playwright or chrome-devtools, e.g. `navigate_page`) to verify the build against the design.
   If the **required MCP tools** are not connected / unavailable, **STOP** and ask the developer to connect
   them — never skip the visual verify or declare a component done without one (project rule: never proceed
   without required MCP tools). (`app` components return at gate 6 and render nothing — they never reach here.)

---

## Step 0: Dev-server handshake (start it now)

Visual validation (Step 3d) renders the host theme in a browser, so the developer's **local preview must be
running**. Remind the developer now:

> Run `shopify theme dev` in the host theme (`<themeRoot>`) and tell me when it's up — paste the preview URL
> (default `http://127.0.0.1:9292`). You can start it while I inspect and plan; it must be running before the
> visual check.

Capture the URL; do **not** assume the server is up — wait for the developer's confirmation. If they decline
to start it, the config/code writes still happen behind backup+diff+approval, but you cannot close the loop
without the visual check — say so explicitly rather than declaring the component done. (`app` components never
reach here — they return at pre-flight gate 6.)

---

## Step 1: Inspect

Run the tested inspection (prints the report as JSON):

```bash
node -e '
const cb=require("./.claude/scripts/component-build.js"), fs=require("fs");
const root=require("./.claude/figma-sync/aristopet/manifest.json");
const cm=require("./.claude/figma-sync/aristopet/design-rules.json").componentMap;
const key=process.argv[1] || (cb.nextComponent(cm, root.buildStatus||{})||{}).key;
console.log(JSON.stringify({pick:key, inspect: cb.inspectComponent(key, cm, root.compositions)}, null, 2));
' "<KEY>"
```

Read: `verdict`, `candidate` (the host section to build ON, or null), `hostSchema` (its load-bearing
settings/blocks), and `usages` (one per template — the design intent `settings`/`blocks`/`colorScheme` and
any `mobileDivergence`). For a `config` baseline, open the candidate `.liquid` to see the full host schema +
markup. For `code`/`no-candidate`, there is no host section — you will author a new one.

## Step 2: Propose the plan (gap-transparent)

See `reference/plan.md` for the full method. In plain language, present:

- **config baseline:** propose the **mapping** of each design-intent setting to a host setting (or "code"),
  then run `configPlan(mapping, hostSchema)` and present its four buckets:
  - **applied** — design intent that maps to an existing host setting with an in-domain value (pure config).
  - **schemaExtensions** — NEW settings to add (à la SP-2). List every one.
  - **schemaWidenings** — existing select/range settings whose domain must grow (add an option / widen the
    range). Separate from extensions because they edit an existing setting in place, not append. List each.
  - **codeGaps** — intent with no host setting, plus any block types the host schema does not accept, plus
    any `mobileDivergence` (routed to code). List every one.
- **code / no-candidate:** propose a **new** `sections/<slug>.liquid` — its schema settings + a liquid
  skeleton bound to **foundations variables** (scheme colors + type styles), plus any new theme blocks.
- Ask the developer to **approve or correct** (e.g. "map `left_title` → host `heading`", "add an `eyebrow`
  setting", "this is code", "use 72 not 80"). Apply corrections to the mapping/plan before executing.

## Step 3: Execute — config first, then code (only after approval)

See `reference/execute.md` for the safe-write protocol. Order matters:

**a. Config**
1. **Backup** each file you will touch (`safe-shopify-write.js` `backup(src, destDir, stamp)`,
   `destDir=.claude/figma-sync/backups/`, `stamp=YYYYMMDD-HHMMSS`).
2. **Schema extensions:** for a host section, `injectSchemaSettings(liquidSource, schemaExtensions)` adds the
   new settings to its `{% schema %}` (the surrounding liquid stays byte-identical). For a new section, write
   the `{% schema %}` directly.
3. **Instance + settings:** write the section instance(s) into the relevant `templates/<t>.json` or
   `sections/<group>.json` with the `applied` settings/blocks (JSON). Inspect the host's existing placement
   to choose the target (chrome → `*-group.json`; page sections → `templates/<t>.json`).
4. **Diff + approval**, then **verify**: `verifyOnlyChanged(beforeJSON, afterJSON, approvedPrefixes)` for the
   JSON writes; a non-empty result → restore from backup and STOP.

**b. Code** (the `codeGaps`)
5. Author/edit `sections/<slug>.liquid` (+ blocks) for the gaps — markup bound to foundations variables,
   following `.claude/figma-best-practices.md` conventions. Behind **backup → diff → approval**.

**c. Validate**
6. `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass. If red, fix or restore + STOP.

**d. Visual verify (against the live preview)**
7. Confirm `shopify theme dev` is running (Step 0); if not, ask the developer to start it and wait. Open the
   preview URL with the browser MCP confirmed at pre-flight gate 7 — Playwright (`browser_navigate`) or
   chrome-devtools (`navigate_page`), whichever is connected. Navigate to the template that renders **{key}**,
   then screenshot it at desktop **and** mobile widths (`resize` ~1440, then ~390).
8. Fetch the design intent — `mcp__figma__get_screenshot` on the usage's `desktopNodeId` / `mobileNodeId` —
   and compare. A thin sliver, a collapsed section, missing text, an unbound/raw color, or wrong type means the
   layout is **broken**; never rationalize a visual anomaly (project rule — see gotchas). On divergence, fix
   the code and re-run **b → c → d**, or surface the gap to the developer. Only a faithful render at both
   breakpoints counts as done.

## Step 4: Record state

Set `buildStatus.components["<key>"] = "complete"` and `buildMeta.builtAt` in the manifest; write it back.

## Step 5: Summary + continue

```
Built {key} into {themeRoot}.
  Config:   {A} settings applied, {E} schema extensions
  Code:     {C} gaps authored ({slug}.liquid {+ N blocks})
  Gaps:     all listed + approved above
  Visual:   verified vs Figma {nodeId} — desktop + mobile
Backups:    .claude/figma-sync/backups/
```

Then run `nextComponent` again and offer the next un-built component (or report all components complete).

## After Completion

If the user corrected your approach during this run — a wrong intent→host mapping, a schema-extension choice,
a placement (template vs group) gotcha, a liquid/binding convention, a write/verify gotcha — append it as a
short **dated bullet** to this skill's `gotchas.md` (`.claude/skills/build-shopify-component/gotchas.md`;
create it if missing). That file is injected at the top of this skill on every invocation, so the next run
starts with the lesson. This is the project's self-updating learning loop (P11/B7).
