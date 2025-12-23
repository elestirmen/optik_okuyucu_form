#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔨 Building production bundle..."

# Build için index.html'in src/main.js referanslı olması gerekiyor
# Kontrol et
if ! grep -q 'src="/src/main.js"' index.html 2>/dev/null; then
    echo "⚠️ index.html'de src/main.js referansı bulunamadı, düzeltiliyor..."
    # Eski hash'li referansı src/main.js ile değiştir
    sed -i 's|src="/assets/[^"]*\.js"|src="/src/main.js"|g' index.html
fi

# Build
npm run build

echo "📁 Deploying files..."

# dist/index.html'i kök dizine kopyala (hash'li asset referansları ile)
cp dist/index.html index.html

# Static hosting için symlink'ler
ln -sfn dist/css css 2>/dev/null || true
ln -sfn dist/libs libs 2>/dev/null || true
ln -sfn dist/assets assets 2>/dev/null || true

echo "🔒 Setting permissions..."
chmod 600 .git 2>/dev/null || true
chmod -R go-rwx src node_modules 2>/dev/null || true

echo ""
echo "✅ Deploy tamamlandı!"
echo ""
echo "📦 Build özeti:"
ls -lh dist/assets/*.js 2>/dev/null | awk '{print "   " $9 ": " $5}'
echo ""
echo "🌐 Sunucuda erişilebilir olması gereken dosyalar:"
echo "   /index.html"
echo "   /css/styles.css"
echo "   /libs/opencv.js"
echo "   /assets/*.js"
