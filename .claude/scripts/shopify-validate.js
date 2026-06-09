'use strict';
/**
 * Deterministic Shopify-theme validation checks (review finding F006/A6).
 *
 * Extracted from validate-shopify/SKILL.md so the error-prone, repeated math is
 * implemented once and unit-tested rather than re-derived from prose on every run.
 * These cover the five main ERROR/WARNING classes; the full thresholds, rationale,
 * and examples live in validate-shopify/reference/schema-rules.md (the canonical
 * detail). Extending this to every Phase 1-5 edge case is tracked as BL-3.
 *
 * The individual check functions are pure: callers pass already-parsed JSON / extracted
 * ids, so the checks are testable without theme files on disk. validateTheme() at the
 * bottom is the filesystem orchestrator that wires them to a real theme dir (and powers
 * the CLI: `node .claude/scripts/shopify-validate.js <themeDir>`).
 */
const fs = require('fs');
const path = require('path');

/** Range setting: Shopify requires (max - min) to be evenly divisible by step, step > 0. */
function rangeStepIssue(s) {
  if (!s || s.type !== 'range') return null;
  const { min, max, step, id } = s;
  if ([min, max, step].some((v) => typeof v !== 'number')) return null;
  if (step <= 0) return `range "${id}": step must be > 0 (got ${step})`;
  const steps = (max - min) / step;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) {
    return `range "${id}": (max-min)=${max - min} is not evenly divisible by step ${step}`;
  }
  return null;
}

/** Select settings may not exceed Shopify's 50-option limit. */
function selectLimitIssue(s) {
  if (!s || s.type !== 'select') return null;
  const n = Array.isArray(s.options) ? s.options.length : 0;
  return n > 50 ? `select "${s.id}": ${n} options exceeds Shopify's 50-option limit` : null;
}

/** A block `type` must resolve to blocks/<type>.liquid (theme/app/private types are exempt). */
function blockTypeFileIssue(type, existingBlockFiles) {
  // Exempt any @-namespaced type: @app, @theme, and the namespaced @theme/<name> form; plus
  // _private (Evil Horizon) convention. These don't map 1:1 to a blocks/<type>.liquid file.
  if (!type || type.startsWith('@') || type.startsWith('_')) return null;
  const file = type + '.liquid';
  return (existingBlockFiles || []).includes(file) ? null : `block type "${type}" has no blocks/${file}`;
}

/** Every referenced color scheme id must be defined in settings_data's color_schemes. */
function colorSchemeRefIssues(referenced, defined) {
  const have = new Set(defined || []);
  return (referenced || []).filter((r) => !have.has(r)).map((r) => `color scheme "${r}" is referenced but not defined in settings_data`);
}

/** Settings defined in a schema but never referenced in liquid are orphaned (warning). */
function orphanedSettingIssues(definedIds, referencedIds) {
  const ref = new Set(referencedIds || []);
  return (definedIds || []).filter((id) => !ref.has(id)).map((id) => `WARNING: setting "${id}" is defined but never referenced`);
}

/** Shopify font value format: {family}_{style}{weight}, e.g. inter_n4 / abril_fatface_i7. */
function fontValueIssue(value) {
  if (typeof value !== 'string' || value === '') return null;
  return /^[a-z0-9_]+_[ni][1-9]$/.test(value) ? null : `font "${value}" is not in {family}_{style}{weight} format (e.g. inter_n4)`;
}

/**
 * Validate one setting VALUE against its schema setting definition (Phase 1.4). Returns an
 * ERROR-level issue string or null. Types with no deterministic structural constraint
 * (text/textarea/richtext/html/url/image_picker/video/collection/product/page/blog/link_list…)
 * return null. A -1 value is accepted when the range explicitly sets min:-1 (padding sentinel).
 */
