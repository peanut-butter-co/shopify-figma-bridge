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
  // Require an IMPERATIVE write ("Set ... components.status ... confirmed"), not merely a
  // descriptive mention of the gate — else an explanatory sentence alone would pass (false-green).
  ok(/set\b[^\n]{0,40}components\.status[^\n]{0,20}confirmed/i.test(md),
    'propose-components/SKILL.md must imperatively Set components.status="confirmed" (not just mention the gate)');
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
  check('variantCompletenessIssues surfaces a NaN built-count (does not silently pass)', () => {
    ok(typeof vu.variantCompletenessIssues === 'function', 'variant-utils must export variantCompletenessIssues');
    const issues = vu.variantCompletenessIssues(
      { sections: { hero: { variants: { a: { values: [1, 2, 3] } } } } },
      () => NaN);
    ok(issues.length === 1 && /hero/.test(issues[0]),
      'a NaN actual-count must surface an issue, not report the section complete');
  });
}
check('validation.md no longer uses the NaN-prone reduce(acc * arr.length) formula', () => {
  const md = read('.claude/skills/build-components/reference/validation.md');
  ok(!/acc\s*\*\s*arr\.length/.test(md), 'validation.md still computes expectedCount via arr.length (NaN for object-shaped variants)');
  // Positive guard: the corrected snippet must shape-check values as an array, so a rename-based
  // regression that re-introduces the object-vs-array bug is caught too.
  ok(/Array\.isArray\(v\.values\)/.test(md), 'validation.md variant count must guard Array.isArray(v.values)');
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
  check('rgbaToShopifyHex tolerates missing alpha (no "#rrggbbNaN")', () => { eq(cu.rgbaToShopifyHex({ r: 1, g: 0, b: 0 }), '#ff0000'); });
  check('shopifyHexToRGBA throws on malformed hex (loud fail, not silent NaN write)', () => {
    let threw = false; try { cu.shopifyHexToRGBA('#f00'); } catch (e) { threw = true; }
    ok(threw, 'malformed hex must throw rather than return NaN channels that get written to settings_data.json');
  });
  check('shopifyHexToRGBA tolerates whitespace inside rgba()', () => { const c = cu.shopifyHexToRGBA('rgba( 255, 0, 0, 0.5 )'); approx(c.r, 1); approx(c.a, 0.5); });
}
check('sync-colors declares Edit in allowed-tools (so its documented write path is runnable)', () => {
  ok(/allowed-tools:\s*\[[^\]]*\bEdit\b/.test(frontmatter(read('.claude/skills/sync-colors/SKILL.md'))), 'Edit not in allowed-tools');
});
check('sync-colors backs up settings_data.json before writing, outside config/ (CLAUDE.md backup rule)', () => {
  const md = read('.claude/skills/sync-colors/SKILL.md');
  const backupIdx = md.search(/back ?up/i);
  const writeIdx = md.search(/use the \*\*Edit\*\* tool to update/i);
  ok(backupIdx !== -1, 'no backup step documented before the Shopify write');
  ok(writeIdx === -1 || backupIdx < writeIdx, 'the backup must be instructed BEFORE the Edit write');
  ok(!/config\/settings_data\.backup/i.test(md), 'backup must NOT be written into config/ (Shopify theme dir)');
  ok(/\.claude\/figma-sync\/backups/i.test(md), 'backup should target .claude/figma-sync/backups/');
});
check('sync-colors prose color JS keeps the missing-alpha guard (stays in sync with color-utils.js)', () => {
  ok(/rgba\.a == null \? 1/.test(read('.claude/skills/sync-colors/SKILL.md')),
    'prose rgbaToShopifyHex dropped the missing-alpha guard -> would emit "#rrggbbNaN"');
});
check('F066: sync-colors shows a real diff + verifies ONLY color keys changed (restore on mismatch)', () => {
  const md = read('.claude/skills/sync-colors/SKILL.md');
  ok(/real key-level diff/i.test(md), 'Step 3 must present a real before/after diff, not a hand-assembled "changed values" list');
  ok(/restore from the backup/i.test(md) && /only[^\n]{0,60}color_schemes/i.test(md),
    'Step 5 must assert ONLY color_schemes.* changed and restore from the backup otherwise');
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
    const checksTools = /(required MCP tools?|MCP tool[s]?[^\n]{0,40}(missing|unavailable|not available|not connected|not installed|disconnected)|verify[^\n]{0,40}MCP[^\n]{0,40}available|if[^\n]{0,30}(use_figma|navigate_page)[^\n]{0,40}(missing|unavailable|not available|not connected))/is.test(body);
    ok(hasStop && checksTools, 'no hard STOP-on-missing-tool instruction');
  });
}

