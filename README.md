# ⚡ Optik Form Pro - OMR (Optik İşaret Tanıma) Sistemi

Modern, kullanıcı dostu bir optik form tasarlama ve okuma uygulaması. Canvas tabanlı form oluşturma, yüksek kaliteli PNG çıktısı ve gelişmiş kamera tabanlı OMR okuma özellikleri sunar.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

---

## 📋 İçindekiler

- [Giriş](#-giriş)
- [Özellikler](#-özellikler)
- [Kurulum Rehberi](#-kurulum-rehberi)
- [Başlangıç Tutorial'ı](#-başlangıç-tutorialı)
- [Detaylı Kullanım Kılavuzu](#-detaylı-kullanım-kılavuzu)
- [Pratik Senaryolar](#-pratik-senaryolar)
- [Teknik Detaylar](#-teknik-detaylar)
- [Sorun Giderme Rehberi](#-sorun-giderme-rehberi)
- [Sık Sorulan Sorular](#-sık-sorulan-sorular)
- [API ve Endpoint'ler](#-api-ve-endpointler)
- [Benchmark ve Test](#-benchmark-ve-test)
- [Katkıda Bulunma](#-katkıda-bulunma)

---

## 🎯 Giriş

Optik Form Pro, eğitim kurumları, işletmeler ve araştırmacılar için tasarlanmış profesyonel bir optik form tasarlama ve okuma sistemidir. Bu sistem sayesinde:

- ✅ Çoktan seçmeli sınav formları tasarlayabilirsiniz
- ✅ Kamera veya dosya ile formları otomatik okuyabilirsiniz
- ✅ Sonuçları Excel formatında export edebilirsiniz
- ✅ Tüm işlemler tarayıcıda, sunucu gerektirmeden çalışır

### Kimler Kullanabilir?

- **Eğitimciler**: Sınav değerlendirme, test analizi
- **İşletmeler**: Anket değerlendirme, müşteri memnuniyeti
- **Araştırmacılar**: Veri toplama, anket çalışmaları
- **Öğrenciler**: Kendi testlerini oluşturma ve değerlendirme

---

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

---

## 📦 Kurulum Rehberi

### Minimum Gereksinimler

- **Node.js**: 18.x (veya >= 20.0.0)
- **npm**: Herhangi bir versiyon (Node.js ile birlikte gelir)
- **Modern Web Tarayıcı**: Chrome, Firefox, Safari veya Edge
- **Kamera**: OMR okuma için (opsiyonel, dosyadan okuma da mümkün)
- **İnternet Bağlantısı**: CDN kütüphaneleri için (ilk yüklemede)

### Adım 1: Sistem Gereksinimlerini Kontrol Edin

Terminal veya komut satırını açın ve şu komutları çalıştırın:

```bash
# Node.js versiyonunu kontrol edin
node --version
# v18.0.0 veya üzeri olmalı (Node 20+ önerilir)

# npm versiyonunu kontrol edin
npm --version
# Herhangi bir versiyon yeterli
```

**Sorun mu var?**
- Node.js yüklü değilse: [nodejs.org](https://nodejs.org/) adresinden indirin
- Versiyon düşükse: Node.js'i güncelleyin

### Adım 2: Projeyi İndirin

#### Yöntem A: Git ile (Önerilen)

```bash
# Projeyi klonlayın
git clone <repository-url>
cd optik_okuyucu_form
```

#### Yöntem B: ZIP İndirme

1. Projeyi ZIP olarak indirin
2. ZIP dosyasını açın
3. Terminal'de klasöre gidin:
   ```bash
   cd optik_okuyucu_form
   ```

### Adım 3: Bağımlılıkları Yükleyin

```bash
# Bağımlılıkları yükleyin (bu işlem birkaç dakika sürebilir)
npm install
```

**Ne oluyor?**
- `npm install` komutu `package.json` dosyasındaki tüm bağımlılıkları indirir
- İlk kez çalıştırıyorsanız biraz zaman alabilir
- İnternet bağlantınızın aktif olduğundan emin olun

**Hata mı aldınız?**
- İnternet bağlantınızı kontrol edin
- `npm cache clean --force` komutunu çalıştırıp tekrar deneyin
- Node.js versiyonunuzu kontrol edin

### Adım 4: Sunucuyu Başlatın

```bash
# Geliştirme modunda başlatın
npm start

# veya

npm run dev
```

**Başarılı başlatma mesajı:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### Adım 5: Tarayıcıda Açın

1. Tarayıcınızı açın (Chrome önerilir)
2. Adres çubuğuna şunu yazın: `http://localhost:3000`
3. Enter'a basın

**İlk açılışta görecekleriniz:**
- Üstte "⚡ Optik Form Pro" başlığı
- "OpenCV..." durum göstergesi (birkaç saniye içinde "✓ OpenCV" olacak)
- İki sekme: "📝 Tasarla" ve "📷 Oku"

---

## 🚀 Başlangıç Tutorial'ı

Bu tutorial, ilk formunuzu oluşturup okumak için gereken tüm adımları gösterir.

### Senaryo: 30 Soruluk Bir Test Formu Oluşturma

#### Bölüm 1: Form Oluşturma (5 dakika)

**Adım 1.1: Form Ayarlarını Yapın**

1. Tarayıcıda `http://localhost:3000` adresini açın
2. "📝 Tasarla" sekmesinin aktif olduğundan emin olun
3. Sol paneldeki "⚙️ Form Ayarları" bölümünde şu değerleri girin:

   ```
   Soru Sayısı: 30
   Şık Sayısı: 5 (A-E)
   Soru Sütunu: 2
   Öğr. No Hane: 10
   Cevap Anahtarı: Göster
   Anahtar Şık: 10
   ```

**Adım 1.2: Görsel Ayarları Yapın**

Aynı panelde aşağı kaydırın ve şu değerleri ayarlayın:

   ```
   Form Genişlik: 800
   Form Yükseklik: 1200
   Baloncuk Boyutu: 14
   Satır Aralığı: 4
   ```

**Adım 1.3: Kalite ve Diğer Ayarlar**

   ```
   Kalite Çarpanı: 2x (Normal kalite - önerilen)
   Harf Tekrar: 5 (Her 5 soruda bir A-E harfleri tekrarlanır)
   Sınav Kodu: MAT101
   Web Adresi: https://example.com
   ```

**Adım 1.4: Formu Oluşturun**

1. "🔄 Oluştur" butonuna tıklayın
2. Sağ taraftaki canvas'ta formunuzun önizlemesini göreceksiniz
3. Form şunları içermelidir:
   - Sol üstte QR kod
   - QR kodun altında web adresi
   - Öğrenci numarası bölümü (10 haneli)
   - Sağ üstte cevap anahtarı (A-J)
   - 30 soru, 2 sütunda, her soru 5 şık (A-E)

**Adım 1.5: Formu İndirin**

1. "📥 PNG İndir" butonuna tıklayın
2. Dosya indirme klasörünüze kaydedilecek
3. Dosya adı: `optik-form-YYYY-MM-DD-HH-MM-SS.png` formatında olacak

**Adım 1.6: Formu Yazdırın (Opsiyonel)**

1. "🖨️ Yazdır" butonuna tıklayın
2. Yazdırma ayarlarını kontrol edin:
   - Kağıt boyutu: A4
   - Kenar boşlukları: Minimum
   - Ölçek: %100
3. Yazdırın

**✅ Kontrol Listesi:**
- [ ] Form düzgün görünüyor mu?
- [ ] Tüm köşelerde marker'lar var mı?
- [ ] Soru numaraları görünüyor mu?
- [ ] Baloncuklar net mi?

#### Bölüm 2: Cevap Anahtarı Girişi (3 dakika)

**Adım 2.1: Oku Sekmesine Geçin**

1. Üstteki "📷 Oku" sekmesine tıklayın
2. Sol panelde "Anahtar Kaynağı" bölümünü bulun

**Adım 2.2: Manuel Cevap Anahtarı Girişi**

1. "Anahtar Kaynağı" menüsünden "Manuel Giriş" seçin
2. "Soru Sayısı" alanına `30` yazın (form ile eşleşmeli)
3. "📋 Anahtar Tablosu Oluştur" butonuna tıklayın
4. Açılan tabloda her soru için doğru cevabı seçin:

   ```
   Soru 1: A
   Soru 2: B
   Soru 3: C
   Soru 4: D
   Soru 5: E
   ... (örnek olarak)
   ```

5. Her soru için açılır menüden cevabı seçin
6. Durum göstergesi yeşil olana kadar devam edin (tüm sorular doldurulmalı)

**Alternatif: Rastgele Anahtar Oluşturma (Test İçin)**

1. "🎲 Rastgele" butonuna tıklayın
2. Tüm sorular için rastgele cevaplar oluşturulacak
3. İsterseniz manuel olarak düzenleyebilirsiniz

**Adım 2.3: Cevap Anahtarını Doğrulayın**

1. Durum göstergesini kontrol edin:
   - 🔴 Kırmızı: Eksik cevaplar var
   - 🟢 Yeşil: Tüm cevaplar girildi
2. Tabloyu gözden geçirin
3. Hatalı cevapları düzeltin

**✅ Kontrol Listesi:**
- [ ] Tüm 30 soru için cevap girildi mi?
- [ ] Durum göstergesi yeşil mi?
- [ ] Cevap anahtarı doğru mu?

#### Bölüm 3: Form Okuma (5 dakika)

**Adım 3.1: Kamerayı Hazırlayın**

1. "Kaynak" menüsünden "📷 Kameradan Oku" seçin
2. "📷 Kamerayı Başlat" butonuna tıklayın
3. Tarayıcı kamera izni isteyecek → "İzin Ver" seçin
4. Kamera görüntüsü ekranda görünecek

**Adım 3.2: Formu Hazırlayın**

1. Yazdırdığınız formu alın
2. Formu doldurun (test amaçlı):
   - Öğrenci numarasını işaretleyin (örn: 1234567890)
   - Bazı soruları işaretleyin
   - Bazı soruları boş bırakın

**Adım 3.3: Formu Tarayın**

1. Formu kameraya gösterin
2. **Önemli**: Köşe marker'larının görünür olduğundan emin olun
3. Formu düz tutun (eğik olmamalı)
4. İyi aydınlatma altında tutun
5. "📸 Öğrenci Formu Tara" butonuna tıklayın

**Adım 3.4: Sonuçları İnceleyin**

Başarılı taramada şunları göreceksiniz:

1. **Özet İstatistikler**:
   ```
   Doğru: X
   Yanlış: Y
   Boş: Z
   Net: W
   ```

2. **Öğrenci Numarası**: Okunan numara

3. **Soru Detayları**: Her soru için:
   - İşaretlenen şık
   - Doğru/Yanlış/Boş durumu
   - Renk kodlaması (yeşil: doğru, kırmızı: yanlış, gri: boş)

4. **İşlenmiş Görüntüler**:
   - Yakalanan: Orijinal görüntü
   - Marker: Marker tespiti
   - Düzeltilmiş: Perspektif düzeltilmiş görüntü

**Adım 3.5: Oturum Kaydını Kontrol Edin**

1. Sağ altta "Oturum Kayıtları" bölümünü bulun
2. Okunan form otomatik olarak listeye eklenmiş olmalı
3. Her kayıt şunları içerir:
   - Öğrenci numarası
   - Skorlar
   - Tarih/saat

**✅ Kontrol Listesi:**
- [ ] Form başarıyla okundu mu?
- [ ] Öğrenci numarası doğru mu?
- [ ] Skorlar mantıklı mı?
- [ ] Kayıt oturum listesine eklendi mi?

#### Bölüm 4: Sonuçları Export Etme (2 dakika)

**Adım 4.1: Export Formatını Seçin**

1. "Oturum Kayıtları" bölümünde export butonlarını bulun
2. Üç seçenek var:
   - **TXT Listesi**: Metin formatı
   - **Excel (CSV)**: Excel uyumlu CSV
   - **Excel (XLSX)**: Tam Excel dosyası (önerilen)

**Adım 4.2: Excel Dosyasını İndirin**

1. "📊 Excel (XLSX)" butonuna sağ tıklayın
2. "Farklı kaydet" veya "Save as" seçin
3. Dosya adını girin (örn: `sinav-sonuclari.xlsx`)
4. Kaydedin

**Adım 4.3: Excel Dosyasını Açın**

1. Excel veya Google Sheets'te dosyayı açın
2. Şu sütunları göreceksiniz:
   - Öğrenci No
   - Doğru
   - Yanlış
   - Boş
   - Net
   - Tarih/Saat

**✅ Kontrol Listesi:**
- [ ] Dosya başarıyla indirildi mi?
- [ ] Excel'de açılabiliyor mu?
- [ ] Tüm kayıtlar var mı?

---

## 📖 Detaylı Kullanım Kılavuzu

### Form Oluşturma - Detaylı Rehber

#### 1. Form Parametreleri - Açıklamalı

**Temel Ayarlar:**

| Parametre | Açıklama | Önerilen Değer | Notlar |
|-----------|----------|----------------|--------|
| **Soru Sayısı** | Formdaki toplam soru sayısı | 20-50 | 1-200 arası. Çok fazla soru formu uzatır. |
| **Şık Sayısı** | Her sorudaki seçenek sayısı | 4 veya 5 | 4 şık: A-D, 5 şık: A-E |
| **Soru Sütunu** | Soruların kaç sütunda gösterileceği | 2 | 1-4 arası. 2 sütun dengeli görünüm sağlar. |
| **Öğr. No Hane** | Öğrenci numarası için hane sayısı | 10 | 4-15 arası. Okul sisteminize göre ayarlayın. |

**Görsel Ayarlar:**

| Parametre | Açıklama | Önerilen Değer | Notlar |
|-----------|----------|----------------|--------|
| **Form Genişlik** | Formun piksel cinsinden genişliği | 800 | 300-1200 arası. A4 için 800-900 ideal. |
| **Form Yükseklik** | Formun piksel cinsinden yüksekliği | 1200 | 400-2000 arası. Soru sayısına göre artar. |
| **Baloncuk Boyutu** | İşaretleme baloncuklarının çapı (px) | 14 | 8-24 arası. 14-16 ideal okuma için. |
| **Satır Aralığı** | Sorular arası boşluk (px) | 4 | 1-20 arası. 4-6 okunabilirlik için iyi. |

**Kalite Ayarları:**

| Kalite | Kullanım Amacı | Dosya Boyutu | İşlem Süresi |
|--------|----------------|--------------|--------------|
| **1x** | Hızlı önizleme | Küçük | Çok hızlı |
| **2x** | Normal kullanım (önerilen) | Orta | Hızlı |
| **3x** | Yazdırma için | Büyük | Orta |
| **4x** | Profesyonel baskı | Çok büyük | Yavaş |

**Diğer Ayarlar:**

- **Harf Tekrar**: Her kaç soruda bir A B C D E harfleri tekrarlansın
  - Örnek: 5 → Her 5 soruda bir harf başlıkları tekrarlanır
  - Uzun formlarda kullanıcı dostu
  - 3-20 arası değer

- **Cevap Anahtarı**: Form üzerinde cevap anahtarı gösterilsin mi?
  - Göster: Form sağ üstünde A-J baloncukları görünür
  - Gizle: Cevap anahtarı görünmez (güvenlik için)

- **Anahtar Şık**: Cevap anahtarı için şık sayısı
  - Genelde soru şık sayısından fazla olur
  - 4-10 arası

- **Sınav Kodu**: Form üzerinde gösterilecek kod
  - Örnek: MAT101, FIZ201
  - Boş bırakılabilir

- **Web Adresi**: QR kodun altında gösterilecek adres
  - Örnek: https://example.com/sinav
  - Boş bırakılabilir

#### 2. Form Oluşturma İşlemi - Adım Adım

**Adım 1: Parametreleri Ayarlayın**

1. Tüm parametreleri yukarıdaki tablolara göre ayarlayın
2. Değerleri tek tek girin veya varsayılanları kullanın
3. Her değişiklikten sonra "🔄 Oluştur" butonuna basmanız gerekir

**Adım 2: Önizlemeyi Kontrol Edin**

1. "🔄 Oluştur" butonuna tıklayın
2. Canvas'ta formun önizlemesi görünecek
3. Şunları kontrol edin:
   - Form boyutu uygun mu?
   - Sorular düzgün görünüyor mu?
   - Marker'lar köşelerde mi?
   - Baloncuklar net mi?

**Adım 3: İnce Ayarlar Yapın**

Form görünümünde sorun varsa:

- **Form çok uzun**: Form Yüksekliği'ni azaltın veya Soru Sütunu'nu artırın
- **Form çok geniş**: Form Genişliği'ni azaltın
- **Baloncuklar küçük**: Baloncuk Boyutu'nu artırın
- **Sorular sıkışık**: Satır Aralığı'nı artırın

**Adım 4: Final Kontrolü**

1. Formu tekrar oluşturun
2. Tüm bölümleri kontrol edin:
   - ✅ QR kod var mı?
   - ✅ Öğrenci numarası bölümü var mı?
   - ✅ Cevap anahtarı (eğer gösteriliyorsa) var mı?
   - ✅ Sorular düzgün mü?
   - ✅ Marker'lar köşelerde mi?

**Adım 5: İndirme veya Yazdırma**

**PNG İndirme:**
1. "📥 PNG İndir" butonuna tıklayın
2. Dosya otomatik olarak indirilecek
3. Dosya adı: `optik-form-YYYY-MM-DD-HH-MM-SS.png`

**Yazdırma:**
1. "🖨️ Yazdır" butonuna tıklayın
2. Yazdırma ayarlarını yapın:
   - Kağıt: A4
   - Kenar boşlukları: Minimum
   - Ölçek: %100
   - Arka plan grafikleri: Açık
3. Yazdırın

**💡 İpucu:** Yazdırma için kalite çarpanını 3x veya 4x yapın, sonra tekrar oluşturun.

### Cevap Anahtarı Girişi - Detaylı Rehber

#### Yöntem 1: Manuel Giriş

**Ne Zaman Kullanılır?**
- Cevap anahtarını bilgisayarda hazırladıysanız
- Hızlı giriş yapmak istiyorsanız
- Cevap anahtarı formu yoksa

**Adım Adım:**

1. **Oku sekmesine geçin**
   - Üstteki "📷 Oku" sekmesine tıklayın

2. **Manuel giriş modunu seçin**
   - "Anahtar Kaynağı" menüsünden "Manuel Giriş" seçin

3. **Soru sayısını girin**
   - "Soru Sayısı" alanına form ile eşleşen sayıyı girin
   - Örnek: Form 30 soruluysa, buraya 30 yazın

4. **Tablo oluşturun**
   - "📋 Anahtar Tablosu Oluştur" butonuna tıklayın
   - Tablo görünecek, her satır bir soruyu temsil eder

5. **Cevapları girin**
   - Her soru için açılır menüden doğru cevabı seçin
   - Menüde şıklar görünür: A, B, C, D, E (şık sayısına göre)

6. **Durumu kontrol edin**
   - Durum göstergesi:
     - 🔴 Kırmızı: Eksik cevaplar var
     - 🟢 Yeşil: Tüm cevaplar girildi

7. **Doğrulama**
   - Tabloyu gözden geçirin
   - Hatalı cevapları düzeltin

**Hızlı İpuçları:**
- Klavye ile hızlı gezinme: Tab tuşu ile sonraki soruya geçin
- Rastgele anahtar: "🎲 Rastgele" butonu ile test anahtarı oluşturun
- Temizleme: "🗑️ Temizle" ile tüm cevapları sıfırlayın

#### Yöntem 2: Tarama ile Yükleme

**Ne Zaman Kullanılır?**
- Cevap anahtarı formunu doldurup yazdırdıysanız
- Formu tarayarak otomatik yüklemek istiyorsanız
- Hızlı ve hatasız giriş için

**Adım Adım:**

1. **Cevap anahtarı formunu hazırlayın**
   - Formu yazdırın
   - Cevap anahtarı bölümünü (sağ üstteki A-J baloncukları) doldurun
   - Örnek: Soru 1 için A'yı, Soru 2 için B'yi işaretleyin

2. **Oku sekmesine geçin**
   - "📷 Oku" sekmesine tıklayın

3. **Tarama modunu seçin**
   - "Anahtar Kaynağı" menüsünden "Tarayarak Yükle" seçin

4. **Kamerayı başlatın**
   - "📷 Kamerayı Başlat" butonuna tıklayın
   - Kamera izni verin

5. **Formu hizalayın**
   - Cevap anahtarı formunu kameraya gösterin
   - Köşe marker'larının görünür olduğundan emin olun
   - Formu düz tutun
   - İyi aydınlatma altında tutun

6. **Taramayı başlatın**
   - "📷 Cevap Anahtarı Tara" butonuna tıklayın
   - Sistem otomatik olarak cevapları okur

7. **Sonucu kontrol edin**
   - Durum göstergesi yeşil olursa başarılıdır
   - Tabloda cevapları kontrol edin
   - Hatalı okumalar varsa manuel düzeltin

**Sorun Giderme:**
- Marker tespit edilmiyor: Işığı artırın, formu düz tutun
- Yanlış okuma: Formu yeniden tarayın, daha iyi aydınlatma kullanın
- Eksik cevaplar: Formu kontrol edin, tüm baloncuklar dolu mu?

### Öğrenci Formu Okuma - Detaylı Rehber

#### Yöntem 1: Kamera ile Okuma

**Hazırlık:**

1. **Kamerayı kontrol edin**
   - Kamera çalışıyor mu?
   - Tarayıcıya izin verildi mi?
   - Doğru kamera seçildi mi? (ön/arka)

2. **Işık koşullarını ayarlayın**
   - Yeterli aydınlatma olmalı
   - Gölge ve parlama olmamalı
   - Mümkünse doğal ışık kullanın

3. **Formu hazırlayın**
   - Form düzgün mü? (buruşuk, katlanmış olmamalı)
   - Köşe marker'ları görünür mü?
   - İşaretlemeler net mi? (kalemle dolu mu?)

**Adım Adım Okuma:**

1. **Kamerayı başlatın**
   - "📷 Kamerayı Başlat" butonuna tıklayın
   - Kamera görüntüsü ekranda görünecek

2. **Formu hizalayın**
   - Formu kameraya gösterin
   - Köşe marker'larının ekranda görünür olduğundan emin olun
   - Formu düz tutun (eğik olmamalı)
   - Kameraya yaklaştırın/uzaklaştırın (tüm form görünmeli)

3. **Manuel Tarama**
   - "📸 Öğrenci Formu Tara" butonuna tıklayın
   - Sistem formu analiz eder
   - Sonuçlar gösterilir

4. **Otomatik Tarama (Opsiyonel)**
   - "🔄 Otomatik" butonunu aktif edin
   - Sistem sürekli tarar ve sonuçları günceller
   - Formu sabit tutun
   - İyi sonuç alınca otomatik modu kapatın

5. **Sonuçları İnceleyin**

   **Özet İstatistikler:**
   ```
   Doğru: 25
   Yanlış: 3
   Boş: 2
   Net: 24.25 (Doğru - (Yanlış × 0.25))
   ```

   **Öğrenci Numarası:**
   - Okunan numara gösterilir
   - Hatalı okuma varsa manuel düzeltilebilir

   **Soru Detayları:**
   - Her soru için:
     - İşaretlenen şık (A, B, C, D, E)
     - Durum (Doğru/Yanlış/Boş)
     - Renk kodlaması:
       - 🟢 Yeşil: Doğru cevap
       - 🔴 Kırmızı: Yanlış cevap
       - ⚪ Gri: Boş
       - 🟡 Sarı: Çoklu işaretleme

   **İşlenmiş Görüntüler:**
   - **Yakalanan**: Orijinal kamera görüntüsü
   - **Marker**: Marker tespiti (yeşil çizgilerle gösterilir)
   - **Düzeltilmiş**: Perspektif düzeltilmiş form görüntüsü

6. **Kaydı Kontrol Edin**
   - Başarılı okuma otomatik olarak oturum listesine eklenir
   - Sağ altta "Oturum Kayıtları" bölümünde görünür

**İpuçları:**
- Formu sabit tutun, titreme olmamalı
- Marker'lar her zaman görünür olmalı
- İyi aydınlatma kritik öneme sahip
- Otomatik mod hızlı tarama için idealdir

#### Yöntem 2: Dosyadan Okuma

**Ne Zaman Kullanılır?**
- Kameranız yoksa
- Toplu işleme yapıyorsanız
- Yüksek kaliteli görüntüleriniz varsa

**Adım Adım:**

1. **Kaynak seçin**
   - "Kaynak" menüsünden "📁 Dosyadan Yükle" seçin

2. **Resim seçin**
   - "📁 Resim Seç" butonuna tıklayın
   - Dosya seçici açılır
   - PNG, JPG veya JPEG formatında form resmi seçin
   - "Aç" butonuna tıklayın

3. **Görüntüyü kontrol edin**
   - Seçilen görüntü ekranda görünecek
   - Görüntü kalitesini kontrol edin:
     - Net mi?
     - Marker'lar görünür mü?
     - İşaretlemeler net mi?

4. **Analiz edin**
   - "🔍 Formu Analiz Et" butonuna tıklayın
   - Sistem görüntüyü analiz eder
   - Sonuçlar gösterilir

5. **Sonuçları inceleyin**
   - Kamera okuma ile aynı şekilde sonuçlar gösterilir
   - Özet istatistikler, soru detayları, öğrenci numarası

**Görüntü Gereksinimleri:**
- Format: PNG, JPG, JPEG
- Çözünürlük: En az 800x600 piksel
- Kalite: Net, bulanık olmamalı
- Marker'lar: Köşe marker'ları görünür olmalı

### OMR Ayarları - Detaylı Açıklama

#### Doluluk Eşiği (Fill Threshold)

**Ne İşe Yarar?**
Baloncukların ne kadar dolu olduğunda "dolu" kabul edileceğini belirler.

**Nasıl Çalışır?**
- 0.1-0.9 arası değer
- 0.20 = Baloncuğun %20'si doluysa "dolu" kabul edilir
- Daha yüksek değer = daha katı kontrol (daha az yanlış pozitif)
- Daha düşük değer = daha esnek kontrol (daha az yanlış negatif)

**Ne Zaman Değiştirilmeli?**

| Durum | Önerilen Değer | Açıklama |
|-------|----------------|----------|
| Düşük ışık | 0.18-0.22 | Daha esnek, hafif işaretlemeleri de yakalar |
| Normal ışık | 0.20-0.24 | Varsayılan, çoğu durumda çalışır |
| Parlak ışık | 0.24-0.28 | Daha katı, sadece net işaretlemeleri kabul eder |
| Çoklu işaretleme sorunu | 0.25-0.30 | Daha katı kontrol, yanlış pozitifleri azaltır |
| Boş okuma sorunu | 0.15-0.20 | Daha esnek, boş okumaları azaltır |

**Nasıl Ayarlanır?**
1. "Oku" sekmesinde "OMR Ayarları" bölümünü bulun
2. "Doluluk Eşiği" kaydırıcısını ayarlayın
3. Değeri değiştirin
4. Formu yeniden tarayın
5. Sonuçları karşılaştırın

#### Yanlış Cezası (Penalty)

**Ne İşe Yarar?**
Yanlış cevaplar için net puanın ne kadar düşeceğini belirler.

**Nasıl Çalışır?**
- 0-1 arası değer
- 0.25 = Her yanlış cevap 0.25 puan düşürür
- Net puan = Doğru - (Yanlış × Penalty)

**Örnekler:**

| Doğru | Yanlış | Penalty | Net Puan |
|-------|--------|---------|----------|
| 25 | 5 | 0.25 | 23.75 |
| 25 | 5 | 0.50 | 22.50 |
| 25 | 5 | 1.00 | 20.00 |
| 25 | 5 | 0.00 | 25.00 |

**Ne Zaman Değiştirilmeli?**

| Senaryo | Önerilen Değer | Açıklama |
|---------|----------------|----------|
| Standart sınav | 0.25 | Varsayılan, dengeli |
| Zor sınav | 0.20 | Daha az ceza |
| Kolay sınav | 0.33 | Daha fazla ceza |
| Ceza yok | 0.00 | Sadece doğru sayısı |
| Tam ceza | 1.00 | Her yanlış 1 puan düşürür |

#### Gölge Modu

**Ne İşe Yarar?**
Zorlu ışık koşullarında (gölge, parlama) daha iyi analiz yapar.

**Ne Zaman Kullanılmalı?**
- Form üzerinde gölgeler varsa
- Parlama sorunları varsa
- Işık koşulları kötüyse
- Marker tespiti zorlanıyorsa

**Nasıl Aktif Edilir?**
1. "Oku" sekmesinde "OMR Ayarları" bölümünü bulun
2. "Gölge Modu" checkbox'ını işaretleyin
3. Formu yeniden tarayın

**Not:** Gölge modu performansı biraz düşürebilir, sadece gerektiğinde kullanın.

### Sonuç Yönetimi ve Export - Detaylı Rehber

#### Oturum Kayıtları

**Ne İşe Yarar?**
Okunan tüm formlar otomatik olarak oturum listesine eklenir.

**Özellikler:**
- Her okuma otomatik kaydedilir
- Kayıt sayısı "X kayit" şeklinde gösterilir
- Her kayıt şunları içerir:
  - Öğrenci numarası
  - Doğru/Yanlış/Boş/Net skorları
  - Tarih ve saat

**Kayıt Yönetimi:**
- Kayıtlar tarayıcıda saklanır (localStorage)
- Sayfa yenilendiğinde kaybolmaz
- Farklı tarayıcıda farklı kayıtlar olur

**Kayıtları Temizleme:**
1. "🗑️ Temizle" butonuna tıklayın
2. Onaylayın
3. Tüm kayıtlar silinir

#### Export Formatları

**1. TXT Listesi**

**Ne İçin Kullanılır?**
- Basit metin formatında sonuçlar
- Hızlı gözden geçirme
- Basit analiz

**Format:**
```
Öğrenci No: 1234567890
Doğru: 25, Yanlış: 3, Boş: 2, Net: 24.25
Tarih: 2024-01-15 14:30:00

Öğrenci No: 0987654321
Doğru: 28, Yanlış: 1, Boş: 1, Net: 27.75
Tarih: 2024-01-15 14:31:00
```

**Nasıl İndirilir?**
1. "📄 TXT Listesi" butonuna tıklayın
2. Dosya otomatik indirilir
3. Dosya adı: `sonuclar-YYYY-MM-DD-HH-MM-SS.txt`

**2. Excel (CSV)**

**Ne İçin Kullanılır?**
- Excel uyumlu format
- Hızlı import
- Basit analiz

**Format:**
CSV formatında, virgülle ayrılmış değerler:
```csv
Öğrenci No,Doğru,Yanlış,Boş,Net,Tarih
1234567890,25,3,2,24.25,2024-01-15 14:30:00
0987654321,28,1,1,27.75,2024-01-15 14:31:00
```

**Nasıl İndirilir?**
1. "📊 Excel (CSV)" butonuna tıklayın
2. Dosya otomatik indirilir
3. Excel'de açın (virgülle ayrılmış değerler olarak import edin)

**3. Excel (XLSX) - Önerilen**

**Ne İçin Kullanılır?**
- Tam Excel formatı
- Kolay analiz
- Grafik oluşturma
- Profesyonel raporlama

**Format:**
Tam Excel dosyası, şu sütunlarla:
- Öğrenci No
- Doğru
- Yanlış
- Boş
- Net
- Tarih/Saat

**Nasıl İndirilir?**
1. "📊 Excel (XLSX)" butonuna sağ tıklayın
2. "Farklı kaydet" veya "Save as" seçin
3. Dosya adını girin (örn: `sinav-sonuclari.xlsx`)
4. Kaydedin

**Excel'de Kullanım:**
1. Dosyayı Excel'de açın
2. Veriler otomatik olarak tablo formatında görünür
3. İstediğiniz analizi yapabilirsiniz:
   - Ortalama hesaplama
   - Grafik oluşturma
   - Sıralama
   - Filtreleme

---

## 📝 Pratik Senaryolar

### Senaryo 1: Okul Sınavı Değerlendirme

**Durum:** 50 soruluk matematik sınavı, 100 öğrenci

**Adımlar:**

1. **Form Oluşturma**
   ```
   Soru Sayısı: 50
   Şık Sayısı: 5 (A-E)
   Soru Sütunu: 2
   Kalite: 3x (yazdırma için)
   ```

2. **Cevap Anahtarı Girişi**
   - Manuel giriş yapın veya cevap anahtarı formunu tarayın
   - 50 soru için cevapları girin

3. **Form Yazdırma**
   - 100 adet form yazdırın
   - Her forma öğrenci numarası yazın

4. **Toplu Okuma**
   - Her öğrenci formunu sırayla tarayın
   - Oturum listesinde kayıtlar birikir

5. **Export**
   - Tüm kayıtlar tamamlandıktan sonra Excel (XLSX) export edin
   - Excel'de analiz yapın

**Süre:** ~2-3 saat (100 form için)

### Senaryo 2: Anket Değerlendirme

**Durum:** 20 soruluk müşteri memnuniyet anketi, 500 katılımcı

**Adımlar:**

1. **Form Oluşturma**
   ```
   Soru Sayısı: 20
   Şık Sayısı: 5 (Çok memnun - Hiç memnun değil)
   Soru Sütunu: 1
   Öğr. No Hane: 8 (Müşteri ID)
   ```

2. **Cevap Anahtarı**
   - Anket için cevap anahtarı gerekmez (her soru için farklı cevaplar)
   - Ancak doğrulama için bir test formu okuyabilirsiniz

3. **Toplu Okuma**
   - Her anket formunu tarayın
   - Sonuçları kaydedin

4. **Analiz**
   - Excel'de her soru için cevap dağılımını analiz edin
   - Grafikler oluşturun

**Süre:** ~5-6 saat (500 form için)

### Senaryo 3: Hızlı Test Değerlendirme

**Durum:** 10 soruluk hızlı quiz, 30 öğrenci

**Adımlar:**

1. **Form Oluşturma**
   ```
   Soru Sayısı: 10
   Şık Sayısı: 4 (A-D)
   Soru Sütunu: 1
   Kalite: 2x (hızlı yazdırma)
   ```

2. **Cevap Anahtarı**
   - Manuel giriş (hızlı)

3. **Okuma**
   - Otomatik tarama modunu kullanın
   - Her formu hızlıca tarayın

4. **Hızlı Export**
   - CSV formatında export edin
   - Hızlı gözden geçirme

**Süre:** ~30 dakika (30 form için)

---

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler

#### Frontend

- **HTML5 Canvas**: Form çizimi ve render
- **OpenCV.js**: Görüntü işleme ve OMR analizi
- **jsQR**: QR kod okuma
- **qrcode**: QR kod oluşturma
- **SheetJS (XLSX)**: Excel dosya oluşturma
- **Vite**: Build tool ve development server

#### Backend

- **Express.js**: Web sunucusu (opsiyonel)
- **Node.js**: Runtime ortamı

#### CDN Kütüphaneleri

- OpenCV.js (fallback): `https://docs.opencv.org/4.8.0/opencv.js`
- qrcode (opsiyonel fallback): `https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm`
- xlsx (opsiyonel fallback): `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm`

### OMR Algoritması - Detaylı Açıklama

#### 1. Görüntü Yakalama

**Kamera Modu:**
- Video akışından frame yakalama
- Canvas üzerine çizme
- Yüksek çözünürlük için kalite ayarı

**Dosya Modu:**
- Dosya yükleme
- Canvas'a çizme
- Format dönüşümü (JPG → Canvas)

#### 2. Ön İşleme

**Grayscale Dönüşümü:**
- Renkli görüntüyü gri tonlamaya çevirme
- RGB → Grayscale formülü

**Gaussian Blur:**
- Gürültü azaltma
- Yumuşatma filtresi
- Kernel boyutu: 5x5

**Adaptive Threshold:**
- Işık koşullarına uyum
- Yerel eşikleme
- Block size: 11

**Morfolojik İşlemler:**
- Açma (Opening): Gürültü temizleme
- Kapanma (Closing): Boşluk doldurma
- Kernel: 3x3

#### 3. Marker Tespiti

**Köşe Marker Yapısı:**
- Dış köşelerde siyah kareler
- İç köşelerde beyaz kareler (L-şekli)
- Toplam 4 marker (her köşede bir)

**Tespit Algoritması:**
1. Kontur bulma
2. Kontur filtreleme (boyut, şekil)
3. L-şekli doğrulama
4. Köşe pozisyonu hesaplama

**Kalite Kontrolü:**
- Marker boyutu kontrolü
- Marker pozisyonu kontrolü
- Marker şekil kontrolü

#### 4. Perspektif Düzeltme

**Homography Matrisi:**
- 4 nokta eşleştirme (marker köşeleri)
- Perspektif transformasyonu
- Warp transformation

**Sonuç:**
- Eğik form → Düz form
- Normalize çözünürlük
- Standart koordinat sistemi

#### 5. Baloncuk Analizi

**Koordinat Sistemi:**
- Normalize koordinatlar (0-1 arası)
- Form boyutundan bağımsız
- Marker bazlı hesaplama

**ROI (Region of Interest) Hesaplama:**
- Her baloncuk için ROI
- Merkez koordinatları
- Yarıçap hesaplama

**Doluluk Analizi:**
- Merkez ağırlıklı analiz
- Piksel sayımı
- Threshold karşılaştırması

#### 6. Sonuç Hesaplama

**Cevap Karşılaştırması:**
- Okunan cevap vs. Cevap anahtarı
- Doğru/Yanlış/Boş tespiti
- Çoklu işaretleme tespiti

**Net Puan:**
```
Net = Doğru - (Yanlış × Penalty)
```

**Öğrenci Numarası:**
- Her hane için baloncuk analizi
- Rakam tespiti (0-9)
- Numara birleştirme

### Koordinat Sistemi

**Normalize Koordinatlar:**
- Tüm koordinatlar 0-1 arası
- Form boyutundan bağımsız
- Marker pozisyonlarına göre hesaplanır

**Avantajları:**
- Farklı form boyutlarında çalışır
- Farklı çözünürlüklerde çalışır
- Kalite çarpanından etkilenmez

**Hesaplama:**
```javascript
normalizedX = (pixelX - markerLeft) / (markerRight - markerLeft)
normalizedY = (pixelY - markerTop) / (markerBottom - markerTop)
```

### Form Yapısı - Detaylı

#### Üst Bölüm

**QR Kod:**
- Sol üst köşede
- Form kimlik doğrulama için
- JSON formatında form bilgileri

**Web Adresi:**
- QR kodun altında
- Opsiyonel
- Metin formatında

**Öğrenci Numarası:**
- Yatay düzen
- Sütunlar: Hane numaraları (1, 2, 3, ...)
- Satırlar: Rakamlar (0-9)
- Her hane için 10 baloncuk (0-9)

**Cevap Anahtarı (Opsiyonel):**
- Sağ üst köşede
- Dikey A-J baloncukları
- Her şık bir soruyu temsil eder

#### Soru Bölümü

**Sütun Başlıkları:**
- Her sütunun üstünde A B C D E harfleri
- Periyodik tekrar (her N soruda bir)

**Soru Numaraları:**
- Her sorunun solunda numara
- Sıralı numaralandırma

**Baloncuklar:**
- Her şık için dairesel işaretleme alanı
- Eşit aralıklarla yerleştirilmiş
- Standart boyut

#### Köşe Marker'ları

**Yapı:**
- Formun 4 köşesinde siyah kareler
- İç köşelerde beyaz kareler (L-şekli)
- Toplam 8 kare (4 siyah + 4 beyaz)

**Boyut:**
- Marker boyutu form boyutuna göre ayarlanır
- Standart oran: Form genişliğinin %5'i

**Kullanım:**
- Form tespiti
- Perspektif düzeltme
- Koordinat hesaplama

---

## ⚠️ Sorun Giderme Rehberi

### Kamera Sorunları

#### Sorun: Kamera Açılmıyor

**Belirtiler:**
- "Kamerayı Başlat" butonuna tıklanınca hiçbir şey olmuyor
- Kamera izni istenmiyor
- Hata mesajı görünüyor

**Çözümler:**

1. **HTTPS Kontrolü**
   - Localhost hariç HTTPS gereklidir
   - `http://localhost:3000` çalışır
   - `http://192.168.1.100:3000` çalışmaz (HTTPS gerekir)
   - Çözüm: HTTPS proxy kullanın veya localhost kullanın

2. **Tarayıcı İzinleri**
   - Tarayıcı ayarlarından kamera iznini kontrol edin
   - Chrome: Ayarlar → Gizlilik → Site Ayarları → Kamera
   - Firefox: Ayarlar → Gizlilik → İzinler → Kamera
   - İzin verilmiş siteleri kontrol edin

3. **Kamera Kullanımda mı?**
   - Başka bir uygulama kamerayı kullanıyor olabilir
   - Tüm kamera kullanan uygulamaları kapatın
   - Bilgisayarı yeniden başlatın

4. **Kamera Seçimi**
   - Birden fazla kamera varsa doğru kamera seçilmeli
   - Tarayıcı ayarlarından kamera seçin
   - Farklı bir kamera deneyin

5. **Dosyadan Yükleme**
   - Geçici çözüm: Dosyadan yükleme kullanın
   - Resim dosyası olarak formu yükleyin

#### Sorun: Marker Tespit Edilmiyor

**Belirtiler:**
- Form taranıyor ama marker'lar bulunamıyor
- "Marker tespit edilemedi" hatası
- Form analiz edilemiyor

**Çözümler:**

1. **Işık Koşulları**
   - Işığı artırın
   - Doğal ışık kullanın
   - Gölge ve parlama olmamalı
   - Form üzerinde gölge olmamalı

2. **Form Hizalama**
   - Formu düz tutun (eğik olmamalı)
   - Köşe marker'ları görünür olmalı
   - Tüm 4 köşe marker'ı görünmeli
   - Formu kameraya yaklaştırın/uzaklaştırın

3. **Marker Görünürlüğü**
   - Marker'lar net görünmeli
   - Marker'lar eksik veya hasarlı olmamalı
   - Yazdırma kalitesini kontrol edin
   - Marker'lar siyah-beyaz olmalı

4. **Gölge Modu**
   - Gölge modunu aktif edin
   - Zorlu ışık koşullarında yardımcı olur

5. **Form Kalitesi**
   - Form düzgün yazdırılmış mı?
   - Marker'lar net mi?
   - Form buruşuk veya katlanmış mı?

### Form Okuma Sorunları

#### Sorun: Yanlış Okuma

**Belirtiler:**
- Bazı sorular yanlış okunuyor
- Boş sorular dolu olarak okunuyor
- Dolu sorular boş olarak okunuyor

**Çözümler:**

1. **Doluluk Eşiği Ayarlama**
   - Doluluk eşiğini ayarlayın
   - Düşük ışıkta: 0.18-0.22
   - Normal ışıkta: 0.20-0.24
   - Parlak ışıkta: 0.24-0.28
   - Test ederek en iyi değeri bulun

2. **Işık Koşulları**
   - Işığı iyileştirin
   - Eşit aydınlatma sağlayın
   - Gölge ve parlama olmamalı

3. **Form Hizalama**
   - Formu daha düz tutun
   - Perspektif düzeltme daha iyi çalışır
   - Marker'lar net görünmeli

4. **İşaretleme Kalitesi**
   - Kalemle dolu mu işaretlenmiş?
   - Baloncuklar tamamen dolu mu?
   - Silgi izi var mı?
   - Çoklu işaretleme var mı?

5. **Gölge Modu**
   - Gölge modunu deneyin
   - Zorlu koşullarda yardımcı olur

#### Sorun: Öğrenci Numarası Okunmuyor

**Belirtiler:**
- Öğrenci numarası yanlış okunuyor
- Öğrenci numarası boş geliyor
- Rakamlar karışıyor

**Çözümler:**

1. **İşaretleme Kontrolü**
   - Öğrenci numarası bölümü dolu mu?
   - Her hane için bir rakam işaretlenmiş mi?
   - İşaretlemeler net mi?

2. **Form Hizalama**
   - Formu düz tutun
   - Öğrenci numarası bölümü görünür mü?
   - Marker tespiti başarılı mı?

3. **Yeniden Tarama**
   - Formu yeniden tarayın
   - Farklı açılardan deneyin
   - Işığı iyileştirin

4. **Manuel Düzeltme**
   - Öğrenci numarası manuel düzeltilebilir
   - Sonuçlar bölümünde düzenleyin

### Performans Sorunları

#### Sorun: Yavaş İşleme

**Belirtiler:**
- Form oluşturma yavaş
- Tarama yavaş
- Tarayıcı donuyor

**Çözümler:**

1. **Kalite Çarpanı**
   - Kalite çarpanını düşürün (1x veya 2x)
   - 3x ve 4x yavaş olabilir
   - Sadece yazdırma için yüksek kalite kullanın

2. **Otomatik Tarama**
   - Otomatik taramayı kapatın
   - Manuel tarama daha hızlıdır
   - Sadece gerektiğinde otomatik kullanın

3. **Tarayıcı**
   - Chrome kullanın (en hızlı)
   - Diğer tarayıcılar daha yavaş olabilir
   - Tarayıcıyı güncelleyin

4. **Bellek**
   - Tarayıcı sekmesini yenileyin
   - Oturum kayıtlarını temizleyin
   - Diğer sekmeleri kapatın

5. **Soru Sayısı**
   - Çok fazla soru yavaşlatır
   - 50'den fazla soru için dikkatli olun
   - Formu bölün (2 ayrı form)

#### Sorun: Bellek Sorunları

**Belirtiler:**
- Tarayıcı çöküyor
- "Bellek yetersiz" hatası
- Sayfa yavaşlıyor

**Çözümler:**

1. **Oturum Kayıtları**
   - Oturum kayıtlarını temizleyin
   - Çok fazla kayıt belleği doldurur
   - Düzenli olarak export edip temizleyin

2. **Sayfa Yenileme**
   - Tarayıcı sekmesini yenileyin
   - Bellek temizlenir

3. **Soru Sayısı**
   - Daha az soru kullanın
   - Formu bölün

4. **Kalite**
   - Düşük kalite kullanın
   - Yüksek kalite daha fazla bellek kullanır

### Sunucu Sorunları

#### Sorun: Port Zaten Kullanılıyor

**Belirtiler:**
- `EADDRINUSE` hatası
- Sunucu başlamıyor
- Port 3000 kullanılıyor

**Çözümler:**

1. **Farklı Port Kullan**
   ```bash
   npm run dev -- --port 8080
   ```

2. **Kullanan Process'i Bul**
   ```bash
   # Linux/Mac
   lsof -i :3000
   kill -9 <PID>
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

3. **Sunucuyu Durdur**
   - Önceki sunucu çalışıyor olabilir
   - Terminal'de Ctrl+C ile durdurun

#### Sorun: Bağımlılık Hataları

**Belirtiler:**
- `npm install` hata veriyor
- Modül bulunamıyor
- Versiyon uyumsuzluğu

**Çözümler:**

1. **Temizle ve Yeniden Yükle**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **npm Cache Temizle**
   ```bash
   npm cache clean --force
   npm install
   ```

3. **Node.js Versiyonu**
   - Node.js 18.x (veya >= 20.0.0) olmalı
   - Versiyonu kontrol edin: `node --version`
   - Güncelleyin: [nodejs.org](https://nodejs.org/)

### Export Sorunları

#### Sorun: Excel Dosyası Açılmıyor

**Belirtiler:**
- Excel dosyası açılmıyor
- Hata mesajı görünüyor
- Dosya bozuk görünüyor

**Çözümler:**

1. **Format Seçimi**
   - XLSX formatını kullanın (CSV yerine)
   - XLSX daha uyumludur

2. **Excel Programı**
   - Farklı bir Excel programı deneyin
   - Microsoft Excel, LibreOffice, Google Sheets

3. **Dosya Adı**
   - Dosya adında özel karakter olmamalı
   - Türkçe karakter sorun çıkarabilir
   - Sadece İngilizce karakter kullanın

4. **Yeniden Export**
   - Yeniden export edin
   - Farklı format deneyin

---

## ❓ Sık Sorulan Sorular

### Genel Sorular

**S: Bu uygulama ücretsiz mi?**
C: Evet, tamamen ücretsiz ve açık kaynaklıdır (MIT lisansı).

**S: İnternet bağlantısı gerekli mi?**
C: İlk yüklemede CDN kütüphaneleri için gerekli. Sonrasında offline çalışabilir (yerel OpenCV varsa).

**S: Verilerim güvende mi?**
C: Evet, tüm işlemler tarayıcıda yapılır. Veriler sunucuya gönderilmez. Sadece tarayıcınızda saklanır.

**S: Hangi tarayıcıları destekliyor?**
C: Chrome, Firefox, Safari, Edge. Chrome önerilir (en iyi performans).

**S: Mobil cihazlarda çalışır mı?**
C: Evet, ancak kamera kalitesi ve ekran boyutu nedeniyle masaüstü önerilir.

### Form Oluşturma

**S: Kaç soruya kadar form oluşturabilirim?**
C: 1-200 soru arası. 50'den fazla soru için formu bölmek önerilir.

**S: Form boyutunu nasıl ayarlarım?**
C: "Form Genişlik" ve "Form Yükseklik" parametrelerini ayarlayın. A4 için 800x1200 önerilir.

**S: Kalite çarpanı ne işe yarar?**
C: PNG çıktısının çözünürlüğünü belirler. Yazdırma için 3x-4x önerilir.

**S: Marker'lar nedir?**
C: Formun köşelerindeki siyah-beyaz kareler. Form tespiti ve perspektif düzeltme için kullanılır.

### Cevap Anahtarı

**S: Cevap anahtarını nasıl girerim?**
C: İki yöntem var: Manuel giriş veya tarama ile yükleme. Manuel giriş daha hızlıdır.

**S: Cevap anahtarını değiştirebilir miyim?**
C: Evet, tabloda herhangi bir cevabı değiştirebilirsiniz.

**S: Rastgele anahtar ne işe yarar?**
C: Test amaçlı otomatik cevap anahtarı oluşturur. Gerçek sınavlar için kullanmayın.

### Form Okuma

**S: Kameram yok, kullanabilir miyim?**
C: Evet, dosyadan yükleme özelliği var. Formu fotoğraflayıp yükleyebilirsiniz.

**S: Formu ne kadar eğik tutabilirim?**
C: Sistem perspektif düzeltme yapar, ancak çok eğik formlar okunmayabilir. Mümkün olduğunca düz tutun.

**S: Işık koşulları ne kadar önemli?**
C: Çok önemli. İyi aydınlatma doğru okuma için kritiktir. Gölge ve parlama olmamalı.

**S: Otomatik tarama nasıl çalışır?**
C: Sürekli olarak formu tarar ve sonuçları günceller. Formu sabit tutmanız gerekir.

**S: Doluluk eşiği nedir?**
C: Baloncukların ne kadar dolu olduğunda "dolu" kabul edileceğini belirler. Işık koşullarına göre ayarlanmalıdır.

### Sonuçlar ve Export

**S: Sonuçlar nerede saklanıyor?**
C: Tarayıcınızın localStorage'ında. Sayfa yenilendiğinde kaybolmaz, ancak tarayıcı verilerini temizlerseniz kaybolur.

**S: Kaç kayıt saklayabilirim?**
C: Sınırsız, ancak çok fazla kayıt performansı etkileyebilir. Düzenli olarak export edip temizleyin.

**S: Hangi export formatını kullanmalıyım?**
C: Excel (XLSX) önerilir. Tam Excel formatı, kolay analiz için idealdir.

**S: Export edilen dosyada hangi bilgiler var?**
C: Öğrenci numarası, doğru/yanlış/boş/net skorları, tarih/saat.

### Teknik Sorular

**S: OpenCV nedir?**
C: Görüntü işleme kütüphanesi. OMR analizi için kullanılır.

**S: Form verileri sunucuya gönderiliyor mu?**
C: Hayır, tüm işlemler tarayıcıda yapılır. Veriler sunucuya gönderilmez.

**S: Offline çalışabilir miyim?**
C: Evet, yerel OpenCV dosyası varsa offline çalışabilir. CDN kullanıyorsanız internet gerekir.

**S: Performansı nasıl artırabilirim?**
C: Düşük kalite kullanın, otomatik taramayı kapatın, Chrome kullanın, oturum kayıtlarını temizleyin.

---

## 🌐 API ve Endpoint'ler

### Express Sunucusu

Bu sunucu **opsiyoneldir** ve `dist/` çıktısını servis eder.

```bash
# Production build al
npm run build
# dist/ klasörünü Express ile servis et
npm run serve
```

#### GET `/`
- **Açıklama**: Ana sayfa (index.html)
- **Response**: HTML dosyası
- **Kullanım**: Tarayıcıda açıldığında otomatik çağrılır

#### GET `/health`
- **Açıklama**: Health check endpoint
- **Response**: 
  ```json
  {
    "status": "ok",
    "timestamp": "2024-01-15T14:30:00.000Z"
  }
  ```
- **Kullanım**: Sunucu durumunu kontrol etmek için

#### Statik Dosyalar
- **Path**: `/assets/*`, `/css/*`, `/libs/*`
- **Açıklama**: CSS, JavaScript ve kütüphane dosyaları
- **Servis**: `express.static` ile otomatik servis edilir

### Port Yapılandırması

- **Varsayılan Port**: 3000
- **Environment Variable**: `PORT` ile değiştirilebilir
- **Örnek**: 
  ```bash
  PORT=8080 npm run serve
  ```

---

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
npm install
```

---

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

---

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

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır ve özgürce kullanılabilir.

---

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

---

## 📧 İletişim ve Destek

- **Issues**: GitHub Issues üzerinden hata bildirimi ve öneriler
- **Pull Requests**: Katkılar için PR açabilirsiniz
- **Dokümantasyon**: README.md ve kod içi yorumlar

---

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
