/**
 * ArUco Marker Detection System with Cross-Marker Fallback
 * Bu modül, daha robust marker tespiti için ArUco ve klasik cross-marker'ı birleştirir.
 * 
 * Stabilizasyon ve Robust Kontroller:
 * - Frame stabilizasyonu ile ani değişimleri filtreler
 * - Geometrik tutarlılık kontrolü ile yanlış tespitleri reddeder
 * - Outlier rejection ile mantıksız değişimleri engeller
 */

import { MARKER_OFFSET, MARKER_SIZE } from '../features/config.js';

// ArUco marker dictionary constants
const ARUCO_DICT_4X4_50 = 0;
const ARUCO_DICT_6X6_50 = 10;

// ============== FRAME STABILIZATION SYSTEM ==============

/**
 * Frame stabilizasyon konfigürasyonu
 * NOT: Stabilizasyon varsayılan olarak KAPALI - sadece warp için kalite kontrolleri aktif
 */
const STABILIZATION_CONFIG = {
    enabled: false,              // Stabilizasyon kapalı (sorun yaratıyordu)
    historySize: 3,              // Kaç frame tutulsun (azaltıldı)
    maxMovementPixels: 80,       // Bir frame'de max izin verilen piksel hareketi (artırıldı)
    maxMovementRatio: 0.15,      // Max hareket oranı (artırıldı - daha toleranslı)
    minStableFrames: 2,          // Stabil sayılmak için min frame sayısı
    smoothingFactor: 0.3,        // 0-1 arası (azaltıldı - daha az yapışkan)
    outlierThreshold: 3.0,       // Standart sapma çarpanı (artırıldı - daha toleranslı)
    aspectRatioRange: [0.4, 2.5], // Kabul edilebilir en-boy oranı aralığı (genişletildi)
    minAreaRatio: 0.03,          // Min form alanı / görüntü alanı oranı (azaltıldı)
    maxAreaRatio: 0.98,          // Max form alanı / görüntü alanı oranı
    maxSkewAngle: 30,            // Max eğiklik açısı (artırıldı)
    quadrilateralMinAngle: 40,   // Dörtgenin min iç açısı (azaltıldı - daha toleranslı)
    quadrilateralMaxAngle: 140   // Dörtgenin max iç açısı (artırıldı)
};

/**
 * Marker pozisyon geçmişi (frame stabilizasyonu için)
 */
let markerHistory = [];
let lastValidMarkers = null;
let stableFrameCount = 0;
let lastImageSize = { width: 0, height: 0 };

/**
 * Stabilizasyon sistemini sıfırla
 */
export function resetStabilization() {
    markerHistory = [];
    lastValidMarkers = null;
    stableFrameCount = 0;
}

/**
 * İki marker seti arasındaki mesafeyi hesapla
 */
