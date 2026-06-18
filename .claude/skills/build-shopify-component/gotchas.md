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
- 2026-06-11 — **Casing is presentation, NEVER content — don't uppercase a label literal to fake the design's
  style.** image-with-text's design shows both CTAs UPPERCASE; the host `button` block has no `case` setting and
  renders the label verbatim, so "Ver PRODUCTOS" stayed mixed-case. The wrong fix is editing the literal to
  "VER PRODUCTOS" — the dev explicitly said "never uppercase the literal." UPPERCASE-on-buttons is a theme-wide
  *button-style* treatment (the whole design system has it); the right fix is foundations (a global button
  `text-transform`), not baking caps into one label. Rule: when a text effect (case, tracking, weight) is a
  *style* the design applies uniformly to a component class, reproduce it via the host's style layer or flag it
  as a foundations gap — keep the content literal in its natural case. Same trap as the overline `letter_spacing`
  (design 0.1em, host `text` block caps at `loose`≈0.03em): a style ceiling in the host, not a per-instance value.
- 2026-06-11 — **A media-centric candidate (`hero`) renders a PLACEHOLDER when empty — wrong host for a media-less banner; use generic `section`.** `hero.liquid` emits `'hero-apparel-1' | placeholder_svg_tag` whenever `media_count == 0`, so a colored content-only promo banner gets a gray apparel image behind it. Before trusting a media-centric candidate, check its empty-media behavior; for content-on-color with no media, the generic `section` (accepts `@theme` blocks, paints `color_scheme`, no forced media — the same host split-banner uses) is correct. Grep a candidate's markup for `placeholder_svg_tag` guarded by a media count before building media-less on it. (F29.)
- 2026-06-11 — **A design background that matches NO reconstructed scheme is a foundations gap — add a scheme, don't ship the nearest.** promo-banner's signature teal `#99ddd7` was bound to no scheme var (a literal accent); the contract snapped `colorScheme` to the nearest (scheme-3 beige), which would have shipped the banner beige. Confirm with `get_variable_defs` (the section's bound bg vs the literal), then either add a dedicated scheme (clone the nearest in `config/settings_data.json` `color_schemes`, override `background` + the design's `*_button_*`/`border` roles from `get_variable_defs`) or surface a per-section literal-bg gap. **Verify the bg actually paints:** a Horizon section element computes `background-color: transparent` — the scheme paints via the `color-scheme-N` class / a `.section-background` layer, so confirm the accent renders with a screenshot, not just the section's own computed bg. (F28.)
- 2026-06-11 — **A host that ROTATES/STACKS its blocks (announcement bar) is the EXCEPTION to the marquee "decompose
  separator-delimited content" rule — keep it ONE block.** `header-announcements.liquid` autoplays a cross-fading
  carousel the moment `blocks.size > 1` (one `_announcement` visible at a time), and its `divider_width` is the bar's
  bottom BORDER, not an inter-item separator. So a static utility line
  (`¿Necesitas ayuda?  900 920 450  |  hello@aristopet.com`) is a SINGLE `_announcement` block with the separators as
  inline content — splitting it into three blocks would make them ROTATE, not sit in a row. The marquee decompose rule
  (split `X | Y | Z` into independent blocks + real `_divider`s) is conditioned on the host laying blocks out in a ROW;
  for a carousel/stack host the faithful reconstruction of a one-line row is one block. **Read the host's block-layout
  model — row vs carousel vs accordion vs stack — BEFORE deciding to decompose.** (Surfaced building the header utility
  bar; F31.)
