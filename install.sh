#!/bin/bash
set -e

# Shopify Figma Bridge - Installer
# Copies Claude Code skills into the current project's .claude/commands/ directory.

REPO="peanut-butter-co/shopify-figma-bridge"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"

SKILLS=(
  "setup.md"
  "analyze-theme.md"
  "build-foundations.md"
  "propose-components.md"
  "build-components.md"
  "compose-page.md"
  "sync-colors.md"
)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "  Shopify Figma Bridge - Installer"
echo "  ================================="
echo ""

# Check if we're in a Shopify theme directory
if [ ! -f "config/settings_schema.json" ]; then
  echo -e "${YELLOW}Warning:${NC} No config/settings_schema.json found."
  echo "  This doesn't look like a Shopify theme directory."
  echo ""
  read -p "  Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 1
  fi
fi

# Create target directory
mkdir -p .claude/commands

# Download skills
echo "  Downloading skills..."
for skill in "${SKILLS[@]}"; do
  echo -n "    $skill ... "
  if curl -sfL "$BASE_URL/.claude/commands/$skill" -o ".claude/commands/$skill"; then
    echo -e "${GREEN}ok${NC}"
  else
    echo -e "${RED}failed${NC}"
  fi
done

echo ""
echo -e "  ${GREEN}Done!${NC} Installed ${#SKILLS[@]} skills to .claude/commands/"
echo ""
echo "  Next steps:"
echo "    1. Open Claude Code in this directory"
echo "    2. Run /setup to configure your store and Figma file"
echo "    3. Run /analyze-theme to extract design tokens"
echo "    4. Run /build-foundations to create the Figma design system"
echo ""
echo "  Full pipeline: /setup → /analyze-theme → /build-foundations"
echo "                 → /propose-components → /build-components → /compose-page"
echo ""
