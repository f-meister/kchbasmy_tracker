#!/bin/bash

# Exit immediately if any command fails
set -e

echo "🧹 Clearing legacy build-time JSON datasets..."

# The -f flag ensures rm succeeds silently even if the directory is already empty
if [ -d "assets/data" ]; then
    rm -f assets/data/*
    echo "✨ Checked assets/data/"
fi

if [ -d "static/data" ]; then
    rm -f static/data/*
    echo "✨ Checked static/data/"
fi

echo "🏗️  Executing data compilation pipeline script..."

if [ -f ".devcontainer/setup.sh" ]; then
    bash .devcontainer/setup.sh
    echo "✅ Data initialization complete!"
else
    echo "❌ Error: .devcontainer/setup.sh could not be found."
    exit 1
fi
