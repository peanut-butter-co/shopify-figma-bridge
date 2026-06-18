# Write protocol (reference)

The lean write model (2026-06-10 pivot — the heavy backup + verify substrate is archived under
`docs/superpowers/archive/2026-06-10-safe-write-substrate/`). **Edit directly → validate → spot-check.** No
backups (git is the safety net; this is a dev theme served by `shopify theme dev`, never prod), no per-write
verify gate. Reused by the per-component build (spec #3).

## Principle: preserve formatting by construction

Reserializing a whole file (`parse → JSON.stringify → write`) reformats it unless your serializer reproduces
the file's exact bytes — and Horizon's `settings_schema.json` is CRLF + hand-mixed (some option arrays inline,
some expanded), so a full rewrite reflows every line (a huge spurious diff `theme dev` would push). So:

- **A few targeted changes** → surgical `Edit` (exact string-replace: can't reformat what it doesn't touch,
  fails loud on a missing/ambiguous match, never corrupts structure).
- **Many scattered changes in a file that round-trips faithfully** → programmatic *set-by-path then write*.
- **Fidelity guard (cheap):** before any programmatic write, assert `serialize(parse(original)) === original`.
  False → that file won't round-trip; use a surgical `Edit` instead.

## settings_data.json (theme-wide settings)

JSONC: a leading `/* auto-generated */` header, then JSON. It round-trips faithfully (LF, 2-space), so a
programmatic write is clean:

1. `parseSettingsData(text)` (strips the header) → the object.
2. `applyPlan(plan, schema, data)` (`foundations-map.js`) merges the approved scheme/type/font keys → `data`.
3. Write `settingsDataHeader(originalText) + JSON.stringify(data, null, 2) + "\n"` — re-prepend the header so
   the auto-generated banner survives.

## settings_schema.json (only the schemaExtensions)

CRLF + hand-mixed → **never reserialize.** For each `schemaExtension` (a new select option, e.g.
`type_size_h1 += {value:"80", label:"80px"}`), do a surgical `Edit`: insert the option in the exact sibling
format (same indentation + `\r\n`), in sorted position. One option object = 4 lines.

## Section .liquid schemas (per-component build)

To add settings to a section's `{% schema %}`, `injectSchemaSettings(liquidSource, newSettings)` parses only
the schema block, appends (deduped by id), and re-serializes that block — surrounding markup byte-identical.
For an EXISTING host section whose schema block isn't 2-space/LF, prefer a surgical `Edit` to avoid reflowing
the block; for a section you author from scratch, either is fine.

## Validate + spot-check (the real safety net)

1. `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass (0 errors). Optionally
   `shopify theme push --strict --only <file>` for Shopify's own upload validator.
2. Spot-check the live `:9292` preview (chrome-devtools — attaches to the running Chrome, fast). Confirm the
   change rendered; a render anomaly = broken, never rationalize it (project rule).

If validate is red or the render is wrong, fix forward (or `git checkout` the tracked file / `shopify theme
pull` the gitignored one) — but you won't be restoring a backup, because there isn't one.
