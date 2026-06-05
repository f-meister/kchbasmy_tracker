#!/bin/bash
set -e

echo "📥 Downloading Kuching static transit package..."
mkdir -p ./tmp-gtfs
curl -L https://api.data.gov.my/gtfs-static/mybas-kuching -o ./tmp-gtfs/kuching-static.zip

echo "📂 Extracting layout files..."
cd tmp-gtfs && unzip -o kuching-static.zip && cd ..

if [ -f ".devcontainer/scripts/parse-shapes.js" ] && [ -f ".devcontainer/scripts/parse-destinations.js" ]; then
    echo "⚙️ Compiling relational GeoJSON maps..."
    node .devcontainer/scripts/parse-shapes.js
    
    echo "⚙️ Compiling direction terminal dictionary..."
    node .devcontainer/scripts/parse-destinations.js
    
    echo "🧹 Cleansing operational workspace..."
    rm -rf ./tmp-gtfs
else
    echo "❌ Error: Required parser scripts are missing from the .devcontainer/scripts directory"
    exit 1
fi
echo "✅ Static ingestion pipeline initialized successfully!"
