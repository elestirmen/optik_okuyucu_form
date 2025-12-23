/**
 * Advanced Image Preprocessing Module
 * CLAHE, Shadow Removal, Sauvola Thresholding, Auto-Parameter Tuning
 */

import { state } from '../features/state.js';

// Preprocessing parametreleri
const DEFAULT_PARAMS = {
    clahe: false,
    claheClipLimit: 2.0,
    claheTileSize: 8,
    blurSigma: 0,
    blockSize: 11,
    cValue: 2,
    shadowRemoval: false,
    whiteBalance: false
};

const SHADOW_PARAMS = {
    clahe: true,
    claheClipLimit: 3.0,
    claheTileSize: 8,
    blurSigma: 1.0,
    blockSize: 13,
    cValue: 3,
    shadowRemoval: true,
    whiteBalance: true
};

/**
 * Görüntü kalitesini değerlendir
 * Brightness, contrast, noise, sharpness analizi
 */
export function assessImageQuality(srcMat) {
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    
    // Brightness (ortalama parlaklık)
    const meanVal = cv.mean(gray);
    const brightness = meanVal[0];
    
    // Contrast (standart sapma)
    const meanMat = new cv.Mat();
    const stdMat = new cv.Mat();
    cv.meanStdDev(gray, meanMat, stdMat);
    const contrast = stdMat.data64F ? stdMat.data64F[0] : stdMat.doubleAt(0, 0);
    meanMat.delete();
    stdMat.delete();
    
    // Sharpness (Laplacian variance)
    const sharpness = estimateSharpness(gray);
    
    // Noise level estimation
    const noiseLevel = estimateNoiseLevel(gray);
    
    // Lighting evenness (histogram analizi)
    const evenness = assessLightingEvenness(gray);
    
    gray.delete();
    
    return {
        brightness,
        contrast,
        sharpness,
        noiseLevel,
        evenness,
        overall: calculateOverallQuality({ brightness, contrast, sharpness, noiseLevel, evenness })
    };
}

/**
 * Netlik tahmini (Laplacian variance)
 */