function settingValueIssue(def, value) {
  if (!def || typeof def !== 'object') return null;
  const id = def.id;
  const numBounds = () => {
    if (typeof def.min === 'number' && value < def.min) return `setting "${id}": ${value} is below min ${def.min}`;
    if (typeof def.max === 'number' && value > def.max) return `setting "${id}": ${value} is above max ${def.max}`;
    return null;
  };
  switch (def.type) {
    case 'range': {
      if (typeof value !== 'number') return `setting "${id}": range value must be a number (got ${JSON.stringify(value)})`;
      const b = numBounds(); if (b) return b;
      if (typeof def.step === 'number' && def.step > 0 && typeof def.min === 'number') {
        const off = (value - def.min) / def.step;
        if (Math.abs(off - Math.round(off)) > 1e-9) return `setting "${id}": ${value} is not on a valid step (min ${def.min}, step ${def.step})`;
      }
      return null;
    }
    case 'number':
      if (typeof value !== 'number') return `setting "${id}": number value must be a number (got ${JSON.stringify(value)})`;
      return numBounds();
    case 'select':
    case 'radio': {
      if (value == null || value === '') return null; // unset / cleared select is not a violation
      // Option values may be numbers or strings, and the editor treats e.g. 1 and "1" as equal —
      // compare by string so a number-vs-string mismatch is not a false positive.
      const opts = Array.isArray(def.options) ? def.options.map((o) => o && o.value) : [];
      return opts.map(String).includes(String(value)) ? null : `setting "${id}": value ${JSON.stringify(value)} is not one of [${opts.join(', ')}]`;
    }
    case 'checkbox':
      return typeof value === 'boolean' ? null : `setting "${id}": checkbox value must be true/false (got ${JSON.stringify(value)})`;
    case 'color': {
      if (value === '' || value == null) return null; // a cleared color is allowed
      const v = String(value).trim();
      // Shopify color accepts 3/4/6/8-digit hex (alpha included) OR a functional rgb(a)/hsl(a)
      // string (that is how a transparent color like rgba(0,0,0,0) is stored).
      const ok = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) || /^(rgba?|hsla?)\([^)]*\)$/i.test(v);
      return ok ? null : `setting "${id}": color "${value}" is not a valid hex / rgb(a) / hsl(a) color`;
    }
    case 'font_picker': {
      const f = fontValueIssue(value);
      return f ? `setting "${id}": ${f}` : null;
    }
    default:
      return null; // no deterministic structural check for free-text / reference types
  }
}

/** Duplicate setting ids within one scope (section-level, or one block type). Phase 2.4. */
function idUniquenessIssues(settings, scopeLabel) {
  const seen = new Set(), dupes = new Set();
  for (const s of (Array.isArray(settings) ? settings : [])) {
    if (!s || s.id == null) continue;
    if (seen.has(s.id)) dupes.add(s.id); else seen.add(s.id);
  }
  return [...dupes].map((id) => `duplicate setting id "${id}"${scopeLabel ? ` in ${scopeLabel}` : ''}`);
}

/** A section's block count must not exceed a positive max_blocks (Phase 1.5 / schema-rules #9). */
function maxBlocksIssue(blockCount, maxBlocks, label) {
  if (typeof maxBlocks !== 'number' || maxBlocks <= 0) return null;
  return blockCount > maxBlocks ? `${label || 'section'}: ${blockCount} blocks exceeds max_blocks ${maxBlocks}` : null;
}

/** Extract + parse the {% schema %} JSON from a section/block .liquid source (null if none). */
const SCHEMA_RE = /\{%[-\s]*schema\s*[-]?%\}([\s\S]*?)\{%[-\s]*endschema\s*[-]?%\}/;
function extractSchema(liquidSource) {
  const m = String(liquidSource).match(SCHEMA_RE);
  if (!m) return null;
  return JSON.parse(m[1]); // throws on malformed schema JSON — callers decide how to surface it
}

/**
 * Parse theme JSON that may carry Shopify's auto-generated JSONC comments. templates/*.json and
 * config/settings_data.json begin with an auto-generated block-comment header (and may carry line
 * comments). Strips comments that sit OUTSIDE string literals — so comment-like text inside a value
 * (e.g. a URL containing a double slash) survives — then JSON.parse. ({% schema %} blocks forbid
 * comments, so extractSchema parses those directly with JSON.parse.)
 */
function parseThemeJSON(text) {
  const s = String(text).replace(/^\uFEFF/, ''); // strip a leading UTF-8 BOM (some editors add one)
  let out = '', inStr = false, inBlock = false, inLine = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inStr) {
      out += c;
      if (c === '\\') { out += (n || ''); i++; }   // keep escape pairs (e.g. \") intact
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '/' && n === '/') { inLine = true; i++; continue; }
    out += c;
  }
  return JSON.parse(out);
}

