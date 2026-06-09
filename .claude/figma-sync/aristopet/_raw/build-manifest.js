'use strict';
/**
 * SP-1 P0+P2 generator (reproducible assembly). Reads _raw/skeleton.json (deterministic order +
 * node-ids + pairing) and _raw/sec-<slug>.json (inferred settings/scheme-roles/blocks) and writes
 * ../manifest.json = { config, foundations, compositions }. Foundations schemes are the 4 distinct
 * color modes clustered from the section backgrounds. Run: node _raw/build-manifest.js
 */
const fs = require('fs');
const path = require('path');
const RAW = __dirname;
const OUT = path.join(RAW, '..', 'manifest.json');

const skeleton = JSON.parse(fs.readFileSync(path.join(RAW, 'skeleton.json'), 'utf8'));
// Fail loud: a missing or malformed sec-<slug>.json is a real data error, not an empty section.
const sec = (slug) => JSON.parse(fs.readFileSync(path.join(RAW, `sec-${slug}.json`), 'utf8'));

// --- P0 foundations: 4 schemes clustered from section backgrounds (confidence: medium) ---
const foundations = {
  colors: {
    schemes: {
      'scheme-1': { name: 'White', colors: {
        background: '#fffefd', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
        foreground_chip: '#1e1b1814', primary: '#af7d4f',
        primary_button_background: '#1e1b18', primary_button_text: '#fffefd', primary_button_border: '#1e1b18',
        secondary_button_background: '#00000000', secondary_button_text: '#1e1b18',
        inputs_text: '#1e1b18', inputs_border: '#c9a88280', inputs_hover_background: '#faf7f2' } },
      'scheme-2': { name: 'Warm White', colors: {
        background: '#faf7f2', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
        primary: '#af7d4f', primary_button_background: '#1e1b18', primary_button_text: '#faf7f2',
        secondary_button_background: '#00000000', secondary_button_text: '#1e1b18' } },
      'scheme-3': { name: 'Sand', colors: {
        background: '#ede8e1', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#c9a88280',
        primary: '#af7d4f', primary_button_background: '#1e1b18', primary_button_text: '#fffefd',
        secondary_button_background: '#00000000', secondary_button_text: '#1e1b18',
        inputs_text: '#1e1b18', inputs_border: '#c9a88280' } },
      'scheme-4': { name: 'Espresso', colors: {
        background: '#1e1b18', foreground_heading: '#fffefd', foreground: '#faf7f2', border: '#faf7f21a',
        primary: '#af7d4f' } },
    },
    semanticGroups: [
      { name: 'Essential', variables: ['background', 'foreground_heading', 'foreground', 'border', 'primary'] },
      { name: 'Primary button', variables: ['primary_button_background', 'primary_button_text', 'primary_button_border'] },
      { name: 'Secondary button', variables: ['secondary_button_background', 'secondary_button_text'] },
      { name: 'Inputs', variables: ['inputs_text', 'inputs_border', 'inputs_hover_background'] },
    ],
    uniqueColors: { themeColors: [
      { name: 'Espresso', hex: '#1e1b18' }, { name: 'Warm White', hex: '#faf7f2' },
      { name: 'White', hex: '#fffefd' }, { name: 'Sand', hex: '#ede8e1' },
      { name: 'Caramel', hex: '#af7d4f' }, { name: 'Foreground', hex: '#2a2620' } ] },
  },
  typography: {
    fontRoles: {
      body: { family: 'DM Sans', weight: 400, style: 'normal', raw: 'dm_sans_n4' },
      label: { family: 'DM Sans', weight: 600, style: 'normal', raw: 'dm_sans_n6' },
      heading: { family: 'Instrument Sans', weight: 700, style: 'normal', raw: 'instrument_sans_n7' },
    },
    hasMobilePresets: false,
    presets: {
      h1: { fontRole: 'heading', size: 80, lineHeight: 94, letterSpacing: -2, case: 'none' },
      h2: { fontRole: 'heading', size: 48, lineHeight: 100, letterSpacing: -1, case: 'none' },
      h3: { fontRole: 'heading', size: 32, lineHeight: 110, letterSpacing: 0, case: 'none' },
      overline: { fontRole: 'label', size: 13, lineHeight: 160, letterSpacing: 1.3, case: 'uppercase' },
      paragraph: { fontRole: 'body', size: 14, lineHeight: 160, letterSpacing: 0, case: 'none' },
      caption: { fontRole: 'body', size: 11, lineHeight: 140, letterSpacing: 1.32, case: 'uppercase' },
    },
  },
  spacing: {
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 80, 120],
    radii: { button_primary: 0, button_secondary: 0, input: 0, card: 0 },
    borderWidths: { button_secondary: 1, input: 1 },
  },
};

