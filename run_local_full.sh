#!/bin/bash

# Exit immediately if a child process drops an error flag
set -e

echo "========================================="
echo "🔄 Starting Full Local Workspace Refresh"
echo "========================================="

# 1. Run Data Initialization Step
if [ -f "./init_data.sh" ]; then
    bash ./init_data.sh
else
    echo "❌ Error: init_data.sh template wrapper not found."
    exit 1
fi

echo ""
echo "========================================="
echo "🌐 Launching Local Development Server"
echo "========================================="

# 2. Hand over execution to your local runtime script
if [ -f "./run_local.sh" ]; then
    exec bash ./run_local.sh
else
    echo "❌ Error: run_local.sh wrapper execution loop not found."
    exit 1
fi
