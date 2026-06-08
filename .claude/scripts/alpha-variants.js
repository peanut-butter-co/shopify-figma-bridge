'use strict';
/**
 * Deterministic alpha-variant computation for build-foundations (review finding F023/A6).
 *
 * Extracted from build-foundations/reference/alpha-variants.md so the error-prone parse /
 * skip / round / dedup steps are implemented once and unit-tested, rather than re-derived
 * from prose. Reuses color-utils.js for color parsing.
 *
 * The script does the deterministic part (which alpha colors need a variant, deduplicated).
 * The Figma-specific part — matching each entry's RGB to its parent base variable and naming
 * it `{ParentGroup}/{pct}` — stays with the agent, which has the live variable list.
 */
const { shopifyHexToRGBA } = require('./color-utils.js');

/**
 * Given `foundations.colors.schemes` (an object of scheme -> { field: colorString }),
 * return the deduplicated alpha variants that need creating: `[{ r, g, b, a, pct }]`.
 * - Opaque colors (a >= 0.99) are skipped — the opaque base variable covers them.
 * - Fully transparent colors (a <= 0.01) are skipped — use the `Transparent` variable.
 * - `pct = round(a * 100)`; entries are deduplicated by (rounded RGB byte triple + pct),
 *   which also absorbs the +/-1% alpha tolerance from the spec.
 * @param {Object<string, Object<string, string>>} schemes
 * @returns {{r:number,g:number,b:number,a:number,pct:number}[]}
 */
function neededAlphaVariants(schemes) {
  const out = [];
  const seen = new Set();
  for (const scheme of Object.values(schemes || {})) {
    for (const value of Object.values(scheme || {})) {
      if (typeof value !== 'string') continue;
      let c;
      try { c = shopifyHexToRGBA(value); } catch (e) { continue; }
      const a = c.a == null ? 1 : c.a;
      if (a >= 0.99 || a <= 0.01) continue;
      const pct = Math.round(a * 100);
      const key = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), pct].join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ r: c.r, g: c.g, b: c.b, a, pct });
    }
  }
  return out;
}

module.exports = { neededAlphaVariants };
