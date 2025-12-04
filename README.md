# ⚡ Optik Form Pro - OMR (Optik İşaret Tanıma) Sistemi

Modern, kullanıcı dostu bir optik form tasarlama ve okuma uygulaması. Canvas tabanlı form oluşturma, yüksek kaliteli PNG çıktısı ve gelişmiş kamera tabanlı OMR okuma özellikleri sunar.

## 🎯 Özellikler

### 📝 Form Tasarımı
- **Kompakt ve Profesyonel Tasarım**: Öğrenci numarası, cevap anahtarı ve soru bölümleriyle tam özellikli form
- **Tam Boyut Kontrolü**: Form genişlik/yükseklik, baloncuk boyutu ve satır aralığı ayarlanabilir
- **Çoklu Sütun Desteği**: 1-4 sütun arası soru yerleşimi
- **Yüksek Kaliteli Çıktı**: 1x-4x kalite çarpanı ile PNG export
- **Köşe Marker'ları**: Otomatik köşe işaretleri ile form tespiti
- **QR Kod Entegrasyonu**: Form kimlik doğrulama için QR kod desteği

### 📷 Optik Okuma (OMR)
- **Gelişmiş Marker Tespiti**: Köşe marker'ları ile güvenilir form algılama
- **Perspektif Düzeltme**: Eğik tutulan formları otomatik düzeltme
- **Adaptif Threshold**: Işık koşullarına dayanıklı analiz
- **Morfolojik İşlemler**: Gürültü temizleme ve iyileştirme
- **Merkez Ağırlıklı Analiz**: Baloncuk tespitinde yüksek doğruluk
- **Otomatik Tarama**: Çoklu kare analizi ile stabilizasyon

### 🔑 Cevap Anahtarı Yönetimi
- **Manuel Giriş**: Soru bazında açılır menü ile cevap seçimi
- **Tarama ile Yükleme**: Cevap anahtarı formunu tarayarak otomatik yükleme
- **Rastgele Anahtar**: Test amaçlı otomatik cevap anahtarı üretimi
- **Durum Takibi**: Eksik/eksiksiz cevap anahtarı göstergesi

## 🚀 Kullanım

### Form Oluşturma

1. **Form Parametrelerini Ayarlayın**:
   - Soru sayısı (1-200)
   - Şık sayısı (4 veya 5)
   - Sütun sayısı (1-4)
   - Öğrenci numarası hane sayısı (4-15)
   - Form boyutları (genişlik/yükseklik)
   - Baloncuk boyutu ve satır aralığı

2. **Cevap Anahtarı Bölümü** (Opsiyonel):
   - Form üzerinde gösterilecek cevap anahtarı bölümünü etkinleştirin
   - Anahtar şık sayısını belirleyin (A-J arası)

3. **Formu Oluşturun**:
   - "🔄 Oluştur" butonuna tıklayın
   - Önizlemeyi kontrol edin

4. **İndirin veya Yazdırın**:
   - **PNG İndir**: Yüksek kaliteli resim dosyası olarak kaydedin
   - **Yazdır**: Tarayıcı yazdırma penceresi ile çıktı alın

### Cevap Anahtarı Girişi

#### Manuel Giriş
1. **Oku** sekmesine geçin
2. "Anahtar Kaynağı" olarak "Manuel Giriş" seçin
3. "📋 Anahtar Tablosu Oluştur" butonuna tıklayın
4. Her soru için açılır menüden doğru cevabı seçin
5. Durum göstergesi yeşil olana kadar devam edin

#### Tarama ile Yükleme
1. **Oku** sekmesine geçin
2. "Anahtar Kaynağı" olarak "Tarayarak Yükle" seçin
3. Kamerayı başlatın
4. İşaretlenmiş cevap anahtarı formunu kameraya gösterin
5. "📷 Cevap Anahtarı Tara" butonuna tıklayın
6. Sistem otomatik olarak cevapları okur ve kaydeder

### Öğrenci Formu Okuma

1. **Kamerayı Başlatın**:
   - "📷 Başlat" butonuna tıklayın
   - Kamera izni verin

2. **Formu Tarayın**:
   - Formu köşe marker'ları görünecek şekilde hizalayın
   - "📸 Öğrenci Formu Tara" ile manuel tarama
   - "🔄 Otomatik" ile sürekli tarama modu

3. **Sonuçları İnceleyin**:
   - Doğru/Yanlış/Boş/Net skorları
   - Soru bazında detaylı sonuçlar
   - Öğrenci numarası okuma sonucu

## ⚙️ Ayarlar

### Form Ayarları
- **Kalite Çarpanı**: PNG çıktı kalitesi (1x-4x)
  - 1x: Hızlı, düşük kalite
  - 2x: Normal (önerilen)
  - 3x: Yüksek kalite
  - 4x: Çok yüksek kalite (baskı için ideal)

