# Research: Best Practices for Claude Code Skills, Commands & Agents

**Date:** 2026-03-27
**Purpose:** Deep research on patterns, strategies, and best practices for building Claude Code skill systems, with focus on design system automation and self-learning capabilities.

---

## Table of Contents

1. [Official Documentation Findings](#1-official-documentation)
2. [Community Projects Analysis](#2-community-projects)
3. [Skills Architecture Patterns](#3-skills-architecture)
4. [Agent Orchestration Patterns](#4-agent-orchestration)
5. [Self-Learning & Feedback Systems](#5-self-learning-systems)
6. [Hooks System Patterns](#6-hooks-patterns)
7. [CLAUDE.md & Memory Best Practices](#7-claudemd-and-memory)
8. [Design Systems + AI Agents](#8-design-systems-ai)

---

## 1. Official Documentation

### Skills System

Skills are markdown files (`SKILL.md`) that extend Claude's capabilities. They follow the Agent Skills open standard.

**Where skills live (priority order):**
- Enterprise (managed settings) -- highest
- Personal (`~/.claude/skills/<name>/SKILL.md`)
- Project (`.claude/skills/<name>/SKILL.md`)
- Plugin (`<plugin>/skills/<name>/SKILL.md`)

**Key frontmatter fields:**
| Field | Purpose |
|-------|---------|
| `name` | Slash-command name (lowercase, hyphens, max 64 chars) |
| `description` | Tells Claude when to auto-load (critical for activation) |
| `disable-model-invocation` | User-only, prevents auto-triggering |
| `user-invocable` | `false` = Claude-only, hidden from `/` menu |
| `allowed-tools` | Restrict tool access during execution |
| `context: fork` | Run in isolated subagent context |
| `agent` | Which subagent type to use with `context: fork` |
| `model` / `effort` | Override model/effort per skill |
| `paths` | Glob patterns limiting auto-activation |
| `hooks` | Lifecycle hooks scoped to the skill |

**Dynamic context:** `` !`command` `` syntax runs shell commands before skill content is sent, injecting dynamic output.

**Budget:** Skill descriptions consume ~2% of context window (fallback 16,000 chars).

### Commands vs Skills vs Agents

| Mechanism | Trigger | Context | Use Case |
|-----------|---------|---------|----------|
| **Commands** (`.claude/commands/`) | Manual `/slash` | Injected into current context | User-initiated workflows |
| **Skills** (`.claude/skills/`) | Auto or manual | Inline or `context: fork` | Reusable knowledge/workflows |
| **Agents** (`.claude/agents/`) | Auto-invocable | Fresh isolated context | Autonomous specialized workers |

**Weight hierarchy:** Skills (lightest) > Agents (separate context) > Commands (explicit-only).

### Subagents

- Run in isolated context windows with custom prompts, tools, permissions
- Cannot spawn other subagents (no nesting)
- Support persistent memory with `memory: user|project|local`
- Can run in git worktrees with `isolation: worktree`
- Built-in types: Explore (fast/Haiku), Plan (read-only), general-purpose (all tools)

### Hooks

Deterministic handlers at lifecycle events. Four types: command, HTTP, prompt, agent.

**Key events:** SessionStart, PreToolUse, PostToolUse, Stop, SubagentStart/Stop, PreCompact, PostCompact, CwdChanged, FileChanged, Notification, etc.

**Exit codes:** 0 = success, 2 = blocking error, 1 = non-blocking error.

### Official Best Practices Summary

1. **Give Claude verification criteria** (tests, screenshots, expected outputs) -- highest-leverage action
2. **Explore -> Plan -> Implement -> Commit** cycle
3. **Manage context aggressively** (`/clear`, `/compact`, subagents for isolation)
4. **Keep CLAUDE.md under 200 lines**
5. **Use subagents for investigation** to keep main context clean
6. **Course-correct early** with Esc, `/rewind`, `/clear`

---

## 2. Community Projects Analysis

### 2.1 Superpowers (obra/superpowers) -- ~117k stars

**Architecture:** A skills framework for coding agents. Skills are markdown-based behavioral engineering documents.

**Key innovations:**

**a) Claude Search Optimization (CSO)**
Skill descriptions must contain ONLY triggering conditions, never workflow summaries. When descriptions summarize workflow, agents shortcut and follow the description instead of reading the full skill.

```markdown
# BAD description
"Helps debug issues by first investigating logs, then forming hypotheses..."

# GOOD description
"Use when: debugging a failing test, investigating an error, or diagnosing unexpected behavior"
```

**b) Anti-Rationalization Engineering**
Every skill includes:
- **Iron Law** -- one non-negotiable rule at the top
- **Rationalization tables** -- "Excuse vs. Reality" that counter agent shortcuts
- **Red Flags lists** -- thoughts that should trigger STOP
- **Decision flowcharts** (Graphviz DOT) for non-obvious branching only

**c) Subagent-Driven Development**
```
Coordinator (your session)
  ├── Implementer subagent (task + context, commits, self-reviews)
  ├── Spec compliance reviewer (skeptical: "finished suspiciously quickly")
  └── Code quality reviewer (structure, SRP, file sizes)
```
- Fresh agent per task (prevents context drift)
- Two-stage review: spec compliance THEN code quality (never combined)
- Status protocol: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED

**d) TDD for Skills**
1. RED: Run pressure scenarios WITHOUT the skill. Document rationalizations.
2. GREEN: Write skill addressing those rationalizations. Re-run.
3. REFACTOR: Find new loopholes, add counters, re-test.

**e) Hard Phase Gates**
brainstorming -> writing-plans -> implementation (no skipping allowed)

### 2.2 Impeccable (pbakaus/impeccable) -- ~14k stars

**Architecture:** Single "meta-skill" (frontend-design) + 20 "command skills" for design quality enforcement.

**Key innovations:**

**a) Config-Driven Provider Factory**
Skills authored once, compiled to 10+ AI tools (Claude, Cursor, Codex, Gemini, etc.) via build system with provider-specific transformers.

**b) Skill + Command Separation**
- One meta-skill contains domain knowledge (7 reference docs: typography, color, spatial, motion, interaction, responsive, UX writing)
- 20 command skills reference the meta-skill: `/audit`, `/polish`, `/normalize`, `/animate`, `/colorize`, etc.
- Commands categorized: Diagnostic, Refinement, Enhancement, Structural

**c) Persistent Design Context**
`/teach-impeccable` runs 3-phase discovery:
1. Scan codebase for patterns/tokens/brand
2. Ask targeted questions only for gaps
3. Write `.impeccable.md` as persistent project personality

