# OMR Benchmark Plan

Amaç: Farklı ışık, kadraj ve warp koşullarında doldurulmuş formların okunabilirliğini sistematik ölçmek; parametre setlerini karşılaştırıp en güvenilir kombinasyonu seçmek.

## Senaryo Seti
- A1: İyi ışık, tam kadraj, hafif eğik (%2-3 warp), mat kağıt.
- A2: İyi ışık, tam kadraj, belirgin eğik (%8-10 warp), parlama yok.
- B1: Orta ışık (-1 EV), tam kadraj, hafif motion blur (1px), mat kağıt.
- B2: Orta ışık, %5 crop (üstten/sol), eğik %6, parlama yok.
- C1: Düşük ışık (-2 EV), ISO noise eklenmiş, hafif blur, tam kadraj.
- C2: Düşük ışık, parlak hotspot (LED/flash yan yansıması) sol üst, eğik %4.
- D1: Sert ışık (+1 EV), yüksek kontrast gölge kenarı formun bir köşesinden geçiyor.
- D2: Sert ışık, parlama + gölge kombinasyonu, eğik %8.
- E1: Aşırı eğik (%12-15 warp), iyi ışık, mat kağıt.
- E2: Aşırı crop (köşe marker’larının yarısı içeride), iyi ışık.
- F1: Kamera motion blur (2-3px), iyi ışık.
- F2: Hafif kir/lekeli kağıt, iyi ışık, hafif eğik.

## Parametre Grid’i
Karşılaştırılacak temel parametreler (her testte kaydedin):
- fillThreshold: 0.18, 0.20, 0.24, 0.28
- BLANK_GUARD (kodda sabit): 0.12, 0.18, 0.22 (gerekirse kodda oynatılıp tekrar ölçülür)
- FILL_ROI_SCALE: 1.00, 1.04, 1.08
- FILL_MASK_RATIO: 0.28, 0.32, 0.38
- adaptiveThreshold blok boyutu: 11, 13, 15 (kodda cv.adaptiveThreshold parametresi)

**Önerilen başlangıç seti (baseline)**: `fillThreshold=0.20`, `BLANK_GUARD=0.18`, `FILL_ROI_SCALE=1.04`, `FILL_MASK_RATIO=0.32`, adaptive block=11, penalty=0.25.

## Ölçütler
- Doğruluk: Doğru/yanlış/boş oranları; çoklu işaret sayısı.
- Şüpheli yakalama: Şüpheli uyarısı verdiği soruların gerçek hatalı okuma ile çakışma oranı (yüksek olmalı).
- Marker tespiti: Başarısız warp/marker hatası sayısı (düşük olmalı).
- Öğrenci no: `?` içeren hane sayısı.

Başarı kriteri: Her senaryoda marker tespitinin >%95, doğru okumanın >%97 (C/D/E/F senaryolarında >%90) ve şüpheli uyarılarının yanlış pozitif oranının <%5 olması.

## Varyasyon Üretimi (Simülasyon)
- Form PNG: `index.html`’den 2x kaliteyle alınan referans form ve doğru cevap seti.
- Sentez: OpenCV ile
  - Gamma/brightness: EV +/- {0, 1, 2}
  - Gaussian blur: sigma {0, 1, 1.5}
  - Motion blur: 5-15px yatay/dikey
  - Noise: Gaussian 5-10%
  - Perspective warp: rastgele dört köşe jitter (2%-15%)
  - Crop: üst/alt/sol/sağ %0, %5, %10 (marker kaybı testi)
  - Parlama: dairesel/oval beyaz gradient maske (10-30% alan)
  - Gölge: yarı saydam siyah gradient

## Manuel / Otomasyon
- Otomatik üretim için Python/OpenCV taslağı: referans formu oku, yukarıdaki varyasyonları oluştur, her varyasyon için beklenen cevap anahtarıyla çalıştır (tarayıcıda OMR kodunu çağırmak için playwright veya puppeteer kullanılabilir).
- Eğer otomasyon yoksa: her senaryo için oluşturulan görüntüleri `benchmarks/images/<senaryo>/<varyasyon>.png` altına koyup tarayıcıda elle sırayla okutun, sonuçları tabloya işleyin.

## Raporlama Şablonu
- CSV/Markdown tablo sütunları: `Senaryo, Varyasyon, fillThreshold, ROI_SCALE, MASK_RATIO, BlockSize, Dogru, Yanlis, Bos, Coklu, SupheliFlag, SupheliNeden, MarkerBasari(OK/FAIL), OgrNoSupheli(OK/FAIL)`.
- En iyi kombinasyonu seçmek için doğruluk puanı (Doğru/(Doğru+Yanlış)) + şüpheli yakalama puanı (şüpheli uyarısı verilen sorulardan kaçının gerçekten hatalı olduğu) ile sıralayın.

## Başlangıç Önerisi (parametre sonucu)
Saha denemeleri için önce iki seti deneyin:
1) **Standart**: threshold 0.20, ROI_SCALE 1.04, MASK 0.32, block 11 — parlama ve orta ışık için dengeli.
2) **Düşük ışık / noise**: threshold 0.24, ROI_SCALE 1.08, MASK 0.28, block 13 — gürültüye karşı daha seçici.

Hangisi senaryoların çoğunda >%97 doğruluk sağlıyorsa onu “varsayılan” kabul edin, diğerini “Düşük ışık modu” olarak Ayarlar’a ekleyin.