- **Harf Tekrar**: Kaç soruda bir A B C D E harfleri tekrarlansın (3-20)
  - Karışıklığı önlemek için 5 veya daha az önerilir

### OMR Ayarları
- **Doluluk Eşiği**: Baloncuk dolu kabul edilme oranı (0.1-0.9)
  - Daha yüksek değer = daha katı kontrol
  - Varsayılan: 0.28

- **Yanlış Cezası**: Yanlış cevap için net puan düşüşü (0-1)
  - 0.25 = Her yanlış cevap 0.25 puan düşürür
  - Varsayılan: 0.25

## 📋 Form Yapısı

### Üst Bölüm
- **QR Kod**: Form kimlik doğrulama için
- **Web Adresi**: QR kodun altında gösterilir
- **Öğrenci Numarası**: Yatay düzen (sütunlar: hane numaraları, satırlar: 0-9)
- **Cevap Anahtarı** (Opsiyonel): Dikey A-J baloncukları

### Soru Bölümü
- **Sütun Başlıkları**: Her sütunun üstünde A B C D E harfleri
- **Periyodik Tekrar**: Her N soruda bir harf başlıkları tekrarlanır
- **Soru Numaraları**: Her sorunun solunda numara
- **Baloncuklar**: Her şık için dairesel işaretleme alanı

### Köşe Marker'ları
- Formun 4 köşesinde siyah kareler
- İç köşelerde beyaz kareler (L-şekli)
- Kamera ile form tespiti için kritik

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler
- **HTML5 Canvas**: Form çizimi ve render
- **OpenCV.js**: Görüntü işleme ve OMR analizi
- **jsQR**: QR kod okuma
- **QRCode.js**: QR kod oluşturma

### OMR Algoritması
1. **Görüntü Yakalama**: Video akışından frame yakalama
2. **Ön İşleme**: Grayscale dönüşüm, blur, adaptive threshold
3. **Marker Tespiti**: Köşe marker'larını bulma ve doğrulama
4. **Perspektif Düzeltme**: Formu düz görünüme dönüştürme
5. **Baloncuk Analizi**: Her baloncuk için doluluk oranı hesaplama
6. **Sonuç Hesaplama**: Cevap anahtarı ile karşılaştırma ve skorlama

### Koordinat Sistemi
- Tüm koordinatlar normalize edilmiş (0-1 arası)
- Form boyutu değişse bile OMR doğru çalışır
- Scale faktörü sadece görsel kaliteyi etkiler

## 📦 Kurulum

1. **Dosyaları İndirin**:
   ```bash
   git clone <repository-url>
   cd optik_okuyucu
   ```

2. **Tarayıcıda Açın**:
   - `index.html` dosyasını modern bir tarayıcıda açın
   - HTTPS üzerinden çalıştırmanız önerilir (kamera erişimi için)

3. **Bağımlılıklar**:
   - Tüm kütüphaneler CDN üzerinden yüklenir
   - İnternet bağlantısı gereklidir

## 🌐 Tarayıcı Desteği

- ✅ Chrome/Edge (önerilen)
- ✅ Firefox
- ✅ Safari
- ⚠️ Opera
- ❌ Internet Explorer (desteklenmiyor)

## 📝 Kullanım Senaryoları

### Eğitim
- Sınav değerlendirme
- Anket analizi
- Test sonuçları

### İşletme
- Müşteri memnuniyet anketleri
- Çalışan değerlendirmeleri
- Toplantı oylamaları

## ⚠️ Önemli Notlar

1. **Kamera İzni**: OMR özelliği için kamera erişim izni gereklidir
2. **Işık Koşulları**: İyi aydınlatma altında daha doğru sonuçlar alınır
3. **Form Hizalama**: Köşe marker'ları görünür olmalıdır
4. **Cevap Anahtarı**: Öğrenci formlarını okumadan önce cevap anahtarını girmelisiniz
5. **Kalite**: Yazdırma için 3x veya 4x kalite çarpanı kullanın

## 🐛 Bilinen Sorunlar

- Çok düşük ışıkta marker tespiti zorlaşabilir
- Çok küçük formlarda (<300px) bazı elementler taşabilir
- Eski tarayıcılarda Canvas performansı düşük olabilir

## 🔄 Güncellemeler

### v2.0
- Canvas tabanlı form çizimi
- Yüksek kaliteli PNG export
- Cevap anahtarı yönetimi
- Tarama ile cevap anahtarı yükleme
- Periyodik harf başlıkları
- Gelişmiş OMR algoritması

## 📄 Lisans

Bu proje açık kaynak kodludur ve özgürce kullanılabilir.

## 🤝 Katkıda Bulunma

Hata bildirimi ve öneriler için issue açabilirsiniz.

## 📧 İletişim

Sorularınız için issue açabilirsiniz.

---

**Not**: Bu uygulama tamamen tarayıcı tabanlıdır, sunucu gerektirmez. Tüm işlemler yerel olarak yapılır.