function calculateMarkerDistance(markers1, markers2) {
    if (!markers1 || !markers2) return Infinity;
    
    let totalDist = 0;
    const corners = ['tl', 'tr', 'bl', 'br'];
    
    for (const corner of corners) {
        if (!markers1[corner] || !markers2[corner]) return Infinity;
        const dx = markers1[corner].x - markers2[corner].x;
        const dy = markers1[corner].y - markers2[corner].y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalDist / 4; // Ortalama mesafe
}

/**
 * Marker pozisyonlarının geçerli olup olmadığını kontrol et
 */
function validateMarkerPositions(markers, imgWidth, imgHeight) {
    if (!markers || !markers.tl || !markers.tr || !markers.bl || !markers.br) {
        return { valid: false, reason: 'Eksik marker köşesi' };
    }
    
    const corners = ['tl', 'tr', 'bl', 'br'];
    
    // Tüm köşelerin görüntü sınırları içinde olduğunu kontrol et
    for (const corner of corners) {
        const p = markers[corner];
        if (p.x < 0 || p.x > imgWidth || p.y < 0 || p.y > imgHeight) {
            return { valid: false, reason: `${corner} köşesi görüntü dışında` };
        }
    }
    
    // Köşelerin doğru sırada olduğunu kontrol et
    // TL sol üstte, TR sağ üstte, vs. olmalı
    const cx = imgWidth / 2;
    const cy = imgHeight / 2;
    
    if (markers.tl.x > cx || markers.tl.y > cy) {
        return { valid: false, reason: 'Sol üst köşe yanlış konumda' };
    }
    if (markers.tr.x < cx || markers.tr.y > cy) {
        return { valid: false, reason: 'Sağ üst köşe yanlış konumda' };
    }
    if (markers.bl.x > cx || markers.bl.y < cy) {
        return { valid: false, reason: 'Sol alt köşe yanlış konumda' };
    }
    if (markers.br.x < cx || markers.br.y < cy) {
        return { valid: false, reason: 'Sağ alt köşe yanlış konumda' };
    }
    
    return { valid: true };
}

/**
 * Dörtgenin geometrik tutarlılığını kontrol et
 */
function validateQuadrilateralGeometry(markers, imgWidth, imgHeight) {
    const issues = [];
    
    // Kenar uzunlukları
    const top = Math.hypot(markers.tr.x - markers.tl.x, markers.tr.y - markers.tl.y);
    const bottom = Math.hypot(markers.br.x - markers.bl.x, markers.br.y - markers.bl.y);
    const left = Math.hypot(markers.bl.x - markers.tl.x, markers.bl.y - markers.tl.y);
    const right = Math.hypot(markers.br.x - markers.tr.x, markers.br.y - markers.tr.y);
    
    // Köşegen uzunlukları
    const diag1 = Math.hypot(markers.br.x - markers.tl.x, markers.br.y - markers.tl.y);
    const diag2 = Math.hypot(markers.bl.x - markers.tr.x, markers.bl.y - markers.tr.y);
    
    // En-boy oranı kontrolü
    const avgWidth = (top + bottom) / 2;
    const avgHeight = (left + right) / 2;
    const aspectRatio = avgWidth / avgHeight;
    
    if (aspectRatio < STABILIZATION_CONFIG.aspectRatioRange[0] || 
        aspectRatio > STABILIZATION_CONFIG.aspectRatioRange[1]) {
        issues.push(`Anormal en-boy oranı: ${aspectRatio.toFixed(2)}`);
    }
    
    // Alan kontrolü
    // Shoelace formülü ile dörtgen alanı
    const area = 0.5 * Math.abs(
        (markers.tl.x * markers.tr.y - markers.tr.x * markers.tl.y) +
        (markers.tr.x * markers.br.y - markers.br.x * markers.tr.y) +
        (markers.br.x * markers.bl.y - markers.bl.x * markers.br.y) +
        (markers.bl.x * markers.tl.y - markers.tl.x * markers.bl.y)
    );
    const imgArea = imgWidth * imgHeight;
    const areaRatio = area / imgArea;
    
    if (areaRatio < STABILIZATION_CONFIG.minAreaRatio) {
        issues.push(`Form alanı çok küçük: ${(areaRatio * 100).toFixed(1)}%`);
    }
    if (areaRatio > STABILIZATION_CONFIG.maxAreaRatio) {
        issues.push(`Form alanı çok büyük: ${(areaRatio * 100).toFixed(1)}%`);
    }
    
    // Kenar oranları kontrolü (paralel kenarlar benzer uzunlukta olmalı)
    const hSkew = Math.abs(top - bottom) / Math.max(top, bottom);
    const vSkew = Math.abs(left - right) / Math.max(left, right);
    
    if (hSkew > 0.3) {
        issues.push(`Yatay kenarlar çok farklı: ${(hSkew * 100).toFixed(1)}% fark`);
    }
    if (vSkew > 0.3) {
        issues.push(`Dikey kenarlar çok farklı: ${(vSkew * 100).toFixed(1)}% fark`);
    }
    
    // Köşegen oranı kontrolü (dikdörtgene yakın olmalı)
    const diagRatio = Math.abs(diag1 - diag2) / Math.max(diag1, diag2);
    if (diagRatio > 0.25) {
        issues.push(`Köşegenler dengesiz: ${(diagRatio * 100).toFixed(1)}% fark`);
    }
    
    // İç açı kontrolü
    const angles = calculateQuadrilateralAngles(markers);
    for (let i = 0; i < angles.length; i++) {
        if (angles[i] < STABILIZATION_CONFIG.quadrilateralMinAngle || 
            angles[i] > STABILIZATION_CONFIG.quadrilateralMaxAngle) {
            issues.push(`Köşe ${i + 1} açısı anormal: ${angles[i].toFixed(1)}°`);
        }
    }
    
    return {
        valid: issues.length === 0,
        issues,
        geometry: {
            aspectRatio,
            areaRatio,
            hSkew,
            vSkew,
            diagRatio,
            angles
        }
    };
}

/**
 * Dörtgenin iç açılarını hesapla
 */
function calculateQuadrilateralAngles(markers) {
    const corners = [markers.tl, markers.tr, markers.br, markers.bl];
    const angles = [];
    
    for (let i = 0; i < 4; i++) {
        const p1 = corners[(i + 3) % 4]; // Önceki nokta
        const p2 = corners[i];            // Mevcut nokta
        const p3 = corners[(i + 1) % 4]; // Sonraki nokta
        
        // Vektörler
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        // İç çarpım
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (mag1 > 0 && mag2 > 0) {
            const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
            angles.push(Math.acos(cosAngle) * 180 / Math.PI);
        } else {
            angles.push(90); // Default
        }
    }
    
    return angles;
}

/**
 * Outlier kontrolü - ani değişimleri tespit et
 */
function isOutlier(currentMarkers, history, imgWidth) {
    if (history.length < 2) return false;
    
    // Son marker'larla karşılaştır
    const lastMarkers = history[history.length - 1];
    const dist = calculateMarkerDistance(currentMarkers, lastMarkers);
    
    // Görüntü boyutuna göre maksimum hareket
    const maxMove = Math.min(
        STABILIZATION_CONFIG.maxMovementPixels,
        imgWidth * STABILIZATION_CONFIG.maxMovementRatio
    );
    
    if (dist > maxMove) {
        return true;
    }
    
    // İstatistiksel outlier kontrolü
    if (history.length >= 3) {
        const movements = [];
        for (let i = 1; i < history.length; i++) {
            movements.push(calculateMarkerDistance(history[i], history[i - 1]));
        }
        
        const mean = movements.reduce((a, b) => a + b, 0) / movements.length;
        const variance = movements.reduce((a, b) => a + (b - mean) ** 2, 0) / movements.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 0 && dist > mean + stdDev * STABILIZATION_CONFIG.outlierThreshold) {
            return true;
        }
    }
    
    return false;
}

