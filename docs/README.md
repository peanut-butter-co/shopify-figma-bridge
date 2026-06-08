# Documentation

Index of all docs in this repo.

> **For agents:** only **`roadmap.md`** and the **`research/`** folder describe current, actionable intent. **`archive/`** holds superseded plans — read them for decision history, but **do not act on them** (they describe a state of the repo that no longer exists, e.g. a `/design` skill or `.claude/commands/` that were never built or have been removed).

**Status legend:** 🟢 Active · 📚 Research (evergreen reference) · 🗄️ Archived (superseded / historical)

## 🟢 Active

| Doc | What it is |
|-----|------------|
| [roadmap.md](roadmap.md) | **Start here.** The forward plan (Phases 5–9): design the store, build via configuration, build via code, production readiness. Also diagnoses the repo's current honesty bugs (install.sh, over-promising landing page, "bidirectional" claim). |
| [github-pages-landing-plan.md](github-pages-landing-plan.md) | Spec for the public landing page (`index.html`). ⚠️ The live page over-promises unshipped features — reconciliation tracked in `roadmap.md` (Phase 5). |
| [index.html](index.html) | The live GitHub Pages site, published from `main` → `/docs`. (Do not move — Pages serves `docs/index.html` as the site root.) |

## 📚 Research & reference

Evergreen background, still cited by the active roadmap.

| Doc | What it is |
|-----|------------|
| [research/design-system-learnings.md](research/design-system-learnings.md) | Empirical findings from building real design systems from Shopify themes (Evil Horizon, etc.). |
| [research/responsive-component-architecture-research.md](research/responsive-component-architecture-research.md) | Desktop-vs-mobile component strategy: breakpoint variables vs viewport variants vs separate components. Drives a roadmap open question. |
| [research/figma-slots-research.md](research/figma-slots-research.md) | Figma slots and how they map to Shopify sections/blocks. Cited by roadmap Phase 8. |
| [research/claude-code-skills-best-practices-research.md](research/claude-code-skills-best-practices-research.md) | Best practices for Claude Code skills/commands/agents — the background behind this repo's skill architecture. |
| [research/agenticui-gap-analysis.md](research/agenticui-gap-analysis.md) | Benchmark of this system against the external AgenticUI Design Systems Manual. |

## 🗄️ Archive (superseded — do not act on)

Decision records, kept for history. Each carries a banner explaining what superseded it.

| Doc | What it is |
|-----|------------|
| [archive/2026-03-27-implementation-plan.md](archive/2026-03-27-implementation-plan.md) | The original Phases 1–4 plan. Phases 1–3 shipped; Phase 4 ("Design Agent") was never built and is superseded by `roadmap.md`. Retains the as-designed `validate-shopify` spec, the responsive-architecture decision, and the commands→skills migration mechanics. |
| [archive/2026-03-27-system-improvement-conclusions.md](archive/2026-03-27-system-improvement-conclusions.md) | The analysis the plan was based on. Its "current state" descriptions reflect March 2026 and are no longer true. |

## Conventions

- **Active** docs live at the `docs/` root; **research** under `research/`; **superseded** plans under `archive/`, date-prefixed (`YYYY-MM-DD-…`) with a banner.
- When a plan is superseded, move it to `archive/` with a one-line banner pointing at what replaced it — don't delete it (the decision rationale stays useful).
- Keep this index in sync when adding or moving a doc.
