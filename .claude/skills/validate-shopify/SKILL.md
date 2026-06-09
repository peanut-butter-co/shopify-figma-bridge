---
name: validate-shopify
description: >
  Use when: writing or modifying Shopify template JSON files, section schemas,
  or settings_data.json. Also use before shopify theme push. Catches schema
  violations, setting dependency issues, range/step errors, and block type mismatches.
user-invocable: true
context: fork
allowed-tools: [Read, Glob, Grep]
---

# Validate Shopify

> **Reference:** thresholds, rationale, and worked examples for every check live in
> [`reference/schema-rules.md`](reference/schema-rules.md) — read it to interpret results
> (it also flags intentional patterns, e.g. the `-1` padding sentinel and UUID color-scheme
> keys, that are NOT violations).

## Purpose

Validate the structural and semantic correctness of a Shopify theme's configuration layer —
template JSON, section schemas, settings data, and cross-file references — catching errors
`shopify theme check` misses: setting-value violations, block-type mismatches, range/step math,
and orphaned references.

Run this skill:
- Before every `shopify theme push`
- After modifying any `templates/*.json` file
- After changing a section's `{% schema %}` block
- After editing `config/settings_data.json`
- When debugging "setting not applying" issues in the theme editor

---

## Step 1: Run the deterministic checks (scripted + unit-tested)

```sh
node .claude/scripts/shopify-validate.js [themeDir]   # defaults to the current directory
```

The script parses `templates/*.json`, section `{% schema %}` blocks, and
`config/settings_data.json` (tolerating Shopify's auto-generated `/* … */` JSONC headers),
runs the checks below, prints `ERROR:` / `WARNING:` lines, and exits non-zero on any ERROR.
The error-prone logic lives in `.claude/scripts/shopify-validate.js` (verified by the skills
harness) so it is implemented and tested once, not re-derived from prose.

**What it checks — name → severity** (detail in `reference/schema-rules.md`):

| Check | Phase | Severity |
|---|---|---|
| Template `order` ↔ `sections` consistency | 1.1 | ERROR |
| Section `type` resolves to `sections/<type>.liquid` | 1.2 | ERROR |
| Setting values vs schema — range bounds/step, select/radio membership, checkbox, number, color, font | 1.4 | ERROR |
| Block type accepted + `max_blocks` + block setting values | 1.5 | ERROR |
| Range step divides the interval; select ≤ 50 options | 2.2 / 2.3 | ERROR |
| Section & block setting-id uniqueness | 2.4 | ERROR |
| Block `type` ↔ `blocks/<type>.liquid` | 2.5 / 5.1 | ERROR |
| Preset setting values | 2.6 | ERROR |
| Color-scheme references defined in `settings_data` | 3.2 | ERROR |

The script already handles the common edge cases (sections without a `{% schema %}` block,
`shopify://`-managed sections, `@app` / `@theme` / file-backed blocks, translation-key labels,
the `-1` padding sentinel, UUID color-scheme keys) — see `schema-rules.md` for which patterns
are intentional.

---

## Step 2: Run the checks the script does NOT cover (manual)

These require scanning the `.liquid` sources, so run them by hand (detail in `schema-rules.md`):

- **Snippet references** [5.2 / ERROR]: grep `{% render '<name>' %}`; confirm `snippets/<name>.liquid` exists.
- **Asset references** [5.3 / WARNING]: grep `'<name>' | asset_url`; confirm `assets/<name>` exists (may be CDN-hosted).
- **Orphaned settings** [3.4 / WARNING]: a setting defined in a schema but never referenced in its liquid.
- **Conditional dependencies** [4.1 / WARNING — schema-rules #8]: a template sets a setting whose `condition` dependency isn't also set.
- **settings_data global fonts** [3.3 / WARNING]: font values must match `{family}_{style}{weight}` (e.g. `inter_n4`).

---

## Step 3: Interpret + report

- **ERROR** — must fix before `shopify theme push` (page won't render, or a setting is silently dropped).
- **WARNING** — review; may be intentional (check `schema-rules.md` for known-good patterns first).

Summarize as: templates/sections checked, then list errors and warnings as
`file → location → issue`. This is a **read-only** validator (`allowed-tools: [Read, Glob, Grep]`)
— it does not write files; hand the user the markdown if they want the report saved.

## After Completion

If the user corrected your approach during this run — a wrong assumption, a better
method, a binding/layout/naming gotcha, anything worth knowing next time — append it
as a short **dated bullet** to this skill's `gotchas.md`
(`.claude/skills/validate-shopify/gotchas.md`; create the file if it does not exist). That
file is injected at the top of this skill on every invocation, so the next run starts
with the lesson. This is the project's self-updating learning loop (P11/B7).
