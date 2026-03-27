# GitHub Pages Landing Page Plan

**URL:** `https://peanut-butter-co.github.io/shopify-figma-bridge/`
**Tech:** Single `index.html` in `/docs` folder (GitHub Pages from `/docs` on `main`)
**Style:** Minimal, clean — matches the design system ethos. No frameworks, just HTML + CSS.

---

## Page Structure

### Hero

```
Shopify ↔ Figma Bridge
━━━━━━━━━━━━━━━━━━━━━━
Build design systems from any Shopify theme.
Automatically. Bidirectionally. With Claude Code.

[Get Started →]  [View on GitHub →]
```

- Dark background, light text (matches Scheme 5 from Evil Horizon)
- Animated SVG showing the bridge concept: Shopify logo → tokens flowing → Figma logo
- Tagline focuses on the three differentiators: any theme, automatic, bidirectional

### How It Works (3-step visual)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. Analyze  │ →  │  2. Build    │ →  │  3. Design   │
│              │    │              │    │              │
│ Point at any │    │ Variables,   │    │ Compose pages│
│ Shopify theme│    │ text styles, │    │ from real    │
│ codebase     │    │ components   │    │ components   │
└─────────────┘    └─────────────┘    └─────────────┘
```

Each step links to the relevant skill documentation.

### Pipeline Overview

Visual flow diagram showing the full pipeline:

```
/setup → /analyze-theme → /build-foundations → /propose-components → /build-components → /compose-page
                                                                                              ↓
                                                                    /sync-colors ←→ Bidirectional sync
                                                                    /validate-instances → Quality gate
                                                                    /design → Compose with the system
```

### Feature Cards (grid)

| Card | Description |
|------|-------------|
| **Any Shopify Theme** | Works with Horizon, Dawn, Refresh, custom themes. Theme profiles accelerate known themes. |
| **Token Extraction** | Colors, typography, spacing, radii — extracted from `settings_schema.json` and `settings_data.json` automatically. |
| **Variable Architecture** | Primitives → Tokens with color scheme modes. Changes cascade everywhere. |
| **Component Library** | Atoms, blocks, sections — all as Figma components with proper auto-layout and variable bindings. |
| **Page Composition** | Template JSON → Figma page. Desktop + mobile paired. 14 page types supported. |
| **Instance Enforcement** | Every sub-element is a component instance. Built-in audit catches violations. |
| **Shopify Validation** | Schema-aware JSON validation catches range errors, dependency issues, block type mismatches. |
| **Brand Onboarding** | Brand guidelines → Primitives → all templates. New client in minutes, not days. |
| **Bidirectional Sync** | Figma ↔ Shopify. Design changes update template JSON. Code changes update Figma. |
| **Self-Learning** | Gotchas files per skill. The system gets smarter with every build. |

### Demo Section

Before/after screenshots from the Evil Horizon build:
- Empty Figma file → full design system (timelapse-style grid)
- Screenshot of the Foundations section (variables, scheme samplers)
- Screenshot of a composed Homepage template (desktop + mobile)
- Screenshot of the validation audit report

### Quick Start

```bash
# Install
curl -sfL https://raw.githubusercontent.com/peanut-butter-co/shopify-figma-bridge/main/install.sh | bash

# Or clone
git clone https://github.com/peanut-butter-co/shopify-figma-bridge.git
cp -r shopify-figma-bridge/.claude/commands/ your-theme/.claude/commands/

# Run
cd your-shopify-theme
claude
> /build-design-system
```

### Requirements

- Claude Code CLI
- Shopify theme codebase
- Figma file (any)
- Figma MCP server connected (`claude mcp add --transport http figma https://mcp.figma.com/mcp`)

### Skills Reference Table

