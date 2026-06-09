# design->build contract fixture

A committed, **valid** instance of the SP-0 contract (see
`docs/contract/design-build-contract.md`). `.claude/scripts/skills-tests.js` runs the §6
invariants against it: the shape enforcer and invariants 1-3 must report **zero** issues, and
`deriveWorkOrder(componentMap, compositions)` must equal `work-order.expected.json`.

Three files mirror the three artifacts:
- `design-rules.json` -> `componentMap` (one entry per component, §3.1 shape).
- `compositions.json` -> `manifest.compositions` (layout, references componentMap by key, §3.2 shape).
- `work-order.expected.json` -> the DERIVED work-order (§3.3); never hand-maintained in production.

## The representative cases (the spec's worked Aristopet examples, made executable)

| Component | Verdict | What it exercises in the work-order |
|---|---|---|
| `hero` | config | in-domain instance -> **absent** from the work-order |
| `slideshow` | config (baseline) | composition uses 6 slides > schema `max_blocks:5` -> **instance delta** (`max-blocks-exceeded`) |
| `homepage-marquee-promo` | config (baseline) | composition has a `behavior` mobile divergence -> **code** (`mobile-divergence`) |
| `pdp-ugc-section` | code | no host target -> **whole-component** code (`no-candidate`) |
| `reviews` | app | app slot -> **appBlocks** (`app-slot`) |

This is the all-green baseline. The invariant tests ALSO feed crafted *invalid* inputs inline
(bad enum, dangling reference, config-with-null-schema, exists:false+config) to prove each check
has teeth. To add a case, extend these files AND `work-order.expected.json` together.
