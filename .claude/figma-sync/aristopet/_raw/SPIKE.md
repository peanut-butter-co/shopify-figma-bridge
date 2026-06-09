# SP-1 spike gate — assumption check (Homepage slice)

**File:** `73Qy4BbWWqFUky9b5LXTGT` ("Aristopet-Design-v1 (PRUEBAS PABLO)"), page `05 - Pages` (`93:2`).
**Host theme:** the Drive Skeleton theme (bare — 0 color schemes, no `color_scheme_group`).
**Outcome: PASS** — the contract's readability assumptions hold; no contract change required beyond the
planned invariant 5 + the idiom decisions below.

## Assertions

| # | Assumption (spec §6) | Result | Evidence |
|---|---|---|---|
| 1 | Composed section reports `instance` + resolvable `mainComponent` (vs detached `frame` = bespoke) | **PASS** | Split Banner instance `3436:1954` → main component `2623:511` ("Section / Split Banner / Desktop") via `get_design_context`. Metadata marks each child `<instance>` vs `<frame>`. |
| 2 | `colorScheme` readable from variable mode | **PASS (with nuance)** | `get_variable_defs` resolves the section's variables (e.g. `Essential/Foreground Heading`). Scheme is inferred by matching resolved colors to a foundations scheme. **Nuance:** some bespoke sections (Split Banner) use two modes internally (left `#1e1b18` vs right `#fffefd` for the same variable) → multi-scheme → routes to CODE. |
| 3 | `settings` / text overrides readable | **PASS** | `get_design_context` exposes them as props: `leftTitle:"Aristoperros"`, `leftEyebrow:"FW26 · Lanzamiento"`, `leftDescription`, button `"Comprar perros"`, etc. |
| 4 | Decide the "Section Heading / Section Footer" wrapper idiom | **DECIDED** | See idioms below. |

## Foundations finding (drives P0)

Aristopet's foundations are **wholly different** from the Skills-01 dev project:
- **Type:** `DM Sans` (body / labels: Regular 14, SemiBold/Bold 13) + `Instrument Sans` (display headings: Bold 80, lineHeight 0.94, letterSpacing −2). NOT Inter/Abril.
- **Color:** warm near-black `#1e1b18` (heading) / `#2a2620` (foreground) on cream `#faf7f2` / `#fffefd`.
- **Spacing/radii:** `spacing-16 = 16`, `radius/button_secondary = 0`.
- Schemes live ONLY as Figma variable modes — must be reconstructed from Figma (host theme is empty).

## Idiom decisions (→ recorded in the contract doc in Task 8)

- **"Section Heading" / "Section Footer" wrappers** = Aristopet spacing+heading wrappers around a content
  section (e.g. the homepage `Artistopeters` frame = Section Heading + UGC + Section Footer). **Decision:**
  fold the wrapper into the wrapped section — the heading text becomes the wrapped section's `heading`
  setting and the wrapper contributes top/bottom spacing. The wrapper is **not** a separate `componentMap`
  entry.
- **Two Header variants (v1 / v2):** Homepage uses Header v2, Product/Collection use Header v1. **Decision:**
  two distinct `componentMap` entries (`header-v1`, `header-v2`) — they are different compositions, and the
  bare host has no header section to host either (→ both CODE).
- **Global chrome (Header Utility Bar, Header, Footer, Newsletter):** appears in every template's frame. Kept
  in each composition's `order` for fidelity; the chrome→`header-group.json`/`footer-group.json` placement is
  an SP-2 concern (noted in the README).
- **Overlay states** (Cart Drawer, Dropdown/Menu Drawer, Sticky Add to Cart, "Above the Fold") are **not**
  templates — excluded from `compositions`; they inform header/cart features.
- **Detached vs instance dedup:** `Product Card Row` is an instance on Homepage but a detached frame on
  Collection — dedup keys on the **resolved component/slug**, not the node type (one `componentMap` entry).

## Raw captures in this dir
- `skeleton.json` — the deterministic per-template ordered section list (from `get_metadata` on `93:2`).
- `variables.split-banner.json` — sample `get_variable_defs` output (foundations probe).
- (per-section `get_design_context` extracts are produced during P1/P2.)
