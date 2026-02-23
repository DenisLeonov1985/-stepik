#!/bin/bash
# ============================================
# Установка OpenClaw.ai Gateway на сервер
# ============================================

echo "🦞 Installing OpenClaw.ai Gateway..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"

# Установка OpenClaw.ai CLI глобально
echo "📦 Installing OpenClaw.ai CLI..."
npm install -g @openclaw/cli

# Создание директории для данных
echo "📁 Creating data directory..."
mkdir -p /home/openclaw/.openclaw
chown -R openclaw:openclaw /home/openclaw/.openclaw

# Инициализация OpenClaw
echo "🔧 Initializing OpenClaw..."
su - openclaw -c "openclaw setup"

echo ""
echo "✅ OpenClaw.ai Gateway installed!"
echo ""
echo "Next steps:"
echo "1. Login to OpenClaw: openclaw login"
echo "2. Configure gateway: openclaw gateway --configure"
echo "3. Start gateway: openclaw gateway"
echo ""
echo "For systemd service:"
echo "  openclaw system install"