// ---------------------------------------------------------------------------
// C4 / state-contract — manifest producer/consumer field agreements
//   F033/F080 buildStatus shape · F054 blocks source · F055 Step-8 schema ·
//   F056 validate-instances build-state gate · F058 theme.profileValidation ·
//   F059 buildMeta.practicesVersion · F057 build-design-rules documented
// ---------------------------------------------------------------------------
group('C4: manifest state-contract (producer/consumer agreement)');
check('F033/F080: build-design-rules gates on FLAT buildStatus keys, not a nested components namespace', () => {
  const md = read('.claude/skills/build-design-rules/SKILL.md');
  ok(!/buildStatus\.components/.test(md), 'build-design-rules still reads buildStatus.components (never written)');
  ok(/buildStatus(\.atoms|\.blocks|\["sections-(desktop|mobile)"\])/.test(md), 'build-design-rules must check a flat buildStatus phase key');
});
check('F054: build-components Blocks phase reads components.blocks, not a missing sourceBlocks field', () => {
  const md = read('.claude/skills/build-components/SKILL.md');
  ok(!/sourceBlocks/.test(md), 'build-components still references the nonexistent sourceBlocks field');
  ok(/components\.blocks/.test(md), 'build-components Blocks phase must source from components.blocks');
});
check('F055: propose-components Step 8 enumerates variableProperties + totalVariantCombinations', () => {
  const md = read('.claude/skills/propose-components/SKILL.md');
  ok(/variableProperties/.test(md) && /totalVariantCombinations/.test(md),
    'Step 8 must list the full per-section schema the Step 9 generator consumes');
});
check('F056: validate-instances has a build-state pre-flight routing to /build-components', () => {
  const md = read('.claude/skills/validate-instances/SKILL.md');
  ok(/build state/i.test(md), 'validate-instances missing a build-state pre-flight');
  ok(/\/build-components/.test(md) && /buildStatus/.test(md), 'must read buildStatus and route to /build-components when nothing is built');
});
check('F058: analyze-theme Step 4 persists theme.profileValidation (+ hasProfile)', () => {
  const md = read('.claude/skills/analyze-theme/SKILL.md');
  ok(/theme\.profileValidation/.test(md) && /theme\.hasProfile/.test(md),
    'analyze-theme Step 4 write must persist theme.profileValidation/hasProfile that build-foundations gates on');
});
check('F059: build-components stamps buildMeta.practicesVersion on completion', () => {
  const md = read('.claude/skills/build-components/SKILL.md');
  ok(/stamp[^\n]{0,60}buildMeta\.practicesVersion/i.test(md),
    'build-components must WRITE buildMeta.practicesVersion (it only reads it today -> dead staleness check)');
});
check('F057: build-design-rules is documented in CLAUDE.md (not orphaned)', () => {
  ok(/build-design-rules/.test(read('CLAUDE.md')), 'CLAUDE.md must document build-design-rules in the pipeline');
});

