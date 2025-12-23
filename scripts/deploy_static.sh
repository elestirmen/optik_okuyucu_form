#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔨 Building..."
npm run build

echo "📁 Setting up symlinks..."
# Static hosting için symlink'ler
# dist klasöründe zaten css, libs, assets var
# Kök dizinden erişim için symlink oluştur
ln -sfn dist/css css 2>/dev/null || true
ln -sfn dist/libs libs 2>/dev/null || true
ln -sfn dist/assets assets 2>/dev/null || true

# Prod index'i köke al
cp dist/index.html index.html

echo "🔒 Setting permissions..."
# Güvenlik: .git ve kaynak/bağımlılık dizinlerini web'den sakla
chmod 600 .git 2>/dev/null || true
chmod -R go-rwx src node_modules 2>/dev/null || true

echo "✅ Deploy tamamlandı."
echo ""
echo "Sunucuda aşağıdaki dosyalar erişilebilir olmalı:"
echo "  - /index.html"
echo "  - /css/styles.css"
echo "  - /libs/opencv.js"
echo "  - /assets/*.js"
