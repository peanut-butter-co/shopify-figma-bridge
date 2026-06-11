# Element Foundations — design spec

**Date:** 2026-06-11
**Status:** Approved design (pre-implementation)
**Phase:** SP-2 downstream — extends `build-shopify-foundations` (design → Shopify host theme)
**Not:** the Figma-side `build-foundations` (that builds Figma variables/styles)

---

## Motivation

`build-shopify-foundations` today writes only **Colors** and **Typography** into the host theme. Everything
else that governs a theme's visual language — button/input/badge radii, border widths, text case, page
width, swatch & variant-picker styling — keeps Horizon's defaults. Live symptom (dogfooding, 2026-06-11):
the split-banner built faithfully, but its buttons render with **rounded corners** while the Figma design is
**square**. That is not a component bug — it is a foundations gap. Current host values vs design intent:

| Host setting | Now | Design wants |
|---|---|---|
| `button_border_radius_primary` | 14 | 0 |
| `button_border_radius_secondary` | 14 | 0 |
| `inputs_border_radius` | 4 | 0 |
| `card_corner_radius` | 4 | 0 |
| `secondary_button_border_width` | 1 | 1 ✓ |
| `product_corner_radius` | 0 | 0 ✓ |

## Goal

Extend `build-shopify-foundations` to configure the theme's **element primitives** from the design, using the
same proven mechanism it already uses for `type_*` (write values into `config/settings_data.json`,
gap-transparent, behind the explicit approval gate). Theme-agnostic with a Horizon-guided fast path.

## Decisions (from brainstorming)

1. **Scope** — the 7 Horizon groups Pablo named *plus adjacent visual primitives*: Page Layout (`page_width`),
   Badges, Buttons, Input Fields, Popovers & Modals, Swatches, Variant Pickers, **plus** `product_corner_radius`,
   `card_corner_radius`, `icon_stroke`. **Excluded:** behavioral settings (cart type, quick-add, breadcrumbs,
   animations, drawers behavior).
2. **Source of values** — build the **mapping + write layer now**, sourced from tokens **already in the
   manifest** (`foundations.spacing.{radii,borderWidths}`, which are *per-element*) + a per-element
   **recommendation table in the theme profile**. Ambiguous / missing tokens → **gap** (never invented).
   Per-element extraction *from Figma* (badges, page-width, swatch/variant/popover styling) is **deferred**
   (roadmap F6/F10).
3. **Architecture** — Approach A: recommendations as **data** in the theme profile + a **pure module**
   `elements-map.js` (mirrors `foundations-map.js`) + a **lean generic fallback** for themes without a profile.

## Ground truth (already present)

`manifest.foundations.spacing`:
```json
{ "scale":[0,4,8,12,16,20,24,32,40,48,60,80,120],
  "radii":  { "button_primary":0, "button_secondary":0, "input":0, "card":0 },
  "borderWidths": { "button_secondary":1, "input":1 } }
```
`foundations.typography.presets` includes `overline` (role=label, case=uppercase) and the `body` role — the
source for button text-case and button font.
`theme-profiles/horizon.json` already has a `recommendations` block (and `evil-horizon.json` already has a
`recommendations.foundations` key) — i.e. the recommendation layer has a home.
All target host settings are **flat theme settings** in `config/settings_schema.json`, and the radii ranges
are `[0–100]`/`[0–40]`, so writing `0` is **in-domain** (no schema extension needed for the core case).

---

## Design

### Data flow

```
manifest.foundations.spacing.{radii,borderWidths}        ┐
manifest.foundations.typography (preset case, font role) ┤→ elements-map.js → plan ─→ build-shopify-foundations
theme-profiles/horizon.json  recommendations.elements    ┘   (applied/exts/gaps)      (approve F8 → write → verify)
host: config/settings_schema.json (domains) + settings_data.json (current values, for old→new diff)
```

### 1. `recommendations.elements` (data, in `theme-profiles/horizon.json`)

Each entry maps a design concept to a **source** (a path into `manifest.foundations`), an optional
**transform**, and the **host** setting id(s) it writes:

```jsonc
"elements": {
  "button_primary_radius":   { "source": "spacing.radii.button_primary",          "host": ["button_border_radius_primary"] },
  "button_secondary_radius": { "source": "spacing.radii.button_secondary",        "host": ["button_border_radius_secondary"] },
  "input_radius":            { "source": "spacing.radii.input",                   "host": ["inputs_border_radius"] },
  "card_radius":             { "source": "spacing.radii.card",                    "host": ["card_corner_radius","product_corner_radius"] },
  "secondary_button_border": { "source": "spacing.borderWidths.button_secondary", "host": ["secondary_button_border_width"] },
  "input_border":            { "source": "spacing.borderWidths.input",            "host": ["input_border_width"] },
  "button_case":             { "source": "typography.preset:overline.case", "transform": "case",     "host": ["button_text_case_primary","button_text_case_secondary"] },
  "button_font":             { "source": "typography.role:body",            "transform": "fontRole", "host": ["type_font_button_primary","type_font_button_secondary"] }
}
```

**Source DSL** (resolved against `manifest.foundations`):
- `spacing.radii.<k>` / `spacing.borderWidths.<k>` — direct dotted path → a number.
- `typography.preset:<name>.<attr>` — the preset whose key/name is `<name>`, its `<attr>` (e.g. `case`).
- `typography.role:<role>` — a font-role token (resolves to the host font-option name).

