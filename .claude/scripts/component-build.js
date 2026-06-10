'use strict';
/**
 * SP-3 — the deterministic spine of the per-component downstream build (`/build-shopify-component`).
 *
 * The skill is the human-assisted orchestrator (inspect -> propose a gap-transparent plan -> approve ->
 * execute config-then-code). THIS module is the pure, tested half:
 *   - nextComponent     : pick the next un-built component (drives the continue-to-next loop + resumability)
 *   - inspectComponent  : assemble everything the developer must see for one component (deterministic)
 *   - configPlan        : validate a developer-confirmed intent->host mapping and partition it into
 *                         applied / schemaExtensions / codeGaps (the provable "how far settings reach")
 *
 * The fuzzy half — the semantic mapping of an off-process design's intent to host settings, and authoring
 * liquid — is the live human-assisted work; this module only VALIDATES it (bias-to-code, SP-0 D3: nothing
 * is "config" without proof against the host schema). Reuses reachability.js + shopify-validate.js.
 */
const { settingValueIssue } = require('./shopify-validate.js');

/**
 * The next component to build: the first `componentMap` key not yet marked complete in
 * `buildStatus.components`, with its reachability summary. Returns null when all are built. Iteration
 * order is componentMap insertion order (which follows the design order), so the loop is deterministic.
 */
function nextComponent(componentMap, buildStatus) {
  const done = (buildStatus && buildStatus.components) || {};
  for (const [key, e] of Object.entries(componentMap || {})) {
    if (done[key] === 'complete') continue;
    const r = (e && e.reachability) || {};
    return { key, verdict: r.verdict, basis: r.basis, candidate: r.candidate || null };
  }
  return null;
}

/**
 * Deterministic inspection report for one component: its verdict + host candidate + (load-bearing) host
 * schema, plus every composition usage (one row per template it appears in) carrying the design intent
 * (settings/blocks/colorScheme) and any section-level mobileDivergence. Throws on an unknown key.
 */
function inspectComponent(key, componentMap, compositions) {
  const e = (componentMap || {})[key];
  if (!e) throw new Error(`inspectComponent: "${key}" is not a componentMap key`);
  const r = e.reachability || {};
  const usages = [];
  for (const [template, comp] of Object.entries(compositions || {})) {
    for (const o of (Array.isArray(comp && comp.order) ? comp.order : [])) {
      if (o && o.component === key) {
        usages.push({
          template,
          desktopNodeId: o.desktopNodeId,
          mobileNodeId: o.mobileNodeId,
          colorScheme: o.colorScheme,
          settings: o.settings || {},
          blocks: Array.isArray(o.blocks) ? o.blocks : [],
          mobileDivergence: o.mobileDivergence || null,
        });
      }
    }
  }
  return {
    key,
    type: e.type,
    verdict: r.verdict,
    basis: r.basis,
    candidate: r.candidate || null,
    kind: (e.theme && e.theme.kind) || null,
    hostSchema: e.schema || null,
    usages,
  };
}

/**
 * Validate a developer-confirmed mapping against the host schema and partition it. `mapping` is an array
 * of { intentKey, target, type, value } where `target` is a host setting id (or null for pure code):
 *   - target == null                          -> codeGaps        (no host setting -> liquid)
 *   - target NOT in the host schema           -> schemaExtensions (a new setting to add, à la SP-2)
 *   - target in schema, value in-domain       -> applied
 *   - target in schema, value off-domain:
 *       select/radio -> schemaExtensions (add the option) ; range -> schemaExtensions (widen the range) ;
 *       anything else -> codeGaps (cannot widen a structural type safely -> author in code)
 * Pure: the value check is single-sourced through shopify-validate.settingValueIssue.
 */
function configPlan(mapping, hostSchema) {
  const applied = [], schemaExtensions = [], codeGaps = [];
  const byId = {};
  for (const s of ((hostSchema && Array.isArray(hostSchema.settings)) ? hostSchema.settings : [])) {
    if (s && s.id != null) byId[s.id] = s;
  }
  for (const m of (Array.isArray(mapping) ? mapping : [])) {
    const { intentKey, target, type, value } = m || {};
    if (target == null) { codeGaps.push({ intentKey, reason: 'no host setting (code)' }); continue; }
    const def = byId[target];
    if (!def) { schemaExtensions.push({ id: target, type: type || 'text', value, reason: 'new setting' }); continue; }
    const issue = settingValueIssue(def, value);
    if (!issue) { applied.push({ id: target, value }); continue; }
    if (def.type === 'select' || def.type === 'radio') {
      schemaExtensions.push({ id: target, type: def.type, value, reason: 'add option', widen: 'option' });
    } else if (def.type === 'range') {
      schemaExtensions.push({ id: target, type: 'range', value, reason: 'widen range', widen: 'range' });
    } else {
      codeGaps.push({ intentKey, target, reason: issue });
    }
  }
  return { applied, schemaExtensions, codeGaps };
}

module.exports = { nextComponent, inspectComponent, configPlan };
