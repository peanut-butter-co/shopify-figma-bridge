# Mandatory Atom Checklist

Scan section and block code for UI primitives that should become reusable Figma components:
- **Buttons** (primary/secondary variants)
- **Inputs** (text fields, search)
- **Badges** (sale, sold out)
- **Icons**, **Dividers**, **Checkboxes** — only if widely used

## Mandatory Atom Table

These atoms should be proposed if they exist in the theme. Search `snippets/`, `blocks/`, and `sections/` for each:

| Atom | Variants | When required |
|------|----------|---------------|
| Button | Primary, Secondary | Always |
| Input Field | Default | Always |
| Checkbox | Checked, Unchecked | Always |
| Text Link | Default, Accent | Always |
| Tab | Active, Inactive | If theme has tabs/accordions |
| Arrow Button | Left, Right | If theme has carousels |
| Badge | (per theme — e.g., Sale, Sold Out) | If theme has products |
| Variant Swatch | Default, Selected | If theme has product variants |
| Product Card | Per image ratio | If theme has products |
| Blog Card | Default | If theme has blog |
| Collection Card | Below Image, On Image | If theme has collections |
| Quantity Selector | Default | If theme has cart |
| Spacer | Small, Medium, Large | Always |
| Divider | Horizontal, Vertical | Always |
| Icon | Default | Always |

## Cross-referencing

If the theme profile includes `recommendations.components.mandatoryAtoms`, cross-reference with that list to confirm the standard atoms apply.

If the theme profile includes `recommendations.components.additionalAtoms`, append each to the proposal. These are theme-specific atoms beyond the standard 15, provided as objects with `name` and `reason`:

```json
"additionalAtoms": [
  { "name": "Accelerated Checkout", "reason": "Theme renders Apple Pay / Shop Pay buttons" },
  { "name": "Variant Picker", "reason": "Combined swatch + dropdown selector for PDP" }
]
```

Show the `reason` in the proposal so the user understands why each extra atom is recommended.

If the theme scan doesn't find a source file for an atom, note it as "create from common patterns" — do NOT skip it.
