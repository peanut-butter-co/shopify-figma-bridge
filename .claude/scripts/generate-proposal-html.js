#!/usr/bin/env node
/**
 * Generate a visual HTML proposal from the manifest's component inventory.
 * Zero dependencies — reads manifest.json, writes proposal.html.
 *
 * Usage: node .claude/scripts/generate-proposal-html.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT, '.claude/figma-sync/manifest.json');
const OUTPUT_PATH = path.join(ROOT, '.claude/figma-sync/proposal.html');

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugToTitle(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Render Functions ─────────────────────────────────────────────────────────

function renderStyles() {
  return `
    @font-face { font-family:'Inter'; font-style:normal; font-weight:400; font-display:swap; src:local('Inter'),url('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2') format('woff2'); }
    @font-face { font-family:'Inter'; font-style:normal; font-weight:500; font-display:swap; src:local('Inter Medium'),url('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2') format('woff2'); }
    @font-face { font-family:'Inter'; font-style:normal; font-weight:600; font-display:swap; src:local('Inter SemiBold'),url('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2') format('woff2'); }
    @font-face { font-family:'Inter'; font-style:normal; font-weight:700; font-display:swap; src:local('Inter Bold'),url('https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2') format('woff2'); }

    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.6;-webkit-font-smoothing:antialiased;background:#f8f8f8}

    /* Hero */
    .hero{background:#1a1a1a;color:#fff;padding:64px 24px 48px;text-align:center}
    .hero h1{font-size:2.25rem;font-weight:700;letter-spacing:-0.02em;margin-bottom:4px}
    .hero .subtitle{font-size:1rem;opacity:.6;margin-bottom:8px}
    .hero .meta{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;font-size:.8rem;opacity:.45;margin-bottom:32px}
    .hero .meta span{white-space:nowrap}
    .scope-badge{display:inline-block;background:#3B82F6;color:#fff;font-size:.7rem;font-weight:600;padding:3px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em;margin-left:8px;vertical-align:middle}

    /* Stats row */
    .stats{display:flex;gap:1px;background:#e0e0e0;margin:0 auto;max-width:720px;border-radius:12px;overflow:hidden;position:relative;top:-28px}
    .stat{flex:1;background:#fff;padding:20px 16px;text-align:center}
    .stat .num{font-size:1.75rem;font-weight:700;line-height:1}
    .stat .label{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-top:4px}
    .stat.purple .num{color:#8B5CF6}
    .stat.amber .num{color:#D97706}
    .stat.blue .num{color:#3B82F6}
    .stat.emerald .num{color:#059669}

    /* Pipeline */
    .pipeline{display:flex;align-items:center;justify-content:center;gap:8px;padding:0 24px 32px;flex-wrap:wrap}
    .pipe-step{font-size:.8rem;font-weight:600;padding:6px 14px;border-radius:6px;color:#fff}
    .pipe-step.atoms{background:#8B5CF6}
    .pipe-step.blocks{background:#D97706}
    .pipe-step.sections{background:#3B82F6}
    .pipe-step.variants{background:#059669}
    .pipe-arrow{color:#bbb;font-size:1.1rem}
    .viewport-badges{display:flex;gap:8px;justify-content:center;margin-bottom:24px}
    .vp-badge{font-size:.7rem;font-weight:500;padding:4px 10px;border-radius:4px;background:#eee;color:#666}

    /* Container */
    .container{max-width:960px;margin:0 auto;padding:0 24px}

    /* Section headers */
    .section-header{display:flex;align-items:center;gap:10px;margin:40px 0 16px}
    .section-header h2{font-size:1.35rem;font-weight:700;letter-spacing:-0.01em}
    .section-header .count{font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:99px;color:#fff}
    .section-header .count.purple{background:#8B5CF6}
    .section-header .count.amber{background:#D97706}
    .section-header .count.blue{background:#3B82F6}

    /* Cards */
    .card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
    .card{background:#fff;border:1px solid #e6e6e6;border-radius:8px;padding:16px;position:relative;overflow:hidden}
    .card::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%}
    .card.purple::before{background:#8B5CF6}
    .card.amber::before{background:#D97706}
    .card.blue::before{background:#3B82F6}
    .card .card-title{font-size:.85rem;font-weight:600;margin-bottom:4px}
    .card .card-sub{font-size:.7rem;color:#888;font-family:'SF Mono',Menlo,monospace;margin-bottom:6px;word-break:break-all}
    .card .card-reason{font-size:.72rem;color:#666;line-height:1.4}

    /* Block cards */
    .block-card{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1px solid #e6e6e6;border-radius:8px;padding:14px 16px;margin-bottom:8px}
    .block-card::before{content:'';width:3px;min-height:100%;border-radius:2px;flex-shrink:0;background:#D97706;align-self:stretch}
    .block-card .bc-name{font-size:.85rem;font-weight:600}
    .block-card .bc-meta{font-size:.7rem;color:#888;margin-top:2px}
    .usage-badge{display:inline-block;background:#FEF3C7;color:#92400E;font-size:.65rem;font-weight:600;padding:1px 6px;border-radius:3px;margin-left:6px}
    .section-tag{display:inline-block;background:#EFF6FF;color:#3B82F6;font-size:.6rem;font-weight:500;padding:1px 5px;border-radius:3px;margin:2px 2px 0 0}

    /* Section panels */
    .section-panel{background:#fff;border:1px solid #e6e6e6;border-radius:10px;margin-bottom:16px;overflow:hidden}
    .section-panel summary{padding:20px 24px;cursor:pointer;display:flex;align-items:center;gap:12px;list-style:none}
    .section-panel summary::-webkit-details-marker{display:none}
    .section-panel summary::before{content:'\\25B6';font-size:.6rem;color:#999;transition:transform .15s}
    .section-panel[open] summary::before{transform:rotate(90deg)}
    .section-panel .sp-name{font-size:1.05rem;font-weight:700;flex:1}
    .section-panel .sp-combos{font-size:.7rem;color:#fff;padding:3px 8px;border-radius:4px;background:#3B82F6;font-weight:600}
    .section-panel .sp-reason{font-size:.75rem;color:#888;padding:0 24px 4px;margin-top:-8px}
    .section-panel .sp-body{padding:0 24px 20px}

    /* Tabs */
    .tabs{display:flex;gap:0;border-bottom:2px solid #eee;margin-bottom:16px}
    .tab-btn{padding:8px 16px;font-size:.75rem;font-weight:600;color:#999;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
    .tab-btn.active{color:#3B82F6;border-bottom-color:#3B82F6}
    .tab-content{display:none}
    .tab-content.active{display:block}

    /* Tables */
    .prop-table{width:100%;border-collapse:collapse;font-size:.78rem}
    .prop-table th{text-align:left;padding:8px 10px;font-weight:600;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#999;border-bottom:1px solid #eee}
    .prop-table td{padding:8px 10px;border-bottom:1px solid #f5f5f5;vertical-align:top}
    .prop-table tr:last-child td{border-bottom:none}

    /* Badges */
    .tier-badge{font-size:.6rem;font-weight:700;padding:2px 6px;border-radius:3px;color:#fff}
    .tier-badge.t1{background:#059669}
    .tier-badge.t2{background:#2563EB}
    .type-badge{font-size:.6rem;font-weight:600;padding:2px 6px;border-radius:3px}
    .type-badge.enum{background:#EEF2FF;color:#4F46E5}
    .type-badge.boolean{background:#FDF2F8;color:#DB2777}
    .value-pill{display:inline-block;font-size:.68rem;font-weight:500;padding:2px 7px;border-radius:3px;background:#f0f0f0;color:#444;margin:1px 2px}
    .default-pill{background:#DBEAFE;color:#1E40AF}

    /* Variant matrix */
    .variant-matrix{margin-top:12px}
    .variant-matrix h4{font-size:.75rem;font-weight:600;color:#666;margin-bottom:8px}
    .matrix-grid{display:inline-grid;gap:3px}
    .matrix-cell{font-size:.58rem;padding:6px 8px;background:#EFF6FF;color:#3B82F6;border-radius:4px;text-align:center;font-weight:500}
    .matrix-header{background:#3B82F6;color:#fff;font-weight:600}
    .matrix-corner{background:transparent}
    .combo-formula{font-size:.75rem;color:#666;margin-top:10px}
    .combo-formula strong{color:#1a1a1a}

    /* Skipped */
    .skipped-card{background:#fafafa;border:1px solid #eee;border-radius:6px;padding:12px 16px;margin-bottom:6px;opacity:.7}
    .skipped-card .sk-name{font-size:.8rem;font-weight:600;color:#888}
    .skipped-card .sk-reason{font-size:.7rem;color:#aaa;margin-top:2px}

    /* Section specific blocks */
    .ssb-group{margin-bottom:12px}
    .ssb-group-title{font-size:.8rem;font-weight:600;color:#666;margin-bottom:6px;padding-left:4px}
    .ssb-item{font-size:.75rem;color:#555;padding:4px 0 4px 16px;border-left:2px solid #F59E0B}
    .ssb-item .integrated{font-size:.6rem;font-weight:600;color:#D97706;margin-left:4px}

    /* Filter */
    .filter-wrap{margin-bottom:16px}
    .filter-input{width:100%;max-width:320px;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:.8rem;font-family:inherit;outline:none;transition:border-color .15s}
    .filter-input:focus{border-color:#3B82F6}

    /* Variable props */
    .var-prop{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:.8rem}
    .var-prop .vp-name{font-weight:600}
    .var-prop .vp-desc{color:#888;font-size:.72rem}

    /* Footer */
    .footer{text-align:center;padding:40px 24px;color:#aaa;font-size:.75rem;border-top:1px solid #eee;margin-top:40px;background:#fff}
    .footer .next-step{color:#3B82F6;font-weight:600;font-size:.8rem;margin-bottom:8px}

    /* Responsive */
    @media(max-width:768px){
      .hero h1{font-size:1.6rem}
      .stats{flex-direction:column;top:-20px}
      .card-grid{grid-template-columns:1fr}
      .pipeline{flex-direction:column}
    }

    @media print{
      .hero{padding:24px;background:#333;-webkit-print-color-adjust:exact}
      .section-panel[open] .sp-body{display:block!important}
      details{break-inside:avoid}
      .filter-wrap{display:none}
    }
  `;
}

function renderScript() {
  return `
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.closest('.section-panel');
        panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        panel.querySelector('#' + btn.dataset.tab).classList.add('active');
      });
    });

    // Section filter
    const filterInput = document.getElementById('section-filter');
    if (filterInput) {
      filterInput.addEventListener('input', () => {
        const q = filterInput.value.toLowerCase();
        document.querySelectorAll('.section-panel').forEach(panel => {
          const name = panel.dataset.name || '';
          panel.style.display = name.includes(q) ? '' : 'none';
        });
      });
    }
  `;
}

function renderHero(config, theme, summary, scope) {
  return `
    <header class="hero">
      <h1>${esc(theme.name)} Design System
        <span class="scope-badge">${esc(scope || 'core')}</span>
      </h1>
      <p class="subtitle">v${esc(theme.version)} by ${esc(theme.author)}</p>
      <div class="meta">
        <span>${esc(config.storeUrl)}</span>
        <span>Figma: ${esc(config.figmaFileName)}</span>
        <span>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
    </header>

    <div class="stats">
      <div class="stat purple">
        <div class="num">${summary.atoms || 0}</div>
        <div class="label">Atoms</div>
      </div>
      <div class="stat amber">
        <div class="num">${(summary.universalBlocks || 0)}</div>
        <div class="label">Blocks</div>
      </div>
      <div class="stat blue">
        <div class="num">${summary.sections || 0}</div>
        <div class="label">Sections</div>
      </div>
      <div class="stat emerald">
        <div class="num">${summary.desktopVariantCombinations || 0}</div>
        <div class="label">Variant Combos</div>
      </div>
    </div>
  `;
}

function renderPipeline(summary, config) {
  return `
    <div class="container">
      <div class="pipeline">
        <span class="pipe-step atoms">${summary.atoms || 0} Atoms</span>
        <span class="pipe-arrow">&rarr;</span>
        <span class="pipe-step blocks">${summary.universalBlocks || 0} Blocks</span>
        <span class="pipe-arrow">&rarr;</span>
        <span class="pipe-step sections">${summary.sections || 0} Sections</span>
        <span class="pipe-arrow">&rarr;</span>
        <span class="pipe-step variants">${summary.desktopVariantCombinations || 0} Variants</span>
      </div>
      <div class="viewport-badges">
        <span class="vp-badge">Desktop ${config.desktopWidth}px</span>
        <span class="vp-badge">Mobile ${config.mobileWidth}px</span>
        <span class="vp-badge">Pages: ${(config.pages || []).join(' / ')}</span>
      </div>
    </div>
  `;
}

function renderAtoms(atoms) {
  if (!atoms || atoms.length === 0) return '';
  const cards = atoms.map(a => `
    <div class="card purple">
      <div class="card-title">${esc(a.name)}</div>
      ${a.sourceFile ? `<div class="card-sub">${esc(a.sourceFile)}</div>` : ''}
      <div class="card-reason">${esc(a.reason)}</div>
    </div>
  `).join('');

  return `
    <div class="container">
      <div class="section-header">
        <h2>Atoms</h2>
        <span class="count purple">${atoms.length}</span>
      </div>
      <div class="card-grid">${cards}</div>
    </div>
  `;
}

function renderBlocks(blocks) {
  if (!blocks) return '';

  let html = '<div class="container">';

  // Universal blocks
  const universal = blocks.universal || [];
  if (universal.length > 0) {
    html += `
      <div class="section-header">
        <h2>Universal Blocks</h2>
        <span class="count amber">${universal.length}</span>
      </div>
    `;
    html += universal.map(b => `
      <div class="block-card">
        <div>
          <div class="bc-name">
            ${esc(b.name || slugToTitle(b.type))}
            ${b.usageCount ? `<span class="usage-badge">Used ${b.usageCount}x</span>` : ''}
          </div>
          <div class="bc-meta">${esc(b.type)}</div>
          ${b.usedInSections ? `<div style="margin-top:4px">${b.usedInSections.map(s => `<span class="section-tag">${esc(s)}</span>`).join('')}</div>` : ''}
          ${b.reason ? `<div class="card-reason" style="margin-top:4px">${esc(b.reason)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // Section-specific blocks
  const specific = blocks.sectionSpecific || {};
  const specificEntries = Object.entries(specific);
  if (specificEntries.length > 0) {
    html += `
      <div class="section-header" style="margin-top:32px">
        <h2>Section-Specific Blocks</h2>
        <span class="count amber">${specificEntries.reduce((sum, [, items]) => sum + items.length, 0)}</span>
      </div>
    `;
    html += specificEntries.map(([section, items]) => `
      <div class="ssb-group">
        <div class="ssb-group-title">${esc(slugToTitle(section))}</div>
        ${items.map(i => `
          <div class="ssb-item">
            ${esc(i.type || i.name)}
            ${i.integrated ? '<span class="integrated">integrated</span>' : ''}
            ${i.reason ? ` &mdash; <span style="color:#999;font-size:.7rem">${esc(i.reason)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  html += '</div>';
  return html;
}

function renderVariantMatrix(variants) {
  const entries = Object.entries(variants);
  if (entries.length === 0) return '';

  if (entries.length === 1) {
    // Single dimension: row of chips
    const [name, v] = entries[0];
    return `
      <div class="variant-matrix">
        <h4>Variant Preview</h4>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${v.values.map(val => `<span class="value-pill">${esc(val)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (entries.length === 2) {
    // 2D matrix grid
    const [nameA, vA] = entries[0];
    const [nameB, vB] = entries[1];
    const cols = vA.values.length + 1;

    let cells = `<div class="matrix-cell matrix-corner"></div>`;
    cells += vA.values.map(v => `<div class="matrix-cell matrix-header">${esc(v)}</div>`).join('');
    cells += vB.values.map(row =>
      `<div class="matrix-cell matrix-header">${esc(row)}</div>` +
      vA.values.map(col => `<div class="matrix-cell">${esc(col)}/${esc(row)}</div>`).join('')
    ).join('');

    return `
      <div class="variant-matrix">
        <h4>Variant Matrix &mdash; ${esc(slugToTitle(nameA))} &times; ${esc(slugToTitle(nameB))}</h4>
        <div class="matrix-grid" style="grid-template-columns:repeat(${cols},auto)">
          ${cells}
        </div>
      </div>
    `;
  }

  // 3+ dimensions: formula
  const formula = entries.map(([n, v]) => `${esc(slugToTitle(n))} (${v.values.length})`).join(' &times; ');
  const total = entries.reduce((acc, [, v]) => acc * v.values.length, 1);
  return `
    <div class="variant-matrix">
      <h4>Variant Formula</h4>
      <div class="combo-formula">${formula} = <strong>${total} combinations</strong></div>
    </div>
  `;
}

function renderSections(sections) {
  if (!sections || Object.keys(sections).length === 0) return '';

  const entries = Object.entries(sections);

  let html = `
    <div class="container">
      <div class="section-header">
        <h2>Sections</h2>
        <span class="count blue">${entries.length}</span>
      </div>
      <div class="filter-wrap">
        <input type="text" class="filter-input" id="section-filter" placeholder="Filter sections...">
      </div>
  `;

  html += entries.map(([slug, sec]) => {
    const variants = sec.variants || {};
    const instanceProps = sec.instanceProperties || {};
    const varProps = sec.variableProperties || {};
    const combos = sec.totalVariantCombinations || {};
    const variantCount = Object.keys(variants).length;
    const instanceCount = Object.keys(instanceProps).length;
    const varPropCount = Object.keys(varProps).length;

    // Variant table
    let variantTab = '';
    if (variantCount > 0) {
      variantTab = `
        <table class="prop-table">
          <thead><tr><th>Property</th><th>Tier</th><th>Values</th><th>#</th><th>Reason</th></tr></thead>
          <tbody>
            ${Object.entries(variants).map(([name, v]) => `
              <tr>
                <td><strong>${esc(slugToTitle(name))}</strong></td>
                <td><span class="tier-badge t${v.tier || 1}">Tier ${v.tier || 1}</span></td>
                <td>${(v.values || []).map(val => `<span class="value-pill">${esc(val)}</span>`).join(' ')}</td>
                <td>${v.combinationCount || v.values?.length || '—'}</td>
                <td style="color:#888;font-size:.72rem">${esc(v.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${renderVariantMatrix(variants)}
      `;
    } else {
      variantTab = '<p style="color:#999;font-size:.8rem">No variants — single default layout.</p>';
    }

    // Instance properties table
    let instanceTab = '';
    if (instanceCount > 0) {
      instanceTab = `
        <table class="prop-table">
          <thead><tr><th>Property</th><th>Type</th><th>Values / Default</th><th>Reason</th></tr></thead>
          <tbody>
            ${Object.entries(instanceProps).map(([name, p]) => `
              <tr>
                <td><strong>${esc(slugToTitle(name))}</strong></td>
                <td><span class="type-badge ${p.type === 'boolean' ? 'boolean' : 'enum'}">${esc(p.type)}</span></td>
                <td>
                  ${p.type === 'boolean'
                    ? `<span class="value-pill default-pill">${p.default ? 'true' : 'false'}</span>`
                    : (p.values || []).map(v => `<span class="value-pill ${v === p.default ? 'default-pill' : ''}">${esc(v)}</span>`).join(' ')
                  }
                </td>
                <td style="color:#888;font-size:.72rem">${esc(p.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      instanceTab = '<p style="color:#999;font-size:.8rem">No instance properties.</p>';
    }

    // Variable properties
    let varPropTab = '';
    if (varPropCount > 0) {
      varPropTab = Object.entries(varProps).map(([name, desc]) => `
        <div class="var-prop">
          <span class="vp-name">${esc(slugToTitle(name))}</span>
          <span class="vp-desc">${esc(desc)}</span>
        </div>
      `).join('');
    } else {
      varPropTab = '<p style="color:#999;font-size:.8rem">No variable properties.</p>';
    }

    const panelId = slug.replace(/[^a-z0-9]/gi, '_');

    return `
      <details class="section-panel" data-name="${esc(slug)}" open>
        <summary>
          <span class="sp-name">${esc(slugToTitle(slug))}</span>
          ${combos.desktop ? `<span class="sp-combos">${combos.desktop} combos</span>` : ''}
        </summary>
        ${sec.reason ? `<div class="sp-reason">${esc(sec.reason)}</div>` : ''}
        <div class="sp-body">
          <div class="tabs">
            <button class="tab-btn active" data-tab="${panelId}_variants">Variants (${variantCount})</button>
            <button class="tab-btn" data-tab="${panelId}_instance">Instance Props (${instanceCount})</button>
            <button class="tab-btn" data-tab="${panelId}_vars">Variables (${varPropCount})</button>
          </div>
          <div class="tab-content active" id="${panelId}_variants">${variantTab}</div>
          <div class="tab-content" id="${panelId}_instance">${instanceTab}</div>
          <div class="tab-content" id="${panelId}_vars">${varPropTab}</div>
          ${combos.note ? `<div class="combo-formula" style="margin-top:12px">Desktop: <strong>${combos.desktop || 0}</strong> &bull; Mobile: <strong>${combos.mobile || 0}</strong> &mdash; ${esc(combos.note)}</div>` : ''}
        </div>
      </details>
    `;
  }).join('');

  html += '</div>';
  return html;
}

function renderSkipped(skippedSections) {
  if (!skippedSections || skippedSections.length === 0) return '';

  return `
    <div class="container">
      <div class="section-header">
        <h2>Skipped Sections</h2>
        <span class="count" style="background:#999">${skippedSections.length}</span>
      </div>
      ${skippedSections.map(s => `
        <div class="skipped-card">
          <div class="sk-name">${esc(s.slug || s.name)}</div>
          <div class="sk-reason">${esc(s.reason)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="next-step">Next step: /build-components</div>
      <div>Generated by Shopify Figma Bridge &bull; ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
    </footer>
  `;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function generateHTML(manifest) {
  const { config, theme, components } = manifest;
  const { atoms, blocks, sections, skippedSections, summary, scope } = components;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(theme.name)} Design System Proposal</title>
  <style>${renderStyles()}</style>
</head>
<body>
  ${renderHero(config, theme, summary, scope)}
  ${renderPipeline(summary, config)}
  ${renderAtoms(atoms)}
  ${renderBlocks(blocks)}
  ${renderSections(sections)}
  ${renderSkipped(skippedSections)}
  ${renderFooter()}
  <script>${renderScript()}</script>
</body>
</html>`;
}

function main() {
  // Read manifest
  let raw;
  try {
    raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  } catch (err) {
    console.error(`Error: Cannot read manifest at ${MANIFEST_PATH}`);
    console.error('Run /propose-components first.');
    process.exit(1);
  }

  const manifest = JSON.parse(raw);

  if (!manifest.components) {
    console.error('Error: No components proposed yet. Run /propose-components first.');
    process.exit(1);
  }

  if (!manifest.components.summary) {
    console.error('Error: Manifest components missing summary. Re-run /propose-components.');
    process.exit(1);
  }

  const html = generateHTML(manifest);
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  console.log(`Proposal generated: ${OUTPUT_PATH}`);
}

main();