**Transforms** (named, in code):
- `case`: `uppercase → "uppercase"`, anything else → `"default"` (matches host `button_text_case_*` options).
- `fontRole`: `body → "body"`, `heading|accent → "accent"` (matches host `type_font_button_*` options).
- (none): pass the numeric value straight through.

Host settings in scope with **no design token** (badges, `page_width`, popovers, swatches, variant-pickers,
`pills_border_radius`, `icon_stroke`) are intentionally **not** in the table → the module emits a
`no-design-token` gap (leaves the host default, surfaces it). Extraction (F6/F10) fills these later.

### 2. `elements-map.js` (pure module, mirrors `foundations-map.js`)

```
elementsMap(foundations, profileElements, liveSchema, liveData)
  → { applied:[{id, value, old}], schemaExtensions:[], schemaWidenings:[], gaps:[{kind, detail}] }
applyElementPlan(plan, data) → data'   // merges `applied` into settings_data.current (non-destructive)
```

Per `profileElements` entry: resolve `source` from `foundations`; if missing → `gap{source-missing}`. Apply
the transform. For each `host` id: validate the value against `liveSchema`'s domain via the shared
`settingValueIssue` (reused from `shopify-validate.js`):
- in-domain → `applied` (read `old` from `liveData.current` for the diff; equal old==new is still listed, marked no-op),
- off-domain on `range`/`select` → `schemaWidening`,
- absent from schema → `schemaExtension`,
- otherwise → `gap{value-out-of-domain}`.

Host element settings present in `liveSchema`'s in-scope groups but covered by **no** entry → `gap{no-design-token}`.

**Generic fallback** (no `profileElements`, i.e. unknown theme): scan `liveSchema` for ids matching
`*_radius` / `*corner_radius` / `*_border_width` / `*_text_case` / `type_font_*`, attempt a name-similarity
match to `foundations.spacing.radii.*` / `borderWidths.*` keys, and emit every proposal as
`gap{generic-needs-confirm}` (best-effort, nothing auto-applied without dev confirmation).

### 3. Skill integration (`build-shopify-foundations`)

A new step after Typography, before "record state":
1. Run `elementsMap` over the live host.
2. Present the plan in plain language — every setting `old → new` and every gap — and pass the **explicit
   approval gate (F8, HARD STOP)**: present the concrete diff, get approval of *this diff*, don't fold it
   into another question.
3. On approval: write `applied` into `settings_data.json` via `applyElementPlan` (re-prepend the JSONC
   header, as the typography write does); apply any `schemaExtensions`/`schemaWidenings` as surgical edits.
4. `shopify-validate` (0 errors) → visual spot-check on the live preview (buttons now square).

Theme-agnostic switch: use `recommendations.elements` when the resolved theme profile has it; else the
generic fallback. (`manifest.theme.hasProfile` already gates profile use elsewhere.)

### 4. Gaps & honesty

Gap kinds: `no-design-token` (host setting in scope, no design source — left at host default), `source-missing`
(profile references a foundations token that isn't there), `value-out-of-domain` (can't widen safely),
`generic-needs-confirm` (fallback proposal). All are surfaced in the plan; nothing is silently approximated.

### 5. Worked example (Aristopet / Horizon)

- **Applied (~8):** `button_border_radius_primary` 14→**0**, `button_border_radius_secondary` 14→**0**,
  `inputs_border_radius` 4→**0**, `card_corner_radius` 4→**0**, `product_corner_radius` 0→0 (no-op),
  `secondary_button_border_width` 1→1 (no-op), `input_border_width`→1, `button_text_case_{primary,secondary}`→**uppercase**,
  `type_font_button_{primary,secondary}`→**body**. → fixes the rounded-button bug.
- **Gaps (`no-design-token`, left at default + surfaced):** `badge_corner_radius` (100), badge
  position/font/transform, `page_width` (narrow), `popover_*`, `variant_swatch_*`, `variant_button_*`,
  `pills_border_radius`, `icon_stroke`.

### 6. Testing (`skills-tests.js`)

- Horizon path: `button_*_radius` 14→0 land in `applied` with correct `old`; `button_case`→uppercase;
  `button_font`→body.
- `no-design-token` gaps emitted for badges/page_width/popover/swatch/variant-picker.
- Off-domain value → `schemaWidening` (not silently dropped); unknown id → `schemaExtension`.
- Generic fallback (no profile): every proposal is `generic-needs-confirm`, nothing auto-applied.
- `applyElementPlan` merges non-destructively (host-only settings preserved) and round-trips `settings_data`.

---

## Out of scope / deferred

- **Per-element extraction from Figma** (badges, page-width, popover/swatch/variant-picker styling, and
  confirming button/input/card values straight from the Figma element styles) — roadmap **F6/F10**. Until
  then those are `no-design-token` gaps.
- Behavioral settings (cart, quick-add, animations, drawers, breadcrumbs).
- The Figma-side `build-foundations` (variables/styles) is unaffected.

## Decision points (resolved as proposed; easy to revisit)

- `card_radius` → both `card_corner_radius` **and** `product_corner_radius` (design has one `card` token).
- `button_case` sourced from the `overline` (label) preset's `case`.
