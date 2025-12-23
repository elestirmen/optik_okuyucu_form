/**
 * ArUco Marker Detection System with Cross-Marker Fallback
 * Bu modül, daha robust marker tespiti için ArUco ve klasik cross-marker'ı birleştirir.
 */

import { MARKER_OFFSET, MARKER_SIZE } from '../features/config.js';

// ArUco marker dictionary constants
const ARUCO_DICT_4X4_50 = 0;
const ARUCO_DICT_6X6_50 = 10;

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
 */
export function detectMarkersHybrid(srcMat, binary, overlay) {
    let method = 'none';
    let markers = null;
    let quality = 0;
    
    // 1. ArUco marker'ları dene
    try {
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        const arucoResult = detectArUcoMarkers(gray);
        gray.delete();
        
        if (arucoResult) {
            markers = extractCornersFromArUco(arucoResult, srcMat.cols, srcMat.rows);
            if (markers) {
                method = 'aruco';
                quality = 0.95; // ArUco genellikle yüksek kaliteli
                
                if (overlay) {
                    const blue = new cv.Scalar(0, 0, 255, 255);
                    for (const key of ['tl', 'tr', 'bl', 'br']) {
                        const pt = markers[key];
                        cv.circle(overlay, new cv.Point(pt.x, pt.y), 8, blue, 2);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('ArUco detection error:', e);
    }
    
    // 2. Cross-marker fallback
    if (!markers) {
        markers = detectCrossMarkers(binary, overlay);
        if (markers) {
            method = 'cross';
            quality = markers.quality?.avg || 0.7;
        }
    }
    
    // 3. 3 marker ile 4. tahmini (fallback)
    if (!markers) {
        markers = tryEstimateFourthMarker(binary, overlay);
        if (markers) {
            method = 'estimated';
            quality = 0.5;
        }
    }
    
    return {
        markers,
        method,
        quality,
        success: markers !== null
    };
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
 * Marker kalitesini değerlendir
 */
export function assessMarkerQuality(markers) {
    if (!markers) return { score: 0, issues: ['Marker bulunamadı'] };
    
    const issues = [];
    let score = 1.0;
    
    // Geometrik tutarlılık kontrolü
    const distTL_TR = Math.hypot(markers.tr.x - markers.tl.x, markers.tr.y - markers.tl.y);
    const distBL_BR = Math.hypot(markers.br.x - markers.bl.x, markers.br.y - markers.bl.y);
    const distTL_BL = Math.hypot(markers.bl.x - markers.tl.x, markers.bl.y - markers.tl.y);
    const distTR_BR = Math.hypot(markers.br.x - markers.tr.x, markers.br.y - markers.tr.y);
    
    // Yatay kenar tutarlılığı
    const hSkew = Math.abs(distTL_TR - distBL_BR) / Math.max(distTL_TR, distBL_BR);
    if (hSkew > 0.15) {
        issues.push('Yatay kenarlar tutarsız');
        score -= 0.2;
    }
    
    // Dikey kenar tutarlılığı
    const vSkew = Math.abs(distTL_BL - distTR_BR) / Math.max(distTL_BL, distTR_BR);
    if (vSkew > 0.15) {
        issues.push('Dikey kenarlar tutarsız');
        score -= 0.2;
    }
    
    // Aspect ratio kontrolü
    const avgW = (distTL_TR + distBL_BR) / 2;
    const avgH = (distTL_BL + distTR_BR) / 2;
    const aspect = avgW / avgH;
    if (aspect < 0.4 || aspect > 2.5) {
        issues.push('En-boy oranı anormal');
        score -= 0.3;
    }
    
    return {
        score: Math.max(0, score),
        issues,
        geometry: { hSkew, vSkew, aspect }
    };
}

