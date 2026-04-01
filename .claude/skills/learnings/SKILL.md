---
name: learnings
description: >
  Use when: the user says "review learnings", "what have we learned",
  "update gotchas", or wants to review and consolidate feedback from
  recent design system work.
user-invocable: true
context: inline
allowed-tools: [Read, Write, Glob, Grep]
---

# Learnings

You are reviewing and consolidating gotchas from recent design system work. This skill reads all gotchas.md files, presents a consolidated view, and lets the user approve, reject, or refine entries.

---

## Step 1: Discover All Gotchas

Use Glob to find every `gotchas.md` file in the skills directory:

```
Glob(".claude/skills/**/gotchas.md")
```

This will discover all gotchas files across all skills, including any added after the initial setup.

For each file, read the full contents and parse into individual gotcha entries.

---

## Step 2: Present Consolidated View

Show the user a structured summary of all gotchas across all skills:

```markdown
## Design System Learnings

### build-foundations ({N} gotchas)
1. **Text Style Enforcement** — Every text node must have textStyleId and bound fills
2. **Mobile Text Styles** — Always create both breakpoints even if sizes match
3. ...

### build-components ({N} gotchas)
1. **Instance Architecture** — Every sub-element that exists as a component must be instanced
2. **Screenshot After Every Step** — Never validate at zoomed-out scale
3. ...

### compose-page ({N} gotchas)
1. **Template Organization** — Each template gets its own Figma page
2. **Zero Inline Frames** — Templates composed entirely from instances
3. ...

### propose-components ({N} gotchas)
1. **Mandatory Atom Checklist** — Never skip atoms, even trivial ones
2. ...

---

**Total: {N} gotchas across {N} skills**
```

---

## Step 3: Review and Update

Ask the user what they want to do:

> **What would you like to do?**
>
> 1. **Add new learnings** — I have new gotchas from recent work
> 2. **Refine existing** — Some entries need updating or better wording
> 3. **Remove outdated** — Some gotchas no longer apply
> 4. **Looks good** — No changes needed

### If adding new learnings:

Ask the user to describe what they learned. Then:

1. Determine which skill(s) the learning applies to
2. Draft the gotcha entry in the same format as existing entries
3. Show the draft to the user for approval
4. Once approved, append to the appropriate `gotchas.md` file
5. If no `gotchas.md` exists for the target skill, create one

### If refining existing:

Ask which entries need updating. Show the current text, propose a revision, and apply once confirmed.

### If removing outdated:

Ask which entries to remove. Confirm before deleting.

---

## Step 4: Cross-Skill Patterns

After reviewing individual gotchas, look for patterns that span multiple skills:

- **Repeated themes:** If the same gotcha appears in multiple skills (e.g., "always screenshot after building"), note it as a universal rule
- **Missing coverage:** If a skill has no gotchas but other similar skills do, suggest adding relevant entries
- **Contradictions:** If two skills have conflicting advice, flag it for resolution

Present any cross-skill observations to the user.

---

## Step 5: Summary

```
Learnings Review Complete

Gotchas reviewed:  {N} across {N} skills
Added:             {N} new entries
Updated:           {N} entries
Removed:           {N} entries
No change:         {N} entries

Cross-skill patterns identified: {N}
```

---

## Notes

### When to run this skill
- After completing a full design system build
- After encountering unexpected issues during any pipeline step
- Periodically (monthly) to keep gotchas current
- When onboarding a new team member who wants to understand common pitfalls

### Gotcha format
Each gotcha should follow this pattern:
```markdown
## {Short Title}

- **What:** One-line description of the issue
- **Why:** Why it matters / what goes wrong if ignored
- **Fix:** How to avoid or resolve it
```

Keep entries concise. If a gotcha needs a code example, include it inline. If it needs extensive explanation, link to the relevant reference doc.
