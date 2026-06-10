# Foundations → crunchy-horizon mapping reference

The deterministic mapping lives in `.claude/scripts/foundations-map.js` (pure, unit-tested). This doc
is the human-readable companion: what maps where, and what becomes a gap.

## Colors — `mapSchemes` (near 1:1)

Horizon's `color_scheme_group` (id `color_schemes`) defines its roles with `"alpha": true`, so Aristopet
alpha colors store directly. `normalizeColor` round-trips each value to Horizon's convention
(`rgba(0,0,0,0)` for transparent, `#rrggbb[aa]` otherwise).

| Aristopet role | Horizon role |
|---|---|
| `background`, `foreground_heading`, `foreground`, `border`, `primary` | identical ids |
| `primary_button_background` / `_text` / `_border` | identical ids |
| `secondary_button_background` / `_text` | identical ids |
| `inputs_text` / `inputs_border` / `inputs_hover_background` | `input_text_color` / `input_border_color` / `input_hover_background` |
| `foreground_chip` | — (orphan → `orphan-role` gap, dropped) |

- **Schemes:** populate `scheme-1..4` (the ids `compositions[*].order[*].colorScheme` references). Host
  surplus schemes not in foundations → `pruneSchemes`. `applyPlan` MERGES mapped roles over the existing
  scheme settings, preserving Horizon-only roles (`primary_hover`, `shadow`, `*_hover_*`, `variant_*`,
  `selected_variant_*`).

## Typography — `mapTypography`

- **Fonts:** `type_body_font ← fontRoles.body.raw`, `type_subheading_font ← fontRoles.label.raw`,
  `type_heading_font ← fontRoles.heading.raw`. `type_accent_font` left at the host default
  (`accent-left-default` gap). Heading font emits a `verify-font-availability` gap (Instrument Sans may
  not be in the Shopify library → propose a custom font source).
- **Levels:** presets `h1,h2,h3 → h1,h2,h3`; `paragraph → paragraph`. `overline`/`caption` are
  component-level (`component-level-preset` gap, handled in spec #3).
- **Size** (`type_size_h{n}`, select of px): exact when on the host ladder; otherwise a
  `schemaExtensions` entry adds the value (Aristopet `h1 = 80px` triggers this) + a
  `size-ladder-extension` gap.
- **Line-height** (token select): `bucket = pct < 100 ? 'tight' : pct <= 125 ? 'normal' : 'loose'`, then
  the live option ending with that bucket (`display-*` for headings, `body-*` for paragraph). Aristopet
  `lineHeight` is a percentage. Emits an `approx-line-height` gap.
- **Letter-spacing** (token select): `bucket = v < 0 ? 'tight' : v === 0 ? 'normal' : 'loose'`. Emits an
  `approx-letter-spacing` gap.
- **Case:** `uppercase` → `uppercase`, else `none` (exact).

## Gap kinds (surface ALL of these in the proposal)

`orphan-role` · `size-ladder-extension` · `approx-line-height` · `approx-letter-spacing` ·
`verify-font-availability` · `accent-left-default` · `component-level-preset`. Plus `pruneSchemes` (the
host schemes to remove). Nothing is applied silently — the developer sees every gap and decides.
