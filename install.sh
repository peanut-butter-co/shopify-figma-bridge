#!/bin/bash
set -euo pipefail

# Shopify Figma Bridge - Installer
# Clones the repo and copies the Claude Code skills into this project's
# .claude/skills/ directory (skills live at .claude/skills/<name>/SKILL.md).

REPO_URL="https://github.com/peanut-butter-co/shopify-figma-bridge.git"
BRANCH="main"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "  Shopify Figma Bridge - Installer"
echo "  ================================="
echo ""

# Sanity-check this looks like a Shopify theme directory
if [ ! -f "config/settings_schema.json" ]; then
  echo -e "${YELLOW}Warning:${NC} No config/settings_schema.json found."
  echo "  This doesn't look like a Shopify theme directory."
  echo ""
  # Read from the terminal even when the script itself is piped (curl | bash);
  # if there is no tty (non-interactive), default to aborting.
  read -p "  Continue anyway? (y/N) " -n 1 -r REPLY </dev/tty 2>/dev/null || REPLY="n"
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 1
  fi
fi

command -v git >/dev/null 2>&1 || { echo -e "${RED}Error:${NC} git is required to install."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "  Cloning $REPO_URL ($BRANCH) ..."
if ! git clone --quiet --depth 1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"; then
  echo -e "${RED}Error:${NC} clone failed — check your network and that the repo is reachable."
  exit 1
fi

if [ ! -d "$TMP/repo/.claude/skills" ]; then
  echo -e "${RED}Error:${NC} .claude/skills not found in the cloned repo."
  exit 1
fi

# Copy the skills (SKILL.md + gotchas.md + reference/ + evals/) and the
# engineering reference the skills cite.
mkdir -p .claude/skills
cp -R "$TMP/repo/.claude/skills/." .claude/skills/
cp -f "$TMP/repo/.claude/figma-best-practices.md" .claude/ 2>/dev/null || true

COUNT="$(find .claude/skills -name SKILL.md | wc -l | tr -d ' ')"
if [ "$COUNT" -eq 0 ]; then
  echo -e "${RED}Error:${NC} no skills were copied."
  exit 1
fi

echo ""
echo -e "  ${GREEN}Done!${NC} Installed $COUNT skills to .claude/skills/"
echo ""
echo "  Next steps:"
echo "    1. Open Claude Code in this directory"
echo "    2. Run /setup to configure your store and Figma file"
echo "    3. Run /build-design-system to build the whole design system,"
echo "       or run phases individually:"
echo "       /analyze-theme → /build-foundations → /propose-components"
echo "       → /build-components → /compose-page"
echo ""
