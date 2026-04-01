# Compose Page Gotchas

Known issues and lessons learned from assembling page compositions.

## Template Organization

- Each template gets its own Figma page. Do NOT put multiple template compositions on the same page.
- Desktop and mobile compositions are ALWAYS side by side (40px gap), never in separate areas or pages.
- Use a label above each pair: "Homepage", "PDP", etc. (Inter Bold 18px).

## Zero Inline Frames

- Templates are composed ENTIRELY from component instances. NEVER build inline frames.
- If a section component doesn't exist, go back to `/build-components` and build it first.
- If you find yourself creating a frame that looks like a section, STOP. That's a violation.

## Section Order

- Section order comes from the template JSON file (`templates/{name}.json`), NOT from the manifest.
- Always include header group sections (from `sections/header-group.json`) at the top and footer group sections at the bottom.
- The `order` field in the JSON determines the sequence.

## Color Scheme Application

- Each section instance manages its own color scheme. Use `setExplicitVariableModeForCollection` on each section instance.
- Do NOT set a mode on the composition frame itself — it uses the default.
- Read the color scheme from the template JSON's section settings, not from the manifest.

## Shared Sections

- Header and footer components are shared across all templates. Never rebuild them for each template.
- If already built for a previous template, just create a new instance.
