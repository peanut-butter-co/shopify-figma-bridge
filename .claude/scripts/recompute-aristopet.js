'use strict';
/**
 * SP-1.1 — recompute Aristopet's reachability + work-order against crunchy-horizon.
 *
 * SP-1 produced the Aristopet contract instance against a BARE Shopify Skeleton host: 1/22 sections had
 * a candidate (footer), everything else routed to `code`/`no-candidate` — the honest outcome for an empty
 * host (SP-1 spec §10.4). The real Aristopet host is now crunchy-horizon (a rich Horizon fork, checked out
 * at the repo root, `config.themeRoot = "."`). Against it, most sections DO have a host candidate, so the
 * verdicts flip `code -> config` — the recompute SP-2 spec §9 flagged as the prerequisite for spec #3.
 *
 * This regenerates the two HOST-DEPENDENT artifacts from three inputs:
 *   1. the prior componentMap's host-INDEPENDENT facts  — figma metadata + type, carried over verbatim
 *      (these are deterministic from the Figma file and do not change with the host);
 *   2. the live crunchy-horizon sections                — theme.exists/schema re-resolved per candidate
 *      via reachability.resolveHostSection (read-only);
 *   3. CANDIDATE_MAP below                              — the FUZZY half of reachability (SP-0 D3): which
 *      Aristopet design slug maps to which Horizon host section. Grounded in reading the live host schemas,
 *      biased to CODE (host:null => no candidate). This is the only inference; it is explicit + auditable.
 *
 * The work-order is then DERIVED (contract.deriveWorkOrder) — never hand-authored. Note bias-to-code is
 * preserved at the work-order level: Aristopet was designed OFF-PROCESS in its own setting vocabulary
 * (`left_title`, `menu_item_1`, …), which is not Horizon's, so every `config` component STILL routes to
 * code via a value-out-of-domain delta ("host section exists; re-author its settings to the host schema").
 * The config verdict means "there is a Horizon section to build ON", not "drop the JSON in" — that
 * re-authoring is SP-3's per-component, human-assisted job. A false `config` cannot silently ship here
 * because nothing auto-applies these settings; the work-order delta makes the gap visible.
 *
 * Run: `node .claude/scripts/recompute-aristopet.js [--dry]` from the repo root (so themeRoot "." resolves).
 * Pure logic (buildComponentMap) is unit-tested in skills-tests.js group "SP-1.1"; the committed output is
 * validated by the existing "SP-1: Aristopet inference artifact set" invariant group.
 */
const fs = require('fs');
const path = require('path');
const { resolveHostSection } = require('./reachability.js');
const {
  deriveWorkOrder, contractShapeIssues, referentialIntegrityIssues,
  configRealityIssues, nonexistentNonConfigIssues, colorSchemeIntegrityIssues,
} = require('./contract.js');

/**
 * Aristopet design slug -> crunchy-horizon host section (`host`), with the inferred verdict/basis/confidence.
 * `host: null` => no host candidate (verdict code/app; candidate stays null). `kind` overrides theme.kind
 * (default carried from the prior entry, else "section"). High-confidence rows are exact-slug or
 * unambiguous structural matches; medium rows are the best plausible host peer (SP-3 re-confirms live).
 */
