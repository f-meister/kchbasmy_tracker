#!/bin/bash
set -e

echo "📥 Running static ingestion pipeline checker..."
# Execute validation to handle live downloads or auto-unpack simulations
node .devcontainer/scripts/validate-gtfs.js

if [ -f ".devcontainer/scripts/parse-shapes.js" ] && \
   [ -f ".devcontainer/scripts/parse-destinations.js" ] && \
   [ -f ".devcontainer/scripts/parse-stop-times.js" ]; then
    
    echo "⚙️ Compiling relational GeoJSON maps..."
    node .devcontainer/scripts/parse-shapes.js
    
    echo "⚙️ Compiling direction terminal dictionary..."
    node .devcontainer/scripts/parse-destinations.js

    echo "⚙️ Compiling timetable lookups..."
    node .devcontainer/scripts/parse-stop-times.js
    
    echo "🧹 Cleansing operational workspace..."
    rm -rf ./tmp-gtfs
else
    echo "❌ Error: Required parser scripts are missing from the .devcontainer/scripts directory"
    exit 1
fi

echo "✅ Static ingestion pipeline initialized successfully!"