function estimateSharpness(gray) {
    if (!cv?.Laplacian) return 50; // Default değer
    
    const maxSide = Math.max(gray.cols, gray.rows);
    let work = gray;
    let resized = null;
    
    if (maxSide > 480) {
        resized = new cv.Mat();
        const scale = 480 / maxSide;
        cv.resize(gray, resized, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
        work = resized;
    }
    
    const lap = new cv.Mat();
    cv.Laplacian(work, lap, cv.CV_64F);
    
    const mean = new cv.Mat();
    const stdDev = new cv.Mat();
    cv.meanStdDev(lap, mean, stdDev);
    const std = stdDev.data64F ? stdDev.data64F[0] : stdDev.doubleAt(0, 0);
    const variance = std * std;
    
    lap.delete();
    mean.delete();
    stdDev.delete();
    if (resized) resized.delete();
    
    return variance;
}

/**
 * Gürültü seviyesi tahmini
 */
function estimateNoiseLevel(gray) {
    // Median filter ile gürültü tahmini
    const blurred = new cv.Mat();
    cv.medianBlur(gray, blurred, 5);
    
    const diff = new cv.Mat();
    cv.absdiff(gray, blurred, diff);
    
    const meanVal = cv.mean(diff);
    const noiseLevel = meanVal[0];
    
    blurred.delete();
    diff.delete();
    
    return noiseLevel;
}

/**
 * Aydınlatma homojenliği değerlendirmesi
 */
function assessLightingEvenness(gray) {
    const h = gray.rows;
    const w = gray.cols;
    
    // 4 bölgeye ayır ve ortalamalarını karşılaştır
    const regions = [
        new cv.Rect(0, 0, w / 2, h / 2),           // Sol üst
        new cv.Rect(w / 2, 0, w / 2, h / 2),       // Sağ üst
        new cv.Rect(0, h / 2, w / 2, h / 2),       // Sol alt
        new cv.Rect(w / 2, h / 2, w / 2, h / 2)    // Sağ alt
    ];
    
    const means = regions.map(r => {
        const roi = gray.roi(r);
        const m = cv.mean(roi)[0];
        roi.delete();
        return m;
    });
    
    const avgMean = means.reduce((a, b) => a + b, 0) / means.length;
    const maxDiff = Math.max(...means.map(m => Math.abs(m - avgMean)));
    
    // 0-1 arası normalize (0 = çok dengesiz, 1 = mükemmel)
    const evenness = Math.max(0, 1 - (maxDiff / 128));
    
    return evenness;
}

/**
 * Genel kalite skoru hesapla
 */
function calculateOverallQuality(metrics) {
    let score = 100;
    
    // Parlaklık penaltı (çok karanlık veya çok aydınlık)
    if (metrics.brightness < 80) {
        score -= (80 - metrics.brightness) * 0.3;
    } else if (metrics.brightness > 200) {
        score -= (metrics.brightness - 200) * 0.3;
    }
    
    // Kontrast penaltı (düşük kontrast)
    if (metrics.contrast < 40) {
        score -= (40 - metrics.contrast) * 0.5;
    }
    
    // Netlik penaltı
    if (metrics.sharpness < 25) {
        score -= (25 - metrics.sharpness) * 1.0;
    }
    
    // Gürültü penaltı
    if (metrics.noiseLevel > 10) {
        score -= (metrics.noiseLevel - 10) * 2;
    }
    
    // Aydınlatma dengesizliği penaltı
    if (metrics.evenness < 0.7) {
        score -= (0.7 - metrics.evenness) * 30;
    }
    
    return Math.max(0, Math.min(100, score));
}

/**
 * Görüntü kalitesine göre otomatik parametre ayarlama
 */
export function autoTuneParameters(srcMat) {
    const quality = assessImageQuality(srcMat);
    
    let params = { ...DEFAULT_PARAMS };
    let reasons = [];
    
    // Düşük parlaklık
    if (quality.brightness < 100) {
        params.clahe = true;
        params.claheClipLimit = 3.0;
        params.blockSize = 13;
        reasons.push('Düşük ışık tespit edildi');
    }
    
    // Yüksek parlaklık (overexposed)
    if (quality.brightness > 180) {
        params.clahe = true;
        params.claheClipLimit = 2.0;
        reasons.push('Aşırı parlak görüntü');
    }
    
    // Düşük kontrast
    if (quality.contrast < 45) {
        params.clahe = true;
        params.claheClipLimit = Math.min(4.0, params.claheClipLimit + 1.0);
        reasons.push('Düşük kontrast');
    }
    
    // Yüksek gürültü
    if (quality.noiseLevel > 8) {
        params.blurSigma = Math.min(2.0, 0.5 + quality.noiseLevel * 0.1);
        params.blockSize = 15;
        reasons.push('Gürültü tespit edildi');
    }
    
    // Düşük netlik (bulanık)
    if (quality.sharpness < 20) {
        params.blockSize = 17;
        params.cValue = 4;
        reasons.push('Bulanık görüntü');
    }
    
    // Dengesiz aydınlatma (gölge/parlama)
    if (quality.evenness < 0.7) {
        params.shadowRemoval = true;
        params.whiteBalance = true;
        reasons.push('Gölge/parlama tespit edildi');
    }
    
    return {
        params,
        quality,
        reasons,
        autoTuned: reasons.length > 0
    };
}

/**
 * Gölge kaldırma (morphological gradient based)
 */
export function removeShadows(srcMat) {
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    
    // Büyük kernel ile background estimation
    const kernelSize = Math.max(50, Math.min(srcMat.cols, srcMat.rows) / 10);
    const kernel = cv.getStructuringElement(
        cv.MORPH_ELLIPSE, 
        new cv.Size(kernelSize, kernelSize)
    );
    
    const background = new cv.Mat();
    cv.morphologyEx(gray, background, cv.MORPH_CLOSE, kernel);
    
    // Normalize
    const corrected = new cv.Mat();
    cv.divide(gray, background, corrected, 255);
    
    // Histogram stretching
    const stretched = new cv.Mat();
    cv.normalize(corrected, stretched, 0, 255, cv.NORM_MINMAX);
    
    kernel.delete();
    gray.delete();
    background.delete();
    corrected.delete();
    
    return stretched;
}

/**
 * Local White Balance
 */
export function applyLocalWhiteBalance(gray) {
    const result = new cv.Mat();
    
    // Block-based white balance
    const blockSize = 64;
    const h = gray.rows;
    const w = gray.cols;
    
    result.create(h, w, cv.CV_8UC1);
    
    for (let y = 0; y < h; y += blockSize) {
        for (let x = 0; x < w; x += blockSize) {
            const bh = Math.min(blockSize, h - y);
            const bw = Math.min(blockSize, w - x);
            const rect = new cv.Rect(x, y, bw, bh);
            
            const roi = gray.roi(rect);
            const resultRoi = result.roi(rect);
            
            // Local max ile normalize
            const minMax = { minVal: 0, maxVal: 0, minLoc: null, maxLoc: null };
            cv.minMaxLoc(roi, minMax);
            
            if (minMax.maxVal > minMax.minVal) {
                const alpha = 255 / (minMax.maxVal - minMax.minVal);
                const beta = -minMax.minVal * alpha;
                cv.convertScaleAbs(roi, resultRoi, alpha, beta);
            } else {
                roi.copyTo(resultRoi);
            }
            
            roi.delete();
            resultRoi.delete();
        }
    }
    
    return result;
}

/**
 * CLAHE uygula
 */
export function applyCLAHE(gray, clipLimit = 2.0, tileSize = 8) {
    const result = new cv.Mat();
    
    if (cv.CLAHE) {
        const clahe = new cv.CLAHE(clipLimit, new cv.Size(tileSize, tileSize));
        clahe.apply(gray, result);
        clahe.delete();
    } else {
        // CLAHE yoksa histogram equalization fallback
        cv.equalizeHist(gray, result);
    }
    
    return result;
}

/**
 * Sauvola Thresholding
 * Adaptive threshold'dan daha iyi sonuç veren yöntem
 */
export function sauvolaThreshold(gray, windowSize = 25, k = 0.15, r = 128) {
    const h = gray.rows;
    const w = gray.cols;
    const halfWin = Math.floor(windowSize / 2);
    
    // Integral images için
    const integral = new cv.Mat();
    const sqIntegral = new cv.Mat();
    cv.integral(gray, integral, sqIntegral, cv.CV_64F);
    
    const result = new cv.Mat(h, w, cv.CV_8UC1);
    
    // Her piksel için local mean ve stddev hesapla
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const x1 = Math.max(0, x - halfWin);
            const y1 = Math.max(0, y - halfWin);
            const x2 = Math.min(w - 1, x + halfWin);
            const y2 = Math.min(h - 1, y + halfWin);
            
            const area = (x2 - x1 + 1) * (y2 - y1 + 1);
            
            // Mean from integral image
            const sum = integral.doubleAt(y2 + 1, x2 + 1) 
                      - integral.doubleAt(y1, x2 + 1)
                      - integral.doubleAt(y2 + 1, x1)
                      + integral.doubleAt(y1, x1);
            const mean = sum / area;
            
            // Stddev from squared integral image
            const sqSum = sqIntegral.doubleAt(y2 + 1, x2 + 1)
                        - sqIntegral.doubleAt(y1, x2 + 1)
                        - sqIntegral.doubleAt(y2 + 1, x1)
                        + sqIntegral.doubleAt(y1, x1);
            const variance = (sqSum / area) - (mean * mean);
            const stddev = Math.sqrt(Math.max(0, variance));
            
            // Sauvola threshold
            const threshold = mean * (1 + k * ((stddev / r) - 1));
            
            const pixel = gray.ucharAt(y, x);
            result.ucharPtr(y, x)[0] = pixel > threshold ? 0 : 255;
        }
    }
    
    integral.delete();
    sqIntegral.delete();
    
    return result;
}

