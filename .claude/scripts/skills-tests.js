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

/**
 * HR-1: extract a named function from a ```javascript fenced block in a .md and eval it.
 * The agent runs the JS *prose* embedded in the skills (it cannot require() a Node module
 * inside the Figma sandbox), so that prose must be exercised by the SAME vectors as the
 * sibling util — otherwise the two silently drift. Returns the live function; throws loudly
 * (never returns a silent stub) if no ```javascript block defines `function <name>(`.
 */
function extractFnFromMarkdown(rel, fnName) {
  const blocks = [...read(rel).matchAll(/```javascript\b[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  const decl = new RegExp('function\\s+' + fnName + '\\s*\\(');
  const src = blocks.find((b) => decl.test(b));
  if (!src) throw new Error('no ```javascript block defining function ' + fnName + '() in ' + rel);
  // eval the prose exactly as written (trusted, in-repo) and hand back the named function.
  return new Function(src + '\nreturn ' + fnName + ';')();
}

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
// HIGH-C / HR-2 — every skill whose work depends on an EXTERNAL RESOURCE (an MCP
//   server OR the web tools) must hard-STOP when that resource is unavailable, rather
//   than silently degrade or fabricate. The guard selects skills by the resource tools
//   their frontmatter declares; HR-2 generalized that selector beyond the figma/chrome
//   MCP servers to ALSO cover WebSearch/WebFetch (refresh-figma-practices) and any other
//   mcp__<server>__ tool, so a resource-dependent skill can never slip the guard silently.
// ---------------------------------------------------------------------------
group('HIGH-C: resource-dependent skills STOP when an MCP/web tool is unavailable');
const skillsDir = path.join(ROOT, '.claude', 'skills');
// A hard STOP pre-flight = the word STOP, plus a resource name tied to an unavailability
// predicate (or a "verify ... available" check). Resource-agnostic: MCP tools OR web tools.
const UNAVAILABLE = 'missing|unavailable|not available|not connected|not installed|disconnected|blocked';
const RESOURCE_NAME = 'required (?:MCP |web )?tools?|MCP tools?|WebSearch|WebFetch|web (?:research )?tools?|use_figma|navigate_page';
function hasAvailabilityStop(body) {
  if (!/\bSTOP\b/.test(body)) return false;
  const near = (a, b) => new RegExp('(?:' + a + ')[^\\n]{0,40}(?:' + b + ')', 'is').test(body);
  return near(RESOURCE_NAME, UNAVAILABLE)                                      // "use_figma is missing" / "web tools are unavailable"
      || near(UNAVAILABLE, RESOURCE_NAME)                                      // "unavailable ... web research tools"
      || /verify[^\n]{0,40}(?:MCP|web|tools?)[^\n]{0,40}available/is.test(body); // "verify required MCP tools are available"
}
// HR-2: a skill depends on an external resource if its frontmatter declares ANY MCP tool
// (`mcp__<server>__*`, not just the figma/chrome servers) OR a web tool (WebSearch/WebFetch).
const dependsOnResource = (fm) => /mcp__[\w-]+__|\bWebSearch\b|\bWebFetch\b/.test(fm);
const resourceGuarded = [];
for (const name of fs.readdirSync(skillsDir).sort()) {
  const sp = path.join(skillsDir, name, 'SKILL.md');
  if (!fs.existsSync(sp)) continue;
  const body = fs.readFileSync(sp, 'utf8');
  if (!dependsOnResource(frontmatter(body))) continue;
  resourceGuarded.push(name);
  check(name + ': resource-dependent skill hard-STOPs when its MCP/web tool is unavailable', () => {
    ok(hasAvailabilityStop(body), 'no hard STOP-on-missing-resource pre-flight (MCP or WebSearch/WebFetch)');
  });
}
check('HR-2: the availability guard covers web-tool skills (refresh-figma-practices), not just MCP', () => {
  ok(resourceGuarded.includes('refresh-figma-practices'),
    'refresh-figma-practices declares WebSearch/WebFetch and MUST be in the availability-guarded set (selector must reach beyond mcp__)');
});

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
check('BL-1: build-components pins the section node name to the slug so validation.md findOne resolves', () => {
  const buildMd = read('.claude/skills/build-components/SKILL.md');
  const valMd = read('.claude/skills/build-components/reference/validation.md');
  // Lockstep guard: the completeness check resolves the built set by name. If this lookup changes
  // shape, the build-side naming instruction below must be re-pinned to match (section.name is
  // often absent in the manifest — see manifest-test.json — so the slug branch is what bites).
  ok(/n\.name === section\.name \|\| n\.name === slug/.test(valMd),
    'validation.md completeness lookup changed shape — re-pin the build-components section naming to match');
  // Build side: the Sections phase must NAME the created component(-set) by the section slug, not a
  // PascalCase display name — else findOne() returns null and every section falsely reports MISSING.
  ok(/\bname[d]?\b[^\n]{0,80}\bsection slug\b|\bsection slug\b[^\n]{0,80}\bname[d]?\b/i.test(buildMd),
    'build-components Sections phase must instruct naming the built component(-set) by the section slug');
  ok(/validation\.md|completeness|\bMISSING\b/.test(buildMd),
    'the naming rule must reference the variant-completeness check it exists to satisfy');
});
check('BL-1: compose-page instantiates sections by slug (consumer lockstep with build-components naming)', () => {
  const composeMd = read('.claude/skills/compose-page/SKILL.md');
  // build-components names sections by slug; compose-page INSTANCES them, so its lookup example
  // must use the slug — a PascalCase "<X> Section" display name makes findOne return null.
  ok(!/n\.name === ["'][A-Z][^"'\n]*Section["']/.test(composeMd),
    'compose-page still looks up a section by a PascalCase display name (e.g. "Hero Section") — build-components names sections by slug, so findOne would return null');
  ok(/\bslug\b/.test(composeMd),
    'compose-page must document looking up section components by their slug (lockstep with build-components)');
});
check('compose-page: components.sections is keyed by slug with NO .type field (grounds the resolution contract)', () => {
  for (const [slug, sec] of Object.entries(fixture.components.sections)) {
    ok(sec && typeof sec === 'object', slug + ' must be an object');
    ok(!('type' in sec), `components.sections["${slug}"] must not carry a .type field — the object is keyed by slug`);
  }
});
check('compose-page: resolves a template section to components.sections by its SLUG KEY, not a phantom .type', () => {
  const md = read('.claude/skills/compose-page/SKILL.md');
  // components.sections is keyed by slug (no .type field), so matching against components.sections[].type
  // never resolves — every section would map to nothing.
  ok(!/components\.sections\[\]\.type/.test(md),
    'compose-page must NOT match the section type against components.sections[].type (no such field — keyed by slug)');
  ok(/keyed by[^\n]{0,20}slug/i.test(md),
    'compose-page Step 1 must state components.sections is keyed by slug (look the section type up as the slug key)');
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
const EVAL_SKILLS = ['analyze-theme', 'build-foundations', 'build-shopify-foundations', 'build-shopify-component', 'propose-components', 'build-components', 'learnings', 'sync-colors', 'validate-shopify'];
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
  const md = read('.claude/skills/setup/SKILL.md');
  // Tightened (HR-3) from a bare /plaintext/i: that false-passes on any unrelated mention AND
  // false-REDs on the equally-correct "plain text"/"plain-text" spelling (setup already says
  // "plain text" elsewhere, for *asking*). Contract = tie the PASSWORD to plaintext storage.
  ok(/password[^\n]{0,80}plain[ -]?text|plain[ -]?text[^\n]{0,80}password/i.test(md),
    'setup must warn the PASSWORD is stored in plaintext (tie password<->plaintext, tolerate "plain text")');
});

// ---------------------------------------------------------------------------
// B7/P11 — self-learning "After Completion" step (F036-F041, F077-F079)
// ---------------------------------------------------------------------------
group('B7/P11: self-learning After-Completion step');
const SELF_LEARN = ['analyze-theme', 'build-foundations', 'build-shopify-foundations', 'build-shopify-component', 'propose-components', 'build-components',
  'build-design-rules', 'setup', 'sync-colors', 'refresh-figma-practices', 'validate-shopify'];
for (const name of SELF_LEARN) {
  check('P11: ' + name + ' has an After-Completion gotchas-append step', () => {
    const md = read('.claude/skills/' + name + '/SKILL.md');
    const idx = md.search(/##\s*After Completion/i);
    ok(idx !== -1, 'missing the "## After Completion" self-learning section');
    ok(/gotchas\.md/.test(md.slice(idx)), 'the After-Completion step must point at the skill gotchas.md');
  });
}

// ---------------------------------------------------------------------------
// C2/C3 — naming + dedup + structure docs (F049/F051/F053)
// ---------------------------------------------------------------------------
group('C2/C3: naming + dedup + structure docs');
check('F049: build-foundations does not duplicate the Figma-API gotchas inline (single home = gotchas.md)', () => { // contract: structural (inline block absent + gotchas.md present)
  ok(!/###\s*Figma API gotchas for this skill/i.test(read('.claude/skills/build-foundations/SKILL.md')),
    'inline gotcha block still present — duplicates and will drift from gotchas.md');
  ok(/blendMode|lineHeight/i.test(read('.claude/skills/build-foundations/gotchas.md')),
    'gotchas.md must retain the Figma-API gotchas (the single source)');
});
check('F053: sync-colors uses the dominant "Grey" spelling (no Color/Gray drift)', () => { // lint: spelling-consistency substring
  ok(!/Color\/Gray\b/.test(read('.claude/skills/sync-colors/SKILL.md')), 'standardize Color/Gray -> Color/Grey');
});
check('F051: CLAUDE.md documents the skill sub-structure convention', () => { // lint: loose doc-presence substring
  ok(/Skill layout/i.test(read('CLAUDE.md')), 'CLAUDE.md Architecture should document the SKILL.md/reference/evals/gotchas structure');
});

// ---------------------------------------------------------------------------
// C5 — tool/resource availability guards (F062/F063/F064)
// ---------------------------------------------------------------------------
group('C5: tool/resource availability guards');
check('F062: compose-page handles a password-gated store (storePassword + fill/click)', () => {
  const md = read('.claude/skills/compose-page/SKILL.md');
  ok(/storePassword/.test(md), 'compose-page must read config.storePassword before navigating the live store');
  const at = (frontmatter(md).match(/allowed-tools:\s*\[([^\]]*)\]/) || [])[1] || '';
  ok(/chrome-devtools__fill/.test(at) && /chrome-devtools__click/.test(at), 'compose-page needs chrome-devtools fill+click to enter the store password');
});
check('F063: refresh-figma-practices STOPs when web tools are unavailable (no fabrication)', () => {
  const md = read('.claude/skills/refresh-figma-practices/SKILL.md');
  // Tightened (HR-3) from decoupled /STOP/ + /WebSearch/ (which pass even if the two are
  // unrelated): require the STOP to be tied to the web-tools-unavailable CONDITION on one line,
  // and require the explicit "don't fabricate" clause — that is the real fabrication-safety contract.
  const stopOnWebUnavailable =
    /(WebSearch|WebFetch|web (research )?tools?)[^\n]{0,80}(unavailable|blocked|missing|not available)[^\n]{0,80}STOP/is.test(md) ||
    /STOP[^\n]{0,80}(WebSearch|WebFetch|web (research )?tools?)[^\n]{0,80}(unavailable|blocked|missing|not available)/is.test(md);
  ok(stopOnWebUnavailable, 'the STOP must be tied to the web-tools-unavailable condition (proximity), not decoupled');
  ok(/fabricat/i.test(md), 'must forbid fabricating practices when web tools are unavailable');
});
check('F064: validate-shopify declares no MCP tools (nothing to verify)', () => {
  const at = (frontmatter(read('.claude/skills/validate-shopify/SKILL.md')).match(/allowed-tools:\s*\[([^\]]*)\]/) || [])[1] || '';
  ok(!/mcp__/.test(at), 'validate-shopify should not declare MCP tools (compose-page MCP guard is covered by HIGH-C)');
});

// ---------------------------------------------------------------------------
// A2/A5/A7/P1 — docs-infra small fixes (F020/F022/F024/F075/F076)
// ---------------------------------------------------------------------------
group('A2/A5/A7/P1: docs-infra small fixes');
check('F024: compose-page diagram uses {viewport} placeholders, not stale literals', () => { // contract: structural (no 375px literal + exact placeholders)
  const md = read('.claude/skills/compose-page/SKILL.md');
  ok(!/375px/.test(md), 'compose-page still hardcodes the stale 375px mobile literal');
  ok(/\{mobileWidth\}px wide/.test(md) && /\{desktopWidth\}px wide/.test(md), 'diagram should use {mobileWidth}/{desktopWidth}');
});
check('F020: validate-instances screenshots fixes to verify (not just grants the tool)', () => { // lint: prose phrase (reword-fragile)
  ok(/screenshot each fixed location/i.test(read('.claude/skills/validate-instances/SKILL.md')),
    'validate-instances body must use get_screenshot to confirm fixes render correctly');
});
check('F022: build-phase descriptions carry an exclusivity/negative clause', () => { // lint: very loose (`not ` matches broadly) — intentional
  for (const n of ['analyze-theme', 'build-foundations', 'propose-components', 'build-components', 'compose-page']) {
    const fm = frontmatter(read('.claude/skills/' + n + '/SKILL.md'));
    const d = (fm.match(/description:\s*>?\s*([\s\S]*?)\n(?:[a-z-]+:|$)/) || [])[1] || '';
    ok(/\bONLY\b|not |does not|no figma|nothing/i.test(d), n + ' description needs a "not for / only" disambiguation clause');
  }
});
check('F075/F076: analyze-theme + setup ship a seeded gotchas.md', () => { // contract: file existence + header
  for (const n of ['analyze-theme', 'setup']) {
    const g = read('.claude/skills/' + n + '/gotchas.md');
    ok(g.length > 60 && /^#/m.test(g), n + '/gotchas.md must exist with a header + a real gotcha');
  }
});

// ---------------------------------------------------------------------------
// B5/B6 — manifest single-source-of-truth contract (F034/F035)
// ---------------------------------------------------------------------------
group('B5/B6: manifest single-source-of-truth contract');
check('F034: CLAUDE.md documents the manifest state contract (phase -> keys)', () => { // contract: anchored on the real handoff-key identifiers
  const md = read('CLAUDE.md');
  ok(/state contract/i.test(md), 'CLAUDE.md should carry a phase -> keys-written -> keys-read state-contract table');
  ok(/components\.status/.test(md) && /profileValidation/.test(md) && /buildStatus/.test(md),
    'the contract table must name the real handoff keys');
});
check('F035: compose-page Step 8 preserves all other manifest keys (SSOT)', () => { // lint: loose prose substring (reword-fragile)
  ok(/preserving every other key/i.test(read('.claude/skills/compose-page/SKILL.md')),
    'compose-page Step 8 must read+merge the manifest, not overwrite it with the delta object');
});

// ---------------------------------------------------------------------------
// C2 — naming consistency + canonical Plugin-API reference (F047/F050)
// ---------------------------------------------------------------------------
group('C2: naming consistency + canonical Plugin-API reference');
check('F047: build-foundations keeps numeric swatch names (no {Group}/Base rename that breaks aliasing)', () => { // lint: loose prose substring (reword-fragile)
  ok(/numeric swatch names for ALL/i.test(read('.claude/skills/build-foundations/SKILL.md')),
    'build-foundations Step 2 must keep numeric names for the opaque base so Step 3.5/Step 4 lookups match');
});
check('F050: figma-best-practices.md has a canonical Plugin-API gotchas section', () => { // contract: anchored on API identifiers (blendMode + PERCENT)
  const md = read('.claude/figma-best-practices.md');
  ok(/Plugin API Gotchas/i.test(md) && /blendMode/.test(md) && /PERCENT/.test(md),
    'the engineering reference must carry the canonical use_figma/Plugin-API invariants');
});

// ---------------------------------------------------------------------------
// B3 — validate-instances auto-fix is non-destructive (F007)
// ---------------------------------------------------------------------------
group('B3: validate-instances auto-fix is non-destructive');
check('F007: auto-fix is create-then-verify-then-remove with reversible state', () => {
  const md = read('.claude/skills/validate-instances/SKILL.md');
  ok(/verify before removing/i.test(md) || /create\s*→\s*verify\s*→\s*remove/i.test(md),
    'auto-fix must verify the new instance before removing the original');
  ok(/reconstruct state|reversible/i.test(md), 'auto-fix must record reconstruct/reversal state');
});

// ---------------------------------------------------------------------------
// A6 — alpha-variant computation extracted + unit-tested (F023)
// ---------------------------------------------------------------------------
group('A6: alpha-variant computation (scripted + unit-tested)');
const av = tryRequire('./alpha-variants.js');
check('alpha-variants.js exists and exports neededAlphaVariants', () => {
  ok(av && typeof av.neededAlphaVariants === 'function', 'create .claude/scripts/alpha-variants.js exporting neededAlphaVariants(schemes)');
});
if (av && av.neededAlphaVariants) {
  check('neededAlphaVariants parses, skips opaque/transparent, rounds %, dedups', () => {
    const got = av.neededAlphaVariants({
      s1: { foreground: '#000000cf', border: '#0000000f', primary: '#000000cf', sbb: 'rgba(0,0,0,0)', heading: '#000000' },
      warm: { primary: '#2b1c14cc' },
    });
    eq(got.length, 3, 'foreground/primary dedup; transparent + opaque skipped');
    eq(got.map((v) => v.pct).sort((a, b) => a - b), [6, 80, 81]);
    const fg = got.find((v) => v.pct === 81); approx(fg.a, 207 / 255); approx(fg.r, 0); approx(fg.g, 0); approx(fg.b, 0);
  });
}
check('F023: build-foundations alpha-variants reference cites the tested script', () => {
  ok(/alpha-variants\.js/.test(read('.claude/skills/build-foundations/reference/alpha-variants.md')),
    'alpha-variants.md should cite the unit-tested .claude/scripts/alpha-variants.js');
});

// ---------------------------------------------------------------------------
// C2/C3 — validate-shopify static reference is reference-named (F048/F052)
// ---------------------------------------------------------------------------
group('C2/C3: validate-shopify reference naming');
check('F048/F052: static reference is reference-named (schema-rules.md, not common-schema-gotchas)', () => {
  ok(fs.existsSync(path.join(skillsDir, 'validate-shopify', 'reference', 'schema-rules.md')),
    'reference/common-schema-gotchas.md should be renamed to reference/schema-rules.md');
  ok(!fs.existsSync(path.join(skillsDir, 'validate-shopify', 'reference', 'common-schema-gotchas.md')),
    'the gotchas-named static reference must be gone (gotchas.md is for runtime learnings, not static reference)');
  const md = read('.claude/skills/validate-shopify/SKILL.md');
  ok(/reference\/schema-rules\.md/.test(md) && !/common-schema-gotchas/.test(md), 'SKILL.md must point at the renamed reference');
});

// ---------------------------------------------------------------------------
// B6 — pipeline-phase enforcement: pre-flight gates are MANDATORY (F008, MVP)
// ---------------------------------------------------------------------------
group('B6: pipeline-phase enforcement gates are MANDATORY');
for (const name of ['build-foundations', 'propose-components', 'build-components', 'compose-page']) {
  check('F008: ' + name + ' pre-flight is a HARD GATE (STOP, not advice)', () => {
    ok(/HARD GATES \(MANDATORY\)/.test(read('.claude/skills/' + name + '/SKILL.md')),
      'pre-flight must be a mandatory hard STOP gate, not an advisory "tell user"');
  });
}
check('F008: CLAUDE.md states pre-flight gates are HARD STOPs', () => {
  ok(/pre-flight gate is a HARD STOP/i.test(read('CLAUDE.md')), 'CLAUDE.md rule must make the gates mandatory');
});

// ---------------------------------------------------------------------------
// A6 — deterministic Shopify validation checks (scripted + unit-tested, F006)
// ---------------------------------------------------------------------------
group('A6: deterministic Shopify validation checks (scripted + unit-tested)');
const sv = tryRequire('./shopify-validate.js');
check('shopify-validate.js exists with the core checks', () => {
  ok(sv && sv.rangeStepIssue && sv.selectLimitIssue && sv.blockTypeFileIssue && sv.colorSchemeRefIssues && sv.orphanedSettingIssues,
    'create .claude/scripts/shopify-validate.js with the deterministic check functions');
});
if (sv && sv.rangeStepIssue) {
  check('rangeStepIssue flags non-divisible (max-min)/step + bad step', () => {
    eq(sv.rangeStepIssue({ type: 'range', id: 'r', min: 0, max: 100, step: 10 }), null);
    ok(sv.rangeStepIssue({ type: 'range', id: 'r', min: 0, max: 100, step: 30 }));
    ok(sv.rangeStepIssue({ type: 'range', id: 'r', min: 0, max: 10, step: 0 }));
  });
  check('selectLimitIssue flags > 50 options', () => {
    ok(sv.selectLimitIssue({ type: 'select', id: 's', options: Array.from({ length: 51 }, (_, i) => ({ value: i })) }));
    eq(sv.selectLimitIssue({ type: 'select', id: 's', options: [{ value: 1 }] }), null);
  });
  check('blockTypeFileIssue flags missing file (exempts @app/@theme/_private)', () => {
    eq(sv.blockTypeFileIssue('text', ['text.liquid']), null);
    ok(sv.blockTypeFileIssue('nope', ['text.liquid']));
    eq(sv.blockTypeFileIssue('@app', []), null);
    eq(sv.blockTypeFileIssue('@theme/foo', []), null); // namespaced theme block — exempt from file lookup
    eq(sv.blockTypeFileIssue('_local', []), null);
  });
  check('colorSchemeRefIssues + orphanedSettingIssues', () => {
    eq(sv.colorSchemeRefIssues(['scheme-1', 'scheme-9'], ['scheme-1']).length, 1);
    eq(sv.orphanedSettingIssues(['a', 'b'], ['a']).length, 1);
  });
  check('blockTypeAccepted mirrors validateTheme acceptance (declared / block-file / @app opt-in / unknown)', () => {
    ok(typeof sv.blockTypeAccepted === 'function', 'export blockTypeAccepted(type, schemaBlocks, blockFiles)');
    ok(sv.blockTypeAccepted('text', [{ type: 'text' }], []));     // declared in schema.blocks (object form)
    ok(sv.blockTypeAccepted('text', ['text'], []));               // declared (string-array form, as in componentMap.schema.blocks)
    ok(sv.blockTypeAccepted('text', [], ['text.liquid']));        // resolves to blocks/text.liquid
    ok(sv.blockTypeAccepted('promo', [], ['_promo.liquid']));     // private/static block file (_-prefixed)
    ok(sv.blockTypeAccepted('anything', [{ type: '@app' }], [])); // section opts into @app blocks
    ok(!sv.blockTypeAccepted('ghost', [{ type: 'text' }], []));   // not declared, no file, no @app
  });
  check('blockTypeAccepted: numeric schema block type matches by string-coercion (byte-equivalent to old inline logic)', () => {
    ok(sv.blockTypeAccepted(1, [{ type: 1 }], []));   // numeric type declared
    ok(sv.blockTypeAccepted('1', [{ type: 1 }], [])); // string query against numeric decl
  });
}
// BL-3 — validateTheme() orchestrator: run the deterministic checks end-to-end against a
//   committed theme fixture (.claude/scripts/fixtures/theme), exercising the same code path
//   the CLI `node .claude/scripts/shopify-validate.js <dir>` uses. The fixture is valid except
//   for documented planted issues (see its README); this asserts exactly those, no false positives.
check('BL-3: validateTheme() runs over the committed fixture and reports its planted issues', () => {
  ok(sv && typeof sv.validateTheme === 'function',
    'shopify-validate.js must export validateTheme(themeDir) returning {errors,warnings}');
  const report = sv.validateTheme(path.join(__dirname, 'fixtures', 'theme'));
  ok(report && Array.isArray(report.errors) && Array.isArray(report.warnings),
    'validateTheme must return {errors:[],warnings:[]}');
  eq(report.errors.length, 3, 'expected exactly the three planted errors, got: ' + JSON.stringify(report.errors));
  ok(report.errors.some((e) => /scheme-2/.test(e)), 'must flag the undefined color scheme scheme-2 (color-scheme ref)');
  ok(report.errors.some((e) => /heading_size/.test(e) && /huge/.test(e)), 'must flag the out-of-options select value "huge" (setting-value validation, Phase 1.4)');
  // Nested-template coverage: validateTheme() must recurse into templates/ subdirectories
  // (templates/customers/*.json, templates/metaobject/*.json on real themes) and label the
  // finding with the theme-root-relative path — not silently skip the file.
  ok(report.errors.some((e) => /templates\/customers\/login\.json/.test(e) && /heading_size/.test(e) && /enormous/.test(e)),
    'must validate the NESTED template templates/customers/login.json (out-of-options select "enormous") with a theme-root-relative label');
  eq(report.warnings.length, 0, 'the otherwise-valid fixture must not raise warnings: ' + JSON.stringify(report.warnings));
});
check('BL-3: parseThemeJSON strips Shopify auto-generated JSONC comments but preserves // inside strings', () => {
  ok(sv && typeof sv.parseThemeJSON === 'function',
    'shopify-validate.js must export parseThemeJSON — real templates/settings_data carry a /* auto-generated */ header that bare JSON.parse rejects');
  eq(sv.parseThemeJSON('/* IMPORTANT: auto-generated */\n{"a":1}'), { a: 1 });
  eq(sv.parseThemeJSON('{\n  // a line comment\n  "a": 1\n}'), { a: 1 });
  eq(sv.parseThemeJSON('{"url":"https://x.com//y","b":2}'), { url: 'https://x.com//y', b: 2 }); // // inside a string survives
  eq(sv.parseThemeJSON('{"note":"/* not a comment */"}'), { note: '/* not a comment */' });
  eq(sv.parseThemeJSON('{"q":"a\\"b","c":3}'), { q: 'a"b', c: 3 }); // escaped quote must not mis-close the string
  eq(sv.parseThemeJSON('\uFEFF{"a":1}'), { a: 1 }); // a leading UTF-8 BOM must be tolerated
});
check('BL-3: settingValueIssue validates a value against its schema setting def (Phase 1.4)', () => {
  ok(sv && typeof sv.settingValueIssue === 'function', 'shopify-validate.js must export settingValueIssue(def, value)');
  // range: bounds + on-step; the -1 padding sentinel is valid when min is -1 (schema-rules #7)
  eq(sv.settingValueIssue({ type: 'range', id: 'p', min: 0, max: 100, step: 4 }, 20), null);
  ok(sv.settingValueIssue({ type: 'range', id: 'p', min: 0, max: 100, step: 4 }, 22), 'off-step must flag');
  ok(sv.settingValueIssue({ type: 'range', id: 'p', min: 0, max: 100, step: 4 }, 120), 'above max must flag');
  ok(sv.settingValueIssue({ type: 'range', id: 'p', min: 0, max: 100, step: 4 }, 'x'), 'non-number must flag');
  eq(sv.settingValueIssue({ type: 'range', id: 'p', min: -1, max: 100, step: 1 }, -1), null);
  // select / radio: membership in options[].value
  eq(sv.settingValueIssue({ type: 'select', id: 's', options: [{ value: 'a' }, { value: 'b' }] }, 'a'), null);
  ok(sv.settingValueIssue({ type: 'select', id: 's', options: [{ value: 'a' }] }, 'z'));
  eq(sv.settingValueIssue({ type: 'radio', id: 'r', options: [{ value: 'x' }] }, 'x'), null);
  eq(sv.settingValueIssue({ type: 'select', id: 's', options: [{ value: 1 }, { value: '2' }] }, 2), null); // number/string options compare equal
  eq(sv.settingValueIssue({ type: 'select', id: 's', options: [{ value: 'a' }] }, ''), null); // cleared/unset is not a violation
  // checkbox boolean; number bounds; color hex-or-empty
  eq(sv.settingValueIssue({ type: 'checkbox', id: 'c' }, true), null);
  ok(sv.settingValueIssue({ type: 'checkbox', id: 'c' }, 'yes'));
  ok(sv.settingValueIssue({ type: 'number', id: 'n', min: 1, max: 5 }, 9));
  eq(sv.settingValueIssue({ type: 'color', id: 'k' }, '#fff'), null);
  eq(sv.settingValueIssue({ type: 'color', id: 'k' }, '#00000026'), null); // 8-digit #rrggbbaa (alpha) is valid
  eq(sv.settingValueIssue({ type: 'color', id: 'k' }, 'rgba(0,0,0,0)'), null); // functional rgba() (transparent) is valid
  eq(sv.settingValueIssue({ type: 'color', id: 'k' }, ''), null);
  ok(sv.settingValueIssue({ type: 'color', id: 'k' }, 'red'));
  // font_picker delegates to the font format; unconstrained types pass
  ok(sv.settingValueIssue({ type: 'font_picker', id: 'f' }, 'Inter'));
  eq(sv.settingValueIssue({ type: 'font_picker', id: 'f' }, 'inter_n4'), null);
  eq(sv.settingValueIssue({ type: 'text', id: 't' }, 'anything goes'), null);
});
check('BL-3: fontValueIssue validates {family}_{style}{weight} (Phase 3.3)', () => {
  ok(sv && typeof sv.fontValueIssue === 'function', 'export fontValueIssue(value)');
  eq(sv.fontValueIssue('inter_n4'), null);
  eq(sv.fontValueIssue('abril_fatface_i7'), null);
  ok(sv.fontValueIssue('Inter'), 'capitalized family / no style+weight must flag');
  ok(sv.fontValueIssue('inter_x4'), 'bad style letter must flag');
  ok(sv.fontValueIssue('inter_n0'), 'weight 0 must flag');
});
check('BL-3: idUniquenessIssues flags duplicate setting ids within a scope (Phase 2.4)', () => {
  ok(sv && typeof sv.idUniquenessIssues === 'function', 'export idUniquenessIssues(settings, scopeLabel)');
  eq(sv.idUniquenessIssues([{ id: 'a' }, { id: 'b' }]).length, 0);
  eq(sv.idUniquenessIssues([{ id: 'a' }, { id: 'a' }, { id: 'b' }, { id: 'b' }]).length, 2);
  eq(sv.idUniquenessIssues([{}, { id: 'a' }]).length, 0); // settings without ids (e.g. type:header) are skipped
});
check('BL-3: maxBlocksIssue flags exceeding a positive max_blocks', () => {
  ok(sv && typeof sv.maxBlocksIssue === 'function', 'export maxBlocksIssue(count, max, label)');
  eq(sv.maxBlocksIssue(3, 5), null);
  ok(sv.maxBlocksIssue(6, 5));
  eq(sv.maxBlocksIssue(99, undefined), null); // no max_blocks defined -> no limit
});
check('BL-3: templateStructureIssues flags order/sections mismatches (Phase 1.1)', () => {
  ok(sv && typeof sv.templateStructureIssues === 'function', 'export templateStructureIssues(template)');
  eq(sv.templateStructureIssues({ sections: { a: {} }, order: ['a'] }).length, 0);
  ok(sv.templateStructureIssues({ sections: { a: {} }, order: ['a', 'b'] }).some((m) => /"b"/.test(m)));        // order key not in sections
  ok(sv.templateStructureIssues({ sections: { a: {}, b: {} }, order: ['a'] }).some((m) => /orphan/.test(m)));   // section not in order
  eq(sv.templateStructureIssues({ foo: 1 }).length, 0); // not a standard page template -> no structural check (FP-safe)
});
check('BL-3: sectionFileIssue flags a template section type with no sections/<type>.liquid (Phase 1.2)', () => {
  ok(sv && typeof sv.sectionFileIssue === 'function', 'export sectionFileIssue(type, sectionFiles)');
  eq(sv.sectionFileIssue('hero', ['hero.liquid']), null);
  ok(sv.sectionFileIssue('ghost', ['hero.liquid']));
  eq(sv.sectionFileIssue('shopify://shop/whatever', []), null); // shopify-managed sections have no local file
});
check('F006/F021: validate-shopify cites the script + defers detail to schema-rules.md', () => {
  const md = read('.claude/skills/validate-shopify/SKILL.md');
  ok(/shopify-validate\.js/.test(md) && /schema-rules\.md/.test(md), 'SKILL.md must cite the script and defer detail to schema-rules.md');
});

// ---------------------------------------------------------------------------
// HR-1 — single-source the extracted utils vs the PROSE the agent actually runs.
//   The agent runs the JS *prose* in the SKILL.md (it cannot require() a Node module
//   inside the Figma sandbox); the unit tests cover the sibling *util*. The two can
//   silently drift. extractFnFromMarkdown() pulls the named function out of the skill's
//   ```javascript block and we run the SAME shared vectors against BOTH the util and the
//   prose — so a fix to one side fails the test until the other matches. (sync-colors:
//   rgbaToShopifyHex / shopifyHexToRGBA. Kills the drift class for color conversion.)
// ---------------------------------------------------------------------------
group('HR-1: sync-colors prose color JS is single-sourced with color-utils.js');

// Shared conversion vectors — the single source of truth, applied to BOTH impls.
const HEX_TO_RGBA_VECTORS = [
  { in: '#ff0000', rgb: { r: 1, g: 0, b: 0 }, a: 1 },
  { in: '#00000080', rgb: { r: 0, g: 0, b: 0 }, a: 128 / 255 },
  { in: 'rgba(255,0,0,0.5)', rgb: { r: 1, g: 0, b: 0 }, a: 0.5 },
  { in: 'rgba( 255, 0, 0, 0.5 )', rgb: { r: 1, g: 0, b: 0 }, a: 0.5 },
  { in: '#3a5f8c', rgb: { r: 0x3a / 255, g: 0x5f / 255, b: 0x8c / 255 }, a: 1 },
];
const RGBA_TO_HEX_VECTORS = [
  { in: { r: 0x3a / 255, g: 0x5f / 255, b: 0x8c / 255, a: 1 }, out: '#3a5f8c' },
  { in: { r: 0x11 / 255, g: 0x22 / 255, b: 0x33 / 255, a: 0x80 / 255 }, out: '#11223380' },
  { in: { r: 0, g: 0, b: 0, a: 0 }, out: 'rgba(0,0,0,0)' },
  { in: { r: 1, g: 0, b: 0 }, out: '#ff0000' }, // missing alpha -> defaults to opaque
  // Non-byte-aligned channels exercise the ROUNDING mode itself: every k/255 vector lets
  // Math.round/floor/ceil collapse to the same byte, so a prose round->floor drift in the
  // Figma->Shopify write path would false-pass. 0.5*255 = 127.5 splits round(128='80') from
  // floor(127='7f'), catching that sub-class on both an rgb channel and the alpha channel.
  { in: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, out: '#808080' },
  { in: { r: 0, g: 0, b: 0, a: 0.5 }, out: '#00000080' },
];
// Assert a given {shopifyHexToRGBA, rgbaToShopifyHex} impl satisfies every shared vector.
function runConversionVectors(label, impl) {
  for (const v of HEX_TO_RGBA_VECTORS) {
    const c = impl.shopifyHexToRGBA(v.in);
    approx(c.r, v.rgb.r, 1e-6, label + ' ' + v.in + '.r');
    approx(c.g, v.rgb.g, 1e-6, label + ' ' + v.in + '.g');
    approx(c.b, v.rgb.b, 1e-6, label + ' ' + v.in + '.b');
    approx(c.a, v.a, 1e-6, label + ' ' + v.in + '.a');
  }
  for (const v of RGBA_TO_HEX_VECTORS) {
    eq(impl.rgbaToShopifyHex(v.in), v.out, label + ' rgbaToShopifyHex(' + JSON.stringify(v.in) + ')');
  }
}
const SYNC_COLORS_MD = '.claude/skills/sync-colors/SKILL.md';
check('HR-1: color-utils.js satisfies the shared conversion vectors', () => {
  ok(cu && cu.shopifyHexToRGBA, 'color-utils must be loadable');
  runConversionVectors('util', cu);
});
check('HR-1: sync-colors PROSE satisfies the SAME vectors (extracted from the ```javascript block + eval-run)', () => {
  const prose = {
    shopifyHexToRGBA: extractFnFromMarkdown(SYNC_COLORS_MD, 'shopifyHexToRGBA'),
    rgbaToShopifyHex: extractFnFromMarkdown(SYNC_COLORS_MD, 'rgbaToShopifyHex'),
  };
  runConversionVectors('prose', prose);
});
check('HR-1: prose and util agree EXACTLY across every vector input (no drift)', () => {
  const proseHexToRGBA = extractFnFromMarkdown(SYNC_COLORS_MD, 'shopifyHexToRGBA');
  const proseRGBAToHex = extractFnFromMarkdown(SYNC_COLORS_MD, 'rgbaToShopifyHex');
  for (const v of HEX_TO_RGBA_VECTORS) {
    eq(proseHexToRGBA(v.in), cu.shopifyHexToRGBA(v.in), 'shopifyHexToRGBA prose<->util drift @ ' + v.in);
  }
  for (const v of RGBA_TO_HEX_VECTORS) {
    eq(proseRGBAToHex(v.in), cu.rgbaToShopifyHex(v.in), 'rgbaToShopifyHex prose<->util drift @ ' + JSON.stringify(v.in));
  }
});

// ---------------------------------------------------------------------------
// HR-3 — assertion-strength audit. Every group() is classified by how strong its
//   checks are, so the lint/contract distinction is EXPLICIT and machine-enforced:
//     contract = anchored / structural / unit-tested. A reworded-but-correct prose
//                change stays green; a real regression turns it red. Load-bearing.
//     lint     = case-insensitive substring presence. Intentionally loose — it guards
//                "did the whole idea get deleted", tolerates rewording, and is NOT a tight
//                contract (a clever reword could false-pass; that is an accepted tradeoff).
//     mixed    = the group has both; its individual checks carry inline // lint / // contract.
//   #8 tightened CRIT-A/CRIT-B/HIGH-F/HIGH-C; this registry documents the rest, and the
//   meta-check fails if any group is left unclassified (or a key goes stale) — so a new
//   group can't be added without consciously declaring its strength.
// ---------------------------------------------------------------------------
group('HR-3: every group is classified by assertion strength (lint vs contract)');
const GROUP_STRENGTH = {
  // contract — unit-tested logic or anchored/structural lints (producer/consumer field tokens,
  // allowed-tools arrays, file existence, exact ^…$ matches). Reword-tolerant, regression-tight.
  'CRIT-A: components.status producer/consumer contract': 'contract',
  'HIGH-F: variant-count logic (no NaN, object-shaped variants)': 'contract',
  'CRIT-B: sync-colors color conversion + write safety': 'contract',
  'HIGH-C: resource-dependent skills STOP when an MCP/web tool is unavailable': 'contract',
  'C4: manifest state-contract (producer/consumer agreement)': 'contract',
  'A9: skill evals exist and are well-formed': 'contract',
  'C9: installer + README target .claude/skills (not legacy .claude/commands)': 'contract',
  'C7: CLAUDE.md + .gitignore reflect reality': 'contract',
  'C8/C9: least-privilege allowed-tools + context mode': 'contract',
  'B7/P11: self-learning After-Completion step': 'contract',
  'C5: tool/resource availability guards': 'contract',
  'A6: alpha-variant computation (scripted + unit-tested)': 'contract',
  'C2/C3: validate-shopify reference naming': 'contract',
  'B6: pipeline-phase enforcement gates are MANDATORY': 'contract',
  'A6: deterministic Shopify validation checks (scripted + unit-tested)': 'contract',
  'HR-1: sync-colors prose color JS is single-sourced with color-utils.js': 'contract',
  'SP-0a: reachability (deterministic expressibility + host resolution)': 'contract',
  'SP-0a: design-build contract invariants': 'contract',
  'SP-1: Aristopet inference artifact set (real contract instance)': 'contract',
  'SP-1.1: Aristopet recompute (crunchy-horizon)': 'contract',
  'SP-2: shopify-foundations build': 'contract',
  'SP-2b: element foundations (elements-map.js)': 'contract',
  'SP-3: component build': 'contract',
  'HR-3: every group is classified by assertion strength (lint vs contract)': 'contract',
  // lint — checks whose only assertions are case-insensitive natural-language substrings (no
  // structural/identifier/file anchor). They guard "did the idea get deleted"; a behavior-
  // preserving reword can false-red and a clever reword can false-pass. Accepted tradeoff —
  // the target is usually prose instructions in a SKILL.md, where there is no code-level
  // invariant to anchor to (e.g. the non-destructive-auto-fix STEPS, the description fields).
  'C1/A1: triggering & description disambiguation': 'lint',
  'B3: validate-instances auto-fix is non-destructive': 'lint',
  // mixed — both shapes present; the individual checks carry inline // lint / // contract tags.
  'C2/C3: naming + dedup + structure docs': 'mixed',
  'A2/A5/A7/P1: docs-infra small fixes': 'mixed',
  'C2: naming consistency + canonical Plugin-API reference': 'mixed',
  'B5/B6: manifest single-source-of-truth contract': 'mixed',
};
check('HR-3: every group() in skills-tests.js is classified in GROUP_STRENGTH (no gaps, no stale keys)', () => {
  const src = read('.claude/scripts/skills-tests.js');
  const titles = [...src.matchAll(/^group\((['"])([\s\S]*?)\1\)/gm)].map((m) => m[2]);
  const unclassified = titles.filter((t) => !(t in GROUP_STRENGTH));
  const stale = Object.keys(GROUP_STRENGTH).filter((k) => !titles.includes(k));
  const bad = Object.entries(GROUP_STRENGTH).filter(([, v]) => !['contract', 'lint', 'mixed'].includes(v));
  ok(unclassified.length === 0, 'unclassified group(s): ' + unclassified.join(' | '));
  ok(stale.length === 0, 'stale GROUP_STRENGTH key(s) with no matching group(): ' + stale.join(' | '));
  ok(bad.length === 0, 'invalid strength value(s): ' + bad.map(([k]) => k).join(' | '));
});

// ---------------------------------------------------------------------------
// SP-0a — reachability: the DETERMINISTIC half of the design->build contract.
//   resolveHostSection (exists + schema via extractSchema), expressibilityIssues
//   (settingValueIssue / blockTypeAccepted / maxBlocksIssue run in REVERSE against a
//   parsed host schema), and the css-hardcoded -> CODE lookup from horizon.json.
//   Reuses .claude/scripts/shopify-validate.js (no logic re-derived). The FUZZY half
//   (candidate-match) is SP-1's inference and is intentionally NOT here.
// ---------------------------------------------------------------------------
group('SP-0a: reachability (deterministic expressibility + host resolution)');
const rc = tryRequire('./reachability.js');
const THEME_FIX = path.join(__dirname, 'fixtures', 'theme');
check('reachability.js exists with the deterministic helpers', () => {
  ok(rc && typeof rc.resolveHostSection === 'function' && typeof rc.expressibilityIssues === 'function'
     && typeof rc.isCssHardcoded === 'function',
    'create .claude/scripts/reachability.js exporting resolveHostSection, expressibilityIssues, isCssHardcoded');
});
if (rc && rc.resolveHostSection) {
  check('resolveHostSection: existing slug -> exists:true + parsed schema (extractSchema reuse)', () => {
    const r = rc.resolveHostSection(THEME_FIX, 'hero');
    eq(r.file, 'sections/hero.liquid');
    eq(r.exists, true);
    ok(r.schema && Array.isArray(r.schema.settings), 'must parse the {% schema %} block');
    ok(r.schema.settings.some((s) => s.id === 'heading_size'), 'parsed schema must expose the hero settings');
  });
  check('resolveHostSection: missing slug -> exists:false, schema:null (no guess; [DESIGN-RULES-TRUST])', () => {
    const r = rc.resolveHostSection(THEME_FIX, 'ghost');
    eq(r.exists, false);
    eq(r.schema, null);
    eq(r.file, 'sections/ghost.liquid');
  });
}
if (rc && rc.expressibilityIssues) {
  // In-memory mirror of fixtures/theme/sections/hero.liquid, plus a max_blocks cap.
  const HERO = {
    settings: [
      { type: 'range', id: 'padding_top', min: 0, max: 100, step: 4 },
      { type: 'select', id: 'heading_size', options: [{ value: 'small' }, { value: 'large' }] },
      { type: 'color_scheme', id: 'color_scheme' },
    ],
    blocks: ['text'],
    max_blocks: 5,
  };
  check('expressibilityIssues: a fully in-domain instance is expressible (-> [])', () => {
    eq(rc.expressibilityIssues(HERO, { settings: { padding_top: 20, heading_size: 'small', color_scheme: 'scheme-1' }, blocks: [{ type: 'text' }] }), []);
  });
  check('expressibilityIssues: a null/absent host schema yields no proof -> [] (D3 safe-default arm)', () => {
    eq(rc.expressibilityIssues(null, { settings: { anything: 'x' }, blocks: [{ type: 'whatever' }] }), []);
  });
  check('expressibilityIssues: out-of-domain select value -> value-out-of-domain', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { heading_size: 'huge' }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: off-step range value -> value-out-of-domain', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { padding_top: 22 }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: an unknown setting id is NOT expressible (bias-to-code, D3)', () => {
    const is = rc.expressibilityIssues(HERO, { settings: { totally_made_up: 'x' }, blocks: [] });
    eq(is.length, 1); eq(is[0].kind, 'value-out-of-domain');
  });
  check('expressibilityIssues: a block type the schema does not declare -> block-type-unsupported', () => {
    const is = rc.expressibilityIssues(HERO, { settings: {}, blocks: [{ type: 'video' }] });
    eq(is.length, 1); eq(is[0].kind, 'block-type-unsupported');
  });
  check('expressibilityIssues: @app/@theme block instance types are accepted (no false code-route)', () => {
    eq(rc.expressibilityIssues(HERO, { settings: {}, blocks: [{ type: '@app' }, { type: '@theme/icon' }] }), []);
  });
  check('expressibilityIssues: more blocks than max_blocks -> max-blocks-exceeded', () => {
    const is = rc.expressibilityIssues(HERO, { settings: {}, blocks: Array.from({ length: 6 }, () => ({ type: 'text' })) });
    eq(is.length, 1); eq(is[0].kind, 'max-blocks-exceeded');
  });
}
if (rc && rc.isCssHardcoded) {
  const profile = readJSON('.claude/figma-sync/theme-profiles/horizon.json');
  check('isCssHardcoded: the horizon spacing scale (margin/padding/gap) routes to CODE', () => {
    ok(rc.isCssHardcoded(profile, '--padding-lg'), 'padding scale is source:css-hardcoded -> CODE');
    ok(rc.isCssHardcoded(profile, '--gap-md'), 'gap is part of the css-hardcoded scale');
    ok(rc.isCssHardcoded(profile, '--margin-2xl'), 'margin is part of the css-hardcoded scale');
  });
  check('isCssHardcoded: settings-driven / unrelated properties are NOT css-hardcoded', () => {
    ok(!rc.isCssHardcoded(profile, 'button_border_radius_primary'), 'radii are source:settings -> not css-hardcoded');
    ok(!rc.isCssHardcoded(profile, 'padding_top'), 'a section setting is not the hardcoded CSS scale');
  });
}
if (rc && rc.cssHardcodedPrefixes) {
  check('cssHardcodedPrefixes: parses multi-segment patterns + dedups (generalized beyond single-token)', () => {
    const prefixes = rc.cssHardcodedPrefixes({
      a: { source: 'css-hardcoded', pattern: '--foo-bar-{size}, --baz-{size}' },
      b: { nested: { source: 'css-hardcoded', pattern: '--baz-{size}' } },
    });
    eq(prefixes.sort(), ['--baz-', '--foo-bar-']);
  });
  check('cssHardcodedPrefixes: a fixed property with no {placeholder} still yields a prefix (-> CODE, safe direction)', () => {
    const prefixes = rc.cssHardcodedPrefixes({ a: { source: 'css-hardcoded', pattern: '--page-width, --header-height' } });
    eq(prefixes.sort(), ['--header-height', '--page-width']);
    ok(rc.isCssHardcoded({ a: { source: 'css-hardcoded', pattern: '--page-width' } }, '--page-width'));
  });
}
// ---------------------------------------------------------------------------
// SP-0a — contract invariants (§6 of the SP-0 spec): the four cross-artifact rules that
//   keep the normalized contract honest, the schema-shape enforcer, and the work-order
//   DERIVATION (invariant 4: the work-order is a pure function of componentMap + compositions,
//   never hand-maintained). Run against the committed fixture (.claude/scripts/fixtures/contract).
// ---------------------------------------------------------------------------
group('SP-0a: design-build contract invariants');
const ct = tryRequire('./contract.js');
const CONTRACT_FIX = '.claude/scripts/fixtures/contract';
const loadFix = (rel) => { try { return readJSON(CONTRACT_FIX + '/' + rel); } catch (e) { return null; } };
const fixCM = (loadFix('design-rules.json') || {}).componentMap || null;
const fixComp = (loadFix('compositions.json') || {}).compositions || null;
const fixWO = loadFix('work-order.expected.json');
check('contract.js exists with the shape + invariant + derivation helpers', () => {
  ok(ct && ['contractShapeIssues', 'referentialIntegrityIssues', 'configRealityIssues', 'nonexistentNonConfigIssues', 'colorSchemeIntegrityIssues', 'deriveWorkOrder'].every((f) => typeof ct[f] === 'function'),
    'create .claude/scripts/contract.js exporting the contract helpers (incl. colorSchemeIntegrityIssues)');
});
check('the contract fixture loaded (componentMap + compositions + expected work-order)', () => {
  ok(fixCM && typeof fixCM === 'object', 'fixtures/contract/design-rules.json must carry a componentMap');
  ok(fixComp && typeof fixComp === 'object', 'fixtures/contract/compositions.json must carry compositions');
  ok(fixWO && Array.isArray(fixWO.codeRequired), 'fixtures/contract/work-order.expected.json must carry codeRequired[]');
});
if (ct && ct.contractShapeIssues) {
  check('inv-shape: the valid fixture satisfies the contract shape (-> [])', () => {
    eq(ct.contractShapeIssues(fixCM, fixComp), []);
  });
  check('inv-shape: a bad verdict enum value flags', () => {
    const bad = { hero: { type: 'section',
      figma: { name: 'hero', isInstance: true, representation: 'variant-set', desktop: { nodeId: '1:1' }, mobile: null },
      theme: { file: 'sections/hero.liquid', exists: true, kind: 'section' },
      schema: { settings: [], blocks: [] },
      reachability: { verdict: 'maybe', basis: 'instance-of-library', confidence: 'high', candidate: 'sections/hero.liquid' } } };
    ok(ct.contractShapeIssues(bad, {}).some((m) => /verdict/.test(m)), 'verdict not in {config,code,app,out-of-scope} must flag');
  });
  check('inv-shape: a bad mobileDivergence type flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [],
        mobileDivergence: { type: 'teleport', note: 'x' } } ] } };
    ok(ct.contractShapeIssues(fixCM, comp).some((m) => /mobileDivergence/.test(m)));
  });
  check('inv-shape: an empty-string component slug flags (not a valid reference)', () => {
    const comp = { index: { template: 'index', order: [
      { component: '', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null } ] } };
    ok(ct.contractShapeIssues(fixCM, comp).some((m) => /component/.test(m)), 'empty component string must flag');
  });
}
if (ct && ct.referentialIntegrityIssues) {
  check('inv-1 referential integrity: every composition component is a componentMap key (fixture clean)', () => {
    eq(ct.referentialIntegrityIssues(fixCM, fixComp), []);
  });
  check('inv-1: a composition referencing an unknown component flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'ghost-section', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null } ] } };
    ok(ct.referentialIntegrityIssues(fixCM, comp).some((m) => /ghost-section/.test(m)));
  });
}
if (ct && ct.configRealityIssues) {
  check('inv-2 config=>real: every config verdict has exists:true + candidate + schema (fixture clean)', () => {
    eq(ct.configRealityIssues(fixCM), []);
  });
  check('inv-2: a config verdict with schema:null flags', () => {
    const bad = { x: { theme: { file: 'sections/x.liquid', exists: true, kind: 'section' }, schema: null,
      reachability: { verdict: 'config', basis: 'schema-expressible', confidence: 'medium', candidate: 'sections/x.liquid' } } };
    ok(ct.configRealityIssues(bad).some((m) => /schema/.test(m)));
  });
}
if (ct && ct.nonexistentNonConfigIssues) {
  check('inv-3 nonexistent=>non-config: exists:false => verdict in {code,app,out-of-scope} (fixture clean)', () => {
    eq(ct.nonexistentNonConfigIssues(fixCM), []);
  });
  check('inv-3: exists:false with verdict:config flags', () => {
    const bad = { x: { theme: { file: null, exists: false, kind: 'section' }, schema: null,
      reachability: { verdict: 'config', basis: 'no-candidate', confidence: 'low', candidate: null } } };
    ok(ct.nonexistentNonConfigIssues(bad).some((m) => /x/.test(m)));
  });
}
if (ct && ct.deriveWorkOrder) {
  // Order-independent compare: the derivation is set-like per bucket.
  const norm = (wo) => ({
    codeRequired: [...((wo && wo.codeRequired) || [])].map((e) => JSON.stringify(e)).sort(),
    appBlocks: [...((wo && wo.appBlocks) || [])].map((e) => JSON.stringify(e)).sort(),
    outOfScope: [...((wo && wo.outOfScope) || [])].map((e) => JSON.stringify(e)).sort(),
  });
  check('inv-4 work-order = pure derivation: deriveWorkOrder(cm, compositions) === committed expected', () => {
    eq(norm(ct.deriveWorkOrder(fixCM, fixComp)), norm(fixWO));
  });
  check('inv-4: derivation is idempotent (no manual/sticky entries)', () => {
    const once = ct.deriveWorkOrder(fixCM, fixComp);
    eq(norm(ct.deriveWorkOrder(fixCM, fixComp)), norm(once));
  });
  check('inv-4: nulling one mobileDivergence drops exactly one mobile-divergence code entry', () => {
    const stripped = JSON.parse(JSON.stringify(fixComp));
    let removed = 0;
    for (const t of Object.values(stripped)) for (const o of t.order) if (o.mobileDivergence) { o.mobileDivergence = null; removed++; }
    ok(removed >= 1, 'fixture must contain at least one mobileDivergence entry to exercise this');
    const before = ct.deriveWorkOrder(fixCM, fixComp).codeRequired.filter((e) => e.basis === 'mobile-divergence').length;
    const after = ct.deriveWorkOrder(fixCM, stripped).codeRequired.filter((e) => e.basis === 'mobile-divergence').length;
    eq(before - after, removed, 'each nulled mobileDivergence must drop exactly one mobile-divergence code entry');
  });
  check('inv-4: a non-config component carrying a mobileDivergence is NOT double-listed (union semantics)', () => {
    const cm = { x: { type: 'section', figma: {}, theme: { file: null, exists: false, kind: 'section' }, schema: null,
      reachability: { verdict: 'code', basis: 'no-candidate', confidence: 'high', candidate: null } } };
    const comp = { index: { template: 'index', order: [
      { component: 'x', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [],
        mobileDivergence: { type: 'behavior', note: 'diverges' } } ] } };
    const wo = ct.deriveWorkOrder(cm, comp);
    const xs = wo.codeRequired.filter((e) => e.component === 'x');
    eq(xs.length, 1, 'a code-verdict component with a mobileDivergence must appear exactly once (baseline only)');
    eq(xs[0].basis, 'no-candidate', 'the single entry is the baseline, not a duplicate mobile-divergence row');
  });
  check('inv-4: a config component that BOTH diverges and fails expressibility -> one mobile-divergence row folding in the expressibility detail', () => {
    const cm = { x: { type: 'section', figma: {}, theme: { file: 'sections/x.liquid', exists: true, kind: 'section' },
      schema: { settings: [], blocks: ['slide'], max_blocks: 5 },
      reachability: { verdict: 'config', basis: 'instance-of-library', confidence: 'high', candidate: 'sections/x.liquid' } } };
    const comp = { index: { template: 'index', order: [
      { component: 'x', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {},
        blocks: Array.from({ length: 6 }, () => ({ type: 'slide' })),
        mobileDivergence: { type: 'behavior', note: 'grid -> carousel' } } ] } };
    const rows = ct.deriveWorkOrder(cm, comp).codeRequired.filter((e) => e.component === 'x');
    eq(rows.length, 1, 'exactly one row (no double-listing)');
    eq(rows[0].basis, 'mobile-divergence');
    ok(/grid -> carousel/.test(rows[0].delta) && /max_blocks 5/.test(rows[0].delta), 'delta folds in BOTH the divergence note and the expressibility detail');
  });
  check('inv-4: a config component with schema:null is routed to code, not silently dropped (D3 defense-in-depth)', () => {
    const cm = { x: { type: 'section', figma: {}, theme: { file: 'sections/x.liquid', exists: true, kind: 'section' }, schema: null,
      reachability: { verdict: 'config', basis: 'instance-of-library', confidence: 'low', candidate: 'sections/x.liquid' } } };
    const comp = { index: { template: 'index', order: [
      { component: 'x', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null } ] } };
    const rows = ct.deriveWorkOrder(cm, comp).codeRequired.filter((e) => e.component === 'x');
    eq(rows.length, 1, 'must appear in codeRequired (not vanish)');
    ok(ct.BASES.includes(rows[0].basis), 'basis is a valid enum member');
  });
  check('inv-4: a note-less mobileDivergence still yields a non-empty string delta (no undefined)', () => {
    const cm = { x: { type: 'section', figma: {}, theme: { file: 'sections/x.liquid', exists: true, kind: 'section' },
      schema: { settings: [], blocks: [] },
      reachability: { verdict: 'config', basis: 'instance-of-library', confidence: 'high', candidate: 'sections/x.liquid' } } };
    const comp = { index: { template: 'index', order: [
      { component: 'x', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: { type: 'reorder' } } ] } };
    const row = ct.deriveWorkOrder(cm, comp).codeRequired.find((e) => e.component === 'x');
    ok(row && typeof row.delta === 'string' && row.delta.length > 0 && /reorder/.test(row.delta), 'delta falls back to a type-based default string');
  });
}
if (ct && ct.colorSchemeIntegrityIssues) {
  const FND = { colors: { schemes: { 'scheme-1': { name: 'White' }, 'scheme-2': { name: 'Grey' } } } };
  check('inv-5 colorScheme integrity: every order colorScheme is a foundations scheme (clean -> [])', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-1', settings: {}, blocks: [], mobileDivergence: null },
      { component: 'hero', desktopNodeId: 'c', mobileNodeId: 'd', colorScheme: 'scheme-2', settings: {}, blocks: [], mobileDivergence: null } ] } };
    eq(ct.colorSchemeIntegrityIssues(comp, FND), []);
  });
  check('inv-5: a colorScheme not defined in foundations flags', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'hero', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: 'scheme-9', settings: {}, blocks: [], mobileDivergence: null } ] } };
    ok(ct.colorSchemeIntegrityIssues(comp, FND).some((m) => /scheme-9/.test(m)), 'dangling scheme ref must flag');
  });
  check('inv-5: a null colorScheme is skipped (not every section carries a scheme)', () => {
    const comp = { index: { template: 'index', order: [
      { component: 'divider', desktopNodeId: 'a', mobileNodeId: 'b', colorScheme: null, settings: {}, blocks: [], mobileDivergence: null } ] } };
    eq(ct.colorSchemeIntegrityIssues(comp, FND), []);
  });
}
check('SP-0a: every basis deriveWorkOrder can emit is a member of contract.BASES (no enum drift)', () => {
  ok(rc && Array.isArray(rc.EXPRESSIBILITY_KINDS), 'reachability.js must export EXPRESSIBILITY_KINDS');
  for (const k of rc.EXPRESSIBILITY_KINDS) ok(ct.BASES.includes(k), `expressibility kind "${k}" not in BASES`);
  for (const b of ['mobile-divergence', 'no-candidate']) ok(ct.BASES.includes(b), `derived basis "${b}" not in BASES`);
});
// ---------------------------------------------------------------------------
// SP-1 — the REAL contract instance (Aristopet). The synthetic fixtures/contract set proves the
//   invariants in isolation; this proves the actual handoff satisfies them end-to-end.
// ---------------------------------------------------------------------------
group('SP-1: Aristopet inference artifact set (real contract instance)');
const ARI = '.claude/figma-sync/aristopet';
const loadAri = (rel) => { try { return readJSON(ARI + '/' + rel); } catch (e) { return null; } }; // mirrors loadFix
const ariCM = (loadAri('design-rules.json') || {}).componentMap || null;
const ariMan = loadAri('manifest.json') || null;
const ariWO = loadAri('work-order.json') || null;
const ariComp = ariMan && ariMan.compositions;
check('the Aristopet artifact set exists (design-rules + manifest + work-order)', () => {
  ok(ariCM && typeof ariCM === 'object', 'aristopet/design-rules.json must carry a componentMap');
  ok(ariComp && typeof ariComp === 'object', 'aristopet/manifest.json must carry compositions');
  ok(ariMan && ariMan.foundations && ariMan.foundations.colors, 'aristopet/manifest.json must carry foundations.colors');
  ok(ariWO && Array.isArray(ariWO.codeRequired), 'aristopet/work-order.json must carry codeRequired[]');
});
if (ct && ariCM && ariComp) {
  check('SP-1 inv-shape: the real set satisfies the contract shape (-> [])', () => eq(ct.contractShapeIssues(ariCM, ariComp), []));
  check('SP-1 inv-1: referential integrity (every composition component is a componentMap key)', () => eq(ct.referentialIntegrityIssues(ariCM, ariComp), []));
  check('SP-1 inv-2: config => real (exists + candidate + schema)', () => eq(ct.configRealityIssues(ariCM), []));
  check('SP-1 inv-3: nonexistent => non-config', () => eq(ct.nonexistentNonConfigIssues(ariCM), []));
  check('SP-1 inv-4: committed work-order.json equals deriveWorkOrder(componentMap, compositions)', () => {
    const norm = (wo) => ({ codeRequired: [...(wo.codeRequired || [])].map((e) => JSON.stringify(e)).sort(),
      appBlocks: [...(wo.appBlocks || [])].map((e) => JSON.stringify(e)).sort(),
      outOfScope: [...(wo.outOfScope || [])].map((e) => JSON.stringify(e)).sort() });
    eq(norm(ct.deriveWorkOrder(ariCM, ariComp)), norm(ariWO));
  });
  check('SP-1 inv-5: every colorScheme is a foundations scheme', () => eq(ct.colorSchemeIntegrityIssues(ariComp, ariMan.foundations), []));
}
// ---------------------------------------------------------------------------
// SP-1.1 — recompute Aristopet's reachability/work-order against crunchy-horizon (the rich real host),
//   replacing SP-1's bare-Skeleton verdicts. Pure logic (buildComponentMap / loadBearingSchema) is unit-
//   tested against the committed fixtures/theme; the committed Aristopet output is re-validated by the
//   "SP-1" invariant group above (deriveWorkOrder, inv 1-5). Generator: recompute-aristopet.js.
// ---------------------------------------------------------------------------
group('SP-1.1: Aristopet recompute (crunchy-horizon)');
const rcp = tryRequire('./recompute-aristopet.js');
check('recompute-aristopet.js exists with buildComponentMap + loadBearingSchema + CANDIDATE_MAP', () => {
  ok(rcp && typeof rcp.buildComponentMap === 'function' && typeof rcp.loadBearingSchema === 'function'
     && rcp.CANDIDATE_MAP && typeof rcp.CANDIDATE_MAP === 'object',
    'create .claude/scripts/recompute-aristopet.js exporting buildComponentMap, loadBearingSchema, CANDIDATE_MAP');
});
if (rcp && rcp.CANDIDATE_MAP && ariCM) {
  check('SP-1.1: CANDIDATE_MAP covers exactly the committed componentMap keys (no drift either way)', () => {
    eq(Object.keys(rcp.CANDIDATE_MAP).sort(), Object.keys(ariCM).sort(),
      'every componentMap key needs a CANDIDATE_MAP entry and vice-versa');
  });
}
if (rcp && rcp.buildComponentMap) {
  // Host-independent: resolve against the committed fixtures/theme (it has sections/hero.liquid).
  const oldCM = {
    'my-hero':    { type: 'section', figma: { name: 'Hero', isInstance: true, representation: 'variant-set', desktop: { nodeId: '1:1' }, mobile: null }, theme: { file: null, exists: false, kind: 'section' }, schema: null, reachability: {} },
    'my-bespoke': { type: 'section', figma: { name: 'Bespoke', isInstance: false, representation: 'separate-components', desktop: { nodeId: '2:2' }, mobile: null }, theme: { file: null, exists: false, kind: 'section' }, schema: null, reachability: {} },
  };
  const cand = {
    'my-hero':    { host: 'hero', verdict: 'config', basis: 'schema-expressible', confidence: 'high' },
    'my-bespoke': { host: null,   verdict: 'code',   basis: 'no-candidate',       confidence: 'high' },
  };
  check('SP-1.1: a config candidate gets exists/schema/candidate from the host; figma carried over host-independently', () => {
    const out = rcp.buildComponentMap(oldCM, cand, THEME_FIX);
    eq(out['my-hero'].theme.exists, true);
    eq(out['my-hero'].theme.file, 'sections/hero.liquid');
    eq(out['my-hero'].reachability.candidate, 'sections/hero.liquid');
    eq(out['my-hero'].reachability.verdict, 'config');
    ok(out['my-hero'].schema && Array.isArray(out['my-hero'].schema.settings), 'config entry must carry a (load-bearing) schema');
    eq(out['my-hero'].figma.name, 'Hero');
  });
  check('SP-1.1: a null-host candidate is code/no-candidate (exists:false, schema:null, candidate:null)', () => {
    const out = rcp.buildComponentMap(oldCM, cand, THEME_FIX);
    eq(out['my-bespoke'].theme.exists, false);
    eq(out['my-bespoke'].theme.file, null);
    eq(out['my-bespoke'].schema, null);
    eq(out['my-bespoke'].reachability.candidate, null);
    eq(out['my-bespoke'].reachability.verdict, 'code');
  });
  check('SP-1.1: a config candidate at a MISSING host section throws (never ships an inv-2 violation)', () => {
    const bad = { x: oldCM['my-hero'] };
    const badCand = { x: { host: 'ghost-section', verdict: 'config', basis: 'schema-expressible', confidence: 'low' } };
    let threw = false;
    try { rcp.buildComponentMap(bad, badCand, THEME_FIX); } catch (e) { threw = true; }
    ok(threw, 'config verdict whose candidate file does not resolve must throw, not emit exists:false+verdict:config');
  });
}
if (rcp && rcp.loadBearingSchema && rc && rc.expressibilityIssues) {
  const full = { name: 't:x', class: 'foo', enabled_on: {}, presets: [{ name: 'p', settings: {} }],
    settings: [
      { type: 'select', id: 'size', label: 't:size', info: 't:i', options: [{ value: 's', label: 't:s' }, { value: 'l', label: 't:l' }] },
      { type: 'range', id: 'pad', label: 't:pad', min: 0, max: 100, step: 4, default: 20 },
    ], blocks: ['text', { type: 'icon' }], max_blocks: 5 };
  check('SP-1.1: loadBearingSchema keeps id/type/options.value/min/max/step + block types + max_blocks, drops cosmetics', () => {
    const slim = rcp.loadBearingSchema(full);
    eq(slim.settings[0], { id: 'size', type: 'select', options: [{ value: 's' }, { value: 'l' }] });
    eq(slim.settings[1], { id: 'pad', type: 'range', min: 0, max: 100, step: 4 });
    eq(slim.blocks, ['text', 'icon']);
    eq(slim.max_blocks, 5);
    ok(!('class' in slim) && !('presets' in slim) && !('enabled_on' in slim), 'non-load-bearing schema keys are dropped');
  });
  check('SP-1.1: loadBearingSchema is behaviour-equivalent — expressibilityIssues identical over projection vs full', () => {
    const slim = rcp.loadBearingSchema(full);
    // (a) out-of-domain settings + an unsupported block type
    const inst = { settings: { size: 'huge', pad: 22 }, blocks: [{ type: 'video' }] };
    eq(rc.expressibilityIssues(slim, inst), rc.expressibilityIssues(full, inst));
    // (b) ACCEPTED blocks OVER max_blocks — guards that the projection keeps BOTH `blocks` and
    //     `max_blocks`: dropping `blocks` would flip the accepted `text` to unsupported; dropping
    //     `max_blocks` would lose the max-blocks-exceeded issue. The single-block (a) case catches neither.
    const over = { settings: {}, blocks: Array.from({ length: 6 }, () => ({ type: 'text' })) };
    eq(rc.expressibilityIssues(slim, over), rc.expressibilityIssues(full, over));
    ok(rc.expressibilityIssues(slim, over).some((i) => i.kind === 'max-blocks-exceeded'),
      'the over-limit instance must actually trip max_blocks, else it guards nothing');
  });
}
if (ariCM) {
  check('SP-1.1 committed: Horizon is a rich host — >=10 sections flipped to config (vs the bare Skeleton\'s 1)', () => {
    const cfg = Object.values(ariCM).filter((e) => e.reachability && e.reachability.verdict === 'config').length;
    ok(cfg >= 10, `expected >=10 config verdicts against crunchy-horizon, got ${cfg}`);
  });
  check('SP-1.1 committed: the exact-slug matches (footer/marquee/breadcrumbs/product-information) are config with a host candidate', () => {
    for (const k of ['footer', 'marquee', 'breadcrumbs', 'product-information']) {
      const e = ariCM[k];
      ok(e && e.reachability.verdict === 'config' && /^sections\/.+\.liquid$/.test((e.reachability.candidate) || ''),
        `${k} must be config with a sections/*.liquid candidate`);
    }
  });
}
// ---------------------------------------------------------------------------
// SP-2 — foundations build: pure mapping (foundations + live Horizon schema/data ->
//   plan) and safe-write substrate. Validated against a committed crunchy-horizon
//   config snapshot under fixtures/shopify-foundations/. Reuses color-utils.js.
// ---------------------------------------------------------------------------
group('SP-2: shopify-foundations build');
const fm = tryRequire('./foundations-map.js');
const ariFND = (() => { try { return readJSON('.claude/figma-sync/aristopet/manifest.json').foundations; } catch (e) { return null; } })();