// ---------------------------------------------------------------------------
// C1 / A1 — triggering & description disambiguation
//   F015-F019 thin descriptions enriched · F042 orchestrator-vs-phase default ·
//   F046 sync-colors WRITE-vs-CHECK
// ---------------------------------------------------------------------------
group('C1/A1: triggering & description disambiguation');
const descOf = (name) => {
  const fm = frontmatter(read('.claude/skills/' + name + '/SKILL.md'));
  const m = fm.match(/description:\s*>?\s*([\s\S]*?)\n(?:[a-z-]+:|$)/);
  return (m ? m[1] : '').replace(/\s+/g, ' ').trim();
};
check('F042: build-design-system is the explicit full-pipeline default', () => {
  const d = descOf('build-design-system');
  ok(/\bentire\b/i.test(d) && /phase/i.test(d), 'orchestrator must claim the ENTIRE pipeline and reference phases');
});
for (const ph of ['analyze-theme', 'build-foundations', 'propose-components', 'build-components', 'compose-page']) {
  check('F042: ' + ph + ' steers full builds to build-design-system', () => {
    ok(/build-design-system/.test(descOf(ph)), ph + ' description must cross-reference build-design-system');
  });
}
check('F046: sync-colors description separates WRITE from read-only CHECK', () => {
  const d = descOf('sync-colors');
  ok(/write|copy|direction/i.test(d) && /validate|check/i.test(d),
    'sync-colors must mark itself a writer and steer check-only intents to the validators');
});
check('F015-F019: previously-thin descriptions are now enriched (> 120 chars)', () => {
  // Floor is 120, not 90: the OLD thin forms for analyze-theme (97) and setup (98) already
  // exceeded 90, so a 90-floor would not catch a revert of those two. All 5 new descriptions
  // are 200+ chars; the old forms were all < 100.
  for (const n of ['analyze-theme', 'build-design-rules', 'refresh-figma-practices', 'setup', 'validate-instances']) {
    ok(descOf(n).length > 120, n + ' description is still too thin (A1 under-triggering risk)');
  }
});

// ---------------------------------------------------------------------------
// A9 — every eval-worthy skill ships a well-formed evals/evals.json (F025-F031)
// ---------------------------------------------------------------------------
group('A9: skill evals exist and are well-formed');
const EVAL_SKILLS = ['analyze-theme', 'build-foundations', 'propose-components', 'build-components', 'learnings', 'sync-colors', 'validate-shopify'];
const allSkillNames = fs.readdirSync(skillsDir).filter((n) => fs.existsSync(path.join(skillsDir, n, 'SKILL.md')));
for (const name of EVAL_SKILLS) {
  check('A9: ' + name + ' has a well-formed evals/evals.json (>= 4 cases)', () => {
    const ev = readJSON('.claude/skills/' + name + '/evals/evals.json');
    eq(ev.skill, name, 'evals.json skill field must match the directory');
    ok(Array.isArray(ev.cases) && ev.cases.length >= 4, 'needs >= 4 trigger cases');
    for (const c of ev.cases) {
      ok(typeof c.prompt === 'string' && c.prompt.length > 0, 'each case needs a prompt');
      ok(['trigger', 'no-trigger', 'route'].includes(c.expect), 'expect must be trigger/no-trigger/route: ' + c.prompt);
      if (c.expect === 'route') ok(allSkillNames.includes(c.to), 'route target must be a real skill: ' + c.to);
    }
  });
}
check('A9: sync-colors conversionCases actually match color-utils.js (executable eval)', () => {
  const ev = readJSON('.claude/skills/sync-colors/evals/evals.json');
  ok(cu && cu.shopifyHexToRGBA, 'color-utils must be loadable');
  for (const c of ev.conversionCases) {
    if (c.rgba) { const g = cu.shopifyHexToRGBA(c.shopify); approx(g.r, c.rgba.r); approx(g.g, c.rgba.g); approx(g.b, c.rgba.b); approx(g.a, c.rgba.a); }
    if (c.rgbaAlphaApprox != null) approx(cu.shopifyHexToRGBA(c.shopify).a, c.rgbaAlphaApprox, 0.002);
    if (c.rgbaNoAlpha) eq(cu.rgbaToShopifyHex(c.rgbaNoAlpha), c.shopify);
  }
});