- 2026-06-11 — **Horizon's header is ONE global chrome section — a design's per-template / per-breakpoint header
  "variants" are NOT separate builds.** The contract emitted `header-v1` (product + all mobile) and `header-v2`
  (home/collection desktop) as distinct keys, but both map to the single `sections/header.liquid` in
  `header-group.json`; the "v2 desktop / v1 mobile" divergence is just Horizon's built-in responsive header (full nav →
  hamburger drawer). The ONLY per-template levers are `enable_transparent_header_{home,product,collection}` +
  `*_color_scheme`. Configure the one global header and mark all variant keys complete against it — never author
  multiple header sections. Two sub-facts: the **country/locale selector is bound to the `header` section**
  (`show_country` + `localization_position/row`), so a design that puts locale in a separate top utility bar can't
  reach it there (Horizon renders it in the header row, and SUPPRESSES it entirely when
  `localization.available_countries.size <= 1`); and **`_header-menu` `navigation_bar:true` is the MOBILE horizontal
  scroll-nav row** (hidden ≥750px), which maps a design's mobile sub-nav strip — the DESKTOP persistent sub-category
  row is not config-reachable (Horizon shows children only as a hover mega-menu). All menu content is the `main-menu`
  linklist (Admin data); the logo is an uploaded image falling back to `shop.name` text. (F31.)
