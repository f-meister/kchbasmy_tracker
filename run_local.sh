#!/bin/bash

# 1. Parse the branch parameter straight from your config file using sed
if [ -f "run_config.yml" ]; then
    BRANCH=$(sed -n 's/^[[:space:]]*branch:[[:space:]]*["'\'']*\([^"'\''[:space:]]*\).*/\1/p' run_config.yml)
else
    echo "❌ Error: run_config.yml file not found."
    exit 1
fi

# Fallback checking just in case the extraction yields empty parameters
if [ -z "$BRANCH" ]; then
    echo "⚠️  Warning: Could not parse branch parameter from YAML. Defaulting to 'dev'."
    BRANCH="dev"
fi

echo "🚀 Booting automation pipeline..."
echo "📌 Target Branch Context: [ $BRANCH ]"

# 2. Clear out the public folder contents ONLY if it contains active files
if [ -d "public" ]; then
    if [ "$(ls -A public)" ]; then
        echo "🧹 Clearing legacy 'public/' build directory artifacts..."
        rm -rf public/*
    else
        echo "✨ 'public/' folder is already pristine and empty."
    fi
fi

# 3. Export the target Cloudflare variable into the active shell environment
export CF_PAGES_BRANCH="$BRANCH"

echo "🏗️  Compiling static assets via Hugo & spinning up Wrangler proxy..."

# 4. Fire the local development toolchains
hugo && npx wrangler pages dev public --port 8788