const CANDIDATE_MAP = {
  // --- global chrome ---
  'header-utility-bar':        { host: 'header-announcements',    verdict: 'config', basis: 'schema-expressible', confidence: 'medium' }, // thin top strip ~ announcement bar
  'header-v1':                 { host: 'header',                  verdict: 'config', basis: 'schema-expressible', confidence: 'high' },
  'header-v2':                 { host: 'header',                  verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // two chrome variants, same host header (SP-1 idiom)
  'footer':                    { host: 'footer',                  verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // exact slug; rich block-based host footer
  'newsletter-signup':         { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },   // no host newsletter SECTION (email-signup is a block)
  // --- homepage ---
  'split-banner':              { host: 'section', preset: 'split_showcase', verdict: 'config', basis: 'schema-expressible', confidence: 'high' }, // Horizon "Split showcase": a PRESET of the generic `section` (content_direction:row + two background_media `group`s, each spacer+text+button). buildComponentMap validates the preset exists and carries it to reachability.preset so the skill instantiates it instead of authoring code.
  'trust-bar':                 { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },   // static icon+text row; no host peer
  'marquee':                   { host: 'marquee',                 verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // exact slug
  'product-card-row':          { host: 'product-list',            verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // configurable product card grid/carousel
  'image-with-text':           { host: 'media-with-content',      verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // host name = media_with_text
  'collection-list-grid':      { host: 'collection-list',         verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // grid of collections
  'promo-banner':              { host: 'hero',                    verdict: 'config', basis: 'schema-expressible', confidence: 'medium' }, // promo band ~ hero (text/button, no media)
  'brand-logos':               { host: 'marquee',                 verdict: 'config', basis: 'schema-expressible', confidence: 'medium' }, // logo wall ~ marquee logo blocks
  'ugc-captions-below':        { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },   // UGC gallery w/ captions; no host peer
  // --- collection ---
  'collection-header':         { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'medium' }, // collection banner; no dedicated host section
  'sub-collection-navigation': { host: 'collection-links',        verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // host = collection_links
  'filter-bar':                { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },   // filters are a block inside main-collection
  'pagination':                { host: null,                      verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },   // built into main-collection/product-list
  // --- product ---
  'breadcrumbs':               { host: 'breadcrumbs',             verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // exact slug
  'product-information':       { host: 'product-information',     verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // exact slug
  'related-products':          { host: 'product-recommendations', verdict: 'config', basis: 'schema-expressible', confidence: 'high' },   // host = product_recommendations
  'product-reviews':           { host: null, kind: 'app-block',   verdict: 'app',    basis: 'app-slot',           confidence: 'medium' }, // app-provided (unchanged from SP-1)
};

/**
 * Project a parsed host {% schema %} down to exactly what the deterministic expressibility check consumes
 * (contract §1: "only settings/blocks/max_blocks are load-bearing"). settingValueIssue reads only
 * id/type/min/max/step/options[].value; blockTypeAccepted reads block type strings; maxBlocksIssue reads
 * max_blocks. Cosmetic fields (labels, t: keys, info, defaults) are dropped — they do not change any verdict
 * and would bloat + cosmetically-couple this single-reference artifact to Horizon. Behaviour-identical:
 * deriveWorkOrder over the projection equals deriveWorkOrder over the full schema (asserted in skills-tests).
 */
function loadBearingSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  const out = {};
  if (schema.name != null) out.name = schema.name;
  out.settings = (Array.isArray(schema.settings) ? schema.settings : [])
    .filter((s) => s && s.id != null)
    .map((s) => {
      const o = { id: s.id, type: s.type };
      if (Array.isArray(s.options)) o.options = s.options.map((op) => ({ value: op && op.value }));
      for (const k of ['min', 'max', 'step']) if (typeof s[k] === 'number') o[k] = s[k];
      return o;
    });
  out.blocks = (Array.isArray(schema.blocks) ? schema.blocks : [])
    .map((b) => (typeof b === 'string' ? b : (b && b.type)))
    .filter(Boolean);
  if (typeof schema.max_blocks === 'number') out.max_blocks = schema.max_blocks;
  return out;
}

/**
 * Rebuild the componentMap: carry figma+type from `oldComponentMap` (host-independent), re-resolve
 * theme/schema against `themeRoot` per CANDIDATE_MAP, set the verdict. Throws if a `config` candidate does
 * not resolve to a real, parseable host section — a bad slug must fail loudly, never ship an inv-2 violation.
 */
function buildComponentMap(oldComponentMap, candidateMap, themeRoot) {
  const out = {};
  for (const [key, prev] of Object.entries(oldComponentMap || {})) {
    const cm = candidateMap[key];
    if (!cm) throw new Error(`CANDIDATE_MAP is missing an entry for componentMap key "${key}"`);
    const kind = cm.kind || (prev.theme && prev.theme.kind) || 'section';
    let theme, schema, candidate, preset = null;
    if (cm.host) {
      const r = resolveHostSection(themeRoot, cm.host);
      if (cm.verdict === 'config' && (!r.exists || !r.schema)) {
        throw new Error(`"${key}": config candidate "${r.file}" did not resolve (exists=${r.exists}, schema=${!!r.schema}) under themeRoot "${themeRoot}"`);
      }
      // Preset-based candidate (Horizon "power section": the generic section.liquid + named presets). The
      // resolver is file-only, so `candidate` stays the FILE; `preset` names which preset to instantiate.
      // Validate against the live presets so a bad name fails loudly (mirrors the bad-slug guard above).
      if (cm.preset) {
        const presets = (r.schema && Array.isArray(r.schema.presets)) ? r.schema.presets : [];
        const hit = presets.some((p) => p && typeof p.name === 'string' && p.name.replace(/^t:names\./, '') === cm.preset);
        if (!hit) throw new Error(`"${key}": config candidate "${r.file}" has no preset named "${cm.preset}" (checked ${presets.length} presets)`);
        preset = cm.preset;
      }
      theme = { file: r.file, exists: r.exists, kind };
      schema = loadBearingSchema(r.schema);
      candidate = r.exists ? r.file : null;
    } else {
      theme = { file: null, exists: false, kind };
      schema = null;
      candidate = null;
    }
    out[key] = {
      type: prev.type,
      figma: prev.figma,
      theme,
      schema,
      reachability: { verdict: cm.verdict, basis: cm.basis, confidence: cm.confidence, candidate, ...(preset ? { preset } : {}) },
    };
  }
  return out;
}

/** Full recompute: { componentMap, workOrder }. workOrder is DERIVED (never primary state). */
function recompute(themeRoot, oldDesignRules, manifest) {
  const componentMap = buildComponentMap((oldDesignRules || {}).componentMap, CANDIDATE_MAP, themeRoot);
  const workOrder = deriveWorkOrder(componentMap, (manifest || {}).compositions);
  return { componentMap, workOrder };
}

/** All five contract invariants over a recomputed set; [] = clean. Used as the generator's STOP gate. */
function invariantIssues(componentMap, compositions, foundations) {
  return [
    ...contractShapeIssues(componentMap, compositions),
    ...referentialIntegrityIssues(componentMap, compositions),
    ...configRealityIssues(componentMap),
    ...nonexistentNonConfigIssues(componentMap),
    ...colorSchemeIntegrityIssues(compositions, foundations),
  ];
}

const PROVENANCE =
  'SP-1.1 recompute against crunchy-horizon@develop (host at repo root, themeRoot="."). figma metadata + ' +
  'type carried over from the SP-1 inference (deterministic from _raw/skeleton.json). theme.exists/schema ' +
  're-resolved via resolveHostSection against the live crunchy-horizon sections. reachability re-inferred: ' +
  '15/22 sections now have a Horizon host candidate (config baseline) vs the bare Skeleton\'s 1/22 — the ' +
  'code->config flip anticipated by SP-2 spec §9. The fuzzy candidate-match (Aristopet design slug -> Horizon ' +
  'section) is CANDIDATE_MAP in .claude/scripts/recompute-aristopet.js, confidence high|medium, biased to ' +
  'CODE. Bias-to-code holds at the work-order level: Aristopet\'s off-process setting vocabulary differs from ' +
  'Horizon\'s, so every config component still routes to code via a value-out-of-domain delta (re-authored ' +
  'live by SP-3). Regenerate with: node .claude/scripts/recompute-aristopet.js';

module.exports = { CANDIDATE_MAP, loadBearingSchema, buildComponentMap, recompute, invariantIssues, PROVENANCE };

if (require.main === module) {
  const ROOT = path.join(__dirname, '..', 'figma-sync', 'aristopet');
  const dr = JSON.parse(fs.readFileSync(path.join(ROOT, 'design-rules.json'), 'utf8'));
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const themeRoot = (man.config && man.config.themeRoot) || '.';
  const { componentMap, workOrder } = recompute(themeRoot, dr, man);

  const counts = Object.values(componentMap).reduce((a, e) => {
    a[e.reachability.verdict] = (a[e.reachability.verdict] || 0) + 1; return a;
  }, {});
  console.error('verdict counts:', JSON.stringify(counts));
  console.error(`work-order: codeRequired=${workOrder.codeRequired.length} appBlocks=${workOrder.appBlocks.length} outOfScope=${workOrder.outOfScope.length}`);

  const issues = invariantIssues(componentMap, man.compositions, man.foundations);
  if (issues.length) { console.error('INVARIANT ISSUES (not writing):\n - ' + issues.join('\n - ')); process.exit(1); }
  console.error('invariants: clean');

  if (process.argv.includes('--dry')) { console.error('(dry run — no files written)'); process.exit(0); }

  const { _provenance, componentMap: _drop, ...rest } = dr;
  const outDR = { _provenance: PROVENANCE, ...rest, componentMap };
  fs.writeFileSync(path.join(ROOT, 'design-rules.json'), JSON.stringify(outDR, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'work-order.json'), JSON.stringify(workOrder, null, 2) + '\n');
  console.error('wrote design-rules.json + work-order.json');
}