check('foundations-map.js exists with the pure mapping helpers', () => {
  ok(fm && typeof fm.foundationsMap === 'function' && typeof fm.mapSchemes === 'function'
     && typeof fm.normalizeColor === 'function' && fm.ROLE_MAP && typeof fm.ROLE_MAP === 'object',
    'create .claude/scripts/foundations-map.js exporting foundationsMap, mapSchemes, normalizeColor, ROLE_MAP');
});
if (fm && fm.mapSchemes) {
  check('SP-2 normalizeColor: transparent -> rgba(0,0,0,0); alpha hex preserved; opaque untouched', () => {
    eq(fm.normalizeColor('#00000000'), 'rgba(0,0,0,0)');
    eq(fm.normalizeColor('#1e1b1814'), '#1e1b1814');
    eq(fm.normalizeColor('#fffefd'), '#fffefd');
  });
  check('SP-2 mapSchemes: scheme-1 roles renamed to Horizon ids, colors normalized', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { name: 'White', colors: {
      background: '#fffefd', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
      foreground_chip: '#1e1b1814', primary: '#af7d4f',
      primary_button_background: '#1e1b18', primary_button_text: '#fffefd', primary_button_border: '#1e1b18',
      secondary_button_background: '#00000000', secondary_button_text: '#1e1b18',
      inputs_text: '#1e1b18', inputs_border: '#c9a88280', inputs_hover_background: '#faf7f2' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {} } } } };
    const r = fm.mapSchemes(fnd, liveData);
    eq(r.schemeWrites['scheme-1'].settings, {
      background: '#fffefd', foreground_heading: '#1e1b18', foreground: '#2a2620', border: '#ede8e1',
      primary: '#af7d4f',
      primary_button_background: '#1e1b18', primary_button_text: '#fffefd', primary_button_border: '#1e1b18',
      secondary_button_background: 'rgba(0,0,0,0)', secondary_button_text: '#1e1b18',
      input_text_color: '#1e1b18', input_border_color: '#c9a88280', input_hover_background: '#faf7f2' });
    ok(r.gaps.some((g) => g.kind === 'orphan-role' && /foreground_chip/.test(g.detail)), 'foreground_chip -> orphan gap');
  });
  check('SP-2 mapSchemes: host schemes not in foundations -> surplusSchemes (surfaced, NOT deleted)', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { colors: { background: '#ffffff' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {} }, 'scheme-5': { settings: {} }, 'scheme-x': { settings: {} } } } };
    const r = fm.mapSchemes(fnd, liveData);
    eq([...r.surplusSchemes].sort(), ['scheme-5', 'scheme-x']);
    ok(r.gaps.some((g) => g.kind === 'surplus-scheme' && /scheme-5/.test(g.detail)), 'surplus scheme surfaced as a gap');
  });
  check('SP-2 mapSchemes: sparse coverage surfaced; dark bg inheriting dark inks -> contrast-risk (transparent skipped)', () => {
    const fnd = { colors: { schemes: { 'scheme-4': { name: 'Espresso', colors: {
      background: '#1e1b18', foreground_heading: '#fffefd', foreground: '#faf7f2', border: '#faf7f21a', primary: '#af7d4f' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-4': { settings: {
      background: '#e1edf5', foreground: '#000000cf', primary_button_background: '#000000',
      secondary_button_text: '#000000', input_text_color: '#000000cf', secondary_button_background: 'rgba(0,0,0,0)' } } } } };
    const r = fm.mapSchemes(fnd, liveData);
    ok(r.gaps.some((g) => g.kind === 'partial-scheme-coverage' && /scheme-4/.test(g.detail)), 'partial coverage surfaced');
    const risk = r.gaps.find((g) => g.kind === 'scheme-contrast-risk');
    ok(risk && /secondary_button_text/.test(risk.detail) && /primary_button_background/.test(risk.detail), 'dark bg + inherited dark inks flagged');
    ok(!/secondary_button_background/.test((risk || {}).detail || ''), 'transparent inherited role NOT flagged as a contrast risk');
  });
  check('SP-2 mapSchemes: light bg inheriting dark inks -> NO contrast-risk (good contrast)', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { name: 'White', colors: { background: '#fffefd', foreground: '#2a2620' } } } } };
    const liveData = { current: { color_schemes: { 'scheme-1': { settings: {
      background: '#ffffff', primary_button_background: '#000000', secondary_button_text: '#000000' } } } } };
    const r = fm.mapSchemes(fnd, liveData);
    ok(!r.gaps.some((g) => g.kind === 'scheme-contrast-risk'), 'dark inks on a light bg are fine — no false positive');
  });
  check('SP-2 mapTypography: fonts + sizes + h1-80 schema extension + nearest tokens + skips', () => {
    const fnd = { typography: {
      fontRoles: { body: { raw: 'dm_sans_n4' }, label: { raw: 'dm_sans_n6' }, heading: { raw: 'instrument_sans_n7' } },
      presets: {
        h1: { fontRole: 'heading', size: 80, lineHeight: 94, letterSpacing: -2, case: 'none' },
        h3: { fontRole: 'heading', size: 32, lineHeight: 110, letterSpacing: 0, case: 'none' },
        paragraph: { fontRole: 'body', size: 14, lineHeight: 160, letterSpacing: 0, case: 'none' },
        overline: { fontRole: 'label', size: 13, lineHeight: 160, letterSpacing: 1.3, case: 'uppercase' } } } };
    const liveSchema = [ { name: 't:names.typography', settings: [
      { type: 'select', id: 'type_size_h1', options: [{ value: '72' }, { value: '88' }] },
      { type: 'select', id: 'type_line_height_h1', options: [{ value: 'display-tight' }, { value: 'display-normal' }, { value: 'display-loose' }] },
      { type: 'select', id: 'type_letter_spacing_h1', options: [{ value: 'heading-tight' }, { value: 'heading-normal' }, { value: 'heading-loose' }] },
      { type: 'select', id: 'type_size_h3', options: [{ value: '32' }] },
      { type: 'select', id: 'type_line_height_h3', options: [{ value: 'display-tight' }, { value: 'display-normal' }, { value: 'display-loose' }] },
      { type: 'select', id: 'type_letter_spacing_h3', options: [{ value: 'heading-tight' }, { value: 'heading-normal' }, { value: 'heading-loose' }] },
      { type: 'select', id: 'type_size_paragraph', options: [{ value: '14' }] },
      { type: 'select', id: 'type_line_height_paragraph', options: [{ value: 'body-tight' }, { value: 'body-normal' }, { value: 'body-loose' }] } ] } ];
    const r = fm.mapTypography(fnd, liveSchema);
    eq(r.fontWrites, { type_body_font: 'dm_sans_n4', type_subheading_font: 'dm_sans_n6', type_heading_font: 'instrument_sans_n7' });
    eq(r.typeWrites.type_font_h1, 'heading');
    eq(r.typeWrites.type_size_h1, '80');
    eq(r.typeWrites.type_line_height_h1, 'display-tight');
    eq(r.typeWrites.type_letter_spacing_h1, 'heading-tight');
    eq(r.typeWrites.type_case_h1, 'none');
    eq(r.typeWrites.type_line_height_h3, 'display-normal');
    eq(r.typeWrites.type_letter_spacing_h3, 'heading-normal');
    eq(r.typeWrites.type_line_height_paragraph, 'body-loose');
    ok(r.schemaExtensions.some((e) => e.setting === 'type_size_h1' && e.addOption.value === '80'), 'h1 80 -> ladder extension');
    ok(!r.schemaExtensions.some((e) => e.setting === 'type_size_h3'), 'h3 32 already on ladder -> no extension');
    ok(r.gaps.some((g) => g.kind === 'component-level-preset' && /overline/.test(g.detail)), 'overline skipped -> gap');
    ok(r.gaps.some((g) => g.kind === 'verify-font-availability'), 'heading font availability flagged');
  });
  check('SP-2 foundationsMap: aggregates schemes + typography into one plan', () => {
    const fnd = { colors: { schemes: { 'scheme-1': { colors: { background: '#fffefd' } } } },
      typography: { fontRoles: { body: { raw: 'dm_sans_n4' }, label: { raw: 'dm_sans_n6' }, heading: { raw: 'instrument_sans_n7' } }, presets: {} } };
    const p = fm.foundationsMap(fnd, [], { current: { color_schemes: { 'scheme-1': { settings: {} }, 'scheme-9': { settings: {} } } } });
    eq(p.schemeWrites['scheme-1'].settings.background, '#fffefd');
    eq(p.fontWrites.type_heading_font, 'instrument_sans_n7');
    eq(p.surplusSchemes, ['scheme-9']);
    ok(Array.isArray(p.gaps) && Array.isArray(p.schemaExtensions), 'plan carries gaps[] + schemaExtensions[]');
  });
  check('SP-2 writeSize symmetry: paragraph off-ladder extends; absent type_size setting -> missing-setting gap', () => {
    const fnd = { typography: { fontRoles: {}, presets: {
      paragraph: { fontRole: 'body', size: 15, lineHeight: 160, letterSpacing: 0, case: 'none' },
      h1: { fontRole: 'heading', size: 80, lineHeight: 94, letterSpacing: -2, case: 'none' } } } };
    const liveSchema = [ { settings: [ { id: 'type_size_paragraph', options: [{ value: '14' }, { value: '16' }] } ] } ];
    const r = fm.mapTypography(fnd, liveSchema);
    ok(r.schemaExtensions.some((e) => e.setting === 'type_size_paragraph' && e.addOption.value === '15'), 'paragraph 15 not on ladder -> extension');
    ok(r.gaps.some((g) => g.kind === 'missing-setting' && /type_size_h1/.test(g.detail)), 'absent type_size_h1 -> missing-setting gap');
  });
  check('SP-2 mapTypography: maps h4/h5/h6 heading levels; surfaces host levels missing from foundations', () => {
    const fnd = { typography: { fontRoles: { heading: { raw: 'instrument_sans_n7' } }, presets: {
      h4: { fontRole: 'heading', size: 28, lineHeight: 115, letterSpacing: 0, case: 'none' },
      h5: { fontRole: 'heading', size: 20, lineHeight: 130, letterSpacing: 0, case: 'none' } } } };
    const liveSchema = [ { settings: [
      { id: 'type_size_h4', options: [{ value: '24' }, { value: '28' }] },
      { id: 'type_line_height_h4', options: [{ value: 'heading-tight' }, { value: 'heading-normal' }, { value: 'heading-loose' }] },
      { id: 'type_size_h5', options: [{ value: '20' }] },
      { id: 'type_size_h6', options: [{ value: '16' }] } ] } ];
    const r = fm.mapTypography(fnd, liveSchema);
    eq(r.typeWrites.type_size_h4, '28');
    eq(r.typeWrites.type_size_h5, '20');
    eq(r.typeWrites.type_line_height_h4, 'heading-normal');
    ok(r.gaps.some((g) => g.kind === 'type-level-not-in-foundations' && /h6/.test(g.detail)), 'host h6 with no preset -> surfaced');
  });
  check('SP-2 mapTypography: extra body sizes beyond paragraph -> host-capacity gap; decorative stays component-level', () => {
    const fnd = { typography: { fontRoles: { body: { raw: 'dm_sans_n4' } }, presets: {
      paragraph: { fontRole: 'body', size: 14, lineHeight: 160, letterSpacing: 0, case: 'none' },
      text_small: { fontRole: 'body', size: 12, lineHeight: 160, letterSpacing: 0, case: 'none' },
      text_large: { fontRole: 'body', size: 16, lineHeight: 160, letterSpacing: 0, case: 'none' },
      caption: { fontRole: 'body', size: 11, lineHeight: 140, letterSpacing: 1.3, case: 'uppercase' } } } };
    const liveSchema = [ { settings: [ { id: 'type_size_paragraph', options: [{ value: '14' }] } ] } ];
    const r = fm.mapTypography(fnd, liveSchema);
    const hc = r.gaps.filter((g) => g.kind === 'host-capacity').map((g) => g.detail.split(' ')[0]).sort();
    eq(hc, ['text_large', 'text_small']); // the two extras flagged; the primary paragraph maps and is NOT flagged
    ok(r.gaps.some((g) => g.kind === 'component-level-preset' && /caption/.test(g.detail)), 'uppercase caption stays component-level, not host-capacity');
  });
}
const sw = tryRequire('./safe-shopify-write.js');
check('safe-shopify-write.js exports the lean theme-JSON helpers (no backup/verify substrate)', () => {
  ok(sw && typeof sw.parseSettingsData === 'function' && typeof sw.settingsDataHeader === 'function'
     && typeof sw.diffPaths === 'function' && typeof sw.injectSchemaSettings === 'function',
    'safe-shopify-write.js must export parseSettingsData, settingsDataHeader, diffPaths, injectSchemaSettings');
  ok(sw && sw.backup === undefined && sw.verifyOnlyChanged === undefined,
    'the heavy substrate (backup, verifyOnlyChanged) was dropped in the lean-write pivot — see docs/superpowers/archive/2026-06-10-safe-write-substrate');
});
if (sw && sw.parseSettingsData) {
  check('SP-2 parseSettingsData: strips the JSONC header comment then parses', () => {
    const txt = '/*\n * auto-generated\n */\n{ "current": { "a": 1 } }';
    eq(sw.parseSettingsData(txt), { current: { a: 1 } });
  });
  check('lean write: settingsDataHeader + JSON.stringify round-trips a faithful settings_data byte-for-byte', () => {
    const original = '/*\n * auto-generated\n */\n{\n  "current": {\n    "a": 1\n  }\n}\n';
    const data = sw.parseSettingsData(original);
    const recon = sw.settingsDataHeader(original) + JSON.stringify(data, null, 2) + '\n';
    eq(recon, original);
  });
  check('SP-2 diffPaths: reports only the leaf dot-paths that changed (the change-summary helper)', () => {
    const before = { current: { color_schemes: { 'scheme-1': { settings: { background: '#000' } } }, x: 1 } };
    const after = { current: { color_schemes: { 'scheme-1': { settings: { background: '#fff' } } }, x: 1 } };
    eq(sw.diffPaths(before, after, '', []), ['current.color_schemes.scheme-1.settings.background']);
  });
}
const FND_FIX = path.join(__dirname, 'fixtures', 'shopify-foundations');
if (fm && fm.applyPlan && sw && sw.parseSettingsData && ariFND) {
  check('SP-2 integration: foundationsMap + applyPlan over the real crunchy-horizon snapshot', () => {
    const liveSchema = JSON.parse(fs.readFileSync(path.join(FND_FIX, 'settings_schema.json'), 'utf8'));
    const liveData = sw.parseSettingsData(fs.readFileSync(path.join(FND_FIX, 'settings_data.json'), 'utf8'));
    const plan = fm.foundationsMap(ariFND, liveSchema, liveData);
    ok(Object.keys(plan.schemeWrites).length === 4, 'maps Aristopet 4 schemes: ' + Object.keys(plan.schemeWrites));
    ok(plan.schemaExtensions.some((e) => e.setting === 'type_size_h1' && e.addOption.value === '80'), 'proposes adding 80px to type_size_h1');
    ok(plan.surplusSchemes.length >= 1, 'surfaces host surplus schemes: ' + plan.surplusSchemes);
    const out = fm.applyPlan(plan, liveSchema, liveData);
    eq(out.data.current.color_schemes['scheme-1'].settings.background, '#fffefd');
    eq(out.data.current.type_size_h1, '80');
    ok(plan.surplusSchemes[0] in out.data.current.color_schemes, 'surplus scheme RETAINED (applyPlan must not auto-delete host-referenced schemes)');
    const h1 = out.schema.flatMap((g) => g.settings || []).find((s) => s.id === 'type_size_h1');
    ok(h1.options.some((o) => o.value === '80'), 'schema ladder now includes 80');
  });
}
// ---------------------------------------------------------------------------
// SP-2b — element foundations (elements-map.js): button/input/badge/... primitives.
// Pure mapper: (foundations, profileElements, liveSchema, liveData) -> write plan.
// ---------------------------------------------------------------------------
group('SP-2b: element foundations (elements-map.js)');
const em = tryRequire('./elements-map.js');

