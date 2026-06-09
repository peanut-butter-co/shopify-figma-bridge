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
  if (!type || type === '@app' || type === '@theme' || type.startsWith('_')) return null;
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
  const s = String(text);
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

  // settings_data.json → the set of defined color-scheme ids
  let definedSchemes = [];
  if (exists('config/settings_data.json')) {
    const sd = readJSONSafe('config/settings_data.json', 'config/settings_data.json');
    if (sd) definedSchemes = Object.keys((sd.current && sd.current.color_schemes) || {});
  }

  // index block files for block-type → file resolution
  const blockFiles = listFiles('blocks', '.liquid');

  // sections: parse each {% schema %}, run schema-level checks, and record which setting ids
  // are color_scheme-typed per section type (so template refs can be resolved below)
  const colorSchemeIdsByType = {};
  for (const file of listFiles('sections', '.liquid')) {
    const type = file.replace(/\.liquid$/, '');
    let schema;
    try { schema = extractSchema(readText(`sections/${file}`)); }
    catch (e) { errors.push(`sections/${file}: malformed {% schema %} JSON (${e.message})`); continue; }
    if (!schema) continue; // a section without a schema block is legal — skip it
    for (const s of (Array.isArray(schema.settings) ? schema.settings : [])) {
      const r = rangeStepIssue(s); if (r) errors.push(`sections/${file}: ${r}`);
      const sel = selectLimitIssue(s); if (sel) errors.push(`sections/${file}: ${sel}`);
      if (s && s.type === 'color_scheme' && s.id) (colorSchemeIdsByType[type] = colorSchemeIdsByType[type] || []).push(s.id);
    }
    for (const b of (Array.isArray(schema.blocks) ? schema.blocks : [])) {
      const bt = blockTypeFileIssue(b && b.type, blockFiles); if (bt) errors.push(`sections/${file}: ${bt}`);
    }
  }

  // templates: resolve each section's color_scheme setting values, validate against definedSchemes
  const referencedSchemes = [];
  for (const file of listFiles('templates', '.json')) {
    const tpl = readJSONSafe(`templates/${file}`, `templates/${file}`);
    for (const sec of Object.values((tpl && tpl.sections) || {})) {
      if (!sec || !sec.settings) continue;
      for (const id of (colorSchemeIdsByType[sec.type] || [])) {
        const val = sec.settings[id];
        if (typeof val === 'string' && val) referencedSchemes.push(val);
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
  extractSchema, parseThemeJSON, validateTheme,
};

if (require.main === module) main(process.argv);
