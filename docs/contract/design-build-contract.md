# The design->build contract

The load-bearing seam between "design" and "build". Three normalized artifacts (SP-0 / Approach A);
the design spec is [docs/research/2026-06-09-sp0-contract-design.md](../research/2026-06-09-sp0-contract-design.md).
Enforced by `.claude/scripts/contract.js` + `.claude/scripts/reachability.js`; the canonical valid
instance is `.claude/scripts/fixtures/contract/`. **Producing Aristopet's instance is SP-1, not this contract.**

## 1. `design-rules.json` > `componentMap` (the single reference)

One entry per component, keyed by slug (sections) or component name (atoms/blocks). `exists` is
VERIFIED from the filesystem (never guessed — closes `[DESIGN-RULES-TRUST]`); `schema` is the parsed
`{% schema %}`; `reachability` is the component-level baseline verdict.

- `figma.representation`: `variant-set` | `separate-components`.
- `figma.desktop` / `figma.mobile`: the two design frames (D4); `mobile` is `null` when there is no distinct mobile frame.
- `theme.exists`: boolean (from `resolveHostSection`). `theme.kind`: `section` | `theme-block` | `app-block` | `snippet`.
- `schema`: `null` when `exists:false`; else `{ settings, blocks, max_blocks, presets, enabledOn }`. Only `settings`/`blocks`/`max_blocks` are load-bearing for the deterministic expressibility check; `presets`/`enabledOn` are informational and not shape-enforced.
- `reachability.verdict`: `config` | `code` | `app` | `out-of-scope`.
- `reachability.basis` enum: `instance-of-library` · `css-hardcoded` · `schema-expressible` · `no-candidate`
  · `block-type-unsupported` · `value-out-of-domain` · `max-blocks-exceeded` · `mobile-divergence` · `app-slot` · `liquid-only`.
- `reachability.confidence`: `high` | `medium` | `low`. `reachability.candidate`: host section if config, else `null`.

## 2. `manifest.compositions` (the layout)

Order + values per template; references `componentMap` **by key** (the normalized indirection). No
provenance fields. Each `order[*]` carries BOTH frame node-ids (`desktopNodeId` / `mobileNodeId`) and a
`mobileDivergence`:
- `null` when desktop & mobile differ only in settings (handled by `_mobile`-suffixed keys in the same `settings` blob);
- `{ type: "reorder" | "viewport-only" | "behavior", note }` when they diverge at the SECTION level — which
  is not expressible in a single JSON `order`/blob and routes that section to the work-order as code (D4).

## 3. work-order (DERIVED — never primary state)

`deriveWorkOrder(componentMap, compositions)` = a pure function. Three contributors:
- whole-component: `verdict ∈ {code, app, out-of-scope}`;
- instance delta: a config component whose specific composition fails the deterministic expressibility check
  (carries `delta` + `usedIn`);
- mobile divergence: a **config** composition entry with a non-null section-level `mobileDivergence`.

`{ codeRequired: [...], appBlocks: [...], outOfScope: [...] }`. Regenerable; consumed by SP-3. The three
contributors are a set UNION — a non-config component with a divergence is represented by its
whole-component baseline only (it is not double-listed).

## 4. Reachability: deterministic vs inferred

Two-part check (D3): `(deterministic schema-expressibility) + (fuzzy candidate-match)`. **Only the
deterministic half lives in this repo today** (`reachability.js`); the fuzzy half is SP-1's AI inference.

| Deterministic (`reachability.js`, reuses `shopify-validate.js`) | Inferred by SP-1 (best-effort) |
|---|---|
| `resolveHostSection` -> `exists` + parsed `schema` | candidate-match for bespoke detached sections |
| `expressibilityIssues` (settingValueIssue / blockTypeAccepted / maxBlocks, run in reverse) | `settings` / `blocks` values |
| `isCssHardcoded` (horizon.json) -> CODE | order + colorScheme read from Figma frames |
| invariants 1-4 (`contract.js`) | the fuzzy half of the verdict (biased to CODE) |

**Bias to CODE (D3):** never claim `config` without proof against the schema. An unknown setting id, an
unparseable/absent schema, or any expressibility failure routes to CODE — a false `code` is visible and
cancelable; a false `config` ships a silently-broken store.

## 5. Invariants (enforced in `skills-tests.js`)

1. Referential integrity: every `compositions[*].order[*].component` is a `componentMap` key.
2. config => real: `verdict === "config"` => `theme.exists === true ∧ candidate != null ∧ schema != null`.
3. nonexistent => non-config: `exists === false` => `verdict ∈ {code, app, out-of-scope}`.
4. work-order = pure derivation (no manual entries).
5. colorScheme integrity: every `compositions[*].order[*].colorScheme` (non-null) ∈ keys(`foundations.colors.schemes`). (Added by SP-1 when foundations entered the contract instance's scope — a dangling scheme ref ships a store with undefined colors.)

The shape enforcer `contractShapeIssues()` additionally checks required keys + enum membership.