/**
 * Marker pozisyonlarını smooth et (yumuşat)
 */
function smoothMarkers(currentMarkers, history) {
    if (!currentMarkers || history.length === 0) return currentMarkers;
    
    const smoothed = {};
    const factor = STABILIZATION_CONFIG.smoothingFactor;
    const lastValid = history[history.length - 1];
    
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
        if (currentMarkers[corner] && lastValid[corner]) {
            smoothed[corner] = {
                x: currentMarkers[corner].x * (1 - factor) + lastValid[corner].x * factor,
                y: currentMarkers[corner].y * (1 - factor) + lastValid[corner].y * factor
            };
        } else {
            smoothed[corner] = currentMarkers[corner];
        }
    }
    
    return smoothed;
}

/**
 * Stabilize edilmiş marker tespiti
 * Ana fonksiyon - stabilizasyon kapalıysa sadece validasyon yapar
 */
export function stabilizeMarkers(rawMarkers, imgWidth, imgHeight) {
    // Stabilizasyon kapalıysa sadece basit validasyon yap
    if (!STABILIZATION_CONFIG.enabled) {
        if (!rawMarkers) {
            return { markers: null, stabilized: false, reason: 'Marker bulunamadı' };
        }
        
        // Sadece temel pozisyon kontrolü
        const posValidation = validateMarkerPositions(rawMarkers, imgWidth, imgHeight);
        if (!posValidation.valid) {
            return { markers: null, stabilized: false, reason: posValidation.reason };
        }
        
        // Ham marker'ları doğrudan döndür
        return { 
            markers: rawMarkers, 
            stabilized: false, 
            reason: null 
        };
    }
    
    // === Stabilizasyon aktif ise (varsayılan olarak kapalı) ===
    
    // Görüntü boyutu değiştiyse geçmişi sıfırla
    if (Math.abs(imgWidth - lastImageSize.width) > 10 || 
        Math.abs(imgHeight - lastImageSize.height) > 10) {
        resetStabilization();
        lastImageSize = { width: imgWidth, height: imgHeight };
    }
    
    // Ham marker yoksa son geçerli olanı döndür
    if (!rawMarkers) {
        if (lastValidMarkers && stableFrameCount > 0) {
            stableFrameCount--;
            return { 
                markers: lastValidMarkers, 
                stabilized: true, 
                reason: 'Son geçerli marker kullanıldı'
            };
        }
        return { markers: null, stabilized: false, reason: 'Marker bulunamadı' };
    }
    
    // Pozisyon validasyonu
    const posValidation = validateMarkerPositions(rawMarkers, imgWidth, imgHeight);
    if (!posValidation.valid) {
        if (lastValidMarkers) {
            return { 
                markers: lastValidMarkers, 
                stabilized: true, 
                reason: posValidation.reason 
            };
        }
        return { markers: null, stabilized: false, reason: posValidation.reason };
    }
    
    // Geometri validasyonu
    const geoValidation = validateQuadrilateralGeometry(rawMarkers, imgWidth, imgHeight);
    if (!geoValidation.valid && geoValidation.issues.length > 2) {
        // Çok fazla geometri sorunu varsa reddet
        if (lastValidMarkers) {
            return { 
                markers: lastValidMarkers, 
                stabilized: true, 
                reason: geoValidation.issues[0]
            };
        }
        return { markers: null, stabilized: false, reason: geoValidation.issues[0] };
    }
    
    // Outlier kontrolü
    if (isOutlier(rawMarkers, markerHistory, imgWidth)) {
        if (lastValidMarkers) {
            return { 
                markers: lastValidMarkers, 
                stabilized: true, 
                reason: 'Ani değişim filtrelendi'
            };
        }
        // Geçmiş yoksa yine de kabul et
    }
    
    // Smoothing uygula
    let finalMarkers = rawMarkers;
    if (markerHistory.length >= STABILIZATION_CONFIG.minStableFrames) {
        finalMarkers = smoothMarkers(rawMarkers, markerHistory);
    }
    
    // Geçmişe ekle
    markerHistory.push(finalMarkers);
    if (markerHistory.length > STABILIZATION_CONFIG.historySize) {
        markerHistory.shift();
    }
    
    // Son geçerli olarak kaydet
    lastValidMarkers = finalMarkers;
    stableFrameCount = STABILIZATION_CONFIG.historySize;
    
    return { 
        markers: finalMarkers, 
        stabilized: markerHistory.length > 1,
        geometry: geoValidation.geometry
    };
}