/**
 * Filesystem orchestrator: read a Shopify theme directory and run every deterministic check,
 * returning { errors:[], warnings:[] } as arrays of human-readable strings. The pure functions
 * above do the logic; this only wires them to disk. Both the CLI (main) and the skills harness
 * call this. (BL-3 extends the wired check set incrementally — see schema-rules.md for the full list.)
 */
function validateTheme(themeDir) {
  const errors = [];
  const warnings = [];
  const abs = (p) => path.join(themeDir, p);
  const exists = (p) => fs.existsSync(abs(p));
  const readText = (p) => fs.readFileSync(abs(p), 'utf8');
  const listFiles = (sub, ext) => (exists(sub) ? fs.readdirSync(abs(sub)).filter((f) => f.endsWith(ext)) : []);
  const readJSONSafe = (p, label) => {
    try { return parseThemeJSON(readText(p)); } catch (e) { errors.push(`${label}: invalid JSON (${e.message})`); return null; }
  };

  // settings_data.json → the set of defined color-scheme ids. `current` is usually an object,
  // but may be a STRING naming a preset (when the merchant hasn't customized), in which case the
  // schemes live under presets[name]. Union every source so a valid theme is never false-flagged.
  let definedSchemes = [];
  if (exists('config/settings_data.json')) {
    const sd = readJSONSafe('config/settings_data.json', 'config/settings_data.json');
    if (sd) {
      const schemeIds = new Set();
      const collect = (o) => { for (const k of Object.keys((o && o.color_schemes) || {})) schemeIds.add(k); };
      if (sd.current && typeof sd.current === 'object') collect(sd.current);
      const presets = (sd.presets && typeof sd.presets === 'object') ? sd.presets : {};
      for (const p of Object.values(presets)) collect(p); // covers a string `current` (named preset) too
      definedSchemes = [...schemeIds];
    }
  }

  // index block files for block-type → file resolution
  const blockFiles = listFiles('blocks', '.liquid');

  // sections: parse each {% schema %} once, run schema-level checks, and index by type so the
  // templates loop can validate setting VALUES against their definitions.
  const sectionSchemas = {}; // type -> parsed schema (or null when the file has no schema block)
  for (const file of listFiles('sections', '.liquid')) {
    const type = file.replace(/\.liquid$/, '');
    let schema;
    try { schema = extractSchema(readText(`sections/${file}`)); }
    catch (e) { errors.push(`sections/${file}: malformed {% schema %} JSON (${e.message})`); continue; }
    sectionSchemas[type] = schema || null;
    if (!schema) continue; // a section without a schema block is legal — skip it
    const settings = Array.isArray(schema.settings) ? schema.settings : [];
    for (const s of settings) {
      const r = rangeStepIssue(s); if (r) errors.push(`sections/${file}: ${r}`);
      const sel = selectLimitIssue(s); if (sel) errors.push(`sections/${file}: ${sel}`);
    }
    for (const issue of idUniquenessIssues(settings, `sections/${file}`)) errors.push(issue);
    for (const b of (Array.isArray(schema.blocks) ? schema.blocks : [])) {
      const bt = blockTypeFileIssue(b && b.type, blockFiles); if (bt) errors.push(`sections/${file}: ${bt}`);
      for (const issue of idUniquenessIssues(b && b.settings, `sections/${file} block "${b && b.type}"`)) errors.push(issue);
    }
    // presets (2.6): preset setting values must validate against this schema's setting defs
    const settingsById = {};
    for (const s of settings) if (s && s.id) settingsById[s.id] = s;
    for (const preset of (Array.isArray(schema.presets) ? schema.presets : [])) {
      for (const [pid, pval] of Object.entries((preset && preset.settings) || {})) {
        const vi = settingValueIssue(settingsById[pid], pval);
        if (vi) errors.push(`sections/${file} preset "${preset && preset.name}": ${vi}`);
      }
    }
  }

  // templates: validate setting VALUES (1.4), blocks (1.5: type membership + max_blocks + values),
  // and collect color-scheme references (validated against settings_data below).
  const referencedSchemes = [];
  for (const file of listFiles('templates', '.json')) {
    const tpl = readJSONSafe(`templates/${file}`, `templates/${file}`);
    for (const [secKey, sec] of Object.entries((tpl && tpl.sections) || {})) {
      if (!sec) continue;
      const schema = sectionSchemas[sec.type];
      const settingsById = {};
      if (schema && Array.isArray(schema.settings)) for (const s of schema.settings) if (s && s.id) settingsById[s.id] = s;
      for (const [sid, sval] of Object.entries(sec.settings || {})) {
        const def = settingsById[sid];
        if (def && def.type === 'color_scheme' && typeof sval === 'string' && sval) referencedSchemes.push(sval);
        const vi = settingValueIssue(def, sval); // null when the key is unknown / unconstrained
        if (vi) errors.push(`templates/${file} → ${secKey}: ${vi}`);
      }
      if (schema) {
        const schemaBlocks = Array.isArray(schema.blocks) ? schema.blocks : [];
        const blockDefsByType = {};
        for (const b of schemaBlocks) if (b && b.type) blockDefsByType[b.type] = b;
        const acceptsAppBlocks = '@app' in blockDefsByType;
        const hasBlockFile = (t) => blockFiles.includes(`${t}.liquid`) || blockFiles.includes(`_${t}.liquid`);
        const tplBlocks = (sec.blocks && typeof sec.blocks === 'object') ? Object.entries(sec.blocks) : [];
        const mb = maxBlocksIssue(tplBlocks.length, schema.max_blocks, `templates/${file} → ${secKey}`);
        if (mb) errors.push(mb);
        for (const [bKey, blk] of tplBlocks) {
          if (!blk || !blk.type) continue;
          const t = blk.type;
          if (String(t).startsWith('@') || String(t).includes('://')) continue; // @app / @theme/* / shopify://… app block instances
          // Valid if the schema declares the type explicitly, OR it resolves to a real
          // blocks/<type>.liquid file (theme & statically-rendered blocks — used even when the
          // section lists no @theme wildcard), OR the section opts into @app blocks. Only a type
          // with no definition anywhere (typo'd / deleted block file) is a genuine error.
          const allowed = (t in blockDefsByType) || hasBlockFile(t) || acceptsAppBlocks;
          if (!allowed) {
            errors.push(`templates/${file} → ${secKey} → ${bKey}: block type "${t}" has no definition (not in section "${sec.type}" schema blocks, and no blocks/${t}.liquid)`);
            continue;
          }
          // Validate block setting values only against an INLINE block def — theme-block setting
          // schemas live in their own blocks/<type>.liquid {% schema %} (out of scope for this pass).
          const bDef = blockDefsByType[t];
          const bSettingsById = {};
          if (bDef && Array.isArray(bDef.settings)) for (const s of bDef.settings) if (s && s.id) bSettingsById[s.id] = s;
          for (const [sid, sval] of Object.entries(blk.settings || {})) {
            const vi = settingValueIssue(bSettingsById[sid], sval);
            if (vi) errors.push(`templates/${file} → ${secKey} → ${bKey}: ${vi}`);
          }
        }
      }
    }
  }
  // dedupe so N sections referencing the same missing scheme yield one error, not N
  for (const issue of colorSchemeRefIssues([...new Set(referencedSchemes)], definedSchemes)) errors.push(issue);

  return { errors, warnings };
}

/** CLI: `node shopify-validate.js [themeDir]` — prints the report, exits non-zero on errors. */
function main(argv) {
  const dir = argv[2] || '.';
  const { errors, warnings } = validateTheme(dir);
  for (const w of warnings) console.log('WARNING: ' + w);
  for (const e of errors) console.log('ERROR: ' + e);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

module.exports = {
  rangeStepIssue, selectLimitIssue, blockTypeFileIssue, colorSchemeRefIssues, orphanedSettingIssues,
  fontValueIssue, settingValueIssue, idUniquenessIssues, maxBlocksIssue,
  extractSchema, parseThemeJSON, validateTheme,
};

if (require.main === module) main(process.argv);
