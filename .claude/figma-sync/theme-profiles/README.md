# Theme Profiles

Pre-loaded knowledge about how specific Shopify themes structure their design systems. Skills read these profiles at runtime to make better decisions.

## How it works

1. `/analyze-theme` detects the theme name and checks if a profile exists here
2. If found, the profile informs how to extract foundations (typography, colors, spacing)
3. If not found, skills fall back to generic heuristics
4. The runtime manifest (manifest.json) captures the actual values for the specific store

## Profile format

Each profile is a JSON file named `{theme-slug}.json`. See `horizon.json` for the reference implementation.

## Adding a new theme profile

Study the theme's `settings_schema.json`, `settings_data.json`, CSS variable patterns, and section structures. Document:

- **How typography is organized** — settings-driven vs hardcoded, font roles, preset systems
- **How color schemes work** — scheme structure, semantic groups, CSS variable patterns
- **How sections reference settings** — CSS classes, variable inheritance, block nesting
- **How spacing/layout is defined** — settings vs CSS, what's configurable
- **Theme-specific quirks** — anything unusual that generic heuristics would miss