// --- scheme assignment by background hex ---
const BG_TO_SCHEME = { '#fffefd': 'scheme-1', '#faf7f2': 'scheme-2', '#ede8e1': 'scheme-3', '#1e1b18': 'scheme-4' };
// colorScheme is a single scalar per composition entry. A multiScheme section (e.g. split-banner:
// light left / dark right) cannot be captured by one scheme — it is componentMap verdict=code, so the
// dual scheme is preserved via the code path (the build reads Figma directly). Here we record the
// DOMINANT scheme (by background) and never fall back SILENTLY: an unmapped background is warned.
function schemeFor(s) {
  const bg = (s && s.bg) || '';
  if (BG_TO_SCHEME[bg]) return BG_TO_SCHEME[bg];
  const who = (s && s.slug && s.slug !== 'undefined') ? s.slug : '(unnamed)';
  if (s && s.multiScheme) console.warn(`  note: ${who} is multiScheme -> colorScheme collapsed to dominant scheme-1 (dual scheme preserved via its code verdict)`);
  else console.warn(`  warn: unmapped background "${bg}" for ${who} -> defaulting colorScheme to scheme-1`);
  return 'scheme-1';
}

// --- blocks from blockTypes (preserves repeats; @app for app components) ---
const blocksOf = (s) => ((s && Array.isArray(s.blockTypes)) ? s.blockTypes : []).map((t, i) => ({ type: t, order: i }));

// --- section-level mobile divergence rules (deterministic from skeleton notes) ---
function divergenceFor(slug) {
  if (slug === 'header-v2') return { type: 'behavior', note: 'desktop Header v2 / mobile Header v1 — different section layout by viewport' };
  if (slug === 'product-information') return { type: 'behavior', note: 'desktop two-column gallery / mobile swipe carousel — behaviour differs' };
  return null;
}

// --- P2 compositions: iterate skeleton order, drop the spacing wrappers ---
const compositions = {};
for (const [tpl, t] of Object.entries(skeleton.templates)) {
  const order = [];
  for (const item of t.order) {
    if (item.wrapper) continue; // Section Heading / Section Footer spacing wrappers are folded out (v1)
    const s = sec(item.slug);
    order.push({
      component: item.slug,
      desktopNodeId: item.desktopNodeId,
      mobileNodeId: item.mobileNodeId,
      colorScheme: schemeFor(s),
      settings: (s && s.settings) || {},
      blocks: blocksOf(s),
      mobileDivergence: divergenceFor(item.slug),
    });
  }
  compositions[tpl] = { template: tpl, figmaNodeId: t.desktopFrame, figmaNodeIdMobile: t.mobileFrame, order };
}

const manifest = {
  _provenance: 'SP-1 Aristopet manifest (config + foundations + compositions). foundations = 4 color schemes clustered from section backgrounds + DM Sans/Instrument Sans type + spacing (inferred from Figma, confidence medium). compositions = deterministic order/node-ids from _raw/skeleton.json + inferred settings/colorScheme/blocks from _raw/sec-*.json. Settings are representative (one extract per distinct section reused across occurrences). Generated by _raw/build-manifest.js.',
  config: {
    themeRoot: '/Users/pablo/Library/CloudStorage/GoogleDrive-pablo@peanutbutter.es/Shared drives/Peanut Butter Drive/7. Diseño/AI Design/shopify-figma-bridge',
    figmaFileKey: '73Qy4BbWWqFUky9b5LXTGT',
    figmaFileName: 'Aristopet-Design-v1 (PRUEBAS PABLO)',
    desktopWidth: 1680,
    mobileWidth: 392,
    mobileNaming: '{name} / Mobile',
    mobilePlacement: 'adjacent',
  },
  foundations,
  compositions,
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');
const counts = Object.fromEntries(Object.entries(compositions).map(([k, v]) => [k, v.order.length]));
console.log('wrote manifest.json | schemes:', Object.keys(foundations.colors.schemes).join(','), '| order counts:', JSON.stringify(counts));
