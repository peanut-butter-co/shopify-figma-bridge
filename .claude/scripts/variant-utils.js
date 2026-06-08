'use strict';
/**
 * Deterministic variant-count helpers for the build-components completeness check.
 *
 * Extracted from build-components/reference/validation.md so the logic is unit-tested
 * and identical on every run (review findings HIGH-F + A6). The previous inline formula
 *   Object.values(section.variants).reduce((acc, arr) => acc * arr.length, 1)
 * produced NaN, because `section.variants` is an OBJECT keyed by setting id whose values
 * are objects ({ tier, values: [...], ... }) — not arrays — so `arr.length` was undefined.
 */

/**
 * Expected number of Figma component-set variants for a section.
 * An empty/absent `variants` object means a single, non-variant component → 1.
 * @param {{variants?: Object<string,{values?: any[]}>}} section
 * @returns {number}
 */
function expectedVariantCount(section) {
  const variants = (section && section.variants) || {};
  return Object.values(variants).reduce((acc, v) => {
    const n = v && Array.isArray(v.values) ? v.values.length : 1;
    return acc * (n > 0 ? n : 1);
  }, 1);
}

/**
 * Completeness issues for built sections.
 * `components.sections` is an OBJECT keyed by slug (NOT an array — `for...of` over it throws).
 * @param {object} components - manifest.components
 * @param {(slug: string, section: object) => (number|null)} actualCountOf
 *        returns built-variant count for a section, or null if the Figma node is missing.
 * @returns {string[]}
 */
function variantCompletenessIssues(components, actualCountOf) {
  const issues = [];
  const sections = (components && components.sections) || {};
  for (const [slug, section] of Object.entries(sections)) {
    const expected = expectedVariantCount(section);
    const actual = actualCountOf(slug, section);
    if (actual == null) { issues.push(`MISSING: ${slug} not found`); continue; }
    if (Number.isNaN(actual)) { issues.push(`UNKNOWN: ${slug} variant count could not be computed`); continue; }
    if (actual < expected) issues.push(`INCOMPLETE: ${slug} has ${actual}/${expected} variants`);
  }
  return issues;
}

module.exports = { expectedVariantCount, variantCompletenessIssues };