/**
 * Stabilizasyon durumunu al
 */
export function getStabilizationStatus() {
    return {
        historySize: markerHistory.length,
        stableFrames: stableFrameCount,
        hasValidMarkers: lastValidMarkers !== null,
        isStable: markerHistory.length >= STABILIZATION_CONFIG.minStableFrames
    };
}

// ============== END FRAME STABILIZATION SYSTEM ==============

/**
 * ArUco marker'ları tespit et
 * OpenCV.js ArUco modülü yüklüyse kullanır, yoksa null döner
 */
export function detectArUcoMarkers(grayMat) {
    // OpenCV.js'te ArUco modülü kontrol et
    if (!cv.aruco || !cv.aruco.detectMarkers) {
        return null;
    }

    try {
        const dictionary = cv.aruco.getPredefinedDictionary(ARUCO_DICT_4X4_50);
        const parameters = cv.aruco.DetectorParameters_create();
        
        // Parametre optimizasyonu - düşük ışık ve perspektif için
        parameters.adaptiveThreshWinSizeMin = 3;
        parameters.adaptiveThreshWinSizeMax = 23;
        parameters.adaptiveThreshWinSizeStep = 10;
        parameters.adaptiveThreshConstant = 7;
        parameters.minMarkerPerimeterRate = 0.015;
        parameters.maxMarkerPerimeterRate = 0.5;
        parameters.polygonalApproxAccuracyRate = 0.05;
        parameters.minCornerDistanceRate = 0.05;
        parameters.minDistanceToBorder = 3;
        parameters.cornerRefinementMethod = 1; // CORNER_REFINE_SUBPIX
        parameters.cornerRefinementWinSize = 5;
        parameters.cornerRefinementMaxIterations = 30;
        
        const corners = new cv.MatVector();
        const ids = new cv.Mat();
        const rejected = new cv.MatVector();
        
        cv.aruco.detectMarkers(grayMat, dictionary, corners, ids, parameters, rejected);
        
        const result = {
            corners: [],
            ids: [],
            count: ids.rows
        };
        
        for (let i = 0; i < ids.rows; i++) {
            const id = ids.intAt(i, 0);
            const corner = corners.get(i);
            const pts = [];
            for (let j = 0; j < 4; j++) {
                pts.push({
                    x: corner.floatAt(0, j * 2),
                    y: corner.floatAt(0, j * 2 + 1)
                });
            }
            result.corners.push(pts);
            result.ids.push(id);
        }
        
        // Cleanup
        corners.delete();
        ids.delete();
        rejected.delete();
        dictionary.delete();
        parameters.delete();
        
        return result.count >= 4 ? result : null;
    } catch (e) {
        console.warn('ArUco detection failed:', e);
        return null;
    }
}

/**
 * ArUco marker sonuçlarından köşe noktalarını çıkar
 * Marker ID'lerine göre köşeleri eşleştirir (0=TL, 1=TR, 2=BR, 3=BL)
 */
