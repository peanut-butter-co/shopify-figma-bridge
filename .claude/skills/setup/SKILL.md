---
name: setup
description: >
  Use when: configuring a new Shopify-to-Figma pipeline, setting store URL, Figma file, or viewports
user-invocable: true
context: inline
allowed-tools: [mcp__figma__use_figma, mcp__figma__get_screenshot, mcp__figma__get_metadata, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__fill, mcp__chrome-devtools__click, Read, Write, Glob, Grep]
---

```sh
!cat .claude/skills/setup/gotchas.md 2>/dev/null || echo "No gotchas yet."
```

# Design System Setup

You are configuring the environment for the Shopify-to-Figma design system pipeline. This skill runs once before any other design system skill. It collects configuration from the user and writes a manifest file that all subsequent skills read from.

**Manifest path:** `.claude/figma-sync/manifest.json`

---

## Step 1: Reference Store URL and Figma File

Ask the user in plain text to provide two things:

1. The URL of their Shopify store (e.g., `https://my-store.myshopify.com` or `http://localhost:9292`)
2. The Figma file URL or file key where the design system will be built (e.g., `https://www.figma.com/design/ABC123/My-File`)

Wait for the user to reply with both URLs in a single message.

Once the **Store URL** is provided:

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

Once the **Figma file** URL/key is provided:

**Parse the fileKey from URLs:**
- `figma.com/design/:fileKey/:fileName` → extract `fileKey`
- `figma.com/design/:fileKey/branch/:branchKey/:fileName` → use `branchKey`

1. Use Figma MCP → `get_metadata` with the fileKey to verify access
2. If access fails → ask user to check sharing permissions or the URL
3. If access succeeds → confirm to the user and show the file name

**Verify both the store and Figma file in parallel** (navigate_page + get_metadata at the same time).

---

## Step 2: Detect Theme Info

Read the theme's `config/settings_schema.json` and extract:
- `theme_name` from the first entry (the `theme_info` object)
- `theme_version`
- `theme_author`

Tell the user: "Detected theme: **{name}** v{version} by {author}"

**Check for theme profile:** Look for `.claude/figma-sync/theme-profiles/{theme_name_lowercase}.json`. If it exists, tell the user: "Found optimized profile for {name}. Recommendations will be pre-tuned for this theme."

---

## Step 3: Propose Configuration

Present the proposed configuration as a markdown table:

```
Here's the proposed configuration:

| Setting               | Value                          |
|----------------------|--------------------------------|
| Desktop design width | 1440px                         |
| Mobile design width  | 390px                          |
| Figma pages to create| Foundations, Atoms, Blocks, Sections |
| Mobile variant naming| {name} / Mobile                |
```

Ask the user to confirm:

- **"Accept defaults" (Recommended)** — Use all values as shown
- **"Adjust values"** — Let me change specific settings

If they choose to adjust, ask which settings they want to change and use their new values.

---

## Step 4: Write Manifest

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
    "mobilePlacement": "adjacent"
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

## Step 5: Summary

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
2. Ask the user with these options:
   - **"Update specific values"** — Change only what I need, keep everything else
   - **"Reconfigure from scratch"** — Start fresh (clears extracted foundations and component inventory)
3. If updating: only change the values the user specifies, preserve everything else (foundations, components, buildStatus)
4. If reconfiguring: start fresh but warn that this will clear any extracted foundations and component inventory