- 2026-06-12 — **A "clean" reset leaves the global chrome built — INSPECT for an existing host instance before (re)building, and switch to VERIFY-mode if found.** `buildStatus.components = {}` + a reset `templates/index.json` does NOT revert the `*-group.json` chrome (`header-group.json`, `footer-group.json`) — they keep the prior build, so state says "un-built" while the host IS built. Before building a component, search the relevant host file (`*-group.json` for chrome, `templates/*.json` for body sections) for an existing instance of the key; if present, diff vs the design and apply only deltas — never rebuild over working chrome. (F37.)
- 2026-06-12 — **`text` block `letter_spacing: loose` ≈ 0.1em (1.4px at 14px) — it DOES reach the Overline/Label tracking (refines F16).** The earlier "loose ≈ 0.03em ceiling" worry was a different host control (the section eyebrow), not the `text` block. So Overline intent renders faithfully as `type_preset:custom` + `font:var(--font-subheading--family)` + `font_size:0.875rem` + `letter_spacing:loose` + `case:uppercase`; the ONLY residual gap is the **+1px size** (the `font_size` ladder jumps 12→14px, no 13px). (F38.)
- 2026-06-12 — **`font_size` ladder is coarse — no 13px (overline) or 11px (caption).** Options: 10/12/14/16/18/20/24/32/40/48/56/72/88/120/152/184px. The foundations' exact label sizes have no host option; use the nearest and flag it `approximate` (don't silently round). A schema widening to add `0.8125rem`/`0.6875rem` is possible but is a global typography decision, not a per-instance one. (F38.)
- 2026-06-12 — **Contrast-flagged dark group/section: use the surplus host `scheme-5` (#333333) for a WORKING secondary button (F18).** When the design's dark area is scheme-4 (#1e1b18) but scheme-4's `secondary_button_text/border` are black (invisible outline button), set that group/section `color_scheme: scheme-5` — its secondary button is white-on-#333 (legible, verified both breakpoints). Trade-off: bg renders #333 vs the design's #1e1b18 (acceptable delta); the exact-dark fix is a foundations sub-palette (clone scheme-4 with white button colors, F28-style), out of component scope. Two-zone half = nested groups: outer `group` with `vertical_alignment_flex_direction_column: space-between` holding [counter, inner copy `group`] pushes counter to top, copy cluster to bottom (the faithful split_showcase reconstruction without bg media; mobile packs compact — F19).
- 2026-06-12 — **`type_preset_mobile` on the `text` block absorbs per-element type divergences even when `mobileDivergence: null` (F21 family).** split-banner's title is H1 80px desktop / H3 36px mobile — set `type_preset:"h1"` + `type_preset_mobile:"h3"` and it renders correctly per breakpoint with no section-level code gap. ALWAYS read the mobile node separately and check for per-element type-preset/size changes; the contract's `mobileDivergence: null` is unreliable. (F38.)
- 2026-06-12 — **Preset block-tree builds are hand-authored; `inspectComponent` surfaces only section-level blocks.** For a preset like `split_showcase`, `inspect.hostSchema.blocks` returns `["@theme","@app","_divider"]`, not the real `group → [text,button]` tree — re-parse `sections/<file>.liquid`'s `presets[]` + each child block schema (`blocks/{group,text,button}.liquid`) by hand for valid setting ids/domains, then validate with `shopify-validate.js` + the live render (theme dev push surfaces invalid values). (F14/F15/F38.)
- 2026-06-12 — **`_divider` is AXIS-RESPONSIVE — it adapts to the container's `content_direction`.** Measured on trust-bar: a `_divider` between ROW children renders **vertical** (1px × content-height — e.g. 1×46 between desktop row items), and between COLUMN children renders **horizontal** (container-width × thickness — e.g. 468×1 between mobile stacked items), colored by the active scheme's `--color-border`. So `_divider` is the correct tool for design separators in EITHER axis (vertical pipes between row items, horizontal rules between a stack) and it flips automatically at the breakpoint where the layout stacks. This **CORRECTS the older "_divider is always horizontal" assumption** in the marquee bullet above. (F39.)
- 2026-06-12 — **Separator decompose is CONTENT-vs-STRUCTURE, not "always decompose" (refines the 2026-06-11 marquee bullet).** Whether an "X | Y" string is ONE `text` block (literal pipe) or decomposed (`text·_divider·text`) depends on what the separator IS in the design: if `get_variable_defs` binds the whole node to ONE type style with the pipe inline, the pipe is **content** → one block with the literal pipe matches the Figma structure; if the separator is a distinct divider element with its own style, **decompose** with `_divider` (which renders vertical in a horizontal marquee strip — see the axis-responsive note, so the old "can't make a vertical pipe" objection is void). Aristopet's marquee = one type style → built one-block; the tradeoff is the duplication/loop seam then has no separator unless you append a trailing pipe to the string OR decompose with a trailing `_divider`. Read the separator's nature (content vs structure) AND the host's block-layout model (row / carousel / continuous-scroll) before deciding. (F40 — dev decision owed on the seam.)
- 2026-06-12 — **Prefer a named `type_preset` over `custom` when the design sits on a foundation preset.** Marquee text = H3 exactly → `type_preset:"h3"` hits Instrument Sans 700 / 36px / preset tracking precisely; `custom` would force the coarse `font_size` ladder (no 36px) and lose the preset's tracking + line-height. Note a host preset's OWN default may be generic (the host marquee preset ships `custom` + body + H2) — don't inherit it for a heading-styled design; map to the foundation preset the design actually uses. (F40.)
- 2026-06-12 — **`section`/`icons_with_text` preset default item-axis is icon-ABOVE (`content_direction:column`); set per-item `content_direction:row` + `vertical_alignment:center` for an icon-LEFT design.** Don't carry the preset's default item axis — it's a design-checked decision. Also: `icons_with_text` is the exact host for an icon+heading+subtext trust/benefit row (the contract may mis-verdict it `code`/`no-candidate` — F20/F39); diff the design's icons against `blocks/icon.liquid`'s ~59-option set and flag misses (gift→`box` substitute; truck/return/lock exact). (F39.)
- 2026-06-14 — **Reason about the component's RUNTIME BEHAVIOR, not just the static Figma frame. This is the root of the marquee miss.** The Figma inputs (`get_screenshot` / `get_design_context` / `get_variable_defs`) are all snapshots of ONE frame; a dynamic component's defining behavior — a marquee's infinite LOOP, a carousel's rotation, an accordion's collapse, hover/sticky states — is NOT in them. Transcribing the visible frame yields something correct-for-the-frame and broken-for-the-behavior. Concretely: a marquee's **loop seam** (end rejoins start) cannot appear in a static frame, so the separator must be made uniform around the loop by *reasoning what a marquee is*, not read off the data. **Don't transcribe the snapshot — reconstruct the behaving component:** build the repeating unit so it tiles seamlessly (separator at the unit boundary). When the separator is a colored TEXT glyph (one type style — here the dark `#1e1b18` pipe), keep it as text + append a trailing separator (NOT a `_divider`, which is scheme-border colored). **Priority rule:** when component behavior (or a gotcha) contradicts the literal Figma data, behavior wins — *"the CSS is a hint, not intention"* applies double to anything runtime. Treat a self-noticed defect ("the seam has no separator but it matches the static string") as a STOP, not a "faithful" — that's rationalizing an anomaly. (F40; resolved the marquee seam this way — trailing text-pipe + `gap_between_elements:0`.)
