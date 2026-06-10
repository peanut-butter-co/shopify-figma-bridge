# Archived: the "safe-write substrate" design for SP-2 / SP-3

**Date archived:** 2026-06-10 · **Reason:** pivoted to a lean direct-edit approach during the first live
test on Aristopet (crunchy-horizon @ `aristopet-5390`).

This folder is a **recovery copy** of the heavier design we replaced. The canonical history is in git;
these files just make the old design browsable without `git show`.

## What this design was

The downstream build (Shopify-side) originally wrapped every theme-file write in a substrate:

- **`backup(src, destDir, stamp)`** — copy the file to `.claude/figma-sync/backups/<base>.<stamp>.json` before writing.
- **reserialize-the-whole-file** — `parse → mutate the object → JSON.stringify(,,2) → write`.
- **`verifyOnlyChanged(before, after, approvedPrefixes)`** — diff before/after and abort+restore if any
  non-approved key changed.
- a **dry-run / fidelity gate** before the real write, plus an interactive **diff preview + approval** on
  every write (the CLAUDE.md rule "ALL Shopify JSON writes require backup + diff preview + user approval").

## Why we archived it

The first live foundations run exposed two problems:

1. **Reserializing reformats the file.** `config/settings_schema.json` on this host is **CRLF + hand-mixed
   formatting** (some option arrays inlined, some expanded). `JSON.stringify(,,2)` emits LF + uniform indent,
   so a full reserialize rewrote ~every line — a huge spurious diff `shopify theme dev` would push. Avoiding
   that forced round-trip fidelity checks, a 106-line temp driver, and dry-runs **— all ceremony created by
   the reserialize choice itself.**
2. **Too heavy for dev velocity.** Backups are redundant (git is the safety net; we never touch prod with an
   agent — only a throwaway dev theme via `shopify theme dev`), and the per-write verify/approval turned a
   tiny change into ~12 steps.

## What replaced it (the lean approach)

> **Discover → edit directly → validate → spot-check.**
> - **Discover** the constraints first (valid block/section *types* + setting *domains*) — the genuinely hard
>   part. This is unchanged: `foundations-map.js`, `component-build.js`, `reachability.js`, `contract.js`,
>   `shopify-validate.js (settingValueIssue)`.
> - **Edit directly:** surgical `Edit` for a few changes (exact string-replace → preserves formatting by
>   construction, fails loud, can't corrupt structure); a programmatic *set-by-path then write* for bulk
>   changes in a file that round-trips faithfully (e.g. `settings_data.json`, LF). **Never reserialize a file
>   whose formatting you can't reproduce.**
> - **Validate:** `shopify-validate.js` (and/or `shopify theme push --strict --only <file>`).
> - **Spot-check:** the live `:9292` preview via chrome-devtools (attaches to the running Chrome — fast).
> - **No backups** (git), **no verify-substrate**, **no dry-runs**.

## What we kept from the old design

- The **tested discovery / mapping / validation** logic — that was always the value: `foundations-map.js`,
  `component-build.js`, `shopify-validate.js`, `reachability.js`, `contract.js`.
- The **JSONC header helpers** (`parseSettingsData` / `settingsDataHeader`) — `settings_data.json` has an
  auto-generated comment header you must strip before parse and re-prepend on write.
- **`diffPaths`** — still handy for showing a change *summary* before a big write.
- **`injectSchemaSettings`** — surgical `{% schema %}` edit for sections we author/extend.

Dropped: `backup`, `verifyOnlyChanged`.

## Recovery

Files here are the heavy versions of:
`scripts/safe-shopify-write.js`, `build-shopify-foundations/{SKILL.md, reference/safe-write.md, reference/mapping.md}`,
`build-shopify-component/{SKILL.md, reference/execute.md, reference/plan.md}`.

Canonical git history: `37925f3` (SP-2), `ee5ea15` (SP-3), `eb71808` (SP-3 visual gate),
`c03dfdb` (foundations live run). Restore a single file with
`git show 37925f3:.claude/scripts/safe-shopify-write.js`.
