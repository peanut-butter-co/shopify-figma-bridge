'use strict';
/**
 * Canonical, unit-tested color conversion for sync-colors (Figma <-> Shopify).
 *
 * Extracted from sync-colors/SKILL.md (review findings CRIT-B + A6/HIGH-H) so the
 * deterministic, regression-prone conversion is implemented once and tested, rather
 * than re-derived from prose on every run.
 */

/**
 * Shopify color string -> Figma RGBA floats (0-1).
 * Accepts `#rrggbb`, `#rrggbbaa`, or `rgba(r,g,b,a)`.
 */
function shopifyHexToRGBA(hex) {
  hex = String(hex).trim();
  if (hex.startsWith('rgba')) {
    const m = hex.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!m) throw new Error('Unparseable rgba() string: ' + hex);
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: +m[4] };
  }
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/**
 * Figma RGBA floats -> Shopify color string.
 * Fully transparent black round-trips to the literal `rgba(0,0,0,0)` Shopify uses.
 * Opaque colors emit `#rrggbb`; semi-transparent emit `#rrggbbaa`.
 */
function rgbaToShopifyHex(rgba) {
  const { r, g, b, a } = rgba;
  if (r === 0 && g === 0 && b === 0 && a === 0) return 'rgba(0,0,0,0)';
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (Math.abs(a - 1) < 0.001) return hex;
  return `${hex}${toHex(a)}`;
}

/** Two colors match if rgb within 0.005 and alpha within 0.01 (defaults). */
function colorsMatch(x, y, rgbTol = 0.005, aTol = 0.01) {
  return Math.abs(x.r - y.r) <= rgbTol &&
         Math.abs(x.g - y.g) <= rgbTol &&
         Math.abs(x.b - y.b) <= rgbTol &&
         Math.abs((x.a == null ? 1 : x.a) - (y.a == null ? 1 : y.a)) <= aTol;
}

module.exports = { shopifyHexToRGBA, rgbaToShopifyHex, colorsMatch };
