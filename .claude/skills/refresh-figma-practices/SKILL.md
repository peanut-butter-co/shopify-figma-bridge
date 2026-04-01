---
name: refresh-figma-practices
description: >
  Use when: updating the Figma best practices cheatsheet
user-invocable: true
context: inline
allowed-tools: [WebSearch, WebFetch, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/refresh-figma-practices/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Refresh Figma Practices

Research the latest Figma features, Plugin API changes, and community best practices, then propose updates to `.claude/figma-best-practices.md`.

**This skill does NOT auto-rewrite the cheatsheet.** It proposes changes for the user to review.

---

## Step 1: Read Current Cheatsheet

Read `.claude/figma-best-practices.md` and note:
- The `Version` and `Last researched` dates
- The current topics covered
- Any patterns that might be outdated

---

## Step 2: Research Updates

Use web search to investigate:

### 2a. Official Figma Updates

Search for Figma product updates, Plugin API changelogs, and Config announcements since the `Last researched` date:
- `site:figma.com/blog` for product announcements
- `site:developers.figma.com/docs/plugins/updates` for Plugin API changes
- Search for "Figma Config {year}" recap posts

Focus on changes to:
- Auto-layout (new properties, behavior changes)
- Variables and modes (new capabilities, limits)
- Component architecture (slots, properties, variants)
- Grid layout (graduated from beta? new features?)
- Any new layout paradigms or deprecated patterns

### 2b. Expert Community

Search for recent content from known Figma experts:
- Joey Banks, Ridd, Alice Packard, Nathan Curtis, Luis Ouriach, Christine Vallaure, Jan Six, Rogie King
- Search: `"{expert name}" figma {year}` for blog posts, videos, tweets
- Search: `figma best practices {year}` for new voices and techniques

Focus on patterns relevant to programmatic component building — not general UI design tips.

### 2c. New Experts

Look for emerging voices in the Figma community:
- Config speakers from the most recent conference
- Popular new Figma YouTube channels or courses
- Authors of widely-shared Figma articles

---

## Step 3: Compare and Propose

For each finding, classify it:

### Categories

1. **New pattern** — a technique or feature not covered in the current cheatsheet
2. **Updated pattern** — an existing recommendation that should be revised
3. **Deprecated pattern** — something the community has moved away from
4. **Confirmed** — existing recommendation validated by new sources (no change needed)

### Present as a diff

```
## Proposed Updates to Figma Best Practices

### New Patterns
- [Topic]: [description of what to add]
  Source: [link]

### Updates to Existing Patterns
- [Section name]: [current text] → [proposed text]
  Reason: [why it changed]
  Source: [link]

### Deprecated
- [Section name]: [what to remove or flag]
  Reason: [why]

### Confirmed (no changes)
- [Section name]: Still current as of [date]

## Impact Assessment
- Skills affected: [list any skills that reference changed patterns]
- Existing projects: [any risk to already-built design systems?]
```

---

## Step 4: Wait for User Approval

**Do NOT modify the cheatsheet until the user approves.** They may:
- Accept all changes
- Accept some, reject others
- Ask for more research on specific topics
- Defer updates to avoid impacting an active project

---

## Step 5: Apply Approved Changes

Once the user approves:

1. Update `.claude/figma-best-practices.md` with the approved changes
2. Update the `Version` date to today
3. Update the `Last researched` date to today
4. If any skill files reference patterns that changed, flag them: "These skills may need updating to match the new practices: [list]"

---

## Step 6: Summary

```
Figma Practices Refresh Complete

Last version:     {old date}
New version:      {today}
Patterns added:   {N}
Patterns updated: {N}
Patterns removed: {N}
No change:        {N}

Skills to review: {list or "none"}
```