check('elements-map.js exists with elementsMap + applyElementPlan + resolveSource', () => {
  ok(em && typeof em.elementsMap === 'function' && typeof em.applyElementPlan === 'function'
    && typeof em.resolveSource === 'function',
    'create .claude/scripts/elements-map.js exporting elementsMap, applyElementPlan, resolveSource');
});

if (em && em.elementsMap) {
  const emFoundations = {
    spacing: {
      radii: { button_primary: 0, button_secondary: 0, input: 0, card: 0 },
      borderWidths: { button_secondary: 1, input: 1 },
    },
    typography: { presets: { overline: { case: 'uppercase' }, paragraph: { case: 'none' } } },
  };
  const emProfile = {
    button_primary_radius:   { source: 'spacing.radii.button_primary',   host: ['button_border_radius_primary'] },
    button_secondary_radius: { source: 'spacing.radii.button_secondary', host: ['button_border_radius_secondary'] },
    input_radius:            { source: 'spacing.radii.input',            host: ['inputs_border_radius'] },
    card_radius:             { source: 'spacing.radii.card',             host: ['card_corner_radius', 'product_corner_radius'] },
    secondary_button_border: { source: 'spacing.borderWidths.button_secondary', host: ['secondary_button_border_width'] },
    button_case:             { source: 'typography.preset:overline.case', transform: 'case', host: ['button_text_case_primary'] },
    button_font:             { source: 'typography.role:body', transform: 'fontRole', host: ['type_font_button_primary'] },
  };
  const emSchema = { settings: [
    { id: 'button_border_radius_primary', type: 'range', min: 0, max: 100, step: 1 },
    { id: 'button_border_radius_secondary', type: 'range', min: 0, max: 100, step: 1 },
    { id: 'inputs_border_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'card_corner_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'product_corner_radius', type: 'range', min: 0, max: 50, step: 1 },
    { id: 'secondary_button_border_width', type: 'range', min: 0, max: 4, step: 1 },
    { id: 'button_text_case_primary', type: 'select', options: [{ value: 'default' }, { value: 'uppercase' }] },
    { id: 'type_font_button_primary', type: 'select', options: [{ value: 'body' }, { value: 'accent' }] },
    { id: 'badge_corner_radius', type: 'range', min: 0, max: 100, step: 1 }, // in scope, no rule -> no-design-token
  ] };
  const emData = { current: { button_border_radius_primary: 14, button_border_radius_secondary: 14, inputs_border_radius: 4, card_corner_radius: 4 } };

  check('SP-2b Horizon path: radii map to 0 with old value captured (the rounded-button fix)', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    const prim = r.applied.find((a) => a.id === 'button_border_radius_primary');
    eq(prim, { id: 'button_border_radius_primary', value: 0, old: 14 });
    const card = r.applied.find((a) => a.id === 'card_corner_radius');
    eq(card.value, 0); eq(card.old, 4);
    const prod = r.applied.find((a) => a.id === 'product_corner_radius');
    eq(prod, { id: 'product_corner_radius', value: 0, old: null }); // not in current -> old null
  });

  check('SP-2b transforms: case -> uppercase, fontRole -> body', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    eq(r.applied.find((a) => a.id === 'button_text_case_primary').value, 'uppercase');
    eq(r.applied.find((a) => a.id === 'type_font_button_primary').value, 'body');
  });

  check('SP-2b no-design-token gap for an in-scope host setting with no rule', () => {
    const r = em.elementsMap(emFoundations, emProfile, emSchema, emData);
    const nd = r.gaps.filter((g) => g.kind === 'no-design-token').map((g) => g.detail.split(' ')[0]).sort();
    eq(nd, ['badge_corner_radius']);
  });

  check('SP-2b source-missing gap when a rule points at an absent token', () => {
    const r = em.elementsMap(emFoundations, { x: { source: 'spacing.radii.nope', host: ['button_border_radius_primary'] } }, emSchema, emData);
    ok(r.gaps.some((g) => g.kind === 'source-missing'), 'absent source must emit source-missing');
    ok(!r.applied.some((a) => a.id === 'button_border_radius_primary'), 'nothing applied for a missing source');
  });

  check('SP-2b off-domain -> widening (range) / option (select); absent id -> schemaExtension', () => {
    const f2 = { spacing: { radii: { big: 999 } }, typography: { presets: {} } };
    const sch = { settings: [
      { id: 'r', type: 'range', min: 0, max: 10, step: 1 },
      { id: 's', type: 'select', options: [{ value: 'a' }] },
    ] };
    const prof = {
      rrad: { source: 'spacing.radii.big', host: ['r'] },        // 999 out of [0-10] -> widen range
      ssel: { source: 'spacing.radii.big', host: ['s'] },        // 999 not an option -> widen option
      newx: { source: 'spacing.radii.big', host: ['brand_new'] },// absent id -> schemaExtension
    };
    const r = em.elementsMap(f2, prof, sch, { current: {} });
    ok(r.schemaWidenings.some((w) => w.id === 'r' && w.widen === 'range'), 'range over max -> widen range');
    ok(r.schemaWidenings.some((w) => w.id === 's' && w.widen === 'option'), 'select miss -> widen option');
    ok(r.schemaExtensions.some((e) => e.id === 'brand_new'), 'absent id -> schemaExtension');
  });

  check('SP-2b generic fallback (no profile): nothing applied, every proposal needs-confirm', () => {
    const r = em.elementsMap(emFoundations, null, emSchema, emData);
    eq(r.applied, []);
    ok(r.gaps.length > 0 && r.gaps.every((g) => g.kind === 'generic-needs-confirm'),
      'fallback proposes only generic-needs-confirm gaps');
    ok(r.gaps.some((g) => /button_border_radius_primary/.test(g.detail)), 'fallback notices radius settings');
  });

  check('SP-2b applyElementPlan: merges applied into data.current, non-destructive + clones', () => {
    const data = { current: { button_border_radius_primary: 14, keep_me: 'x' } };
    const out = em.applyElementPlan({ applied: [{ id: 'button_border_radius_primary', value: 0 }] }, data);
    eq(out.current.button_border_radius_primary, 0);
    eq(out.current.keep_me, 'x', 'host-only settings preserved');
    eq(data.current.button_border_radius_primary, 14, 'original input not mutated (cloned)');
  });
  check('SP-2b horizon.json recommendations.elements resolves against the real Aristopet foundations', () => {
    const profile = readJSON('.claude/figma-sync/theme-profiles/horizon.json');
    const manifest = readJSON('.claude/figma-sync/aristopet/manifest.json');
    const elements = profile && profile.recommendations && profile.recommendations.elements;
    ok(elements && typeof elements === 'object' && Object.keys(elements).length > 0,
      'horizon.json must define recommendations.elements');
    for (const [concept, rule] of Object.entries(elements)) {
      ok(Array.isArray(rule.host) && rule.host.length > 0 && rule.host.every((h) => typeof h === 'string'),
        `${concept}.host must be a non-empty string[]`);
      ok(em.resolveSource(manifest.foundations, rule.source) !== undefined,
        `${concept}.source "${rule.source}" must resolve against the real foundations (no source-missing)`);
    }
  });
}
check('SP-2b build-shopify-foundations SKILL.md wires the element-foundations step', () => {
  const md = read('.claude/skills/build-shopify-foundations/SKILL.md');
  ok(/elements-map\.js/.test(md), 'SKILL.md must reference elements-map.js');
  ok(/element foundations|element-foundations|element primitives/i.test(md), 'SKILL.md must describe the element step');
});
// ---------------------------------------------------------------------------
// SP-3 — per-component build: the deterministic spine (nextComponent / inspectComponent / configPlan) and
//   the safe-write section-schema injection. The skill is the human-assisted orchestrator; this group
//   unit-tests the provable parts. Reuses reachability.js + shopify-validate.js + safe-shopify-write.js.
// ---------------------------------------------------------------------------
group('SP-3: component build');
const cb = tryRequire('./component-build.js');
const sw3 = tryRequire('./safe-shopify-write.js');
const sv3 = tryRequire('./shopify-validate.js');
check('component-build.js exists with nextComponent + inspectComponent + configPlan', () => {
  ok(cb && typeof cb.nextComponent === 'function' && typeof cb.inspectComponent === 'function' && typeof cb.configPlan === 'function',
    'create .claude/scripts/component-build.js exporting nextComponent, inspectComponent, configPlan');
});
if (cb && cb.nextComponent) {
  const CM = {
    a: { type: 'section', theme: { kind: 'section' }, schema: { settings: [{ id: 'h', type: 'text' }] },
         reachability: { verdict: 'config', basis: 'schema-expressible', candidate: 'sections/a.liquid' } },
    b: { type: 'section', theme: { kind: 'section' }, schema: null,
         reachability: { verdict: 'code', basis: 'no-candidate', candidate: null } },
  };
  const COMP = {
    index:   { order: [{ component: 'a', desktopNodeId: 'd1', mobileNodeId: 'm1', colorScheme: 'scheme-1', settings: { h: 'Hi' }, blocks: [], mobileDivergence: null }] },
    product: { order: [{ component: 'a', desktopNodeId: 'd2', mobileNodeId: 'm2', colorScheme: 'scheme-2', settings: { h: 'Yo' }, blocks: [{ type: 'x' }], mobileDivergence: { type: 'behavior', note: 'n' } }] },
  };
  check('SP-3 nextComponent: first un-built, skips completed, null when all done, carries reachability', () => {
    eq(cb.nextComponent(CM, {}).key, 'a');
    eq(cb.nextComponent(CM, { components: { a: 'complete' } }).key, 'b');
    eq(cb.nextComponent(CM, { components: { a: 'complete', b: 'complete' } }), null);
    eq(cb.nextComponent(CM, {}).candidate, 'sections/a.liquid');
  });
  check('SP-3 inspectComponent: gathers usages across templates, carries host schema + mobileDivergence; throws on unknown key', () => {
    const ins = cb.inspectComponent('a', CM, COMP);
    eq(ins.usages.length, 2);
    eq(ins.usages[1].template, 'product');
    eq(ins.usages[1].mobileDivergence.type, 'behavior');
    eq(ins.hostSchema.settings[0].id, 'h');
    eq(ins.verdict, 'config');
    let threw = false; try { cb.inspectComponent('zz', CM, COMP); } catch (e) { threw = /not a componentMap key/.test(e.message); }
    ok(threw, 'unknown key must throw');
  });
}
if (cb && cb.configPlan) {
  const HS = { settings: [
    { id: 'heading', type: 'text' },
    { id: 'size', type: 'select', options: [{ value: 's' }, { value: 'l' }] },
    { id: 'pad', type: 'range', min: 0, max: 100, step: 4 },
    { id: 'on', type: 'checkbox' },
    { id: 'tint', type: 'color' },
  ] };
  check('SP-3 configPlan: partitions into applied / schemaExtensions (new) / schemaWidenings (existing) / codeGaps', () => {
    const plan = cb.configPlan([
      { intentKey: 'left_title', target: 'heading', type: 'text', value: 'X' },     // in-domain text -> applied
      { intentKey: 'eyebrow',    target: 'eyebrow', type: 'text', value: 'E' },      // new id -> schemaExtensions
      { intentKey: 'sz',         target: 'size',    type: 'select', value: 'xl' },   // off-domain select -> schemaWidenings
      { intentKey: 'p',          target: 'pad',     type: 'range', value: 999 },     // off-range -> schemaWidenings
      { intentKey: 'flag',       target: 'on',      type: 'checkbox', value: 'yes' },// bad checkbox, not widenable -> code
      { intentKey: 'c',          target: 'tint',    type: 'color', value: 'nope' },  // bad color, not widenable -> code
      { intentKey: 'badge',      target: null,      value: 'NUEVO' },                // pure code
    ], HS);
    eq(plan.applied, [{ id: 'heading', value: 'X' }]);
    eq(plan.schemaExtensions.map((e) => e.id), ['eyebrow']);                          // ONLY new ids (safe for injectSchemaSettings)
    eq(plan.schemaWidenings.map((e) => e.id).sort(), ['pad', 'size']);               // existing ids needing a wider domain
    eq(plan.codeGaps.map((c) => c.intentKey).sort(), ['badge', 'c', 'flag']);        // null + non-widenable off-domain
  });
}
if (sw3 && sw3.injectSchemaSettings && sv3 && sv3.extractSchema) {
  const LIQ = '<div>{{ section.settings.heading }}</div>\n{% schema %}\n{\n  "name": "Foo",\n  "settings": [{ "type": "text", "id": "heading" }]\n}\n{% endschema %}\n';
  check('SP-3 injectSchemaSettings: appends + dedups by id, re-parses, leaves surrounding liquid intact', () => {
    const out = sw3.injectSchemaSettings(LIQ, [{ type: 'text', id: 'eyebrow' }, { type: 'text', id: 'heading' }]);
    eq(sv3.extractSchema(out).settings.map((s) => s.id), ['heading', 'eyebrow']);
    ok(out.startsWith('<div>{{ section.settings.heading }}</div>'), 'leading liquid byte-identical');
    ok(out.trimEnd().endsWith('{% endschema %}'), 'trailing liquid preserved');
    // whitespace-control {%- schema -%} tags are captured, preserved, and round-trip via extractSchema
    const wout = sw3.injectSchemaSettings('{%- schema -%}\n{ "name": "B", "settings": [] }\n{%- endschema -%}', [{ type: 'text', id: 'x' }]);
    eq(sv3.extractSchema(wout).settings.map((s) => s.id), ['x']);
    ok(wout.startsWith('{%- schema -%}') && wout.trimEnd().endsWith('{%- endschema -%}'), 'whitespace-control tags preserved');
  });
  check('SP-3 injectSchemaSettings: throws when the source has no {% schema %} block', () => {
    let threw = false; try { sw3.injectSchemaSettings('<div>no schema</div>', [{ id: 'x' }]); } catch (e) { threw = /no \{% schema/.test(e.message); }
    ok(threw, 'a source without a schema block must throw');
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
