# validate-shopify test fixture

A deliberately minimal Shopify theme used by `.claude/scripts/skills-tests.js` to
exercise `shopify-validate.js`'s `validateTheme()` end to end. **Not a real theme** —
just enough structure (one template, one section schema, one block, settings_data)
to drive the deterministic checks.

The repo gitignores theme files by default (whitelist `.gitignore`); this fixture is
explicitly un-ignored so the harness stays reproducible.

## Planted issues (asserted by the harness)

Everything here is valid **except** the deliberate violations below — the end-to-end
test asserts `validateTheme()` reports exactly these:

- `templates/index.json` → `sections.hero.settings.color_scheme` references
  `scheme-2`, which is **not** defined in `config/settings_data.json` (only
  `scheme-1` exists) → 1 ERROR (`colorSchemeRefIssues`).

Everything else is intentionally clean: the range step (4) divides the interval
(0–100) evenly, the select has 2 options (≤ 50), and block type `text` resolves to
`blocks/text.liquid`. The two JSON files carry the auto-generated `/* … */` header
Shopify's theme editor writes, so `validateTheme()`'s JSONC parser is exercised
end-to-end (bare `JSON.parse` would choke on it).

The harness asserts exactly **1 error, 0 warnings** (the `0 warnings` part is a
no-false-positive guard — no WARNING-producing check, e.g. orphaned settings, is
wired into `validateTheme()` yet; those land in BL-3 PR-B with their own planted
cases). To preserve the no-false-positive guarantee, add NEW planted issues here
deliberately and bump the expected counts in the harness — don't loosen the
exact-count assertion.
