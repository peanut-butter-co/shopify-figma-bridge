---
description: Configure the design system pipeline (store URL, Figma file, viewports)
---

# Design System Setup

You are configuring the environment for the Shopify-to-Figma design system pipeline. This skill runs once before any other design system skill. It collects configuration from the user and writes a manifest file that all subsequent skills read from.

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## Step 1: Reference Store URL

Ask the user for the URL of their Shopify store. It can be:
- A public Shopify URL (e.g., `https://my-store.myshopify.com`)
- A local dev server (e.g., `http://localhost:9292` or `http://127.0.0.1:9292`)

Once provided:

1. Use Chrome DevTools MCP → `navigate_page` to open the URL
2. Use `take_screenshot` to see the page
3. **If the page shows a password screen:**
   - Tell the user: "Your store is password-protected. Please enter the password."
   - Once the user provides it, use Chrome DevTools MCP to enter the password:
     ```
     fill the password input with the provided password
     click the submit/enter button
     ```
   - Take another screenshot to verify the store loaded
   - Save the password in the manifest
4. **If the page is not accessible** (connection refused, timeout): stop and ask the user to resolve the issue (start dev server, check URL, etc.)
5. **If the page loads correctly:** confirm to the user that the store is accessible

---

## Step 2: Figma File

Ask the user for the Figma file where the design system will be built. They can provide:
- A full Figma URL (e.g., `https://www.figma.com/design/ABC123/My-File`)
- Just the file key (e.g., `ABC123`)

**Parse the fileKey from URLs:**
- `figma.com/design/:fileKey/:fileName` → extract `fileKey`
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use `branchKey`

Once you have the fileKey:
1. Use Figma MCP → `get_metadata` with the fileKey to verify access
2. If access fails → ask user to check sharing permissions or the URL
3. If access succeeds → confirm to the user and show the file name

---

## Step 3: Detect Theme Info

Read the theme's `config/settings_schema.json` and extract:
- `theme_name` from the first entry (the `theme_info` object)
- `theme_version`
- `theme_author`

Tell the user: "Detected theme: **{name}** v{version} by {author}"

**Check for theme profile:** Look for `.claude/figma-sync/theme-profiles/{theme_name_lowercase}.json`. If it exists, tell the user: "Found optimized profile for {name}. Recommendations will be pre-tuned for this theme."

---

## Step 4: Propose Configuration

Present the following configuration with defaults. The user can accept all defaults or adjust individual values.

```
Configuration for your design system:

- Desktop design width:  1440px
- Mobile design width:   390px
- Figma pages to create: Foundations, Atoms, Blocks, Sections
  (+ one page per template you build later)
- Mobile variant naming:  "{name} / Mobile"
```

**Wait for user confirmation.** They may want to change viewport sizes, page names, or naming conventions.

---

## Step 4b: Instance Architecture Rules

Configure the component instance policy for this project:

```
Instance architecture:
- Component instances required: YES (never use inline frames for reusable elements)
- Mobile placement: NEXT TO desktop counterpart (not in separate section)
- Template composition: ALL sub-elements must be component instances
- Section fill for Figma: #B3B3B3
- Spacing: 60px between components, 80px between rows, 120px between page groups
```

These rules are non-negotiable. They ensure design system cascade — one change updates everywhere.

---

## Step 5: Write Manifest

Create the directory `.claude/figma-sync/` if it doesn't exist, then write `manifest.json`:

```json
{
  "config": {
    "storeUrl": "<user-provided URL>",
    "storePassword": "<password or null>",
    "figmaFileKey": "<extracted fileKey>",
    "figmaFileName": "<from get_metadata>",
    "desktopWidth": 1440,
    "mobileWidth": 390,
    "pages": ["Foundations", "Atoms", "Blocks", "Sections"],
    "mobileNaming": "{name} / Mobile",
    "instancePolicy": "strict",
    "mobilePlacement": "adjacent",
    "sectionFill": "#B3B3B3",
    "componentSpacing": 60,
    "rowSpacing": 80,
    "pageGroupSpacing": 120,
    "templateCoverage": ["index", "product", "collection", "cart", "search", "blog", "article", "404", "page", "contact", "list-collections", "password", "gift_card", "policy"]
  },
  "theme": {
    "name": "<from settings_schema>",
    "version": "<from settings_schema>",
    "author": "<from settings_schema>",
    "hasProfile": false
  },
  "foundations": null,
  "components": null,
  "buildStatus": {}
}
```

Set `theme.hasProfile` to `true` if a theme profile file was found.

---

## Step 6: Summary

Show the user a summary:

```
Setup complete!

Store:  {storeUrl} (accessible)
Figma:  {figmaFileName} ({fileKey})
Theme:  {themeName} v{version}
Desktop: {desktopWidth}px | Mobile: {mobileWidth}px

Next step: Run /analyze-theme to extract design tokens.
```

---

## If manifest already exists

If `.claude/figma-sync/manifest.json` already exists when this skill runs:
1. Read it and show the current configuration to the user
2. Ask: "A manifest already exists. Do you want to reconfigure from scratch, or update specific values?"
3. If updating: only change the values the user specifies, preserve everything else (foundations, components, buildStatus)
4. If reconfiguring: start fresh but warn that this will clear any extracted foundations and component inventory
