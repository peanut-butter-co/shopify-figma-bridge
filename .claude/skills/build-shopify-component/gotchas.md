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
- 2026-06-10 (seed) — **The developer runs `shopify theme dev`; you don't.** It serves the host theme's local
  preview (default `http://127.0.0.1:9292`) and hot-reloads on file / theme-editor changes. Remind them at
  Step 0 and WAIT for their "it's running" + URL — never assume it's up or try to start it yourself. App
  components skip this (they return at pre-flight gate 6).
- 2026-06-10 (seed) — **Static validate is not enough — verify the RENDER.** After `shopify-validate.js`
  passes, screenshot the live preview at desktop AND mobile and compare to the Figma node (`get_screenshot`).
  A thin sliver, a collapsed section, missing text, or a raw/unbound color is a BROKEN layout — never
  rationalize a visual anomaly (project rule). "validate green" + "MCP says the page loaded" ≠ "it renders
  correctly". Eyes on the screenshot, both breakpoints, before you call it done.
- 2026-06-11 — **Present the FULL nested block tree in the plan; never compress it.** Horizon power-section
  presets nest two group levels per item — e.g. `icons_with_text` is `group → [icon, group → [heading, text]]`.
  Collapsing that to one line in the plan ("item → icon + heading + subtext") hides a nesting level the
  developer must see to approve the structure at the gate. Draw every `group` boundary explicitly. (Surfaced
  on trust-bar: the inner text-group wrapping title+description was left implicit; the dev had to spell it out.)
- 2026-06-11 — **A `code`/`no-candidate` verdict is NOT proof there's no host — verify against the preset
  catalog first.** trust-bar inspected as `code` (hostSchema null) yet `icons_with_text` (a `section.liquid`
  preset) was an exact host. Before authoring any new `.liquid`, grep `section.liquid`'s `presets[]` for a
  structural match (row of icon+text columns → `icons_with_text`; two media halves → `split_showcase`).
  Building config on a verified preset beats authoring redundant code. This is the F13/F14 matcher blind spot —
  assume it, don't trust a `code` verdict blindly.
- 2026-06-11 — **Give every group/container instance a meaningful `name` (it's editor-only, free).** Bare
  `group` blocks render in the theme-editor sidebar as a useless stack of "Group / Group / Group". Set
  `"name"` (right after `"type"`) from the block's CONTENT or ROLE — the trust item "Envíos Gratuitos", the
  banner half "Aristoperros", the text wrapper "Texto"/"Contenido". A literal string is fine (no `t:` key
  needed). It's pure editor metadata — the storefront render is byte-identical, so no re-verify needed — but
  it makes the section navigable for the merchant. Do this for EVERY group/icon/text container as you author
  the instance, not as a cleanup pass. (Surfaced when the dev saw the trust-bar sidebar as anonymous "Group"s.)
- 2026-06-11 — **Decompose separator-delimited / multi-part content into INDEPENDENT blocks — never cram it
  into one text block.** On marquee I dumped the whole `"FRASE 1   |   FRASE 2   |"` string into a single
  `text` block with literal pipes. Wrong: the host marquee's block vocabulary is `text` / `icon` / `logo` /
  `_divider`, so the faithful build is `text("FRASE 1")` + `_divider` + `text("FRASE 2")` + `_divider` — each
  phrase independently editable, and the separator a real themed `_divider`, not a typed `|` glyph baked into
  copy. **The skill must be smart enough to SEE this, not wait to be told:** when the design intent flattens
  repeated/separated content into one string — a `|` / `•` / `—` / `·` separator, a "X | Y" pattern, a list —
  AND the host section accepts the matching block types (esp. `_divider`), split it into independent blocks.
  The flattened intent string is a *serialization* of a multi-block structure, not the structure itself; read
  the host's block vocabulary and reconstruct the real blocks. And for a *repeating/looping* section (marquee),
  the separator must also TRAIL the last content block — `text · divider · text · divider` — or the loop seam
  (last item → first item of the next repeat) silently drops the separator rhythm. (Surfaced on marquee; dev
  had to point out both the decomposition AND the missing trailing divider.)
- 2026-06-11 — **Per-sub-block `type_preset` audit + computed-style verification** → promoted to SKILL.md Step 2
  (audit each text/heading/price sub-block's type vs the design) + Step 3d (`getComputedStyle` evidence). Origin:
  the product-list kept Horizon's default card presets (title 14px paragraph, price Instrument Sans) — right
  structure, wrong type; "it looks like a card" is not verification.
- 2026-06-11 — **Inspect desktop & mobile as separate passes** → promoted to SKILL.md Step 1 (fetch
  `get_design_context` for both nodes, DIFF, map differences to `*_mobile` settings). Origin: header title was
  H2 desktop / H3 mobile, so mobile shipped 52px instead of 36px because only the desktop node was read.
- 2026-06-11 — **Per-setting SETTINGS AUDIT; `get_design_context`'s CSS is a lossy hint, not the intent** →
  promoted to SKILL.md Step 2 (audit table: every setting design-verified / host-default / gap). Origin: the
  header row got `space-between` from a `justify-between` hint instead of the design's left-align + title-fill.
- 2026-06-11 — **⚠️ When the developer corrects the SAME detail twice, YOUR model is wrong, not theirs — STOP,
  re-open the actual design (or ask for their reference screenshot); do not keep defending your reading.** I
  read the header's Figma frame + the auto-context's `justify-between` as "Ver más on the far right" and built
  `space-between`. The design actually has the title + "Ver más" packed TOGETHER on the left (`flex-start` /
  "pegados"). The dev said "left / pegado" repeatedly; I misheard "pegado" as a bug to un-stick rather than the
  intended state, and kept verifying screenshots against my OWN wrong target — "confirming correct" while the
  dev plainly saw it wrong. Cost: ~5 wasted cycles + eroded trust. Rules: (a) a repeated correction = re-fetch
  the design node or ask for the exact frame, immediately; (b) `get_design_context`'s emitted CSS is a lossy
  hint, NOT the intent — confirm against the rendered design image; (c) never verify a render against your
  assumption of the target — put the design screenshot and the live screenshot side by side.
