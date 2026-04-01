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

## Recommendations schema (optional)

The `recommendations` key provides curated guidance for `/propose-components`. If absent, the skill falls back to generic heuristics. All sub-keys are independently optional — add knowledge incrementally.

```json
{
  "recommendations": {
    "components": {
      "mandatoryAtoms": ["Button", "Input Field", "..."],
      "additionalAtoms": [
        { "name": "Atom Name", "reason": "Why this theme needs it" }
      ],
      "prioritySections": [
        {
          "slug": "section-file-name",
          "reason": "Why this section is important",
          "variants": {
            "setting_id": {
              "tier": 1,
              "values": ["value-a", "value-b"],
              "reason": "Why this setting produces visually distinct variants"
            }
          },
          "instanceProperties": {
            "setting_id": {
              "type": "enum",
              "values": ["page", "full"],
              "default": "page",
              "reason": "Why this is a property, not a variant"
            }
          }
        }
      ],
      "skipSections": [
        { "slug": "section-name", "reason": "Why to skip" }
      ],
      "headerBlocks": ["block-type-1", "block-type-2"],
      "footerBlocks": ["block-type-1"],
      "cartBlocks": ["block-type-1"],
      "blockGrouping": {
        "groups": [
          { "name": "Group Name", "blocks": ["block-a", "block-b"] }
        ]
      }
    },
    "organization": {
      "pageOrder": ["Foundations", "Atoms", "Blocks", "Sections"],
      "sectionFill": "#B3B3B3",
      "componentNaming": "{SectionName} / {Variant}",
      "mobilePlacement": "adjacent",
      "templateLayout": "horizontal-pairs"
    },
    "templates": {
      "coverage": [
        { "key": "index", "name": "Homepage", "priority": 1 }
      ]
    }
  }
}
```

### Three setting categories

Each `select` setting is classified into one of three buckets (see `variant-analysis.md`):

| Category | Profile key | Figma implementation |
|----------|-------------|---------------------|
| **Variant** (Tier 1-2) | `variants` | Component variant property |
| **Instance property** (Tier 3) | `instanceProperties` | Component property (enum/boolean) |
| **Variable property** | _(not in profile)_ | Variable mode on parent frame |

**Variant tiers:**
- **Tier 1** — Almost always variants (position, alignment, layout mode, media direction)
- **Tier 2** — Often variants (content width/proportion, column count)
- **Tier 3** — Instance properties (section width, section/media height — container/dimensional)

### Backward compatibility

`prioritySections` accepts both formats:
- **Flat array** (legacy): `["hero", "slideshow"]`
- **Rich objects** (preferred): `[{ "slug": "hero", "reason": "...", "variants": {...} }]`

### How recommendations are consumed

Recommendations are **weighted suggestions, not overrides**. The generic analysis always runs; recommendations bias the proposal. The user always confirms before anything is written to the manifest.