export function extractCornersFromArUco(arucoResult, imgWidth, imgHeight) {
    if (!arucoResult || arucoResult.count < 4) return null;
    
    const cornerMap = {};
    const cx = imgWidth / 2;
    const cy = imgHeight / 2;
    
    // Her marker için merkez hesapla ve köşeye ata
    for (let i = 0; i < arucoResult.ids.length; i++) {
        const id = arucoResult.ids[i];
        const pts = arucoResult.corners[i];
        
        // Marker merkezi
        const center = {
            x: (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4,
            y: (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4
        };
        
        // ID'ye göre veya pozisyona göre köşe belirle
        let cornerKey;
        if (id >= 0 && id <= 3) {
            // ID bazlı: 0=TL, 1=TR, 2=BR, 3=BL
            cornerKey = ['tl', 'tr', 'br', 'bl'][id];
        } else {
            // Pozisyon bazlı fallback
            const left = center.x < cx;
            const top = center.y < cy;
            if (left && top) cornerKey = 'tl';
            else if (!left && top) cornerKey = 'tr';
            else if (!left && !top) cornerKey = 'br';
            else cornerKey = 'bl';
        }
        
        // İç köşe noktasını kullan (formun içine bakan köşe)
        const innerCorner = getInnerCornerPoint(pts, cornerKey);
        cornerMap[cornerKey] = innerCorner;
    }
    
    if (!cornerMap.tl || !cornerMap.tr || !cornerMap.bl || !cornerMap.br) {
        return null;
    }
    
    return cornerMap;
}

/**
 * Marker'ın iç köşe noktasını hesapla
 */
function getInnerCornerPoint(pts, cornerKey) {
    // ArUco marker köşeleri saat yönünde: 0=TL, 1=TR, 2=BR, 3=BL (marker'ın kendi köşeleri)
    // Form köşesine göre iç köşeyi seç
    const cornerIndices = {
        'tl': 2, // Marker'ın BR köşesi = formun TL iç köşesi
        'tr': 3, // Marker'ın BL köşesi = formun TR iç köşesi
        'br': 0, // Marker'ın TL köşesi = formun BR iç köşesi
        'bl': 1  // Marker'ın TR köşesi = formun BL iç köşesi
    };
    
    const idx = cornerIndices[cornerKey];
    return pts[idx];
}

/**
 * Cross-marker kalite değerlendirmesi (mevcut sistemden)
 */
export function evaluateCrossMarkerQuality(binary, rect) {
    try {
        const roi = binary.roi(rect);
        const w = roi.cols;
        const h = roi.rows;
        const size = Math.min(w, h);
        if (size < 14) { roi.delete(); return 0; }

        const border = Math.max(2, Math.floor(size * 0.2));
        const lineW = Math.max(2, Math.floor(size * 0.14));
        const innerW = w - border * 2;
        const innerH = h - border * 2;
        if (innerW <= 4 || innerH <= 4) { roi.delete(); return 0; }

        const countRect = (r) => {
            const sub = roi.roi(r);
            const n = cv.countNonZero(sub);
            sub.delete();
            return n;
        };

        const top = new cv.Rect(0, 0, w, border);
        const bottom = new cv.Rect(0, h - border, w, border);
        const left = new cv.Rect(0, border, border, innerH);
        const right = new cv.Rect(w - border, border, border, innerH);

        const borderArea = w * border * 2 + innerH * border * 2;
        const borderWhite = countRect(top) + countRect(bottom) + countRect(left) + countRect(right);
        const borderRatio = borderArea > 0 ? borderWhite / borderArea : 0;

        const inner = new cv.Rect(border, border, innerW, innerH);
        const innerArea = innerW * innerH;
        const innerWhite = countRect(inner);
        const innerRatio = innerArea > 0 ? innerWhite / innerArea : 0;

        const midX = Math.max(border, Math.min(w - border - lineW, Math.round(w / 2 - lineW / 2)));
        const midY = Math.max(border, Math.min(h - border - lineW, Math.round(h / 2 - lineW / 2)));
        const vStrip = new cv.Rect(midX, border, lineW, innerH);
        const hStrip = new cv.Rect(border, midY, innerW, lineW);
        const vRatio = (lineW * innerH) > 0 ? countRect(vStrip) / (lineW * innerH) : 0;
        const hRatio = (innerW * lineW) > 0 ? countRect(hStrip) / (innerW * lineW) : 0;

        roi.delete();

        const clamp01 = v => Math.max(0, Math.min(1, v));
        const borderScore = clamp01((borderRatio - 0.25) / 0.55);
        const vScore = clamp01((vRatio - 0.20) / 0.65);
        const hScore = clamp01((hRatio - 0.20) / 0.65);
        let score = borderScore * 0.35 + vScore * 0.325 + hScore * 0.325;
        if (innerRatio < 0.06 || innerRatio > 0.90) score *= 0.6;
        return score;
    } catch {
        return 0;
    }
}

/**
 * Cross-marker tespiti (mevcut sistemden geliştirilmiş)
 */
export function detectCrossMarkers(binary, overlay) {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = [];
    const imgArea = binary.rows * binary.cols;

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < imgArea * 0.0003 || area > imgArea * 0.02) continue;

        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        if (aspect > 0.55 && aspect < 1.8) {
            const hull = new cv.Mat();
            cv.convexHull(cnt, hull);
            const solidity = area / cv.contourArea(hull);
            hull.delete();

            if (solidity > 0.6) {
                const quality = evaluateCrossMarkerQuality(binary, rect);
                if (quality < 0.45) continue;
                candidates.push({
                    center: (() => {
                        const m = cv.moments(cnt, false);
                        if (m.m00) return { x: m.m10 / m.m00, y: m.m01 / m.m00 };
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    })(),
                    rect,
                    quality
                });
            }
        }
    }

    contours.delete(); hierarchy.delete();
    if (candidates.length < 4) return null;

    const cx = binary.cols / 2, cy = binary.rows / 2;
    const maxDim = Math.max(binary.cols, binary.rows) || 1;
    let tl, tr, bl, br;
    let tlRank = -Infinity, trRank = -Infinity, blRank = -Infinity, brRank = -Infinity;

    for (const c of candidates) {
        const left = c.center.x < cx, top = c.center.y < cy;
        const d = (x, y) => Math.hypot(c.center.x - x, c.center.y - y);

        if (left && top) {
            const rank = c.quality * 2 - d(0, 0) / maxDim;
            if (rank > tlRank) { tlRank = rank; tl = c; }
        }
        if (!left && top) {
            const rank = c.quality * 2 - d(binary.cols, 0) / maxDim;
            if (rank > trRank) { trRank = rank; tr = c; }
        }
        if (left && !top) {
            const rank = c.quality * 2 - d(0, binary.rows) / maxDim;
            if (rank > blRank) { blRank = rank; bl = c; }
        }
        if (!left && !top) {
            const rank = c.quality * 2 - d(binary.cols, binary.rows) / maxDim;
            if (rank > brRank) { brRank = rank; br = c; }
        }
    }

    if (!tl || !tr || !bl || !br) return null;

    if (overlay) {
        const green = new cv.Scalar(0, 255, 0, 255);
        [tl, tr, bl, br].forEach(m => {
            cv.rectangle(overlay, new cv.Point(m.rect.x, m.rect.y),
                new cv.Point(m.rect.x + m.rect.width, m.rect.y + m.rect.height), green, 2);
        });
    }

    return {
        tl: tl.center,
        tr: tr.center,
        bl: bl.center,
        br: br.center,
        quality: {
            tl: tl.quality,
            tr: tr.quality,
            bl: bl.quality,
            br: br.quality,
            avg: (tl.quality + tr.quality + bl.quality + br.quality) / 4
        }
    };
}

