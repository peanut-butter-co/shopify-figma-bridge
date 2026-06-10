# build-shopify-component — gotchas

Dated, hard-won lessons. Injected at the top of the skill on every run. Append a bullet whenever the
developer corrects your approach (see SKILL.md "After Completion").

- 2026-06-10 (seed) — **Section instances live in `templates/<t>.json` or `sections/<group>.json`, never in
  `settings_data.json`.** `settings_data.json` is theme-wide settings only (foundations). A section's
  settings/blocks belong to its instance in the template/section-group JSON. Writing them to settings_data
  ships nothing.
- 2026-06-10 (seed) — **Edit only the `{% schema %}` block, never hand-reflow the liquid.** Use
  `injectSchemaSettings` (it replaces only the schema block, leaving markup byte-identical). Hand-editing
  the whole `.liquid` to add a setting risks corrupting unrelated markup.
- 2026-06-10 (seed) — **Off-process settings vocabulary ≠ host vocabulary.** Aristopet's intent keys
  (`left_title`, `menu_item_1`, …) are NOT Horizon's. `configPlan` reports almost everything as a
  schema-extension or code-gap on the first pass — that is correct, not a bug. The mapping (intent → host
  setting) is the developer-confirmed semantic step; the helper only validates it.
- 2026-06-10 (seed) — **Chrome vs page sections.** Header/footer/announcement chrome is placed via
  `sections/header-group.json` / `sections/footer-group.json`, not the page template. Inspect the host's
  existing placement before choosing the write target.
