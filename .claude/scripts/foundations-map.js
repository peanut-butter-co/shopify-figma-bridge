'use strict';
/**
 * SP-2 foundations build — PURE mapping from Aristopet foundations + a live crunchy-horizon
 * (Horizon) settings schema/data to a write plan. No IO, no side effects. The skill
 * (.claude/skills/build-shopify-foundations) runs this and presents the plan for approval.
 * Reuses color-utils.js so color conversion is single-sourced and tested.
 */
const { shopifyHexToRGBA, rgbaToShopifyHex } = require('./color-utils.js');

// Aristopet scheme role id -> Horizon color_scheme_group role id. Missing keys are orphans.
const ROLE_MAP = {
  background: 'background', foreground_heading: 'foreground_heading', foreground: 'foreground',
  border: 'border', primary: 'primary',
  primary_button_background: 'primary_button_background', primary_button_text: 'primary_button_text',
  primary_button_border: 'primary_button_border',
  secondary_button_background: 'secondary_button_background', secondary_button_text: 'secondary_button_text',
  inputs_text: 'input_text_color', inputs_border: 'input_border_color',
  inputs_hover_background: 'input_hover_background',
};

// Aristopet preset key -> Horizon type level. Other presets (overline, caption) are component-level.
const PRESET_LEVEL = { h1: 'h1', h2: 'h2', h3: 'h3', paragraph: 'paragraph' };

/** Normalize an Aristopet color string to Horizon's convention (rgba(0,0,0,0) for transparent, #rrggbb[aa] otherwise). */
function normalizeColor(c) { return rgbaToShopifyHex(shopifyHexToRGBA(c)); }

/**
 * foundations + liveData -> { schemeWrites, surplusSchemes, gaps }.
 * schemeWrites carry only mapped roles (partial, merged later). surplusSchemes = host schemes NOT in
 * foundations: they are SURFACED as gaps but never auto-deleted (a host scheme may still be referenced
 * by host sections/templates — deleting it silently breaks them; cleanup belongs to spec #3).
 */
function mapSchemes(foundations, liveData) {
  const schemes = ((foundations || {}).colors || {}).schemes || {};
  const liveSchemes = (((liveData || {}).current || {}).color_schemes) || {};
  const schemeWrites = {};
  const gaps = [];
  for (const [id, scheme] of Object.entries(schemes)) {
    const settings = {};
    for (const [role, value] of Object.entries(scheme.colors || {})) {
      const target = ROLE_MAP[role];
      if (!target) { gaps.push({ kind: 'orphan-role', detail: `${id}.${role} (${value}) has no Horizon role — dropped` }); continue; }
      settings[target] = normalizeColor(value);
    }
    schemeWrites[id] = { settings };
  }
  const surplusSchemes = Object.keys(liveSchemes).filter((k) => !(k in schemes));
  for (const id of surplusSchemes) {
    gaps.push({ kind: 'surplus-scheme', detail: `host scheme "${id}" is not in the Aristopet foundations — left in place (it may be referenced by host sections; remove only when those are replaced)` });
  }
  return { schemeWrites, surplusSchemes, gaps };
}

/** Find a setting by id anywhere in the live schema; return its option value array (or null if absent). */
function optionValues(liveSchema, id) {
  for (const grp of liveSchema || []) {
    for (const s of (grp.settings || [])) {
      if (s && s.id === id && Array.isArray(s.options)) return s.options.map((o) => o.value);
    }
  }
  return null;
}
function nearestToken(bucket, options) {
  const hit = (options || []).find((o) => String(o).endsWith(bucket));
  return hit || null;
}
function lineHeightBucket(pct) { return pct < 100 ? 'tight' : pct <= 125 ? 'normal' : 'loose'; }
function letterSpacingBucket(v) { return v < 0 ? 'tight' : v === 0 ? 'normal' : 'loose'; }

/**
 * Write a type size for any level (heading or paragraph) consistently: always record the value, but
 * surface the two failure modes — value off the host ladder (-> schemaExtensions + gap) and host
 * setting absent (-> missing-setting gap). Keeps heading/paragraph handling symmetric.
 */
function writeSize(level, size, liveSchema, typeWrites, schemaExtensions, gaps) {
  const sizeStr = String(size);
  typeWrites['type_size_' + level] = sizeStr;
  const opts = optionValues(liveSchema, 'type_size_' + level);
  if (opts === null) {
    gaps.push({ kind: 'missing-setting', detail: `host has no type_size_${level} setting — wrote ${sizeStr} but it may be ignored` });
  } else if (!opts.includes(sizeStr)) {
    schemaExtensions.push({ setting: 'type_size_' + level, addOption: { value: sizeStr, label: sizeStr + 'px' } });
    gaps.push({ kind: 'size-ladder-extension', detail: `${level} size ${sizeStr}px is not on the host ladder — proposing to add it` });
  }
}

