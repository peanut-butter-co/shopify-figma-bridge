# Profile Validation Procedure

A theme profile contains pre-loaded knowledge about a base theme (e.g., Horizon). But the actual theme may be a customized fork — a developer may have added typography presets, changed color scheme structure, or modified settings. **The profile is a starting hint, not ground truth.** Always validate it against the real files before relying on it.

## Validation checks

After reading the theme configuration files, compare the profile's claims against reality:

### Typography
1. Count the font role settings in `settings_schema.json` (settings with `type: "font_picker"` or that match the profile's `typography.fontRoles.roles[*].settingKey`)
2. Compare count against `profile.typography.fontRoles.count`
3. Count the heading presets — look for all `type_{level}_size` settings. Compare against what the profile expects.
4. Check for unexpected typography settings not in the profile (e.g., mobile-specific presets like `type_h1_size_mobile`)

### Color schemes
1. Count semantic color roles in the `color_scheme_group` definition array
2. Compare against the number of roles in `profile.colorSchemes.semanticGroups`
3. Count the number of actual schemes in `settings_data.json`

### Spacing
1. Check if spacing values exist in `settings_schema.json` (the profile may say "CSS-hardcoded" but the fork may have added settings)
2. Verify radii and border-width settings match the profile

### Sections (light check)
1. List all `.liquid` files in `sections/` — do unexpected ones exist that the profile doesn't account for?

## How to handle divergences

For each check, classify the result:

- **Match** — profile claim matches reality. Use the profile's guidance confidently.
- **Minor divergence** — e.g., 7 schemes instead of 6, or one extra border-radius setting. Note it but proceed with the profile as a baseline, supplementing with detected values.
- **Major divergence** — e.g., 8 font roles instead of 4, mobile-specific typography presets, or a completely different color scheme structure. **The profile is unreliable for this area.**

Report divergences to the user:

```
Theme profile validation: Horizon

Typography:    DIVERGED — found 14 presets (profile expects 7).
               Detected mobile-specific presets: type_h1_size_mobile,
               type_h2_size_mobile, etc. Using detected values.
Color schemes: OK — 8 schemes, 35 roles per scheme (matches profile)
Spacing:       OK — hardcoded scale, settings-driven radii (matches)
Sections:      MINOR — 2 custom sections not in standard Horizon

Using profile guidance for: color schemes, spacing
Using detected values for: typography
```

## Rules
- Where the profile matches → use its `figmaMapping` guidance to inform how you build foundations
- Where it diverges → fall back to generic heuristics, using only the detected data
- **NEVER blindly trust the profile** — always validate first
- Store `theme.profileValidation` in the manifest with the results so downstream skills know which parts of the profile are reliable