/**
 * Hybrid marker tespiti - ArUco öncelikli, cross-marker fallback
 * Stabilizasyon ve kalite kontrolleri entegre edildi
 */
export function detectMarkersHybrid(srcMat, binary, overlay, useStabilization = true) {
    let method = 'none';
    let rawMarkers = null;
    let quality = 0;
    let stabilizationInfo = null;
    
    const imgWidth = srcMat.cols;
    const imgHeight = srcMat.rows;
    
    // 1. ArUco marker'ları dene
    try {
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        const arucoResult = detectArUcoMarkers(gray);
        gray.delete();
        
        if (arucoResult) {
            rawMarkers = extractCornersFromArUco(arucoResult, imgWidth, imgHeight);
            if (rawMarkers) {
                method = 'aruco';
                quality = 0.95;
            }
        }
    } catch (e) {
        console.warn('ArUco detection error:', e);
    }
    
    // 2. Cross-marker fallback
    if (!rawMarkers) {
        rawMarkers = detectCrossMarkers(binary, null); // Overlay'ı sonra çiz
        if (rawMarkers) {
            method = 'cross';
            quality = rawMarkers.quality?.avg || 0.7;
        }
    }
    
    // 3. 3 marker ile 4. tahmini (sadece çok düşük kalite durumunda)
    if (!rawMarkers) {
        rawMarkers = tryEstimateFourthMarker(binary, null);
        if (rawMarkers) {
            method = 'estimated';
            quality = 0.4; // Daha düşük güven
        }
    }
    
    // 4. Kalite kontrolü
    let markers = rawMarkers;
    const qualityAssessment = assessMarkerQuality(rawMarkers, imgWidth, imgHeight);
    
    if (rawMarkers && !qualityAssessment.valid) {
        // Kalite yetersiz - stabilizasyon devreye girsin
        quality = Math.min(quality, qualityAssessment.score);
    }
    
    // 5. Stabilizasyon uygula
    if (useStabilization && rawMarkers) {
        stabilizationInfo = stabilizeMarkers(rawMarkers, imgWidth, imgHeight);
        
        if (stabilizationInfo.stabilized) {
            markers = stabilizationInfo.markers;
            method = method + '+stable';
        } else if (!stabilizationInfo.markers) {
            // Stabilizasyon reddetti - son geçerli marker de yok
            markers = null;
        } else {
            markers = stabilizationInfo.markers;
        }
    } else if (!useStabilization && rawMarkers) {
        // Stabilizasyon kapalıysa sadece basit validasyon
        if (!qualityAssessment.valid && qualityAssessment.score < 0.3) {
            markers = null;
        }
    }
    
    // 6. Overlay çiz
    if (overlay && markers) {
        drawMarkerOverlay(overlay, markers, method, qualityAssessment);
    }
    
    return {
        markers,
        rawMarkers,
        method,
        quality: qualityAssessment.score || quality,
        qualityAssessment,
        stabilizationInfo,
        success: markers !== null
    };
}

/**
 * Marker overlay'ını çiz
 */
function drawMarkerOverlay(overlay, markers, method, quality) {
    if (!markers) return;
    
    // Renk seçimi kaliteye göre
    let color;
    if (quality.score >= 0.8) {
        color = new cv.Scalar(0, 255, 0, 255); // Yeşil - iyi
    } else if (quality.score >= 0.5) {
        color = new cv.Scalar(0, 255, 255, 255); // Sarı - orta
    } else {
        color = new cv.Scalar(0, 165, 255, 255); // Turuncu - düşük
    }
    
    const corners = ['tl', 'tr', 'br', 'bl', 'tl']; // Kapalı dörtgen için tl tekrar
    
    // Dörtgen çiz
    for (let i = 0; i < 4; i++) {
        const p1 = markers[corners[i]];
        const p2 = markers[corners[i + 1]];
        cv.line(overlay, 
            new cv.Point(Math.round(p1.x), Math.round(p1.y)),
            new cv.Point(Math.round(p2.x), Math.round(p2.y)),
            color, 2
        );
    }
    
    // Köşe noktalarını çiz
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
        const pt = markers[corner];
        cv.circle(overlay, new cv.Point(Math.round(pt.x), Math.round(pt.y)), 6, color, -1);
        
        // İç nokta (farklı renk)
        const innerColor = method.includes('aruco') 
            ? new cv.Scalar(255, 0, 0, 255) // Mavi - ArUco
            : new cv.Scalar(255, 255, 255, 255); // Beyaz - Cross
        cv.circle(overlay, new cv.Point(Math.round(pt.x), Math.round(pt.y)), 3, innerColor, -1);
    }
}