**d) Anti-Pattern as First-Class Concept**
Catalogs what NOT to do (overused fonts, pure black, glassmorphism, "cyan-on-dark"). `/audit` includes "AI Slop Detection" scoring.

**e) Quantified Quality Gates**
`/audit` produces 0-20 scores across 5 dimensions with P0-P3 severity tags and suggested remediation commands.

**f) Command Chaining**
`/audit` -> `/normalize` -> domain commands -> `/polish` (each documents issues without fixing what others handle)

### 2.3 shanraisshan/claude-code-best-practice -- ~114k stars

**Key patterns documented:**

**a) Command -> Agent -> Skill hierarchy**
- Commands: 12 frontmatter fields, user-initiated
- Agents: 16 frontmatter fields, auto-invocable, isolated
- Skills: lightest weight, auto-discoverable

**b) Two skill deployment patterns:**
1. Agent skills (preloaded into agent via `skills:` field)
2. Direct skills (invoked via Skill tool from commands)

**c) CLAUDE.md Size Rule**
Keep under 200 lines. Beyond that, Claude starts ignoring instructions even when marked MUST.

**d) Skills Best Practices (from Thariq Shikari, Claude Code team):**
- Description is a trigger, not a summary
- Build a Gotchas section -- highest-signal content
- Don't state the obvious -- focus on non-default behavior
- Don't railroad Claude -- goals + constraints, not prescriptive steps
- Include scripts/libraries for composition, not reconstruction
- Use `context: fork` for isolation
- Embed `` !`command` `` for dynamic context
- Measure skill usage with PreToolUse hooks

### 2.4 everything-claude-code -- Hackathon winner

28 subagents, 125+ skills, 60+ slash commands. Language-specific rules. Hooks for session lifecycle, memory persistence, pattern extraction.

### 2.5 claude-reflect -- Self-learning system

Two-stage feedback:
1. Hooks monitor sessions to detect corrections (regex + semantic analysis)
2. `/reflect` command reviews queued items with confidence scores

Features:
- Skill discovery via `/reflect-skills` (analyzes session history for patterns)
- Semantic deduplication of similar entries
- Corrections during skill execution update the skill file itself

---

