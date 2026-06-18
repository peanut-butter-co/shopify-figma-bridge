'use strict';
/**
 * SP-2 element-foundations mapper (pure, no IO). Mirrors foundations-map.js: turns design tokens
 * (manifest.foundations.spacing.{radii,borderWidths} + typography presets) plus a theme-profile
 * recommendation table into a write plan for the host theme's element settings (button/input/badge/...
 * radii, border widths, text-case, font, page width). Consumed by build-shopify-foundations after the
 * typography step. Value-domain checks are single-sourced through shopify-validate.settingValueIssue.
 */
const { settingValueIssue } = require('./shopify-validate.js');

// Host element settings considered "in scope" (Horizon). Any present in the live schema but covered by
// NO recommendation rule -> a `no-design-token` gap (left at host default, surfaced — never invented).
const SCOPE_HOST_SETTINGS = [
  'button_border_radius_primary', 'button_border_radius_secondary', 'pills_border_radius',
  'primary_button_border_width', 'secondary_button_border_width',
  'type_font_button_primary', 'type_font_button_secondary',
  'button_text_case_primary', 'button_text_case_secondary',
  'inputs_border_radius', 'input_border_width',
  'badge_corner_radius', 'badge_position', 'badge_font_family', 'badge_text_transform',
  'page_width',
  'popover_border_radius', 'popover_border', 'popover_border_width', 'popover_border_opacity',
  'variant_swatch_radius', 'variant_swatch_width', 'variant_swatch_height',
  'variant_swatch_border_style', 'variant_swatch_border_width', 'variant_swatch_border_opacity',
  'variant_button_radius', 'variant_button_border_width', 'variant_button_width',
  'product_corner_radius', 'card_corner_radius', 'icon_stroke',
];

// design value -> host option value
const TRANSFORMS = {
  case: (v) => (v === 'uppercase' ? 'uppercase' : 'default'),
  fontRole: (v) => (v === 'heading' || v === 'accent' ? 'accent' : 'body'),
};

/** Read a value out of manifest.foundations using a profile `source` string. undefined when absent. */
function resolveSource(foundations, source) {
  if (!foundations || typeof source !== 'string') return undefined;
  let m = source.match(/^typography\.preset:([^.]+)\.(.+)$/);
  if (m) {
    const ps = (foundations.typography && foundations.typography.presets) || {};
    const list = Array.isArray(ps) ? ps : Object.entries(ps).map(([k, v]) => Object.assign({ key: k }, v));
    const p = list.find((x) => x && (x.key === m[1] || x.name === m[1]));
    return p ? p[m[2]] : undefined;
  }
  m = source.match(/^typography\.role:(.+)$/);
  if (m) return m[1]; // the role name; the `fontRole` transform maps it to a host option
  let cur = foundations;
  for (const seg of source.split('.')) { if (cur == null) return undefined; cur = cur[seg]; }
  return cur;
}

function applyTransform(name, value) {
  if (!name) return value;
  return TRANSFORMS[name] ? TRANSFORMS[name](value) : value;
}

/** Crude name-similarity: pick the token key sharing the most underscore-separated parts with `id`. */
function bestKeyMatch(id, keys) {
  const a = String(id).toLowerCase().split(/[_-]/).filter(Boolean);
  let best = null, score = 0;
  for (const k of keys) {
    const b = k.toLowerCase().split(/[_-]/).filter(Boolean);
    const s = b.filter((t) => a.includes(t)).length;
    if (s > score) { best = k; score = s; }
  }
  return best;
}

/**
 * Build the element write plan. `profileElements` is theme-profile recommendations.elements, or null.
 * Returns { applied:[{id,value,old}], schemaExtensions:[{id,value,reason}],
 *           schemaWidenings:[{id,type,value,widen}], gaps:[{kind,detail}] }.
 */
function elementsMap(foundations, profileElements, liveSchema, liveData) {
  const applied = [], schemaExtensions = [], schemaWidenings = [], gaps = [];
  const byId = {};
  for (const s of ((liveSchema && Array.isArray(liveSchema.settings)) ? liveSchema.settings : [])) {
    if (s && s.id != null) byId[s.id] = s;
  }
  const cur = (liveData && liveData.current && typeof liveData.current === 'object') ? liveData.current : {};

  if (!profileElements || typeof profileElements !== 'object') {
    // generic fallback (unknown theme): best-effort name match, nothing auto-applied — all needs-confirm.
    const radii = (foundations && foundations.spacing && foundations.spacing.radii) || {};
    const bw = (foundations && foundations.spacing && foundations.spacing.borderWidths) || {};
    for (const id of Object.keys(byId)) {
      if (/radius/.test(id)) { // any radius id — Horizon suffixes variants AFTER "radius" (button_border_radius_primary)
        const k = bestKeyMatch(id, Object.keys(radii));
        gaps.push({ kind: 'generic-needs-confirm', detail: `${id} ~ radii.${k || '?'} (${k != null ? radii[k] : '?'}) — confirm` });
      } else if (/_border_width$/.test(id)) {
        const k = bestKeyMatch(id, Object.keys(bw));
        gaps.push({ kind: 'generic-needs-confirm', detail: `${id} ~ borderWidths.${k || '?'} (${k != null ? bw[k] : '?'}) — confirm` });
      }
    }
    return { applied, schemaExtensions, schemaWidenings, gaps };
  }

  const covered = new Set();
  for (const [concept, rule] of Object.entries(profileElements)) {
    const raw = resolveSource(foundations, rule && rule.source);
    if (raw === undefined || raw === null) {
      gaps.push({ kind: 'source-missing', detail: `${concept}: source "${rule && rule.source}" not found in foundations` });
      continue;
    }
    const value = applyTransform(rule.transform, raw);
    for (const id of (rule.host || [])) {
      covered.add(id);
      const def = byId[id];
      if (!def) { schemaExtensions.push({ id, value, reason: `new setting for ${concept}` }); continue; }
      const issue = settingValueIssue(def, value);
      if (!issue) { applied.push({ id, value, old: (id in cur ? cur[id] : null) }); continue; }
      if (def.type === 'select' || def.type === 'radio') schemaWidenings.push({ id, type: def.type, value, widen: 'option' });
      else if (def.type === 'range') schemaWidenings.push({ id, type: 'range', value, widen: 'range' });
      else gaps.push({ kind: 'value-out-of-domain', detail: `${id}: ${issue}` });
    }
  }
  // in-scope host settings present in the schema but covered by no rule -> honest no-design-token gap
  for (const id of SCOPE_HOST_SETTINGS) {
    if (!covered.has(id) && byId[id]) {
      gaps.push({ kind: 'no-design-token', detail: `${id} has no design token (left at host default ${JSON.stringify(id in cur ? cur[id] : byId[id].default)})` });
    }
  }
  return { applied, schemaExtensions, schemaWidenings, gaps };
}

/** Merge `applied` into a clone of settings_data, writing into data.current (like foundations-map.applyPlan). */
function applyElementPlan(plan, liveData) {
  const data = JSON.parse(JSON.stringify(liveData || {}));
  data.current = data.current || {};
  for (const w of ((plan && plan.applied) || [])) data.current[w.id] = w.value;
  return data;
}

module.exports = { elementsMap, applyElementPlan, resolveSource, applyTransform, bestKeyMatch, SCOPE_HOST_SETTINGS };