/**
 * 3 marker varsa 4. marker'ı tahmin et
 */
function tryEstimateFourthMarker(binary, overlay) {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = [];
    const imgArea = binary.rows * binary.cols;

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < imgArea * 0.0003 || area > imgArea * 0.02) continue;

        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        if (aspect > 0.55 && aspect < 1.8) {
            const quality = evaluateCrossMarkerQuality(binary, rect);
            if (quality >= 0.35) { // Daha düşük eşik
                const m = cv.moments(cnt, false);
                const center = m.m00 ? { x: m.m10 / m.m00, y: m.m01 / m.m00 } 
                    : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                candidates.push({ center, rect, quality });
            }
        }
    }

    contours.delete(); hierarchy.delete();
    
    if (candidates.length < 3) return null;
    
    // En iyi 3 marker'ı bul ve 4.'yü tahmin et
    candidates.sort((a, b) => b.quality - a.quality);
    const top3 = candidates.slice(0, 3);
    
    const cx = binary.cols / 2;
    const cy = binary.rows / 2;
    
    // Hangi köşeler mevcut?
    const corners = { tl: null, tr: null, bl: null, br: null };
    for (const c of top3) {
        const left = c.center.x < cx;
        const top = c.center.y < cy;
        const key = (left ? '' : 'r') + (top ? 't' : 'b');
        const cornerKey = left && top ? 'tl' : !left && top ? 'tr' : left && !top ? 'bl' : 'br';
        if (!corners[cornerKey] || corners[cornerKey].quality < c.quality) {
            corners[cornerKey] = c.center;
        }
    }
    
    // Eksik köşeyi tahmin et
    const missing = Object.keys(corners).find(k => !corners[k]);
    if (!missing) {
        return {
            tl: corners.tl,
            tr: corners.tr,
            bl: corners.bl,
            br: corners.br
        };
    }
    
    // Karşı köşelerden tahmin
    let estimated;
    if (missing === 'tl' && corners.tr && corners.bl && corners.br) {
        estimated = {
            x: corners.bl.x + (corners.tr.x - corners.br.x),
            y: corners.tr.y + (corners.bl.y - corners.br.y)
        };
    } else if (missing === 'tr' && corners.tl && corners.bl && corners.br) {
        estimated = {
            x: corners.br.x + (corners.tl.x - corners.bl.x),
            y: corners.tl.y + (corners.br.y - corners.bl.y)
        };
    } else if (missing === 'bl' && corners.tl && corners.tr && corners.br) {
        estimated = {
            x: corners.tl.x + (corners.br.x - corners.tr.x),
            y: corners.br.y + (corners.tl.y - corners.tr.y)
        };
    } else if (missing === 'br' && corners.tl && corners.tr && corners.bl) {
        estimated = {
            x: corners.tr.x + (corners.bl.x - corners.tl.x),
            y: corners.bl.y + (corners.tr.y - corners.tl.y)
        };
    }
    
    if (!estimated) return null;
    
    corners[missing] = estimated;
    
    if (overlay) {
        const yellow = new cv.Scalar(255, 255, 0, 255);
        cv.circle(overlay, new cv.Point(estimated.x, estimated.y), 10, yellow, 2);
    }
    
    return corners;
}

/**
 * Marker kalitesini değerlendir (Geliştirilmiş versiyon)
 * Daha sıkı kontroller ve detaylı analiz
 */
