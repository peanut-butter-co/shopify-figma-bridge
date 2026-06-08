# Analyze Theme Gotchas

Lessons learned from extracting design tokens from a Shopify theme. Append a dated
bullet here whenever the user corrects the extraction approach (see the skill's
"After Completion" step).

- Some themes (e.g. Horizon) use CSS `clamp()` for responsive type scaling instead of
  separate mobile font settings — there are no mobile presets to extract, so do not invent
  them. Set `hasMobilePresets: false` and let the user decide on `createMobileStyles`.
