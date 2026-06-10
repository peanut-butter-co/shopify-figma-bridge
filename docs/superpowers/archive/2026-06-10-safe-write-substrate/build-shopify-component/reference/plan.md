# Planning a component build (reference)

The deterministic logic lives in `.claude/scripts/component-build.js` (pure, unit-tested). This doc is the
method: how to turn the inspection into a gap-transparent plan the developer approves.

## The two shapes

### A. `config` baseline (there is a host candidate section)

The componentMap gives you `candidate` (e.g. `sections/footer.liquid`) and `hostSchema` (its load-bearing
settings/blocks). The design intent is in each `usage.settings` / `usage.blocks`, in Aristopet's OWN
vocabulary (`brand_tagline`, `col_1_heading`, …) — which is NOT the host's. So you must propose a **mapping**:

1. For each intent key, decide its **target**: an existing host setting id, a NEW host setting id (to add),
   or `null` (it is code — a block, a behavior, a layout the schema can't express).
2. Build the mapping array: `[{ intentKey, target, type, value }]` (`type` = the host setting type for a
   new setting; `value` = the design value).
3. Run `configPlan(mapping, hostSchema)` → `{ applied, schemaExtensions, schemaWidenings, codeGaps }`:
   - **applied** — `target` is an existing host setting and `value` is in-domain → pure config.
   - **schemaExtensions** — a NEW setting (`target` not in the host schema) → appended to the section
     `{% schema %}` with `injectSchemaSettings` (à la SP-2's foundations extensions).
   - **schemaWidenings** — an EXISTING select/range whose value is off-domain → add the option / widen the
     range *in place*. Kept SEPARATE from extensions: the append path dedups by id, so a widening fed to it
     would silently no-op.
   - **codeGaps** — `target: null`, or an existing setting whose type can't be widened safely.
4. Add to **codeGaps**: every block type the host schema does not accept (cross-check `usage.blocks`
   against `hostSchema.blocks`), and any `usage.mobileDivergence` (a section-level desktop/mobile difference
   that a single JSON instance can't express → code).

Present applied / schemaExtensions / codeGaps explicitly. **List every extension and every gap.** The
developer confirms or corrects the mapping (this semantic step is theirs — bias to code if unsure).

### B. `code` / `no-candidate` (no host section)

Propose a **new** `sections/<slug>.liquid`:
- **Schema:** the settings the design needs (named in the host's idiom, not Aristopet's), `color_scheme`,
  `padding-block-start/end`, and any blocks.
- **Liquid:** a skeleton bound to **foundations variables** — scheme colors via the section's
  `color_scheme`, text via the foundations type styles — following `.claude/figma-best-practices.md`. Do not
  hardcode colors or sizes (CLAUDE.md rule).
Name new bespoke sections distinctly (e.g. `sections/aristopet-trust-bar.liquid`) so they never collide
with host sections.

### C. `app`

Document the app-slot (where the app block is placed in the template) and write no code. Mark complete.

## Honesty (bias-to-code, SP-0 D3)

Never claim config without proof: `configPlan` only puts a setting in **applied** when the host setting
exists AND the value validates. Everything else is an extension or a code gap — visible, never silent. A
false "applied" would ship a broken store; a false "code gap" only costs an extra liquid edit.