export function assessMarkerQuality(markers, imgWidth = 0, imgHeight = 0) {
    if (!markers) return { score: 0, issues: ['Marker bulunamadı'], valid: false };
    
    // Tüm köşeler mevcut mu?
    const corners = ['tl', 'tr', 'bl', 'br'];
    for (const corner of corners) {
        if (!markers[corner] || typeof markers[corner].x !== 'number' || typeof markers[corner].y !== 'number') {
            return { score: 0, issues: [`${corner} köşesi eksik`], valid: false };
        }
    }
    
    const issues = [];
    let score = 1.0;
    
    // Kenar uzunlukları
    const distTL_TR = Math.hypot(markers.tr.x - markers.tl.x, markers.tr.y - markers.tl.y);
    const distBL_BR = Math.hypot(markers.br.x - markers.bl.x, markers.br.y - markers.bl.y);
    const distTL_BL = Math.hypot(markers.bl.x - markers.tl.x, markers.bl.y - markers.tl.y);
    const distTR_BR = Math.hypot(markers.br.x - markers.tr.x, markers.br.y - markers.tr.y);
    
    // Köşegen uzunlukları
    const diag1 = Math.hypot(markers.br.x - markers.tl.x, markers.br.y - markers.tl.y);
    const diag2 = Math.hypot(markers.bl.x - markers.tr.x, markers.bl.y - markers.tr.y);
    
    // Minimum kenar uzunluğu kontrolü (çok küçük form tespiti engelle)
    const minEdge = Math.min(distTL_TR, distBL_BR, distTL_BL, distTR_BR);
    if (minEdge < 30) {
        issues.push('Kenarlar çok kısa');
        score -= 0.5;
    }
    
    // Yatay kenar tutarlılığı (daha sıkı: 0.12 yerine 0.15)
    const hSkew = Math.abs(distTL_TR - distBL_BR) / Math.max(distTL_TR, distBL_BR);
    if (hSkew > 0.20) {
        issues.push(`Yatay kenarlar çok tutarsız (${(hSkew * 100).toFixed(0)}%)`);
        score -= 0.35;
    } else if (hSkew > 0.12) {
        issues.push(`Yatay eğiklik (${(hSkew * 100).toFixed(0)}%)`);
        score -= 0.15;
    }
    
    // Dikey kenar tutarlılığı
    const vSkew = Math.abs(distTL_BL - distTR_BR) / Math.max(distTL_BL, distTR_BR);
    if (vSkew > 0.20) {
        issues.push(`Dikey kenarlar çok tutarsız (${(vSkew * 100).toFixed(0)}%)`);
        score -= 0.35;
    } else if (vSkew > 0.12) {
        issues.push(`Dikey eğiklik (${(vSkew * 100).toFixed(0)}%)`);
        score -= 0.15;
    }
    
    // Köşegen oranı kontrolü (dikdörtgene yakınlık)
    const diagRatio = Math.abs(diag1 - diag2) / Math.max(diag1, diag2);
    if (diagRatio > 0.20) {
        issues.push(`Köşegenler dengesiz (${(diagRatio * 100).toFixed(0)}%)`);
        score -= 0.25;
    } else if (diagRatio > 0.10) {
        score -= 0.1;
    }
    
    // Aspect ratio kontrolü (daha sıkı aralık)
    const avgW = (distTL_TR + distBL_BR) / 2;
    const avgH = (distTL_BL + distTR_BR) / 2;
    const aspect = avgW / avgH;
    if (aspect < 0.45 || aspect > 2.2) {
        issues.push(`En-boy oranı anormal (${aspect.toFixed(2)})`);
        score -= 0.4;
    } else if (aspect < 0.55 || aspect > 1.8) {
        score -= 0.1;
    }
    
    // Köşe açıları kontrolü
    const angles = calculateQuadrilateralAngles(markers);
    const angleIssues = angles.filter(a => a < 50 || a > 130);
    if (angleIssues.length > 0) {
        issues.push(`${angleIssues.length} köşe açısı anormal`);
        score -= angleIssues.length * 0.15;
    }
    
    // Konvekslik kontrolü (dörtgen dışbükey olmalı)
    if (!isConvexQuadrilateral(markers)) {
        issues.push('Dörtgen içbükey');
        score -= 0.5;
    }
    
    // Alan kontrolü (görüntü boyutu verilmişse)
    if (imgWidth > 0 && imgHeight > 0) {
        const area = calculateQuadrilateralArea(markers);
        const imgArea = imgWidth * imgHeight;
        const areaRatio = area / imgArea;
        
        if (areaRatio < 0.03) {
            issues.push('Form çok küçük');
            score -= 0.3;
        } else if (areaRatio > 0.98) {
            issues.push('Form çok büyük');
            score -= 0.2;
        }
    }
    
    // Skor sınırla
    score = Math.max(0, Math.min(1, score));
    
    return {
        score,
        issues,
        valid: score >= 0.4, // Minimum kabul edilebilir skor
        geometry: { 
            hSkew, 
            vSkew, 
            diagRatio,
            aspect,
            angles,
            avgWidth: avgW,
            avgHeight: avgH
        }
    };
}

/**
 * Dörtgenin konveks olup olmadığını kontrol et
 */
function isConvexQuadrilateral(markers) {
    const pts = [markers.tl, markers.tr, markers.br, markers.bl];
    let sign = 0;
    
    for (let i = 0; i < 4; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % 4];
        const p3 = pts[(i + 2) % 4];
        
        const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
        
        if (cross !== 0) {
            if (sign === 0) {
                sign = cross > 0 ? 1 : -1;
            } else if ((cross > 0 ? 1 : -1) !== sign) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Dörtgen alanını hesapla (Shoelace formülü)
 */
function calculateQuadrilateralArea(markers) {
    return 0.5 * Math.abs(
        (markers.tl.x * markers.tr.y - markers.tr.x * markers.tl.y) +
        (markers.tr.x * markers.br.y - markers.br.x * markers.tr.y) +
        (markers.br.x * markers.bl.y - markers.bl.x * markers.br.y) +
        (markers.bl.x * markers.tl.y - markers.tl.x * markers.bl.y)
    );
}

