'use strict';
/**
 * SP-2 safe-write substrate for Shopify theme JSON (settings_schema.json / settings_data.json).
 * Deterministic, unit-tested mechanics; the interactive diff + approval live in the skill prose.
 * Reused by the per-component build (spec #3).
 */
const fs = require('fs');
const path = require('path');

// settings_data.json is JSONC: a leading block-comment header then JSON. Strip the header, then JSON.parse.
function stripJsoncHeader(text) { return String(text).replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, ''); }
function parseSettingsData(text) { return JSON.parse(stripJsoncHeader(text)); }
// Extract the leading header comment (so a write can re-prepend it); '' if none.
function settingsDataHeader(text) { const m = String(text).match(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/); return m ? m[0] : ''; }

// Copy srcPath to destDir/<basename-without-ext>.<stamp>.json; mkdir -p destDir; return the backup path.
function backup(srcPath, destDir, stamp) {
  fs.mkdirSync(destDir, { recursive: true });
  const base = path.basename(srcPath).replace(/\.json$/i, '');
  const out = path.join(destDir, `${base}.${stamp}.json`);
  fs.copyFileSync(srcPath, out);
  return out;
}

// Collect dot-paths whose leaf values differ between before/after (recursing into plain objects).
function diffPaths(before, after, prefix, acc) {
  acc = acc || [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    const p = prefix ? prefix + '.' + k : k;
    const a = before ? before[k] : undefined;
    const b = after ? after[k] : undefined;
    const objA = a && typeof a === 'object' && !Array.isArray(a);
    const objB = b && typeof b === 'object' && !Array.isArray(b);
    if (objA && objB) diffPaths(a, b, p, acc);
    else if (JSON.stringify(a) !== JSON.stringify(b)) acc.push(p);
  }
  return acc;
}
// Paths that changed but are not covered by any approved prefix. Empty array = safe to keep; else restore.
function verifyOnlyChanged(before, after, approvedPrefixes) {
  const changed = diffPaths(before, after, '', []);
  return changed.filter((p) => !(approvedPrefixes || []).some((pre) => p === pre || p.startsWith(pre + '.')));
}

module.exports = { stripJsoncHeader, parseSettingsData, settingsDataHeader, backup, diffPaths, verifyOnlyChanged };
