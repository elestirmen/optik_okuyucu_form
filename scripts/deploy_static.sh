#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INDEX_DEV="index.vite.html"
if [[ ! -f "$INDEX_DEV" ]]; then
  echo "HATA: $INDEX_DEV bulunamadı. Build için Vite entry HTML gerekli."
  exit 1
fi

# Not: Prod ortamda repo kökündeki index.html, dist build çıktısıdır.
# Vite build çalıştırabilmek için geçici olarak Vite entry HTML'yi index.html yapıyoruz.
INDEX_BACKUP="$(mktemp)"
cp index.html "$INDEX_BACKUP"
trap 'cp "$INDEX_BACKUP" index.html 2>/dev/null || true; rm -f "$INDEX_BACKUP"' EXIT

cp "$INDEX_DEV" index.html
npm run build

# Static hosting (nginx/openresty) this repo root üzerinden yapılıyorsa:
# - Vite public dizinini otomatik map etmez, bu yüzden symlink ile /css ve /libs sağlanır.
# - dist/assets içerikleri /assets altında sunulur.
ln -sfn public/css css
ln -sfn public/libs libs
ln -sfn dist/assets assets

# Prod index'i köke al (hash'li asset referansları güncel kalsın)
cp dist/index.html index.html

# Güvenlik: .git ve kaynak/bağımlılık dizinlerini web'den sakla (izinler uygunsa)
chmod 600 .git 2>/dev/null || true
chmod -R go-rwx src node_modules 2>/dev/null || true

rm -f "$INDEX_BACKUP"
trap - EXIT

echo "OK: build+publish tamamlandı."
