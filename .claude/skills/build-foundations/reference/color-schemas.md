# Color Schemas Collection

This is the most complex step of building foundations. Create collection "Color Schemas" with **one mode per color scheme**.

## Procedure

1. **Create the collection** with modes named after each scheme key from `foundations.colors.schemes`
2. **Create semantic variables** organized by the groups in `foundations.colors.semanticGroups`. Each variable is named `{GroupName}/{PropertyLabel}` (e.g., `Essential/Background`, `Primary button/Label`)
3. **For each variable in each mode:** set the value as a `VARIABLE_ALIAS` pointing to the Theme Colors or Grey Scale variable whose hex AND alpha match the scheme's color value for that field.

## Critical rules

- Color Schemas NEVER holds raw color values — only VARIABLE_ALIAS references to Theme Colors or Grey Scale variables
- Match by **both RGB and alpha**. The alpha variants from Step 3.5 ensure every scheme color has an exact match.
  - Opaque colors (a >= 0.99) → alias to the base variable (e.g., `Grey/900`)
  - Alpha colors (0.01 < a < 0.99) → alias to the alpha variant (e.g., `Grey/900/81`)
  - Fully transparent (a <= 0.01) → alias to `Transparent`
- Match tolerance: RGB within 0.005, alpha within 0.02
- If no matching variable is found → **STOP and warn the user.** This means Step 3.5 missed a variant. Do NOT alias to a wrong variable.

## Batch strategy

Process one semantic group at a time (Essential, Primary Button, Secondary Button, etc.) to stay within the ~20KB response limit.

## Resolve variable labels

Use the field `id` from the semantic group (e.g., `background`) and map to the label from the `definition` array in the schema. The manifest's `semanticGroups` has both the group name and the list of variable IDs. For the Figma variable name, use `{GroupName}/{human-readable label}` — resolve the label from `settings_schema.json`'s `definition` entries (their `label` field, resolved via locales).
