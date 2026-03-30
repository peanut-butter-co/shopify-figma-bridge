# Instance Lookup Table

Common UI patterns and which atom to instance:

| Sub-element needed | Instance of |
|---|---|
| Any button (CTA, submit, add to cart) | Button (Primary/Secondary variant) |
| Text input or search field | Input Field |
| Checkbox in a form | Checkbox (Checked/Unchecked) |
| Underlined or styled link | Text Link (Default/Accent) |
| Tab or accordion toggle | Tab (Active/Inactive) |
| Carousel/slideshow arrow | Arrow Button (Left/Right) |
| Sale/sold out label | Badge |
| Color or style picker | Variant Swatch (Default/Selected) |
| Product card in a grid | Product Card |
| Blog post card | Blog Card |
| Collection card | Collection Card |
| Quantity stepper (+/-) | Quantity Selector |
| Any icon (cart, search, menu, close, arrows, social) | Icon component from Icons frame (match by name) |

This table covers universal UI patterns. If the theme has additional atoms confirmed in `/propose-components`, add them to this lookup.

**Before building ANY composite:** List sub-elements needed. For each, check if the component exists. If yes → instance. If no → build the atom first.
