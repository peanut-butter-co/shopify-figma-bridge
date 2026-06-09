'use strict';
/**
 * SP-0a — the DETERMINISTIC half of the design->build reachability check.
 *
 * "Deterministic" = calculable yes/no, no AI inference. Reuses .claude/scripts/shopify-validate.js
 * so the schema math lives in exactly one place. The FUZZY half (does a bespoke detached Figma
 * frame correspond to a candidate host section at all?) is SP-1's inference and is NOT here.
 *
 * All functions are pure except resolveHostSection, which reads the host theme from disk (read-only).
 */
const fs = require('fs');
const path = require('path');
const { extractSchema, settingValueIssue, maxBlocksIssue, blockTypeAccepted } = require('./shopify-validate.js');

/**
 * Resolve a section slug against a host theme dir: { file, exists, schema }. `exists` is the real
 * filesystem answer (closes [DESIGN-RULES-TRUST]); `schema` is the parsed {% schema %} (null when the
 * file is absent or its schema block is malformed/absent — caller biases to CODE on null, per D3).
 */
function resolveHostSection(themeRoot, slug) {
  const file = `sections/${slug}.liquid`;
  const abs = path.join(themeRoot, file);
  if (!fs.existsSync(abs)) return { file, exists: false, schema: null };
  let schema = null;
  try { schema = extractSchema(fs.readFileSync(abs, 'utf8')); } catch (e) { schema = null; }
  return { file, exists: true, schema };
}

/**
 * Run the deterministic schema-expressibility check in REVERSE: can `schema` express this instance's
 * settings/blocks? Returns [{ kind, detail }] (empty = expressible). kind in
 * {value-out-of-domain, block-type-unsupported, max-blocks-exceeded}. Conservative per D3: an
 * instance setting id NOT in the schema is treated as not-expressible (we cannot PROVE config), and an
 * unparseable/absent schema (null) yields no positive proof -> caller routes to CODE.
 */
function expressibilityIssues(schema, instance) {
  const issues = [];
  if (!schema || typeof schema !== 'object') return issues; // no schema -> no positive proof (caller biases to code)
  const settingsById = {};
  for (const s of (Array.isArray(schema.settings) ? schema.settings : [])) if (s && s.id) settingsById[s.id] = s;
  for (const [id, val] of Object.entries((instance && instance.settings) || {})) {
    const def = settingsById[id];
    if (!def) { issues.push({ kind: 'value-out-of-domain', detail: `setting "${id}" is not in the host schema` }); continue; }
    const v = settingValueIssue(def, val); // null for in-domain / structurally-unconstrained types
    if (v) issues.push({ kind: 'value-out-of-domain', detail: v });
  }
  const blocks = Array.isArray(instance && instance.blocks) ? instance.blocks : [];
  for (const b of blocks) {
    if (!b || !b.type) continue;
    const t = String(b.type);
    if (t.startsWith('@') || t.includes('://')) continue; // @app / @theme/* / shopify://… instances are accepted
    if (!blockTypeAccepted(t, schema.blocks, [])) issues.push({ kind: 'block-type-unsupported', detail: `block type "${t}" is not accepted by the host schema` });
  }
  const mb = maxBlocksIssue(blocks.length, schema.max_blocks, 'section');
  if (mb) issues.push({ kind: 'max-blocks-exceeded', detail: mb });
  return issues;
}

/**
 * Collect the CSS-custom-property prefixes a theme profile marks `source: "css-hardcoded"`. For
 * Horizon's spacing scale (pattern "--margin-{size}, --padding-{size}, --gap-{size}") this yields
 * ["--margin-", "--padding-", "--gap-"]. Walks the whole profile so future hardcoded regions are
 * picked up without special-casing.
 */
function cssHardcodedPrefixes(profile) {
  const prefixes = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.source === 'css-hardcoded' && typeof o.pattern === 'string') {
      for (const p of o.pattern.split(',')) {
        const m = p.trim().match(/^(--[a-z0-9]+-)\{/i); // "--padding-{size}" -> "--padding-"
        if (m) prefixes.push(m[1]);
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v);
  };
  walk(profile);
  return [...new Set(prefixes)];
}

/** Is a demanded CSS property hardcoded (i.e. NOT settings-changeable) in this theme profile? -> CODE. */
function isCssHardcoded(profile, property) {
  const p = String(property).trim();
  return cssHardcodedPrefixes(profile).some((pre) => p.startsWith(pre));
}

module.exports = { resolveHostSection, expressibilityIssues, cssHardcodedPrefixes, isCssHardcoded };