/** foundations + liveSchema -> { fontWrites, typeWrites, schemaExtensions, gaps }. */
function mapTypography(foundations, liveSchema) {
  const typ = (foundations || {}).typography || {};
  const roles = typ.fontRoles || {};
  const presets = typ.presets || {};
  const gaps = [];
  const schemaExtensions = [];
  const typeWrites = {};
  const fontWrites = {};
  if (roles.body) fontWrites.type_body_font = roles.body.raw;
  if (roles.label) fontWrites.type_subheading_font = roles.label.raw;
  if (roles.heading) {
    fontWrites.type_heading_font = roles.heading.raw;
    gaps.push({ kind: 'verify-font-availability', detail: `confirm "${roles.heading.family || roles.heading.raw}" is in the Shopify font library; else add a custom font source` });
  }
  gaps.push({ kind: 'accent-left-default', detail: 'type_accent_font left at host default (Aristopet has no accent role)' });

  for (const [presetKey, preset] of Object.entries(presets)) {
    const level = PRESET_LEVEL[presetKey];
    if (!level) { gaps.push({ kind: 'component-level-preset', detail: `${presetKey} is a component-level text style — not a theme heading level (handled in spec #3)` }); continue; }
    if (level === 'paragraph') {
      writeSize('paragraph', preset.size, liveSchema, typeWrites, schemaExtensions, gaps);
      const lh = nearestToken(lineHeightBucket(preset.lineHeight), optionValues(liveSchema, 'type_line_height_paragraph'));
      if (lh) { typeWrites.type_line_height_paragraph = lh; gaps.push({ kind: 'approx-line-height', detail: `paragraph line-height ${preset.lineHeight}% -> token ${lh}` }); }
      continue;
    }
    typeWrites['type_font_' + level] = preset.fontRole === 'accent' ? 'accent' : 'heading';
    writeSize(level, preset.size, liveSchema, typeWrites, schemaExtensions, gaps);
    const lh = nearestToken(lineHeightBucket(preset.lineHeight), optionValues(liveSchema, 'type_line_height_' + level));
    if (lh) { typeWrites['type_line_height_' + level] = lh; gaps.push({ kind: 'approx-line-height', detail: `${level} line-height ${preset.lineHeight}% -> token ${lh}` }); }
    const ls = nearestToken(letterSpacingBucket(preset.letterSpacing), optionValues(liveSchema, 'type_letter_spacing_' + level));
    if (ls) { typeWrites['type_letter_spacing_' + level] = ls; gaps.push({ kind: 'approx-letter-spacing', detail: `${level} letter-spacing ${preset.letterSpacing} -> token ${ls}` }); }
    typeWrites['type_case_' + level] = preset.case === 'uppercase' ? 'uppercase' : 'none';
  }
  return { fontWrites, typeWrites, schemaExtensions, gaps };
}

/** Full plan: foundations + live schema/data -> { schemeWrites, typeWrites, fontWrites, schemaExtensions, gaps, surplusSchemes }. */
function foundationsMap(foundations, liveSchema, liveData) {
  const c = mapSchemes(foundations, liveData);
  const t = mapTypography(foundations, liveSchema);
  return {
    schemeWrites: c.schemeWrites,
    surplusSchemes: c.surplusSchemes,
    typeWrites: t.typeWrites,
    fontWrites: t.fontWrites,
    schemaExtensions: t.schemaExtensions,
    gaps: [...c.gaps, ...t.gaps],
  };
}

/** Apply a plan to deep clones of the live schema/data; return { schema, data } ready to serialize. */
function applyPlan(plan, liveSchema, liveData) {
  const schema = JSON.parse(JSON.stringify(liveSchema));
  const data = JSON.parse(JSON.stringify(liveData));
  data.current = data.current || {};
  data.current.color_schemes = data.current.color_schemes || {};
  // schemes: merge mapped roles into existing scheme settings (preserve host-only roles)
  for (const [id, write] of Object.entries(plan.schemeWrites || {})) {
    const slot = data.current.color_schemes[id] || (data.current.color_schemes[id] = { settings: {} });
    slot.settings = Object.assign({}, slot.settings, write.settings);
  }
  // surplus host schemes are intentionally NOT deleted here — they may be referenced by host
  // sections/templates; cleanup happens when those are replaced (spec #3).
  Object.assign(data.current, plan.fontWrites || {}, plan.typeWrites || {});
  // schema: append missing select options
  for (const ext of (plan.schemaExtensions || [])) {
    for (const grp of schema) {
      const s = (grp.settings || []).find((x) => x && x.id === ext.setting);
      if (s && Array.isArray(s.options) && !s.options.some((o) => o.value === ext.addOption.value)) s.options.push(ext.addOption);
    }
  }
  return { schema, data };
}

module.exports = { ROLE_MAP, normalizeColor, mapSchemes, mapTypography, foundationsMap, applyPlan, optionValues };
