# build-shopify-foundations — gotchas

(Theme-write / mapping gotchas accumulate here; this file is injected at the top of SKILL.md each run.)

- 2026-06-10: `config/settings_data.json` is **JSONC** — it opens with a `/* auto-generated */` header. Strip it before `JSON.parse` (use `safe-shopify-write.js` `parseSettingsData`) and re-prepend it on write (`settingsDataHeader`), or the theme-editor banner is lost.
- 2026-06-10: Horizon color roles are all `"alpha": true`, so Aristopet alpha colors (`#rrggbbaa`, `rgba(0,0,0,0)`) write directly — do NOT strip alpha.
- 2026-06-10: the host (crunchy-horizon) is at the repo root and `config.themeRoot` is `"."` — resolve theme paths relative to the repo root.
