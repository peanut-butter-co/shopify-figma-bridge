# Alpha Variant Variables

**This step is critical.** Many scheme colors include alpha/opacity (e.g., `#000000cf` = black at 81%, `#0000000f` = black at 6%). The base collections from Steps 2-3 only contain fully opaque colors. Before building Color Schemas, you MUST create alpha variant variables so that every scheme color has a matching base variable to alias to.

## How to find needed alpha variants

Scan ALL color values across ALL schemes in `foundations.colors.schemes`. For each color value:

1. **Parse the color** — extract RGB hex and alpha:
   - `#RRGGBBAA` (8-char hex): alpha = `AA/255`
   - `rgba(R,G,B,A)`: alpha = A (already 0-1)
   - `#RRGGBB` (6-char hex): alpha = 1.0
   - If alpha >= 0.99 → skip (already covered by opaque base variables)
   - If alpha <= 0.01 → skip (use `Transparent`)

2. **Find the parent base variable** by matching RGB to an existing Theme Colors or Grey Scale variable (ignore alpha for this match)

3. **Create the alpha variant** in the SAME collection as the parent:
   - **Name:** `{ParentGroup}/{round(alpha * 100)}` — e.g., `Grey/900` at 81% → `Grey/900/81`, `Grey/0` at 78% → `Grey/0/78`
   - **Value:** `{r, g, b, a}` where RGB comes from the parent and `a` is the parsed alpha
   - If the parent is `Porcelain/Base` at 80% → name it `Porcelain/80`
   - Group alpha variants under the parent's group in the variable panel

4. **Deduplicate:** If two scheme colors resolve to the same base + alpha percentage, create only one variable. Use a tolerance of +/-1% for alpha matching.

## Example

Given scheme-1 colors:
- `foreground`: `#000000cf` → RGB=#000000 matches `Grey/900`, alpha=0.81 → create `Grey/900/81` = `{0,0,0,0.81}`
- `border`: `#0000000f` → RGB=#000000 matches `Grey/900`, alpha=0.06 → create `Grey/900/6` = `{0,0,0,0.06}`
- `primary`: `#000000cf` → same as foreground, already created
- `secondary_button_background`: `rgba(0,0,0,0)` → alpha=0, use existing `Transparent`

Given warm-cream colors:
- `primary`: `#2b1c14cc` → RGB=#2b1c14 matches `Cinder/900`, alpha=0.80 → create `Cinder/900/80` = `{0.169,0.110,0.078,0.80}`
- `border`: `#2b1c141a` → matches `Cinder/900`, alpha=0.10 → create `Cinder/900/10`

**Batch strategy:** Collect all needed alpha variants first (deduplicated), then create them in one or two `use_figma` calls — group by collection (Theme Colors variants, Grey Scale variants).
