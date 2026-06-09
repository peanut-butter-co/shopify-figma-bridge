'use strict';
/**
 * SP-0a — the design->build CONTRACT: the cross-artifact shape enforcer, the four §6 invariants,
 * and the work-order DERIVATION. Pure functions; reuses reachability.js for the deterministic
 * expressibility check (so invariant 4's "instances failing the check" stays single-sourced).
 *
 * Artifacts (see docs/contract/design-build-contract.md):
 *   componentMap   (design-rules.json) — the single reference: Figma component -> theme code.
 *   compositions   (manifest.compositions) — the layout, references componentMap by key.
 *   work-order     — DERIVED from the two above; never primary state.
 */
const { expressibilityIssues } = require('./reachability.js');

const VERDICTS = ['config', 'code', 'app', 'out-of-scope'];
const BASES = ['instance-of-library', 'css-hardcoded', 'schema-expressible', 'no-candidate',
  'block-type-unsupported', 'value-out-of-domain', 'max-blocks-exceeded', 'mobile-divergence', 'app-slot', 'liquid-only'];
const REPRESENTATIONS = ['variant-set', 'separate-components'];
const DIVERGENCE_TYPES = ['reorder', 'viewport-only', 'behavior'];

/** Schema-shape enforcer: required keys present + enum members valid. Returns [] for a valid contract. */
function contractShapeIssues(componentMap, compositions) {
  const issues = [];
  const req = (cond, msg) => { if (!cond) issues.push(msg); };
  for (const [slug, e] of Object.entries(componentMap || {})) {
    const at = `componentMap["${slug}"]`;
    if (!e || typeof e !== 'object') { issues.push(`${at}: not an object`); continue; }
    req(typeof e.type === 'string', `${at}.type missing`);
    req(e.figma && typeof e.figma === 'object', `${at}.figma missing`);
    if (e.figma) {
      req(REPRESENTATIONS.includes(e.figma.representation), `${at}.figma.representation "${e.figma.representation}" not in {${REPRESENTATIONS.join(',')}}`);
      req('isInstance' in e.figma, `${at}.figma.isInstance missing`);
      req(e.figma.desktop && typeof e.figma.desktop === 'object', `${at}.figma.desktop missing`);
      req('mobile' in e.figma, `${at}.figma.mobile missing (use null when no distinct mobile frame)`);
    }
    req(e.theme && typeof e.theme === 'object', `${at}.theme missing`);
    if (e.theme) {
      req('file' in e.theme, `${at}.theme.file missing`);
      req(typeof e.theme.exists === 'boolean', `${at}.theme.exists must be boolean`);
      req(typeof e.theme.kind === 'string', `${at}.theme.kind missing`);
    }
    req('schema' in e, `${at}.schema missing (use null when exists:false)`);
    req(e.reachability && typeof e.reachability === 'object', `${at}.reachability missing`);
    if (e.reachability) {
      req(VERDICTS.includes(e.reachability.verdict), `${at}.reachability.verdict "${e.reachability.verdict}" not in {${VERDICTS.join(',')}}`);
      req(BASES.includes(e.reachability.basis), `${at}.reachability.basis "${e.reachability.basis}" not in the basis enum`);
      req(['high', 'medium', 'low'].includes(e.reachability.confidence), `${at}.reachability.confidence "${e.reachability.confidence}" not in {high,medium,low}`);
      req('candidate' in e.reachability, `${at}.reachability.candidate missing (null when code)`);
    }
  }
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    const order = Array.isArray(comp && comp.order) ? comp.order : [];
    order.forEach((o, i) => {
      const at = `compositions["${tpl}"].order[${i}]`;
      req(o && typeof o.component === 'string', `${at}.component missing`);
      req(o && ('desktopNodeId' in o), `${at}.desktopNodeId missing`);
      req(o && ('mobileNodeId' in o), `${at}.mobileNodeId missing`);
      req(o && ('colorScheme' in o), `${at}.colorScheme missing`);
      req(o && o.settings && typeof o.settings === 'object', `${at}.settings missing`);
      req(o && Array.isArray(o.blocks), `${at}.blocks must be an array`);
      req(o && ('mobileDivergence' in o), `${at}.mobileDivergence missing (null or {type,note})`);
      if (o && o.mobileDivergence != null) {
        req(DIVERGENCE_TYPES.includes(o.mobileDivergence.type),
          `${at}.mobileDivergence.type "${o.mobileDivergence && o.mobileDivergence.type}" not in {${DIVERGENCE_TYPES.join(',')}}`);
      }
    });
  }
  return issues;
}

