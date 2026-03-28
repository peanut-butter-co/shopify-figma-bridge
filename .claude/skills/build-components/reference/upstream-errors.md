# Upstream Error Protocol

This skill depends on outputs from previous pipeline steps (foundations, variables, text styles). When validation catches an issue, **always diagnose whether the root cause is local or upstream** before applying a fix.

## How to diagnose

When a programmatic check flags an issue (e.g., invisible text, broken fill), investigate one level deeper:
1. **Check the variable value** — does the bound variable resolve to the expected color/value in the active mode?
2. **Check if the issue is isolated or systemic** — does the same variable cause problems on multiple nodes?
3. **If it's systemic** (same variable broken everywhere), the issue is upstream — in foundations, not in the component.

## What to do when you find an upstream error

**STOP building components.** Do NOT apply local workarounds (like manually setting opacity) and continue. Instead:

1. Identify the upstream cause (e.g., "Essential/Text variable resolves to alpha=0 because it aliases to Transparent instead of an alpha variant")
2. Report to the user: explain what's broken, which previous step caused it, and what the fix would be
3. Ask the user: "Should I fix the [foundations/variables/styles] first, or continue with a workaround?"
4. Only proceed once the user decides

**Why this matters:** A local patch hides the bug. Every subsequent component will inherit the same issue, and the fix becomes exponentially harder later.

## Examples of upstream vs local issues

| Symptom | Upstream? | Root cause |
|---------|-----------|------------|
| Text invisible (opacity=0) on multiple components | Yes | Variable aliases to wrong base color (foundations) |
| One button's border radius looks wrong | No | Wrong radius variable used (local fix) |
| All fills show hardcoded color instead of variable | Yes | Variable collection missing or misconfigured |
| A single text node has wrong font | No | Wrong text style applied (local fix) |
