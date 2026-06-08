#!/usr/bin/env node
/**
 * Minimal, zero-dependency measurement harness for the skills system.
 *
 * Run from anywhere:  node .claude/scripts/skills-tests.js
 * Exit code 0 = all green, 1 = at least one red.
 *
 * Two kinds of checks:
 *   - unit    : exercises deterministic logic extracted into sibling modules
 *               (variant-utils.js, color-utils.js).
 *   - contract: lints the skill markdown + the manifest fixture to enforce
 *               producer/consumer agreements and required safety steps that
 *               cannot be unit-tested because the skills are prose.
 *
 * Each test maps to a specific review finding (CRIT-A, HIGH-F, CRIT-B, HIGH-C)
 * so a regression re-opens exactly one finding.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..'); // .claude/scripts -> repo root
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJSON = (rel) => JSON.parse(read(rel));
const frontmatter = (md) => (md.split('---')[1] || '');
const tryRequire = (rel) => { try { return require(rel); } catch (e) { return null; } };

let pass = 0, fail = 0;
const failures = [];
function group(t) { console.log('\n=== ' + t + ' ==='); }
function check(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; failures.push(name + '  ->  ' + e.message); console.log('  ✗ ' + name + '  ->  ' + e.message); }
}
function ok(c, msg) { if (!c) throw new Error(msg || 'expected truthy'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function approx(a, b, tol, msg) { if (typeof a !== 'number' || Math.abs(a - b) > (tol || 1e-6)) throw new Error((msg ? msg + ': ' : '') + 'expected ~' + b + ' got ' + a); }

const fixture = readJSON('.claude/figma-sync/manifest-test.json');

// ---------------------------------------------------------------------------
// CRIT-A — components.status producer/consumer contract
//   propose-components (producer) must WRITE components.status="confirmed";
//   build-components (consumer) gates on it. The fixture must satisfy the gate.
// ---------------------------------------------------------------------------
group('CRIT-A: components.status producer/consumer contract');
check('fixture manifest-test.json has components.status === "confirmed"', () => {
  eq(fixture.components.status, 'confirmed');
});
check('producer: propose-components Step 8 instructs writing components.status = "confirmed"', () => {
  const md = read('.claude/skills/propose-components/SKILL.md');
  ok(/status[^\n]{0,40}confirmed/i.test(md) && /components\.status/.test(md),
    'propose-components/SKILL.md does not instruct writing components.status="confirmed"');
});
check('consumer: build-components gates on components.status === "confirmed"', () => {
  const md = read('.claude/skills/build-components/SKILL.md');
  ok(/components\.status\s*===\s*["'`]confirmed["'`]/.test(md), 'build-components gate missing/changed');
});

// ---------------------------------------------------------------------------
// HIGH-F — variant completeness count must not be NaN
// ---------------------------------------------------------------------------
group('HIGH-F: variant-count logic (no NaN, object-shaped variants)');
const vu = tryRequire('./variant-utils.js');
check('variant-utils.js exists and exports expectedVariantCount', () => {
  ok(vu && typeof vu.expectedVariantCount === 'function',
    'create .claude/scripts/variant-utils.js exporting expectedVariantCount(section)');
});
if (vu && typeof vu.expectedVariantCount === 'function') {
  for (const [slug, section] of Object.entries(fixture.components.sections)) {
    check('expectedVariantCount("' + slug + '") matches totalVariantCombinations.desktop', () => {
      const got = vu.expectedVariantCount(section);
      ok(!Number.isNaN(got), 'returned NaN (the object-vs-array bug)');
      eq(got, section.totalVariantCombinations.desktop, slug);
    });
  }
  check('empty variants {} counts as 1 (featured-product edge case)', () => {
    eq(vu.expectedVariantCount({ variants: {} }), 1);
  });
}
check('validation.md no longer uses the NaN-prone reduce(acc * arr.length) formula', () => {
  const md = read('.claude/skills/build-components/reference/validation.md');
  ok(!/acc\s*\*\s*arr\.length/.test(md), 'validation.md still computes expectedCount via arr.length (NaN for object-shaped variants)');
});

// ---------------------------------------------------------------------------
// CRIT-B — sync-colors: color conversion + backup + Edit tool
// ---------------------------------------------------------------------------
group('CRIT-B: sync-colors color conversion + write safety');
const cu = tryRequire('./color-utils.js');
check('color-utils.js exists', () => {
  ok(cu && cu.shopifyHexToRGBA && cu.rgbaToShopifyHex && cu.colorsMatch,
    'create .claude/scripts/color-utils.js exporting shopifyHexToRGBA, rgbaToShopifyHex, colorsMatch');
});
if (cu && cu.shopifyHexToRGBA) {
  check('hex #ff0000 -> {1,0,0,1}', () => { const c = cu.shopifyHexToRGBA('#ff0000'); approx(c.r, 1); approx(c.g, 0); approx(c.b, 0); approx(c.a, 1); });
  check('hex8 #00000080 -> alpha ~0.502', () => { approx(cu.shopifyHexToRGBA('#00000080').a, 128 / 255); });
  check('rgba() string -> floats', () => { const c = cu.shopifyHexToRGBA('rgba(255,0,0,0.5)'); approx(c.r, 1); approx(c.a, 0.5); });
  check('round-trip #3a5f8c', () => { eq(cu.rgbaToShopifyHex(cu.shopifyHexToRGBA('#3a5f8c')), '#3a5f8c'); });
  check('round-trip alpha #11223380', () => { eq(cu.rgbaToShopifyHex(cu.shopifyHexToRGBA('#11223380')), '#11223380'); });
  check('fully-transparent -> rgba(0,0,0,0)', () => { eq(cu.rgbaToShopifyHex({ r: 0, g: 0, b: 0, a: 0 }), 'rgba(0,0,0,0)'); });
  check('colorsMatch within tolerance', () => { ok(cu.colorsMatch({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, { r: 0.502, g: 0.5, b: 0.5, a: 1 })); });
  check('colorsMatch rejects out-of-tolerance', () => { ok(!cu.colorsMatch({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, { r: 0.6, g: 0.5, b: 0.5, a: 1 })); });
}
check('sync-colors declares Edit in allowed-tools (so its documented write path is runnable)', () => {
  ok(/allowed-tools:\s*\[[^\]]*\bEdit\b/.test(frontmatter(read('.claude/skills/sync-colors/SKILL.md'))), 'Edit not in allowed-tools');
});
check('sync-colors backs up settings_data.json before writing (CLAUDE.md backup rule)', () => {
  ok(/backup/i.test(read('.claude/skills/sync-colors/SKILL.md')), 'no backup step before the Shopify write');
});

// ---------------------------------------------------------------------------
// HIGH-C — every MCP-dependent skill must STOP when a required tool is missing
// ---------------------------------------------------------------------------
group('HIGH-C: MCP-dependent skills STOP on missing tool');
const skillsDir = path.join(ROOT, '.claude', 'skills');
for (const name of fs.readdirSync(skillsDir).sort()) {
  const sp = path.join(skillsDir, name, 'SKILL.md');
  if (!fs.existsSync(sp)) continue;
  const body = fs.readFileSync(sp, 'utf8');
  const mcpDependent = /mcp__figma__|mcp__chrome-devtools__/.test(frontmatter(body));
  if (!mcpDependent) continue;
  check(name + ': has a "required MCP tool missing -> STOP" pre-flight', () => {
    const hasStop = /\bSTOP\b/.test(body);
    const checksTools = /(required MCP tools?|MCP tool[s]?[^\n]{0,40}(missing|unavailable|not available)|verify[^\n]{0,40}MCP[^\n]{0,40}available|if[^\n]{0,30}(use_figma|navigate_page)[^\n]{0,40}(missing|unavailable|not available))/is.test(body);
    ok(hasStop && checksTools, 'no hard STOP-on-missing-tool instruction');
  });
}

// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
if (fail) {
  console.log('\nRED:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(fail ? 1 : 0);
