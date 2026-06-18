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
const PRESET_LEVEL = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', paragraph: 'paragraph' };

/** Normalize an Aristopet color string to Horizon's convention (rgba(0,0,0,0) for transparent, #rrggbb[aa] otherwise). */
function normalizeColor(c) { return rgbaToShopifyHex(shopifyHexToRGBA(c)); }

// Roles whose color sits directly on the scheme background and must contrast with it. Used to flag
// inherited (host-default) roles that will be low-contrast against a newly-written background of the same tone.
const CONTRAST_INK_ROLES = [
  'foreground', 'foreground_heading', 'primary',
  'secondary_button_text', 'secondary_button_border',
  'input_text_color', 'input_border_color',
  'primary_button_background', 'selected_variant_background_color',
];

/** Coarse relative luminance (0-1) of a Shopify color, or null if too transparent to judge (it composites over the bg). */
function luminance(c) {
  let rgba; try { rgba = shopifyHexToRGBA(c); } catch (e) { return null; }
  if ((rgba.a == null ? 1 : rgba.a) < 0.5) return null;
  return 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b;
}

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

    // Coverage transparency: foundations capture only a subset of Horizon's ~35 roles, so the rest stay at
    // host defaults after the merge. Surface which roles are inherited, and escalate to a contrast risk when
    // an inherited ink role lands on the same tone as the newly-written background (e.g. a dark bg keeping the
    // host's dark buttons/inputs -> invisible). This keeps the "gap-transparent" promise for sparse schemes.
    const hostSettings = (liveSchemes[id] && liveSchemes[id].settings) || {};
    const inherited = Object.keys(hostSettings).filter((r) => !(r in settings));
    if (inherited.length) {
      const design = inherited.filter((r) => /button|input|variant/.test(r));
      gaps.push({ kind: 'partial-scheme-coverage', detail: `${id} (${scheme.name || 'scheme'}) sets ${Object.keys(settings).length} roles; inherits ${inherited.length} host defaults${design.length ? ` incl. ${design.slice(0, 6).join(', ')}${design.length > 6 ? '…' : ''}` : ''}` });
      const bg = settings.background != null ? settings.background : hostSettings.background;
      const bgLum = luminance(bg);
      if (bgLum != null) {
        const bgDark = bgLum < 0.5;
        const clash = [];
        for (const r of CONTRAST_INK_ROLES) {
          if (r in settings || !(r in hostSettings)) continue; // set by us, or absent on host
          const lum = luminance(hostSettings[r]);
          if (lum == null) continue; // transparent — composites over bg, can't judge
          if ((lum < 0.5) === bgDark) clash.push(`${r}=${hostSettings[r]}`);
        }
        if (clash.length) {
          gaps.push({ kind: 'scheme-contrast-risk', detail: `${id} background ${bg} is ${bgDark ? 'dark' : 'light'} but inherits same-tone roles that will be low-contrast: ${clash.join(', ')} — set them explicitly or derive from the scheme` });
        }
      }
    }
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

/**
 * Write an enum-valued type setting (font/case), surfacing a gap when the value isn't a host option so we
 * never push a value the theme will silently reject. (Size has its own ladder-extension path via writeSize.)
 */
function writeEnum(id, value, liveSchema, typeWrites, gaps) {
  typeWrites[id] = value;
  const opts = optionValues(liveSchema, id);
  if (opts !== null && !opts.includes(value)) {
    gaps.push({ kind: 'invalid-type-option', detail: `${id}=${value} is not a host option (${opts.join('/')}) — wrote it but the theme may reject it` });
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
  // Every mapped font role needs availability confirmation, not just heading — a missing body/subheading font
  // falls back silently too. (Verified empirically on the live preview, not by asking; see gotchas.md.)
  const FONT_SLOTS = [['body', 'type_body_font'], ['label', 'type_subheading_font'], ['heading', 'type_heading_font']];
  for (const [role, field] of FONT_SLOTS) {
    if (!roles[role]) continue;
    fontWrites[field] = roles[role].raw;
    gaps.push({ kind: 'verify-font-availability', detail: `confirm "${roles[role].family || roles[role].raw}" is in the Shopify font library; else add a custom font source` });
  }
  gaps.push({ kind: 'accent-left-default', detail: 'type_accent_font left at host default (Aristopet has no accent role)' });

  for (const [presetKey, preset] of Object.entries(presets)) {
    const level = PRESET_LEVEL[presetKey];
    if (!level) {
      // Host-capacity (design-has-more-than-host): Horizon exposes a single body size (type_size_paragraph),
      // so extra plain-body sizes (e.g. Figma Text Small/Large) cannot be expressed — flag, never drop silently.
      // Decorative styles (overline/caption — uppercase or label role) are genuinely component-level.
      if (preset.fontRole === 'body' && preset.case !== 'uppercase') {
        gaps.push({ kind: 'host-capacity', detail: `${presetKey} (body text ${preset.size}px) has no host slot — Horizon exposes a single body size (type_size_paragraph); only the primary paragraph maps, ${presetKey} is component-level (spec #3)` });
      } else {
        gaps.push({ kind: 'component-level-preset', detail: `${presetKey} is a component-level text style — not a theme heading level (handled in spec #3)` });
      }
      continue;
    }
    if (level === 'paragraph') {
      writeSize('paragraph', preset.size, liveSchema, typeWrites, schemaExtensions, gaps);
      const lh = nearestToken(lineHeightBucket(preset.lineHeight), optionValues(liveSchema, 'type_line_height_paragraph'));
      if (lh) { typeWrites.type_line_height_paragraph = lh; gaps.push({ kind: 'approx-line-height', detail: `paragraph line-height ${preset.lineHeight}% -> token ${lh}` }); }
      continue;
    }
    writeEnum('type_font_' + level, preset.fontRole === 'accent' ? 'accent' : 'heading', liveSchema, typeWrites, gaps);
    writeSize(level, preset.size, liveSchema, typeWrites, schemaExtensions, gaps);
    const lh = nearestToken(lineHeightBucket(preset.lineHeight), optionValues(liveSchema, 'type_line_height_' + level));
    if (lh) { typeWrites['type_line_height_' + level] = lh; gaps.push({ kind: 'approx-line-height', detail: `${level} line-height ${preset.lineHeight}% -> token ${lh}` }); }
    const ls = nearestToken(letterSpacingBucket(preset.letterSpacing), optionValues(liveSchema, 'type_letter_spacing_' + level));
    if (ls) { typeWrites['type_letter_spacing_' + level] = ls; gaps.push({ kind: 'approx-letter-spacing', detail: `${level} letter-spacing ${preset.letterSpacing} -> token ${ls}` }); }
    writeEnum('type_case_' + level, preset.case === 'uppercase' ? 'uppercase' : 'none', liveSchema, typeWrites, gaps);
  }
  // Transparency: Horizon defines h1..h6 — surface any heading level the host exposes that foundations
  // omit, so the dev knows it stays at the host default (not derived from the design), not silently skipped.
  const mappedLevels = new Set(Object.entries(PRESET_LEVEL).filter(([pk]) => presets[pk]).map(([, lv]) => lv));
  const hostLevels = new Set();
  for (const grp of liveSchema || []) for (const s of (grp.settings || [])) {
    const m = s && typeof s.id === 'string' && s.id.match(/^type_size_(h[1-6])$/);
    if (m) hostLevels.add(m[1]);
  }
  for (const lvl of hostLevels) if (!mappedLevels.has(lvl)) {
    gaps.push({ kind: 'type-level-not-in-foundations', detail: `host has type_size_${lvl} but foundations define no preset for it — left at host default` });
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