## 3. Skills Architecture Patterns

### Activation Rate Research

Across 200+ prompts:
- No optimization: ~20% activation
- Optimized descriptions: 50%
- With evaluation hooks: 84%
- Adding examples: 72% -> 90%

### Three-Tier Activation Strategy

| Level | Method | Success Rate | Effort |
|-------|--------|-------------|--------|
| 1 | Description optimization | 50% | Low |
| 2 | CLAUDE.md references | 60-70% | Medium |
| 3 | Custom evaluation hooks | 84% | High |

### Five Fixes That Work

1. Specific activation triggers replacing vague descriptions
2. Real examples over rules (examples > rules in length)
3. Progressive disclosure (SKILL.md < 500 lines, details in subdirectories)
4. Explicit boundaries (what the skill does NOT do)
5. Testing with real workflows

### Recommended Skill Folder Structure

```
skill-name/
  SKILL.md          # Required, <500 lines
  docs/             # Reference material
  workflows/        # Step-by-step procedures
  scripts/          # Helper scripts for composition
  templates/        # Output templates
  examples/         # Real examples for context
```

---

## 4. Agent Orchestration Patterns

### Core Patterns

| Pattern | Description | Best For |
|---------|-------------|----------|
| **Leader** | One primary agent delegates to workers | Sequential multi-step workflows |
| **Swarm** | Multiple agents in parallel on independent tasks | Research, code review |
| **Pipeline** | Sequential handoff between specialists | Build -> Test -> Deploy |
| **Watchdog** | Monitor agent observes and intervenes | Quality gates, compliance |

### Subagent Best Practices

- Create **feature-specific** subagents with skills, not generic "qa" agents
- Fresh agent per task (isolated context prevents drift)
- Coordinator constructs exact context needed (never inherit session history)
- Use test time compute: separate contexts make results better
- Two-stage review: spec compliance THEN quality (never combined)

### Agent Teams (Experimental)

- Fully independent context windows with peer-to-peer messaging
- Shared task list with self-coordination
- Start with 3-5 teammates, 5-6 tasks each
- Avoid file conflicts (each owns different files)
- Higher token cost (each teammate = separate instance)

---

## 5. Self-Learning & Feedback Systems

### Built-in Auto Memory

Claude saves notes at `~/.claude/projects/<project>/memory/`:
- Build commands, debugging insights, architecture notes
- Code style preferences, workflow habits
- Accumulates across sessions automatically

### claude-reflect Pattern

```
Session monitoring (hooks)
  ├── Regex + semantic detection of corrections
  ├── Confidence scoring
  └── Queue for review
       ↓
/reflect command
  ├── Review queued items
  ├── Approve/reject
  ├── Semantic deduplication
  └── Write to memory/skills
       ↓
/reflect-skills
  ├── Analyze session history
  ├── Find repeating patterns
  └── Propose new skills
```

**Key insight:** Corrections during skill execution should update the skill file itself, making the skill progressively smarter.

### Self-Improving Agent Pattern (Addy Osmani)

Core loop: Pick task -> Implement -> Validate -> Commit -> Update status -> Reset context -> Repeat

