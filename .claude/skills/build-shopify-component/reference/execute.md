# Executing a component build (reference)

The mechanics reuse the lean write protocol in `build-shopify-foundations/reference/safe-write.md` (edit
directly → validate → spot-check; **no backups, no verify substrate** — git is the net, dev theme via
`shopify theme dev` only, never prod). Execute **config first, then code, then visual verify**.

## a. Config

1. **Schema** — for each `schemaExtension` (a NEW setting on a host section), append it to the section's
   `{% schema %}` with `injectSchemaSettings(liquidSource, schemaExtensions)` (or a surgical `Edit` if the
   block isn't 2-space/LF). For each `schemaWidening` (an existing select/range whose domain must grow), do a
   surgical `Edit` in place — add the option / widen the min-max. (Do NOT feed widenings to
   `injectSchemaSettings`: it dedups by id and would no-op them.) For a NEW bespoke section, write its
   `{% schema %}` directly. Name new sections distinctly (`sections/aristopet-<slug>.liquid`) so they never
   collide with host sections.
2. **Instance + settings** — write the section instance(s) into the placement JSON with the `applied`
   settings/blocks, editing the JSON **directly**:
   - Page sections → `templates/<template>.json` (add to `sections` + `order`).
   - Chrome (header/footer/announcement) → `sections/<group>.json` (e.g. `header-group.json`).
   Inspect the host's existing placement first to pick the target + key. Prefer a surgical `Edit`; for a
   bulk/structural change, set-by-path is fine if the file round-trips faithfully (assert
   `serialize(parse(original)) === original` first — else surgical `Edit`).

## b. Code (the codeGaps)

3. Author/edit `sections/<slug>.liquid` (+ `blocks/<name>.liquid`) for the gaps. Markup bound to foundations
   variables (scheme colors via `color_scheme`; type via the foundations text styles) — never hardcode
   colors/sizes (CLAUDE.md rule).

## c. Validate

4. `node .claude/scripts/shopify-validate.js <themeRoot>` — must pass (schema + template JSON + section-type
   resolution + block checks). Optionally `shopify theme push --strict --only <files>` for Shopify's own
   upload validator. If red → fix forward and STOP. Never leave the host theme in a state validate rejects.

## d. Visual verify (live preview)

Static validation proves the JSON/schema are well-formed; it does NOT prove the component *renders*. Close the
loop against the running `shopify theme dev` preview (SKILL Step 0 — the developer starts it; gate 7 confirms
the MCP tools are connected).

5. **Render.** Open the preview with chrome-devtools (`navigate_page` / `resize_page` / `take_screenshot`;
   attaches to the running Chrome, fast — preferred) or Playwright, whichever is connected. Navigate to the
   template that renders the component and screenshot it at desktop (~1440) and mobile (~390).
6. **Compare to intent.** `mcp__figma__get_screenshot` on the usage's `desktopNodeId` / `mobileNodeId`. Put
   the two side by side. A thin sliver, a collapsed/absent section, missing text, a raw (unbound) color, or
   wrong type = **broken** — never rationalize it (project memory: a visual anomaly is real, not a quirk). On
   divergence, fix the code and re-run **b → c → d**, or surface the gap. Only a faithful render at both
   breakpoints is "done".

## Order matters

Config first means the host section + its schema exist before you write its template instance, and the schema
extensions exist before any code references them. Visual verify is **last**: nothing is "done" until the
running preview matches the design intent at both breakpoints — `shopify-validate` green is necessary, not
sufficient. No backups: if something's wrong, fix forward (or `git checkout` the tracked file / `shopify theme
pull` the gitignored one) — there's nothing to restore.
