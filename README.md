# Optik Form Tasarla & Oku

Tek sayfalık bir optik form tasarlama ve OpenCV ile okuma aracı. Formu tarayıcıda çiziyor, kamera ile çekip OMR analizini yapıyor.

## Özellikler
- Soru/şık/sütun sayısı ve baloncuk boyutunu ayarlanabilir form üretimi (PNG/PDF).
- Köşe marker’ları ve QR ile hizalama; öğrenci numarası ve cevap anahtarı okuma.
- OpenCV.js ile adaptif threshold ve perspektif düzeltme; otomatik tarama modu.

## Kurulum
1. Bağımlılık: yalnızca tarayıcı + internet (OpenCV/QR CDN) gerekir.
2. Yerel HTTPS sunucusu açmak için (kamera izni için şart):
   ```bash
   # Sertifika üret
   openssl req -x509 -nodes -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

   # HTTPS sunucu (örn. 8443 portu)
   npx http-server -S -C cert.pem -K key.pem -p 8443
   ```
   Alternatif: `ngrok http 8443` ile tünel açıp çıkan `https://` adresini kullanın.

## Kullanım
1. Masaüstü/mobil tarayıcıda `https://<IP>:8443/index.html` adresini açın (aynı ağda).
2. Sertifika uyarısını geçin, kamera izni verin.
3. Tasarım sekmesinde form ayarlarını yapıp `Oluştur` deyin; `PNG indir` veya yazdır ile kaydedin.
4. Okuma sekmesinde kamerayı başlatın, formu hizalayın, `Tara` veya `Otomatik` seçin.
5. Sonuçlar ve öğrenci numarası sağ panelde listelenir; eşik/ceza ayarlarını gerekirse değiştirin.

## Notlar
- Kamera erişimi `file://` veya HTTP’de çalışmaz; HTTPS veya `http://localhost` kullanın.
- OpenCV.js yüklenmeden tarama çalışmaz; başlıktaki rozet “ready” olmalı.
