#!/bin/bash
# Build script for Render deployment

# Install dependencies
npm ci

# Build the TypeScript code
npm run build

# The app will be started with: npm run start
