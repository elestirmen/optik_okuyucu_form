# ⚡ Optik Form Pro - OMR (Optik İşaret Tanıma) Sistemi

Modern, kullanıcı dostu bir optik form tasarlama ve okuma uygulaması. Canvas tabanlı form oluşturma, yüksek kaliteli PNG çıktısı ve gelişmiş kamera tabanlı OMR okuma özellikleri sunar.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](package.json)

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Kurulum](#-kurulum)
- [Kullanım Kılavuzu](#-kullanım-kılavuzu)
- [Teknik Detaylar](#-teknik-detaylar)
- [API ve Endpoint'ler](#-api-ve-endpointler)
- [Benchmark ve Test](#-benchmark-ve-test)
- [Tarayıcı Desteği](#-tarayıcı-desteği)
- [Sorun Giderme](#-sorun-giderme)
- [Katkıda Bulunma](#-katkıda-bulunma)

## 🎯 Özellikler

### 📝 Form Tasarımı
- **Kompakt ve Profesyonel Tasarım**: Öğrenci numarası, cevap anahtarı ve soru bölümleriyle tam özellikli form
- **Tam Boyut Kontrolü**: Form genişlik/yükseklik, baloncuk boyutu ve satır aralığı ayarlanabilir
- **Çoklu Sütun Desteği**: 1-4 sütun arası soru yerleşimi
- **Yüksek Kaliteli Çıktı**: 1x-4x kalite çarpanı ile PNG export
- **Köşe Marker'ları**: Otomatik köşe işaretleri ile form tespiti
- **QR Kod Entegrasyonu**: Form kimlik doğrulama için QR kod desteği
- **Özelleştirilebilir Parametreler**: Sınav kodu, web adresi ve diğer form özellikleri

### 📷 Optik Okuma (OMR)
- **Gelişmiş Marker Tespiti**: Köşe marker'ları ile güvenilir form algılama
- **Perspektif Düzeltme**: Eğik tutulan formları otomatik düzeltme
- **Adaptif Threshold**: Işık koşullarına dayanıklı analiz
- **Morfolojik İşlemler**: Gürültü temizleme ve iyileştirme
- **Merkez Ağırlıklı Analiz**: Baloncuk tespitinde yüksek doğruluk
- **Otomatik Tarama**: Çoklu kare analizi ile stabilizasyon
- **Dosya Yükleme Desteği**: Kamera yerine resim dosyasından okuma
- **Gölge Modu**: Zorlu ışık koşullarında gelişmiş analiz

### 🔑 Cevap Anahtarı Yönetimi
- **Manuel Giriş**: Soru bazında açılır menü ile cevap seçimi
- **Tarama ile Yükleme**: Cevap anahtarı formunu tarayarak otomatik yükleme
- **Rastgele Anahtar**: Test amaçlı otomatik cevap anahtarı üretimi
- **Durum Takibi**: Eksik/eksiksiz cevap anahtarı göstergesi
- **Temizleme**: Tek tıkla cevap anahtarını sıfırlama

### 📊 Sonuç Yönetimi ve Export
- **Detaylı İstatistikler**: Doğru/Yanlış/Boş/Net skorları
- **Soru Bazında Detay**: Her soru için işaretleme durumu
- **Öğrenci Numarası Okuma**: Otomatik öğrenci numarası tespiti
- **Oturum Yönetimi**: Çoklu form okuma ve kayıt tutma
- **Excel Export**: CSV ve XLSX formatında sonuç indirme
- **TXT Export**: Metin formatında sonuç listesi

## 🚀 Hızlı Başlangıç

### Minimum Gereksinimler
- Node.js >= 14.0.0
- Modern web tarayıcı (Chrome, Firefox, Safari, Edge)
- Kamera erişimi (OMR okuma için)
- İnternet bağlantısı (CDN kütüphaneleri için)

### 5 Dakikada Başlayın

```bash
# 1. Projeyi klonlayın
git clone <repository-url>
cd optik_okuyucu_form

# 2. Bağımlılıkları yükleyin
npm install

# 3. Sunucuyu başlatın
npm start

# 4. Tarayıcıda açın
# http://localhost:3000
```

## 📦 Kurulum

### Yöntem 1: Node.js Sunucusu ile (Önerilen)

1. **Gereksinimleri Kontrol Edin**:
   ```bash
   node --version  # >= 14.0.0 olmalı
   npm --version
   ```

2. **Bağımlılıkları Yükleyin**:
   ```bash
   npm install
   ```

3. **Sunucuyu Başlatın**:
   ```bash
   npm start
   # veya
   npm run dev
   ```

4. **Tarayıcıda Açın**:
   - `http://localhost:3000` adresine gidin
   - HTTPS üzerinden çalıştırmak için proxy kullanın (kamera erişimi için)

### Yöntem 2: Doğrudan Tarayıcıda

1. **Dosyaları İndirin**:
   ```bash
   git clone <repository-url>
   cd optik_okuyucu_form
   ```

2. **index.html'i Açın**:
   - Dosyayı doğrudan tarayıcıda açabilirsiniz
   - **Not**: Kamera erişimi için HTTPS gereklidir
   - Local HTTPS için `http-server` veya benzeri araçlar kullanabilirsiniz

### Yöntem 3: Production Deployment

```bash
# Environment değişkeni ile port ayarlama
PORT=8080 npm start

# PM2 ile production modu
pm2 start server.js --name optik-form
```

## 📖 Kullanım Kılavuzu

### Form Oluşturma

#### 1. Form Parametrelerini Ayarlayın

**Temel Ayarlar**:
- **Soru Sayısı**: 1-200 arası
- **Şık Sayısı**: 4 (A-D) veya 5 (A-E)
- **Soru Sütunu**: 1-4 arası sütun düzeni
- **Öğrenci No Hane**: 4-15 arası hane sayısı

**Görsel Ayarlar**:
- **Form Genişlik**: 300-1200 px
- **Form Yükseklik**: 400-2000 px
- **Baloncuk Boyutu**: 8-24 px
- **Satır Aralığı**: 1-20 px

**Kalite Ayarları**:
- **Kalite Çarpanı**: 
  - 1x: Hızlı, düşük kalite (önizleme için)
  - 2x: Normal kalite (önerilen)
  - 3x: Yüksek kalite (yazdırma için)
  - 4x: Çok yüksek kalite (profesyonel baskı)

**Diğer Ayarlar**:
- **Harf Tekrar**: Kaç soruda bir A B C D E harfleri tekrarlansın (3-20)
- **Cevap Anahtarı**: Form üzerinde göster/gizle
- **Anahtar Şık**: Cevap anahtarı için şık sayısı (4-10)
- **Sınav Kodu**: Form üzerinde gösterilecek kod
- **Web Adresi**: QR kodun altında gösterilecek adres

#### 2. Formu Oluşturun

1. "🔄 Oluştur" butonuna tıklayın
2. Canvas üzerinde önizlemeyi kontrol edin
3. Gerekirse parametreleri ayarlayıp tekrar oluşturun

#### 3. İndirin veya Yazdırın

- **PNG İndir**: Yüksek kaliteli resim dosyası olarak kaydedin
- **Yazdır**: Tarayıcı yazdırma penceresi ile çıktı alın
  - Yazdırma için 3x veya 4x kalite çarpanı önerilir

### Cevap Anahtarı Girişi

#### Manuel Giriş

1. **Oku** sekmesine geçin
2. "Anahtar Kaynağı" olarak "Manuel Giriş" seçin
3. Soru sayısını kontrol edin (form ile eşleşmeli)
4. "📋 Anahtar Tablosu Oluştur" butonuna tıklayın
5. Her soru için açılır menüden doğru cevabı seçin
6. Durum göstergesi yeşil olana kadar devam edin
7. İsterseniz "🎲 Rastgele" ile test anahtarı oluşturun
8. "🗑️ Temizle" ile tüm cevapları sıfırlayın

#### Tarama ile Yükleme

1. **Oku** sekmesine geçin
2. "Anahtar Kaynağı" olarak "Tarayarak Yükle" seçin
3. Kamerayı başlatın ("📷 Kamerayı Başlat")
4. İşaretlenmiş cevap anahtarı formunu kameraya gösterin
5. Köşe marker'larının görünür olduğundan emin olun
6. "📷 Cevap Anahtarı Tara" butonuna tıklayın
7. Sistem otomatik olarak cevapları okur ve kaydeder
8. Durum göstergesi yeşil olursa başarılıdır

### Öğrenci Formu Okuma

#### Kamera ile Okuma

1. **Kamerayı Başlatın**:
   - "📷 Kamerayı Başlat" butonuna tıklayın
   - Kamera izni verin
   - Gerekirse kamera seçin (ön/arka)

2. **Formu Tarayın**:
   - Formu köşe marker'ları görünecek şekilde hizalayın
   - İyi aydınlatma altında tutun
   - "📸 Öğrenci Formu Tara" ile manuel tarama
   - "🔄 Otomatik" ile sürekli tarama modu

3. **Sonuçları İnceleyin**:
   - Doğru/Yanlış/Boş/Net skorları
   - Soru bazında detaylı sonuçlar
   - Öğrenci numarası okuma sonucu
   - İşlenmiş görüntüler (Yakalanan, Marker, Düzeltilmiş)

#### Dosyadan Okuma

1. **Kaynak Seçin**:
   - "Kaynak" menüsünden "📁 Dosyadan Yükle" seçin

2. **Resim Yükleyin**:
   - "📁 Resim Seç" butonuna tıklayın
   - PNG, JPG veya JPEG formatında form resmi seçin

3. **Analiz Edin**:
   - "🔍 Formu Analiz Et" butonuna tıklayın
   - Sonuçlar otomatik olarak gösterilir

### Sonuç Yönetimi

#### Oturum Kayıtları

- Her başarılı okuma otomatik olarak oturum listesine eklenir
- Oturum sayısı "X kayit" şeklinde gösterilir
- Her kayıt şunları içerir:
  - Öğrenci numarası
  - Doğru/Yanlış/Boş/Net skorları
  - Tarih ve saat

#### Export İşlemleri

1. **TXT Listesi**: Metin formatında sonuç listesi
2. **Excel (CSV)**: CSV formatında Excel uyumlu dosya
3. **Excel (XLSX)**: XLSX formatında tam Excel dosyası
   - Sağ tıklayarak kayıt dizini seçebilirsiniz

### OMR Ayarları

#### Doluluk Eşiği (Fill Threshold)

- **Aralık**: 0.1 - 0.9
- **Varsayılan**: 0.20
- **Açıklama**: Baloncuk dolu kabul edilme oranı
  - Daha yüksek değer = daha katı kontrol
  - Düşük ışıkta: 0.18-0.22
  - Normal ışıkta: 0.20-0.24
  - Parlak ışıkta: 0.24-0.28

#### Yanlış Cezası (Penalty)

- **Aralık**: 0 - 1
- **Varsayılan**: 0.25
- **Açıklama**: Yanlış cevap için net puan düşüşü
  - 0.25 = Her yanlış cevap 0.25 puan düşürür
  - 0 = Yanlış cevap cezasız
  - 1 = Her yanlış cevap 1 puan düşürür

#### Gölge Modu

- Zorlu ışık koşullarında kullanın
- Gölge ve parlama sorunlarını azaltır
- Performansı biraz düşürebilir

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler

#### Frontend
- **HTML5 Canvas**: Form çizimi ve render
- **OpenCV.js**: Görüntü işleme ve OMR analizi
- **jsQR**: QR kod okuma
- **QRCode.js**: QR kod oluşturma
- **SheetJS (XLSX)**: Excel dosya oluşturma

#### Backend
- **Express.js**: Web sunucusu
- **Node.js**: Runtime ortamı

#### CDN Kütüphaneleri
- OpenCV.js: `https://docs.opencv.org/4.x/opencv.js`
- jsQR: `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js`
- QRCode.js: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
- SheetJS: `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`

### OMR Algoritması

#### 1. Görüntü Yakalama
- Video akışından frame yakalama
- Dosya yükleme desteği
- Canvas üzerinde işleme

#### 2. Ön İşleme
- Grayscale dönüşümü
- Gaussian blur (gürültü azaltma)
- Adaptive threshold (ışık koşullarına uyum)
- Morfolojik işlemler (açma/kapama)

#### 3. Marker Tespiti
- Köşe marker'larını bulma
- L-şekli marker doğrulama
- Perspektif noktaları hesaplama
- Marker kalite kontrolü

#### 4. Perspektif Düzeltme
- Homography matrisi hesaplama
- Warp transformation uygulama
- Formu düz görünüme dönüştürme
- Çözünürlük normalizasyonu

#### 5. Baloncuk Analizi
- Normalize koordinat sistemi (0-1 arası)
- Her baloncuk için ROI (Region of Interest) hesaplama
- Merkez ağırlıklı doluluk analizi
- Threshold ile dolu/boş kararı

#### 6. Sonuç Hesaplama
- Cevap anahtarı ile karşılaştırma
- Doğru/Yanlış/Boş/Çoklu işaretleme tespiti
- Net puan hesaplama (yanlış ceza ile)
- Öğrenci numarası okuma

### Koordinat Sistemi

- **Normalize Koordinatlar**: Tüm koordinatlar 0-1 arası normalize edilmiş
- **Bağımsızlık**: Form boyutu değişse bile OMR doğru çalışır
- **Scale Faktörü**: Sadece görsel kaliteyi etkiler, OMR'ı etkilemez
- **Marker Bazlı**: Marker pozisyonlarına göre dinamik hesaplama

### Form Yapısı

#### Üst Bölüm
- **QR Kod**: Form kimlik doğrulama için (sol üst)
- **Web Adresi**: QR kodun altında gösterilir
- **Öğrenci Numarası**: 
  - Yatay düzen
  - Sütunlar: hane numaraları (1, 2, 3, ...)
  - Satırlar: rakamlar (0-9)
- **Cevap Anahtarı** (Opsiyonel): 
  - Dikey A-J baloncukları
  - Sağ üst köşede

#### Soru Bölümü
- **Sütun Başlıkları**: Her sütunun üstünde A B C D E harfleri
- **Periyodik Tekrar**: Her N soruda bir harf başlıkları tekrarlanır
- **Soru Numaraları**: Her sorunun solunda numara
- **Baloncuklar**: Her şık için dairesel işaretleme alanı

#### Köşe Marker'ları
- Formun 4 köşesinde siyah kareler
- İç köşelerde beyaz kareler (L-şekli)
- Kamera ile form tespiti için kritik
- Perspektif düzeltme için referans noktaları

## 🌐 API ve Endpoint'ler

### Express Sunucusu

#### GET `/`
- Ana sayfa (index.html)
- Statik dosya servisi

#### GET `/health`
- Health check endpoint
- Response: `{ status: 'ok', timestamp: '...' }`

#### Statik Dosyalar
- `/assets/*`: CSS ve JavaScript dosyaları
- Tüm statik dosyalar `express.static` ile servis edilir

### Port Yapılandırması

- **Varsayılan Port**: 3000
- **Environment Variable**: `PORT` ile değiştirilebilir
- **Örnek**: `PORT=8080 npm start`

## 🧪 Benchmark ve Test

Proje, sistematik OMR performans testleri için benchmark araçları içerir.

### Benchmark Yapısı

```
benchmarks/
├── README.md              # Benchmark kılavuzu
├── benchmark-plan.md      # Test senaryoları planı
├── generate_variations.py # Varyasyon üretimi
├── process_variations.py # Otomatik işleme
├── select_best.py        # En iyi parametre seçimi
├── run_omr_benchmark.js  # Playwright tabanlı test
├── input/                # Test görüntüleri
├── output/               # Üretilen varyasyonlar
└── results.csv           # Test sonuçları
```

### Benchmark Senaryoları

- **A1-A2**: İyi ışık, farklı eğiklik açıları
- **B1-B2**: Orta ışık, motion blur, crop
- **C1-C2**: Düşük ışık, noise, parlama
- **D1-D2**: Sert ışık, yüksek kontrast, gölge
- **E1-E2**: Aşırı eğik, crop
- **F1-F2**: Motion blur, kirli kağıt

### Benchmark Çalıştırma

Detaylı bilgi için `benchmarks/README.md` dosyasına bakın.

```bash
# 1. Referans formu hazırla
# index.html üzerinden 2x kaliteyle doldurulmuş form PNG'si üret

# 2. Varyasyonları üret
python3 benchmarks/generate_variations.py \
  --input benchmarks/input/filled-base.png \
  --out benchmarks/output \
  --per 8 \
  --results benchmarks/results.csv

# 3. Otomatik işleme (opsiyonel)
python3 benchmarks/process_variations.py

# 4. En iyi parametreyi seç
python3 benchmarks/select_best.py --csv benchmarks/results.csv
```

### Test Gereksinimleri

```bash
pip install opencv-python numpy
npm install playwright
```

## 🌐 Tarayıcı Desteği

### Tam Destek
- ✅ **Chrome/Edge** (önerilen) - En iyi performans
- ✅ **Firefox** - Tam destek
- ✅ **Safari** - iOS/macOS için uyumlu

### Kısmi Destek
- ⚠️ **Opera** - Çoğu özellik çalışır

### Desteklenmiyor
- ❌ **Internet Explorer** - Modern API'ler desteklenmiyor

### Tarayıcı Özellikleri

#### Gerekli API'ler
- **getUserMedia**: Kamera erişimi
- **Canvas API**: Form çizimi
- **File API**: Dosya yükleme
- **Web Workers**: (opsiyonel, performans için)

#### Önerilen Ayarlar
- JavaScript etkin olmalı
- Kamera izni verilmeli
- HTTPS üzerinden çalıştırılmalı (kamera için)

## ⚠️ Sorun Giderme

### Kamera Sorunları

#### Kamera Açılmıyor
- **Çözüm 1**: HTTPS üzerinden çalıştırın (localhost hariç)
- **Çözüm 2**: Tarayıcı izinlerini kontrol edin
- **Çözüm 3**: Farklı bir kamera seçin
- **Çözüm 4**: Dosyadan yükleme kullanın

#### Marker Tespit Edilmiyor
- **Çözüm 1**: Işık koşullarını iyileştirin
- **Çözüm 2**: Formu düz tutun, köşe marker'ları görünür olsun
- **Çözüm 3**: Formu kameraya yaklaştırın/uzaklaştırın
- **Çözüm 4**: Gölge modunu aktif edin

### Form Okuma Sorunları

#### Yanlış Okuma
- **Çözüm 1**: Doluluk eşiğini ayarlayın (0.18-0.28 arası)
- **Çözüm 2**: Işık koşullarını iyileştirin
- **Çözüm 3**: Formu daha düz tutun
- **Çözüm 4**: Gölge modunu deneyin

#### Öğrenci Numarası Okunmuyor
- **Çözüm 1**: Öğrenci numarası bölümünün net göründüğünden emin olun
- **Çözüm 2**: Formu yeniden tarayın
- **Çözüm 3**: Marker tespitinin başarılı olduğunu kontrol edin

### Performans Sorunları

#### Yavaş İşleme
- **Çözüm 1**: Kalite çarpanını düşürün (1x veya 2x)
- **Çözüm 2**: Otomatik taramayı kapatın
- **Çözüm 3**: Tarayıcıyı yeniden başlatın

#### Bellek Sorunları
- **Çözüm 1**: Oturum kayıtlarını temizleyin
- **Çözüm 2**: Tarayıcı sekmesini yenileyin
- **Çözüm 3**: Daha az soru sayısı kullanın

### Sunucu Sorunları

#### Port Zaten Kullanılıyor
```bash
# Farklı port kullan
PORT=8080 npm start

# Veya kullanan process'i bul
lsof -i :3000
kill -9 <PID>
```

#### Bağımlılık Hataları
```bash
# node_modules'ı temizle ve yeniden yükle
rm -rf node_modules package-lock.json
npm install
```

### Export Sorunları

#### Excel Dosyası Açılmıyor
- **Çözüm 1**: XLSX formatını kullanın (CSV yerine)
- **Çözüm 2**: Farklı bir Excel programı deneyin
- **Çözüm 3**: Dosya adında özel karakter olmadığından emin olun

## 📝 Kullanım Senaryoları

### Eğitim Sektörü
- **Sınav Değerlendirme**: Çoktan seçmeli sınavların hızlı değerlendirilmesi
- **Anket Analizi**: Öğrenci memnuniyet anketleri
- **Test Sonuçları**: Düzenli testlerin otomatik değerlendirilmesi
- **Yerleştirme Sınavları**: Büyük ölçekli sınavların değerlendirilmesi

### İşletme
- **Müşteri Memnuniyet Anketleri**: Hızlı geri bildirim toplama
- **Çalışan Değerlendirmeleri**: Performans değerlendirme formları
- **Toplantı Oylamaları**: Hızlı karar alma süreçleri
- **Kalite Kontrol**: Ürün/hizmet değerlendirme formları

### Araştırma
- **Anket Çalışmaları**: Büyük örneklemli araştırmalar
- **Veri Toplama**: Saha çalışmalarında hızlı veri girişi
- **Test ve Ölçekler**: Psikolojik testlerin değerlendirilmesi

## 🔄 Güncellemeler

### v2.0.0 (Mevcut)
- ✅ Canvas tabanlı form çizimi
- ✅ Yüksek kaliteli PNG export
- ✅ Cevap anahtarı yönetimi
- ✅ Tarama ile cevap anahtarı yükleme
- ✅ Periyodik harf başlıkları
- ✅ Gelişmiş OMR algoritması
- ✅ Excel export (CSV ve XLSX)
- ✅ Oturum yönetimi
- ✅ Dosyadan okuma desteği
- ✅ Gölge modu
- ✅ Benchmark araçları

### Gelecek Özellikler
- [ ] Çoklu form desteği (toplu işleme)
- [ ] PDF export
- [ ] Veritabanı entegrasyonu
- [ ] Kullanıcı arayüzü iyileştirmeleri
- [ ] Mobil uygulama desteği
- [ ] API endpoint'leri
- [ ] Webhook desteği

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır ve özgürce kullanılabilir.

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları izleyin:

1. **Fork** yapın
2. **Feature branch** oluşturun (`git checkout -b feature/amazing-feature`)
3. **Commit** yapın (`git commit -m 'Add amazing feature'`)
4. **Push** yapın (`git push origin feature/amazing-feature`)
5. **Pull Request** açın

### Katkı Kuralları
- Kod standartlarına uyun
- Testleri çalıştırın
- Dokümantasyonu güncelleyin
- Açıklayıcı commit mesajları yazın

### Hata Bildirimi
- GitHub Issues kullanın
- Sorunu detaylı açıklayın
- Ekran görüntüleri ekleyin
- Tarayıcı ve işletim sistemi bilgisi verin

## 📧 İletişim ve Destek

- **Issues**: GitHub Issues üzerinden hata bildirimi ve öneriler
- **Pull Requests**: Katkılar için PR açabilirsiniz
- **Dokümantasyon**: README.md ve kod içi yorumlar

## 🙏 Teşekkürler

- **OpenCV.js** ekibine görüntü işleme desteği için
- **jsQR** ve **QRCode.js** ekibine QR kod desteği için
- **SheetJS** ekibine Excel export desteği için
- Tüm açık kaynak topluluğuna

---

## 📌 Önemli Notlar

1. **Kamera İzni**: OMR özelliği için kamera erişim izni gereklidir
2. **HTTPS Gereksinimi**: Kamera erişimi için HTTPS üzerinden çalıştırılmalıdır (localhost hariç)
3. **Işık Koşulları**: İyi aydınlatma altında daha doğru sonuçlar alınır
4. **Form Hizalama**: Köşe marker'ları görünür olmalıdır
5. **Cevap Anahtarı**: Öğrenci formlarını okumadan önce cevap anahtarını girmelisiniz
6. **Kalite**: Yazdırma için 3x veya 4x kalite çarpanı kullanın
7. **İnternet Bağlantısı**: CDN kütüphaneleri için internet bağlantısı gereklidir
8. **Tarayıcı Tabanlı**: Bu uygulama tamamen tarayıcı tabanlıdır, sunucu gerektirmez (isteğe bağlı Express sunucusu performans için)

---

**Not**: Bu uygulama tamamen tarayıcı tabanlıdır. Tüm işlemler yerel olarak yapılır, veriler sunucuya gönderilmez. Express sunucusu sadece statik dosya servisi için kullanılır.

**Versiyon**: 2.0.0  
**Son Güncelleme**: 2024