/**
 * Ana preprocessing fonksiyonu
 * Tüm gelişmiş teknikleri birleştirir
 */
export function advancedPreprocess(srcMat, params = null) {
    // Parametre yoksa otomatik ayarla
    if (!params) {
        const autoResult = autoTuneParameters(srcMat);
        params = autoResult.params;
        
        // Shadow mode aktifse parametreleri override et
        const shadowMode = state.shadowMode || document.getElementById('shadowMode')?.checked;
        if (shadowMode) {
            params = { ...params, ...SHADOW_PARAMS };
        }
    }
    
    // Grayscale dönüşümü
    let gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    
    // Shadow removal
    if (params.shadowRemoval) {
        const shadowFree = removeShadows(srcMat);
        gray.delete();
        gray = shadowFree;
    }
    
    // White balance
    if (params.whiteBalance) {
        const balanced = applyLocalWhiteBalance(gray);
        gray.delete();
        gray = balanced;
    }
    
    // CLAHE
    if (params.clahe) {
        const claheResult = applyCLAHE(gray, params.claheClipLimit, params.claheTileSize);
        gray.delete();
        gray = claheResult;
    }
    
    // Gaussian blur
    const blur = new cv.Mat();
    if (params.blurSigma && params.blurSigma > 0) {
        cv.GaussianBlur(gray, blur, new cv.Size(0, 0), params.blurSigma, params.blurSigma);
    } else {
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    }
    gray.delete();
    
    // Adaptive thresholding
    const binary = new cv.Mat();
    const block = params.blockSize && params.blockSize % 2 === 1 
        ? params.blockSize 
        : (params.blockSize || 11) | 1;
    const cVal = params.cValue ?? 2;
    
    cv.adaptiveThreshold(
        blur, binary, 255, 
        cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv.THRESH_BINARY_INV, 
        block, cVal
    );
    
    blur.delete();
    
    return binary;
}

/**
 * Preprocessing parametrelerini al (mevcut API uyumluluğu için)
 */
export function getPreprocessParams() {
    const shadow = state.shadowMode || document.getElementById('shadowMode')?.checked;
    if (shadow) {
        return SHADOW_PARAMS;
    }
    return DEFAULT_PARAMS;
}

/**
 * Fill parametrelerini al (mevcut API uyumluluğu için)
 */
export function getFillParams() {
    const shadow = state.shadowMode || document.getElementById('shadowMode')?.checked;
    if (shadow) {
        return { roiScale: 1.02, maskRatio: 0.30, blankGuard: 0.14 };
    }
    return { roiScale: 1.04, maskRatio: 0.32, blankGuard: 0.18 };
}

/**
 * Fill parametrelerini kaliteye göre ayarla
 */
export function getAdaptiveFillParams(quality) {
    let params = getFillParams();
    
    // Düşük kalite için daha toleranslı parametreler
    if (quality && quality.overall < 60) {
        params.roiScale = Math.min(1.12, params.roiScale + 0.04);
        params.maskRatio = Math.max(0.26, params.maskRatio - 0.04);
        params.blankGuard = Math.max(0.12, params.blankGuard - 0.02);
    }
    
    // Gürültülü görüntü için
    if (quality && quality.noiseLevel > 10) {
        params.roiScale = Math.min(1.10, params.roiScale + 0.02);
    }
    
    return params;
}