/** Invariant 1 — referential integrity: every composition order component is a componentMap key. */
function referentialIntegrityIssues(componentMap, compositions) {
  const keys = new Set(Object.keys(componentMap || {}));
  const issues = [];
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (o && o.component && !keys.has(o.component)) issues.push(`compositions["${tpl}"] references "${o.component}" which is not a componentMap key`);
    }
  }
  return issues;
}

/** Invariant 2 — config => real: verdict "config" requires theme.exists && candidate != null && schema != null. */
function configRealityIssues(componentMap) {
  const issues = [];
  for (const [slug, e] of Object.entries(componentMap || {})) {
    if (!e || !e.reachability || e.reachability.verdict !== 'config') continue;
    if (!(e.theme && e.theme.exists === true)) issues.push(`${slug}: verdict=config but theme.exists !== true`);
    if (e.reachability.candidate == null) issues.push(`${slug}: verdict=config but candidate is null`);
    if (e.schema == null) issues.push(`${slug}: verdict=config but schema is null`);
  }
  return issues;
}

/** Invariant 3 — nonexistent => non-config: exists === false forbids the "config" verdict. */
function nonexistentNonConfigIssues(componentMap) {
  const issues = [];
  for (const [slug, e] of Object.entries(componentMap || {})) {
    if (e && e.theme && e.theme.exists === false && e.reachability && e.reachability.verdict === 'config') {
      issues.push(`${slug}: theme.exists=false but verdict=config (must be code/app/out-of-scope)`);
    }
  }
  return issues;
}

/** component -> [templateKeys] it is used in (deterministic, insertion order of compositions). */
function usedInIndex(compositions) {
  const idx = {};
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (!o || !o.component) continue;
      (idx[o.component] = idx[o.component] || []).push(tpl);
    }
  }
  return idx;
}

/**
 * Invariant 4 — the work-order is a PURE function of componentMap + compositions. Three contributors:
 *   (A) component baselines: verdict in {code, app, out-of-scope} -> whole-component entry.
 *   (B) instance deltas: a config component whose THIS usage fails expressibilityIssues -> code delta.
 *   (C) mobile divergence: a composition entry with a non-null section-level mobileDivergence -> code.
 * A divergent entry routes whole to code (skips the expressibility delta to avoid double-counting).
 */
function deriveWorkOrder(componentMap, compositions) {
  const idx = usedInIndex(compositions);
  const usedOf = (slug) => idx[slug] || [];
  const codeRequired = [], appBlocks = [], outOfScope = [];

  // (A) baselines
  for (const [slug, e] of Object.entries(componentMap || {})) {
    const r = (e && e.reachability) || {};
    if (r.verdict === 'code') codeRequired.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
    else if (r.verdict === 'app') appBlocks.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
    else if (r.verdict === 'out-of-scope') outOfScope.push({ component: slug, basis: r.basis, usedIn: usedOf(slug) });
  }

  // (B)+(C) per composition entry
  for (const [tpl, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (!o || !o.component) continue;
      const e = (componentMap || {})[o.component];
      if (!e) continue; // dangling reference -> invariant 1 reports it; not a work-order entry
      if (o.mobileDivergence && o.mobileDivergence.type) { // (C)
        // Only a config component routes to code via divergence here. A non-config component
        // (code/app/out-of-scope) is already represented by its (A) baseline — emitting again
        // would double-list it, violating the set-UNION semantics of the work-order (§6.4).
        if (e.reachability && e.reachability.verdict === 'config') {
          codeRequired.push({ component: o.component, basis: 'mobile-divergence', usedIn: [tpl], delta: o.mobileDivergence.note });
        }
        continue;
      }
      if (e.reachability && e.reachability.verdict === 'config' && e.schema) { // (B)
        const issues = expressibilityIssues(e.schema, { settings: o.settings, blocks: o.blocks });
        if (issues.length) {
          codeRequired.push({ component: o.component, basis: issues[0].kind, usedIn: [tpl], delta: issues.map((i) => i.detail).join('; ') });
        }
      }
    }
  }
  return { codeRequired, appBlocks, outOfScope };
}

module.exports = { contractShapeIssues, referentialIntegrityIssues, configRealityIssues, nonexistentNonConfigIssues, deriveWorkOrder, usedInIndex, VERDICTS, BASES, REPRESENTATIONS, DIVERGENCE_TYPES };