| Skill | Phase | Description |
|-------|-------|-------------|
| `/setup` | Configure | Store URL, Figma file, viewports |
| `/analyze-theme` | Extract | Design tokens from theme settings |
| `/build-foundations` | Build | Variables, text styles, style guide |
| `/propose-components` | Plan | Component inventory + variants |
| `/build-components` | Build | Atoms, blocks, sections in Figma |
| `/compose-page` | Compose | Page templates from instances |
| `/build-design-system` | All | Full pipeline, one command |
| `/build-design-rules` | Document | Figma → code mapping rules |
| `/sync-colors` | Maintain | Bidirectional color sync |
| `/validate-instances` | Audit | Instance compliance check |
| `/validate-shopify` | Audit | Schema + JSON validation |
| `/refresh-figma-practices` | Update | Best practices cheatsheet |
| `/design` | Create | Compose designs from the system |
| `/learnings` | Improve | Review and consolidate gotchas |

### Architecture Diagram

```
┌─────────────────────────────────────────┐
│           Shopify Theme                  │
│  config/settings_schema.json             │
│  config/settings_data.json               │
│  sections/*.liquid  blocks/*.liquid       │
│  templates/*.json                        │
└──────────┬──────────────────┬────────────┘
           │ analyze          │ validate
           ▼                  ▼
┌──────────────────┐  ┌───────────────────┐
│    Manifest       │  │  Shopify Validator │
│  manifest.json    │  │  Schema-aware      │
└────────┬─────────┘  └───────────────────┘
         │ build
         ▼
┌─────────────────────────────────────────┐
│             Figma File                   │
│  Primitives (58 vars) → Tokens (37×6)   │
│  50 text styles (4 roles × presets)      │
│  Components (atoms → blocks → sections)  │
│  Templates (14 desktop + 14 mobile)      │
└──────────┬──────────────────┬────────────┘
           │ design           │ sync
           ▼                  ▼
┌──────────────────┐  ┌───────────────────┐
│  Design Agent     │  │  Color Sync       │
│  Compose, iterate │  │  Figma ↔ Shopify  │
└──────────────────┘  └───────────────────┘
```

### Footer

```
Built by Willa Creative + Peanut Butter Co.
Powered by Claude Code + Figma MCP
MIT License
```

---

## Implementation

### Option A: Single HTML file in /docs (recommended)

```
docs/
  index.html    ← everything inline (CSS + content)
  assets/
    hero-bg.svg
    screenshot-foundations.png
    screenshot-homepage.png
    screenshot-audit.png
```

Enable GitHub Pages: Settings → Pages → Source: Deploy from branch → `/docs` folder.

**Why single file:** No build step, no framework, no dependencies. Matches the "zero external dependencies" ethos of the project. Update content by editing HTML directly.

### Option B: Use a static site generator

Not recommended. Adds complexity for a single landing page.

### Design Tokens for the Page

Use Evil Horizon's actual color scheme for the landing page — it's dogfooding:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #000000;
  --color-text-subtle: rgba(0,0,0,0.6);
  --color-accent: #000000;
  --color-accent-hover: #333333;
  --color-border: rgba(0,0,0,0.06);
  --color-surface: #f5f5f5;
  --color-dark-bg: #333333;
  --color-dark-text: #ffffff;
  --font-heading: 'Inter', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --radius-button: 14px;
  --radius-card: 4px;
}
```

### Screenshots to Capture

Need these from the Evil Horizon Figma file:

1. **Full Horizon page zoomed out** — shows all 11 sections
2. **Foundations section** — variables, scheme samplers, type specimens
3. **Homepage template** — desktop + mobile paired
4. **PDP template** — desktop + mobile paired
5. **Validation audit report** — terminal output showing violation counts
6. **Before/after** — empty Figma file vs completed system

### Content Sections Priority

1. Hero + How It Works (above the fold — must sell the concept in 5 seconds)
2. Quick Start (get people running immediately)
3. Feature cards (scannable benefits)
4. Architecture diagram (for technical credibility)
5. Demo screenshots (proof it works)
6. Skills reference table (detailed reference)

---

## Tasks

- [ ] Create `docs/` directory in repo
- [ ] Build `index.html` with inline CSS
- [ ] Capture screenshots from Evil Horizon Figma file
- [ ] Create hero SVG animation (Shopify → Bridge → Figma)
- [ ] Enable GitHub Pages on the repo
- [ ] Add link to README.md
- [ ] Test on mobile viewport