// ---------------------------------------------------------------------------
// C9 — installer + README target the real .claude/skills layout (F013/F014)
// ---------------------------------------------------------------------------
group('C9: installer + README target .claude/skills (not legacy .claude/commands)');
check('F013: install.sh installs .claude/skills and fails loudly (no false success)', () => {
  const sh = read('install.sh');
  ok(!/\.claude\/commands/.test(sh), 'install.sh still references the nonexistent .claude/commands path');
  ok(/\.claude\/skills/.test(sh), 'install.sh must install into .claude/skills');
  ok(/set -e/.test(sh) && /exit 1/.test(sh), 'install.sh must fail loudly (set -e + non-zero exits), not print a false "Done!"');
});
check('F014: README Installation targets .claude/skills (not .claude/commands)', () => {
  const md = read('README.md');
  ok(!/\.claude\/commands/.test(md), 'README still tells users to copy/symlink the nonexistent .claude/commands');
  ok(/\.claude\/skills/.test(md), 'README must reference .claude/skills');
});

// ---------------------------------------------------------------------------
// C7 — CLAUDE.md + .gitignore reflect reality (F067/F068)
// ---------------------------------------------------------------------------
group('C7: CLAUDE.md + .gitignore reflect reality');
check('F067: CLAUDE.md represents all skills (pipeline + maintenance in sync)', () => {
  const md = read('CLAUDE.md');
  const missing = fs.readdirSync(skillsDir)
    .filter((n) => fs.existsSync(path.join(skillsDir, n, 'SKILL.md')))
    .filter((n) => !md.includes(n));
  ok(missing.length === 0, 'CLAUDE.md omits skill(s): ' + missing.join(', '));
});
check('F068: .gitignore names the real runtime-state paths (not theme-profiles/manifest.json)', () => {
  const gi = read('.gitignore');
  ok(/^\.claude\/figma-sync\/manifest\.json\s*$/m.test(gi), '.gitignore must explicitly ignore .claude/figma-sync/manifest.json');
  ok(!/theme-profiles\/manifest\.json/.test(gi), 'the dead theme-profiles/manifest.json rule must be removed');
});

// ---------------------------------------------------------------------------
// C8/C9 — least-privilege allowed-tools + context mode (F069/F070/F072/F073/F074)
// ---------------------------------------------------------------------------
group('C8/C9: least-privilege allowed-tools + context mode');
const allowedTools = (name) => {
  const fm = frontmatter(read('.claude/skills/' + name + '/SKILL.md'));
  return (fm.match(/allowed-tools:\s*\[([^\]]*)\]/) || [])[1] || '';
};
check('F070: setup drops the heavyweight figma write tools it never calls', () => {
  const at = allowedTools('setup');
  ok(/get_metadata/.test(at), 'setup must keep mcp__figma__get_metadata (it verifies Figma access)');
  ok(!/use_figma/.test(at) && !/get_screenshot/.test(at), 'setup must NOT grant use_figma/get_screenshot (unused, heavyweight)');
});
check('F072/F073: validate-shopify is read-only (no Write in allowed-tools)', () => {
  const at = allowedTools('validate-shopify');
  ok(at.length > 0 && !/\bWrite\b/.test(at), 'validate-shopify is a read-only validator; drop Write from allowed-tools');
});
check('F074: sync-colors runs inline (keeps the approval diff in the main thread)', () => {
  ok(/context:\s*inline/.test(frontmatter(read('.claude/skills/sync-colors/SKILL.md'))), 'sync-colors should be context: inline, not fork');
});
check('F069: setup warns the storefront password is stored in plaintext', () => {
  ok(/plaintext/i.test(read('.claude/skills/setup/SKILL.md')), 'setup must warn the password is persisted in plaintext before saving it');
});

// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
console.log('RESULT: ' + pass + ' passed, ' + fail + ' failed');
if (fail) {
  console.log('\nRED:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(fail ? 1 : 0);
