# Safe-write protocol (reference)

Mechanics live in `.claude/scripts/safe-shopify-write.js` (unit-tested). The interactive diff + approval
live in the skill. This protocol satisfies the hard rule *"all Shopify JSON writes require backup + diff
preview + user approval"* and is reused by the per-component build (spec #3).

For BOTH `config/settings_schema.json` and `config/settings_data.json`:

1. **Pull** — read the file. For `settings_data.json` use `parseSettingsData` (it is JSONC — a leading
   `/* … */` header then JSON) and keep `settingsDataHeader(text)` to re-prepend on write.
2. **Backup** — `backup(absPath, destDir, stamp)` copies to
   `.claude/figma-sync/backups/<base>.<stamp>.json`. The `stamp` is `YYYYMMDD-HHMMSS`. Mandatory: the
   theme editor can overwrite `settings_data.json`.
3. **Build "after"** — `applyPlan(plan, schema, data) → { schema, data }` (pure; merges scheme roles,
   sets `type_*`/font keys, appends missing select options; surplus host schemes are surfaced but NOT deleted).
4. **Diff-preview + approval** — show the before→after at key level; block until the developer approves.
5. **Write** — serialize the approved objects. Re-prepend the JSONC header to `settings_data.json`.
6. **Verify** — `verifyOnlyChanged(before, after, approvedPrefixes)`. `approvedPrefixes` =
   `['current.color_schemes', 'current.type_…', …]` (exactly the keys you intended). A non-empty result
   means an unexpected change slipped in → **restore from the backup** and STOP.
7. **Validate** — `node .claude/scripts/shopify-validate.js <themeRoot>` must pass.