Four memory channels:
1. Git history (code changes)
2. Progress log (what's done)
3. Task state file (what's pending)
4. AGENTS.md / learnings file (patterns, gotchas, preferences)

**Compound learning:** Each improvement makes subsequent improvements easier.

### auto-dream Pattern

Background sub-agent that:
- Analyzes coding sessions to extract key knowledge
- Acts as "garbage collector" for memory
- Reorganizes old data
- Keeps MEMORY.md clean

### Self-Learning Skill Pattern (Learnings.md)

A skill that maintains a `Learnings.md` file:
- After each task completion, skill appends what worked/didn't
- Before each new task, skill reads learnings for relevant context
- Structured as: `[date] [category] [learning] [confidence]`

### Practical Implementation Approaches

**Level 1 -- Memory-based (simplest):**
- Use existing auto-memory for feedback storage
- Manual `/remember` commands for explicit corrections
- Read memories at skill invocation

**Level 2 -- Hook-based (automatic):**
- PostToolUse hooks detect correction patterns
- PreToolUse hooks inject relevant learnings
- Stop hooks review and consolidate

**Level 3 -- Skill-based (structured):**
- Dedicated `/reflect` skill for reviewing feedback
- `/reflect-skills` for pattern discovery
- Skill files updated based on accumulated feedback

**Level 4 -- Agent-based (sophisticated):**
- Background agent monitors sessions
- Semantic analysis of corrections
- Automatic skill refinement proposals
- Periodic consolidation of learnings

---

## 6. Hooks Patterns

### Most Useful Hook Patterns

| Pattern | Event | Purpose |
|---------|-------|---------|
| Auto-format | PostToolUse (Edit/Write) | Run formatter after code changes |
| Protected files | PreToolUse | Block edits to critical files |
| Context reload | SessionStart (compact) | Re-inject context after compaction |
| Notifications | Notification | Desktop alerts when Claude needs input |
| Skill usage metrics | PreToolUse | Track which skills fire and how often |
| Quality gates | Stop | Verify work before marking complete |
| Auto-commit | PostToolUse (Bash) | Stage and commit after test passes |

### Hook Configuration Tips

- Use absolute paths (hooks run in non-interactive shells)
- Keep matchers narrow (tool name + pattern)
- Exit code 2 to block, 0 to allow
- Check `stop_hook_active` in Stop hooks to prevent infinite loops
- Wrap shell `echo` in interactive-only guards

---

## 7. CLAUDE.md and Memory

### CLAUDE.md Rules

- Under 200 lines per file (consensus: max 300)
- Ask for each line: "Would removing this cause Claude to make mistakes?" If not, cut it.
- Be specific and concrete ("Use 2-space indentation" not "Format properly")
- Don't include standard language conventions Claude already knows

### Structure

```
# Project Context
One-liner that orients Claude

# Commands
How to run tests, build, lint, deploy

# Code Style
Specific formatting and pattern preferences

# Gotchas
Project-specific pitfalls
```

### Memory Architecture

**Loading mechanics in monorepos:**
- Ancestor CLAUDE.md files: loaded eagerly at startup
- Descendant CLAUDE.md files: loaded lazily on access
- Sibling directories: never loaded

**`.claude/rules/` directory:** Path-specific rules with `paths:` frontmatter. Only load when Claude works with matching files.

### Context Cost Awareness

| Feature | Context Impact |
|---------|---------------|
| CLAUDE.md | Loaded every request (keep small) |
| Skills | Descriptions at start, full content on use |
| MCP | Tool names at start, schemas deferred |
| Subagents | Zero main context cost (isolated) |
| Hooks | Zero unless returning context |

---

## 8. Design Systems + AI Agents

### Figma MCP Server

The key unlock for design system automation:
- Allows agents to create/edit components, apply variables, build designs
- `use_figma` tool writes designs back into Figma
- Structured access to design tokens, component libraries, documentation

### Core Problem Solved

AI agents previously had no access to team design decisions. MCP servers provide:
- Design token access
- Component library read/write
- Documentation integration
- Real-time design verification via screenshots

### Design-to-Code Workflow

1. `get_design_context` -- returns code, screenshot, contextual hints
2. Adapt to project stack, components, conventions
3. Map Code Connect snippets to codebase components
4. Follow documentation links for usage guidelines
5. Apply design annotations and constraints

### Figma Make

AI agent workflow builder for:
- Capturing logic, flows, edge cases via prompts
- Generating prototypes using team design systems
- Design decisions grounded in actual system tokens

---

## Sources

### Official Documentation
- [Skills](https://code.claude.com/docs/en/skills)
- [Hooks](https://code.claude.com/docs/en/hooks-guide)
- [Memory](https://code.claude.com/docs/en/memory)
- [Best Practices](https://code.claude.com/docs/en/best-practices)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Agent Teams](https://code.claude.com/docs/en/agent-teams)

### Community Projects
- [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)
- [obra/superpowers](https://github.com/obra/superpowers)
- [pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)
- [BayramAnnakov/claude-reflect](https://github.com/BayramAnnakov/claude-reflect)

### Blog Posts & Articles
- [Anatomy of the .claude/ folder - @akshay_pachaar](https://x.com/akshay_pachaar/status/2035341800739877091)
- [Self-Improving Coding Agents - Addy Osmani](https://addyosmani.com/blog/self-improving-agents/)
- [Design Systems And AI: Why MCP Servers Are The Unlock - Figma](https://www.figma.com/blog/design-systems-ai-mcp/)
- [Claude Code Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Claude Code Best Practices: Lessons From Real Projects](https://ranthebuilder.cloud/blog/claude-code-best-practices-lessons-from-real-projects/)

### Curated Collections
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)
