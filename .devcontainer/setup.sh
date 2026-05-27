#!/bin/bash
set -e

echo "📥 Downloading Kuching static transit package..."
mkdir -p ./tmp-gtfs
curl -L https://api.data.gov.my/gtfs-static/mybas-kuching -o ./tmp-gtfs/kuching-static.zip

echo "📂 Extracting layout files..."
cd tmp-gtfs && unzip -o kuching-static.zip && cd ..

if [ -f ".devcontainer/scripts/parse-shapes.js" ]; then
    echo "⚙️ Compiling relational GeoJSON maps..."
    node .devcontainer/scripts/parse-shapes.js
    echo "🧹 Cleansing operational workspace..."
    rm -rf ./tmp-gtfs
else
    echo "❌ Error: Parser script missing from .devcontainer/scripts/parse-shapes.js"
    exit 1
fi
echo "✅ Static ingestion pipeline initialized successfully!"
