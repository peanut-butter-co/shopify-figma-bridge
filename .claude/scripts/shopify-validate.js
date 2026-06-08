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
 * All functions are pure: callers pass already-parsed JSON / extracted ids, so the
 * checks are testable without theme files on disk.
 */

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

module.exports = { rangeStepIssue, selectLimitIssue, blockTypeFileIssue, colorSchemeRefIssues, orphanedSettingIssues };
