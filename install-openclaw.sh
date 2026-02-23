#!/bin/bash
# OpenClaw Installation Script for Debian 12
# Сохрани как install-openclaw.sh и выполни: bash install-openclaw.sh

set -e

echo "=== OpenClaw Installation Script ==="
echo "=== Updating system... ==="
apt update && apt upgrade -y

echo "=== Installing dependencies... ==="
apt install -y curl git nginx sqlite3

echo "=== Installing Node.js... ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "=== Creating user... ==="
useradd -m -s /bin/bash openclaw || echo "User already exists"

echo "=== Creating project directory... ==="
mkdir -p /home/openclaw/openclaw
cd /home/openclaw/openclaw

echo "=== IMPORTANT ==="
echo "Now you need to:"
echo "1. Upload your project files to /home/openclaw/openclaw"
echo "   OR run: git clone YOUR_REPO_URL ."
echo "2. Create .env file with your tokens"
echo "3. Run: npm install && npm run build"
echo "4. Run: pm2 start dist/index.js --name openclaw"
echo ""
echo "Installation preparation complete!"
