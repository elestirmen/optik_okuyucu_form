# Benchmark çalıştırma rehberi

1) **Referans formu hazırla**
   - `index.html` üzerinden 2x kaliteyle doldurulmuş bir form PNG’si üret.
   - Dosyayı `benchmarks/input/filled-base.png` olarak kaydet (veya istediğin isimle `--input` parametresinde kullan).

2) **Varyasyonları ve sonuç şablonunu üret**
   ```bash
   python3 benchmarks/generate_variations.py --input benchmarks/input/filled-base.png --out benchmarks/output --per 8 --results benchmarks/results.csv
   ```
   - Senaryo başına `--per` kadar varyasyon oluşturur (varsayılan 8; artırmak/azaltmak için değiştirin).
   - Çıktılar `benchmarks/output/<senaryo>/...png` altında, `metadata.csv` dosyası ile gelir.
   - Aynı komut `benchmarks/results.csv` şablonunu da parametre kolonları dolu, sonuç kolonları boş olarak üretir (Dogru/Yanlis/Bos/Coklu/SupheliFlag/MarkerOK/OgrNoOK siz dolduracaksınız). Şablon istemezsen `--no-template` ekle.
   - İstersen otomatik doldurma için `--process` ekleyin: OpenCV tabanlı hızlı okuyucu varyasyonları okur ve `results.csv`’yi doldurur.

3) **(Opsiyonel) Otomatik doldurma**
   - `python3 benchmarks/process_variations.py` komutu, `filled-base.png`’den anahtar çıkarır ve tüm varyasyonları OpenCV ile okuyup `results.csv`’yi doldurur.
   - Veya 2. adımda `--process` bayrağı ile tek komutta üret + doldur.

4) **En iyi parametreyi seç**
   ```bash
   python3 benchmarks/select_best.py --csv benchmarks/results.csv
   ```
   - Parametre setlerini ortalama doğruluk + marker/öğr. no başarısı (ufak ağırlık) ile sıralar.

5) **Parametre modları**
   - Başlangıç seti: `fillThreshold=0.20, ROI=1.04, MASK=0.32, Block=11`
   - Düşük ışık/noise: `fillThreshold=0.24, ROI=1.08, MASK=0.28, Block=13`

Notlar:
- `generate_variations.py` OpenCV + numpy ister (`pip install opencv-python numpy`).
- Warp/crop senaryoları marker kaybını ve kadraj kaymasını test eder; parlama/gölge senaryoları ışık sorunlarını simüle eder.
