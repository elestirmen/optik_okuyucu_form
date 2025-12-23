import { state } from '../features/state.js';
import { MARKER_OFFSET, MARKER_SIZE } from '../features/config.js';
import { updateStatus, setLog } from '../utils/helpers.js';
import { playSuccessChime } from './audio.js';
import { renderResults, safeAddSessionResult } from '../features/results.js';
import { initCamera, stopCamera, loadCameraDevices } from './camera.js';
import jsQR from 'jsqr';
// Removed circular dependencies or unused imports if any

const BASE_FILL_ROI_SCALE = 1.04;
const BASE_FILL_MASK_RATIO = 0.32;
const BASE_BLANK_GUARD = 0.18;
const WARP_SKEW_LIMIT = 0.15;
const WARP_AREA_MIN_RATIO = 0.10;
const CAPTURE_MAX_DIM = 1280;
const BLUR_VAR_WARN = 25;
const BLUR_VAR_REJECT = 12;

let uploadedImage = null;
let lastQrCheckAtMs = 0;
let lastQrCorner = null;

// ... (Previous exports: getPreprocessParams, preprocessToBinary, getFillParams - keep them) ...
// I will rewrite the whole file to ensure completeness

export function getPreprocessParams() {
    const shadow = state.shadowMode || (document.getElementById('shadowMode')?.checked);
    if (shadow) {
        return { clahe: true, blurSigma: 1.0, blockSize: 13, cValue: 3 };
    }
    return { clahe: false, blurSigma: 0, blockSize: 11, cValue: 2 };
}

export function preprocessToBinary(srcMat) {
    const p = getPreprocessParams();
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    if (p.clahe && cv.CLAHE) {
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(gray, gray);
        clahe.delete();
    }
    const blur = new cv.Mat();
    if (p.blurSigma && p.blurSigma > 0) {
        cv.GaussianBlur(gray, blur, new cv.Size(0, 0), p.blurSigma, p.blurSigma);
    } else {
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    }
    const binary = new cv.Mat();
    const block = p.blockSize && p.blockSize % 2 === 1 ? p.blockSize : (p.blockSize || 11) | 1;
    const cVal = p.cValue ?? 2;
    cv.adaptiveThreshold(blur, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, block, cVal);
    gray.delete(); blur.delete();
    return binary;
}

export function getFillParams() {
    const shadow = state.shadowMode || (document.getElementById('shadowMode')?.checked);
    if (shadow) {
        return { roiScale: 1.02, maskRatio: 0.30, blankGuard: 0.14 };
    }
    return { roiScale: BASE_FILL_ROI_SCALE, maskRatio: BASE_FILL_MASK_RATIO, blankGuard: BASE_BLANK_GUARD };
}

function estimateLaplacianVariance(srcMat) {
    if (!cv?.Laplacian) return null;
    const gray = new cv.Mat();
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);

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
    gray.delete();

    return variance;
}

function decodeQrFromRect(rgbaMat, rect) {
    try {
        const roi = rgbaMat.roi(rect);
        const roiCopy = roi.clone();
        roi.delete();

        const data = new Uint8ClampedArray(
            roiCopy.data.buffer,
            roiCopy.data.byteOffset,
            roiCopy.data.byteLength
        );
        const res = jsQR(data, roiCopy.cols, roiCopy.rows);
        roiCopy.delete();

        if (res?.data) return res;
        return null;
    } catch {
        return null;
    }
}

function findQrCorner(warpMat) {
    if (!warpMat || !warpMat.cols || !warpMat.rows) return null;

    const w = warpMat.cols;
    const h = warpMat.rows;
    const minSide = Math.min(w, h);

    const pad = Math.max(4, Math.round(minSide * 0.04));
    const maxPossible = Math.min(w - pad * 2, h - pad * 2);
    const roiSize = Math.min(maxPossible, Math.max(120, Math.round(minSide * 0.32)));
    if (roiSize < 80) return null;

    const corners = [
        { key: 'tr', x: w - roiSize - pad, y: pad },
        { key: 'tl', x: pad, y: pad },
        { key: 'br', x: w - roiSize - pad, y: h - roiSize - pad },
        { key: 'bl', x: pad, y: h - roiSize - pad },
    ];

    for (const c of corners) {
        const x = Math.max(0, Math.min(w - roiSize, Math.round(c.x)));
        const y = Math.max(0, Math.min(h - roiSize, Math.round(c.y)));
        const rect = new cv.Rect(x, y, roiSize, roiSize);
        const decoded = decodeQrFromRect(warpMat, rect);
        if (decoded?.data) return { corner: c.key, data: decoded.data };
    }
    return null;
}

function remapMarkersByQrCorner(markers, qrCorner) {
    if (qrCorner === 'bl') {
        // QR alt-sol -> form ters (180°)
        return { tl: markers.br, tr: markers.bl, br: markers.tl, bl: markers.tr };
    }
    if (qrCorner === 'tl') {
        // QR üst-sol -> form 90° sola dönük (düzelt: 90° sağ)
        return { tl: markers.tr, tr: markers.tl, br: markers.bl, bl: markers.br };
    }
    if (qrCorner === 'br') {
        // QR alt-sağ -> form 90° sağa dönük (düzelt: 90° sol)
        return { tl: markers.bl, tr: markers.br, br: markers.tr, bl: markers.tl };
    }
    return markers;
}

function labelForQrCorner(qrCorner) {
    if (qrCorner === 'bl') return '180°';
    if (qrCorner === 'tl') return '90° sağ';
    if (qrCorner === 'br') return '90° sol';
    return '';
}

function warpPerspectiveWithQrCorrection(src, markers, forceQrCheck = true) {
    const warped = warpPerspective(src, markers);
    const now = Date.now();
    if (!forceQrCheck && lastQrCorner === 'tr' && (now - lastQrCheckAtMs) < 2500) {
        return { warped, corrected: false, rotationLabel: '', qrChecked: false, qrCorner: lastQrCorner || null, qrData: null };
    }

    const qr = findQrCorner(warped);
    lastQrCheckAtMs = now;
    lastQrCorner = qr?.corner || null;
    if (!qr || qr.corner === 'tr') {
        return { warped, corrected: false, rotationLabel: '', qrChecked: true, qrCorner: qr?.corner || null, qrData: qr?.data || null };
    }

    const remapped = remapMarkersByQrCorner(markers, qr.corner);
    const corrected = warpPerspective(src, remapped);
    const qr2 = findQrCorner(corrected);
    if (qr2 && qr2.corner === 'tr') {
        lastQrCorner = 'tr';
        warped.delete();
        return {
            warped: corrected,
            corrected: true,
            rotationLabel: labelForQrCorner(qr.corner),
            qrChecked: true,
            qrCorner: qr2.corner,
            qrData: qr2.data
        };
    }

    corrected.delete();
    return { warped, corrected: false, rotationLabel: '', qrChecked: true, qrCorner: qr.corner, qrData: qr.data };
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

function evaluateCrossMarkerQuality(binary, rect) {
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

function scoreBubble(binary, choice, w, h, roiScale, maskRatio, dx = 0, dy = 0) {
    const roiW = Math.round(choice.width * w * roiScale);
    const roiH = Math.round(choice.height * h * roiScale);

    let rectX = Math.round(choice.x * w - roiW / 2) + dx;
    let rectY = Math.round(choice.y * h - roiH / 2) + dy;
    rectX = Math.max(0, rectX);
    rectY = Math.max(0, rectY);

    let width = roiW;
    let height = roiH;
    if (rectX + width > w) width = w - rectX;
    if (rectY + height > h) height = h - rectY;
    if (width <= 0 || height <= 0) return 0;

    const rect = new cv.Rect(rectX, rectY, width, height);
    const roi = binary.roi(rect);
    let score = 0;

    if (roi.rows > 0 && roi.cols > 0) {
        const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
        const r = Math.floor(Math.min(roi.rows, roi.cols) * maskRatio);
        const cx = Math.floor(roi.cols / 2);
        const cy = Math.floor(roi.rows / 2);
        cv.circle(mask, new cv.Point(cx, cy), r, new cv.Scalar(255, 255, 255, 255), -1);
        const masked = new cv.Mat();
        cv.bitwise_and(roi, mask, masked);
        const maskArea = cv.countNonZero(mask);
        score = maskArea > 0 ? cv.countNonZero(masked) / maskArea : 0;
        masked.delete(); mask.delete();
    }

    roi.delete();
    return score;
}

function scoreChoices(binary, choices, w, h, roiScale, maskRatio) {
    return choices.map(c => ({ opt: c.option, score: scoreBubble(binary, c, w, h, roiScale, maskRatio) }));
}

function scoreChoicesWithOffset(binary, choices, w, h, roiScale, maskRatio, dx, dy) {
    return choices.map(c => ({ opt: c.option, score: scoreBubble(binary, c, w, h, roiScale, maskRatio, dx, dy) }));
}

function getScoreStats(scores, threshold) {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const best = sorted[0] || { opt: '', score: 0 };
    const second = sorted[1] || { opt: '', score: 0 };
    const mean = scores.reduce((sum, s) => sum + s.score, 0) / Math.max(1, scores.length);
    const median = sorted[Math.floor(sorted.length / 2)]?.score ?? mean;
    const filledCount = scores.filter(s => s.score >= threshold).length;
    const gap = best.score - second.score;
    return { sorted, best, second, mean, median, filledCount, gap };
}

function getAdaptiveFillThreshold(stats, baseThreshold) {
    // Zoom/tele kameralarda (daha karanlık + gürültülü görüntü) baloncuk çizgileri
    // merkez maskeye taşabiliyor ve "boş" sorular bile eşiği geçebiliyor.
    // Bu durumda, soruya özel taban (median) üstüne marj ekleyip eşiği yükseltiyoruz.
    const median = stats?.median ?? 0;
    const baselineHigh = median >= 0.12 && median >= baseThreshold * 0.8;
    if (!baselineHigh) return baseThreshold;
    return Math.min(0.9, Math.max(baseThreshold, median + 0.06));
}

function refineScoresIfNeeded(binary, choices, w, h, roiScale, maskRatio, baseScores, threshold, blankGuard) {
    const baseStats = getScoreStats(baseScores, threshold);
    const baseMax = baseStats.best.score;

    if (baseMax < 0.02) return baseScores;

    const shouldSearch =
        (baseStats.filledCount > 1 && baseStats.gap < 0.08) ||
        (baseMax >= blankGuard && baseMax < threshold);
    if (!shouldSearch) return baseScores;

    const sample = choices[0];
    const roiW = Math.round(sample.width * w * roiScale);
    const roiH = Math.round(sample.height * h * roiScale);
    const searchPx = Math.min(14, Math.max(3, Math.round(Math.min(roiW, roiH) * 0.45)));
    const half = Math.max(1, Math.round(searchPx / 2));
    const offsets = Array.from(new Set([-searchPx, -half, 0, half, searchPx]));

    const metricFor = (stats) => {
        // Daha büyük ayrım (best-second) ve daha az eşik üstü seçim => daha iyi.
        return stats.gap * 2 + stats.best.score - Math.max(0, stats.filledCount - 1) * 0.25;
    };

    let bestScores = baseScores;
    let bestStats = baseStats;
    let bestMetric = metricFor(baseStats);

    for (const dx of offsets) {
        for (const dy of offsets) {
            if (dx === 0 && dy === 0) continue;
            const scores = scoreChoicesWithOffset(binary, choices, w, h, roiScale, maskRatio, dx, dy);
            const stats = getScoreStats(scores, threshold);
            const metric = metricFor(stats);
            if (metric > bestMetric + 0.02) {
                bestMetric = metric;
                bestScores = scores;
                bestStats = stats;
            }
        }
    }

    // Kazanım yoksa veya kötüleşiyorsa bırak.
    if (bestScores === baseScores) return baseScores;

    if (bestStats.filledCount < baseStats.filledCount) return bestScores;
    if (bestStats.gap > baseStats.gap + 0.05) return bestScores;
    if (baseMax < threshold && bestStats.best.score > baseMax + 0.03) return bestScores;

    return baseScores;
}

export function processFrame(isAuto) {
    let src, binary, markerOverlay;

    try {
        src = cv.imread('captureCanvas');
        const blurVar = estimateLaplacianVariance(src);
        if (blurVar !== null && blurVar < BLUR_VAR_REJECT) {
            updateStatus('error', 'Görüntü bulanık');
            if (!isAuto) {
                setLog('omrLog', `⚠️ Görüntü bulanık (netlik ${blurVar.toFixed(1)}). Telefonu sabitleyip tekrar deneyin.`, 'error');
            }
            return;
        }
        binary = preprocessToBinary(src);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
            updateStatus('', 'Form bulunamadı');
            if (!isAuto) setLog('omrLog', 'Köşe markerları bulunamadı', 'error');
            return;
        }
        const warpCheck = checkWarpQuality(markers, src.cols, src.rows);
        if (!warpCheck.ok) {
            if (!isAuto) setLog('omrLog', `Eğim/alan kontrolü başarısız: ${warpCheck.reasons.join(', ')}`, 'error');
            updateStatus('error', 'Eğim çok yüksek');
            return;
        }

        const warpOut = warpPerspectiveWithQrCorrection(src, markers, !isAuto);
        const warped = warpOut.warped;
        if (warpOut.corrected && !isAuto) {
            setLog('omrLog', `↻ Form otomatik döndürüldü (${warpOut.rotationLabel}).`, 'info');
        }
        cv.imshow('warpCanvas', warped);

        const result = analyzeBubbles(warped);
        if (blurVar !== null && blurVar < BLUR_VAR_WARN) {
            result.suspicious = true;
            result.suspiciousReasons = result.suspiciousReasons || [];
            result.suspiciousReasons.push(`Görüntü bulanık olabilir (netlik ${blurVar.toFixed(1)})`);
        }
        renderResults(result);
        safeAddSessionResult(result);
        if (result.suspicious) {
            updateStatus('error', 'Şüpheli okuma');
            if (!isAuto) setLog('omrLog', `⚠️ Okuma şüpheli: ${result.suspiciousReasons.join(', ')}`, 'error');
        } else {
            playSuccessChime();
            updateStatus('ready', '✓ Okundu');
            if (!isAuto) setLog('omrLog', '✓ Tarama tamamlandı', 'success');
        }

        warped.delete();
    } catch (e) {
        if (!isAuto) setLog('omrLog', 'Hata: ' + e.message, 'error');
    } finally {
        if (src) src.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
    }
}

export function captureAndProcess(isAuto = false) {
    if (!window.cvReady) { setLog('omrLog', 'OpenCV bekleniyor...', 'error'); return; }

    const video = document.getElementById('video');
    if (!video || video.readyState < 2) return;

    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh) return;
    const scale = Math.min(1, CAPTURE_MAX_DIM / Math.max(vw, vh));
    canvas.width = Math.max(1, Math.floor(vw * scale));
    canvas.height = Math.max(1, Math.floor(vh * scale));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (state.scanMode === 'answerKey') {
        processAnswerKeyFrame();
    } else {
        processFrame(isAuto);
    }
}

export function toggleAutoScan() {
    if (state.isAutoScanning) {
        clearInterval(state.autoScanInterval);
        state.isAutoScanning = false;
        document.getElementById('autoScanBtn').textContent = '🔄 Otomatik';
    } else {
        state.isAutoScanning = true;
        document.getElementById('autoScanBtn').textContent = '⏹️ Durdur';
        state.autoScanInterval = setInterval(() => captureAndProcess(true), 800);
    }
}

export function toggleScanSource() {
    const source = document.getElementById('scanSource').value;
    document.getElementById('cameraSection').style.display = source === 'camera' ? 'block' : 'none';
    document.getElementById('fileSection').style.display = source === 'file' ? 'block' : 'none';
    const camRow = document.getElementById('cameraSelectRow');
    if (camRow) camRow.style.display = source === 'camera' ? 'block' : 'none';

    state.scanMode = 'student';
    document.getElementById('processFileBtn').textContent = '🔍 Formu Analiz Et';

    if (source === 'camera') {
        initCamera();
        loadCameraDevices();
    } else {
        stopCamera();
        setLog('cameraLog', '📁 Dosya yükleme modu aktif. Resim seçin.', 'info');
    }
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
        setLog('cameraLog', '❌ Lütfen bir resim dosyası seçin (PNG, JPG, JPEG)', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            uploadedImage = img;

            const canvas = document.getElementById('captureCanvas');
            const ctx = canvas.getContext('2d');

            const maxWidth = 1280;
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            document.getElementById('fileName').textContent = `✓ ${file.name} (${Math.round(file.size / 1024)} KB)`;
            document.getElementById('processFileBtn').disabled = false;
            document.getElementById('clearFileBtn').style.display = 'inline-flex';

            setLog('cameraLog', `✅ Resim yüklendi: ${file.name}`, 'success');
            updateStatus('ready', 'Resim hazır');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

export function processUploadedFile() {
    if (!uploadedImage || !window.cvReady) {
        setLog('cameraLog', '⚠️ Önce bir resim yükleyin ve OpenCV hazır olsun.', 'error');
        return;
    }

    if (!state.layoutConfig || !state.layoutConfig.questions || state.layoutConfig.questions.length === 0) {
        setLog('cameraLog', '⚠️ Önce form tasarımını oluşturun (Tasarla sekmesi).', 'error');
        return;
    }

    setLog('cameraLog', '🔍 Resim analiz ediliyor...', 'info');
    updateStatus('scanning', 'Analiz ediliyor...');

    if (state.scanMode === 'answerKey') {
        const ok = processAnswerKeyFrame(); // Reuse frame processing as image is already in canvas
        // Wait, processAnswerKeyFrame calls imread('captureCanvas'). Yes, correct.
        if (ok) {
            state.scanMode = 'student';
            document.getElementById('processFileBtn').textContent = '🔍 Formu Analiz Et';
        }
    } else {
        // Process student form from file (same as processFrame but from canvas, which is already populated)
        // Actually `processFrame` takes from `captureCanvas`.
        // So we can just call `processFrame`.
        // Exception: `processFrame` handles auto-scan logging differently.
        // And `processStudentFormFromFile` in original code had specific error messages for files.
        // But logic is identical: imread -> preprocess -> detect -> warp -> analyze.
        // Let's reuse processFrame(false).
        processFrame(false);
    }
}

export function startAnswerKeyScan() {
    state.scanMode = 'answerKey';
    const source = document.getElementById('scanSource').value;
    if (source === 'camera') {
        document.getElementById('captureBtn').textContent = '📷 Cevap Anahtarı Tara';
        setLog('cameraLog', '📋 Cevap anahtarı formunu tarayın...', 'success');
    } else {
        document.getElementById('processFileBtn').textContent = '🔑 Cevap Anahtarı Analiz Et';
        setLog('cameraLog', '📋 Cevap anahtarı resmini yükleyin ve analiz edin...', 'success');
    }
    updateStatus('ready', 'Anahtar Tarama');
}

export function clearUploadedFile() {
    uploadedImage = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('processFileBtn').disabled = true;
    document.getElementById('clearFileBtn').style.display = 'none';
    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    updateStatus('', '');
}

// ... (Rest of OMR functions: detectCornerMarkers, warpPerspective, checkWarpQuality, analyzeBubbles, processAnswerKeyFrame, readAnswerKeyFromScan) ...
// Copying them from previous step but ensuring `startAnswerKeyScan` is exportable.
// Also `processAnswerKeyFrame` uses `readAnswerKeyFromScan`.

export function detectCornerMarkers(binary, overlay) {
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
        br: br.center
    };
}

export function warpPerspective(src, markers) {
    const baseW = state.layoutConfig?.canvasWidth || 600;
    const baseH = state.layoutConfig?.canvasHeight || 900;
    const maxWarpWidth = 900;
    const warpScale = Math.min(2, maxWarpWidth / baseW);
    const W = Math.max(1, Math.round(baseW * warpScale));
    const H = Math.max(1, Math.round(baseH * warpScale));
    const markerCenter = (MARKER_OFFSET + MARKER_SIZE / 2) * warpScale;

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        markers.tl.x, markers.tl.y, markers.tr.x, markers.tr.y,
        markers.br.x, markers.br.y, markers.bl.x, markers.bl.y
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        markerCenter, markerCenter,
        W - markerCenter, markerCenter,
        W - markerCenter, H - markerCenter,
        markerCenter, H - markerCenter
    ]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(W, H));
    srcPts.delete(); dstPts.delete(); M.delete();
    return dst;
}

export function checkWarpQuality(markers, imgW, imgH) {
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const wt = dist(markers.tl, markers.tr);
    const wb = dist(markers.bl, markers.br);
    const hl = dist(markers.tl, markers.bl);
    const hr = dist(markers.tr, markers.br);
    const avgW = (wt + wb) / 2;
    const avgH = (hl + hr) / 2;
    const areaRatio = (avgW * avgH) / (imgW * imgH);
    const skewW = Math.abs(wt - wb) / Math.max(wt, wb);
    const skewH = Math.abs(hl - hr) / Math.max(hl, hr);
    const reasons = [];
    if (skewW > WARP_SKEW_LIMIT) reasons.push(`Yatay eğiklik yüksek (${(skewW * 100).toFixed(1)}%)`);
    if (skewH > WARP_SKEW_LIMIT) reasons.push(`Dikey eğiklik yüksek (${(skewH * 100).toFixed(1)}%)`);
    if (areaRatio < WARP_AREA_MIN_RATIO) reasons.push(`Form alanı çok küçük (${(areaRatio * 100).toFixed(1)}%)`);
    return { ok: reasons.length === 0, reasons };
}

export function analyzeBubbles(warpMat, debugDraw = true) {
    const threshold = parseFloat(document.getElementById('fillThreshold').value) || 0.20;
    const penalty = parseFloat(document.getElementById('penalty').value) || 0.25;
    const fillParams = getFillParams();
    const blankGuard = Math.min(fillParams.blankGuard, threshold * 0.9);

    const binary = preprocessToBinary(warpMat);

    const w = warpMat.cols, h = warpMat.rows;
    let correct = 0, wrong = 0, blank = 0, multi = 0;
    const suspiciousReasons = [];
    const perQuestion = [];

    let debugMat = null;
    if (debugDraw) {
        debugMat = warpMat.clone();
    }

    const questions = state.layoutConfig?.questions || [];

    for (const q of questions) {
        let scores = scoreChoices(binary, q.choices, w, h, fillParams.roiScale, fillParams.maskRatio);
        scores = refineScoresIfNeeded(binary, q.choices, w, h, fillParams.roiScale, fillParams.maskRatio, scores, threshold, blankGuard);

        const stats = getScoreStats(scores, threshold);
        const thresholdEff = getAdaptiveFillThreshold(stats, threshold);
        const maxScore = stats.best.score;
        if (maxScore < blankGuard) {
            blank++;
            perQuestion.push({ q: q.questionNumber, marked: '-', status: 'Boş', maxScore: maxScore.toFixed(2) });
            continue;
        }

        let status = 'Boş';
        let candidate = null;
        let markedLabel = '-';

        const best = stats.best;
        const second = stats.second;

        if (best.score < thresholdEff && maxScore > 0.05) {
            if (best.score > second.score * 1.5 || (best.score > 0.1 && best.score > second.score * 1.3)) {
                candidate = best;
            }
        } else if (best.score >= thresholdEff) {
            const multiSecondMin = Math.max(threshold + 0.06, thresholdEff);
            const multiClose = second.score >= threshold && (second.score >= best.score * 0.88 || stats.gap < 0.06);
            const isMulti = second.score >= multiSecondMin && multiClose;
            if (isMulti) {
                candidate = best;
                markedLabel = candidate.opt + '*';
                multi++;
                suspiciousReasons.push(`S${q.questionNumber}: çoklu işaret`);
            } else {
                const baseline = stats.median ?? 0;
                const clearGap = stats.gap >= 0.06 || best.score >= second.score * 1.25;
                const clearAboveBaseline = (best.score - baseline) >= 0.10;
                if (clearGap || clearAboveBaseline) {
                    candidate = best;
                }
            }
        }

        if (candidate) {
            const key = state.answerKey ? state.answerKey[q.questionNumber] : null;
            status = key && key === candidate.opt ? 'Doğru' : 'Yanlış';
            if (markedLabel === '-') markedLabel = candidate.opt;
            if (status === 'Doğru') correct++; else wrong++;
            const lowConfidence = second.score >= threshold && stats.gap < 0.06 && best.score < (thresholdEff + 0.08);
            if (lowConfidence) {
                suspiciousReasons.push(`S${q.questionNumber}: düşük güven (yakın skor)`);
            }
        } else {
            blank++;
            if (maxScore >= thresholdEff * 0.6) {
                suspiciousReasons.push(`S${q.questionNumber}: belirsiz işaret (skor ${maxScore.toFixed(2)})`);
            }
        }

        perQuestion.push({ q: q.questionNumber, marked: markedLabel, status, maxScore: maxScore.toFixed(2) });
    }

    if (debugMat) {
        cv.imshow('warpCanvas', debugMat);
        debugMat.delete();
    }

    let studentNo = '';
    if (state.layoutConfig?.studentId) {
        const digitCenterMaskRatio = Math.max(fillParams.maskRatio, 0.34);
        const digitRoiScale = Math.max(fillParams.roiScale, 1.06);
        const digitThreshold = Math.min(0.18, Math.max(0.10, threshold * 0.6));
        const digitBlankGuard = Math.min(0.07, digitThreshold * 0.6);
        const digitMissing = [];
        const digitLowConf = [];

        for (let col = 0; col < state.layoutConfig.studentId.digits; col++) {
            const colBubbles = state.layoutConfig.studentId.bubbles.filter(b => b.col === col);
            const entries = colBubbles.map(b => {
                const centerScore = scoreBubble(binary, b, w, h, digitRoiScale, digitCenterMaskRatio);
                const fullScore = scoreBubble(binary, b, w, h, digitRoiScale, 1.0);
                return { opt: String(b.digit), centerScore, fullScore };
            });
            const fullScoresSorted = entries.map(e => e.fullScore).sort((a, b) => a - b);
            const medianFull = fullScoresSorted[Math.floor(fullScoresSorted.length / 2)] ?? 0;
            const scores = entries.map(e => ({
                opt: e.opt,
                score: Math.max(e.centerScore, Math.max(0, e.fullScore - (medianFull + 0.02)))
            }));

            const stats = getScoreStats(scores, digitThreshold);
            const best = stats.best;
            const second = stats.second;

            if (best.score < digitBlankGuard) {
                studentNo += '?';
                if (digitMissing.length < 3) digitMissing.push(`H${col + 1}`);
                continue;
            }

            const gapOk = stats.gap >= 0.05 || best.score >= second.score * 1.25;
            const ambiguous = second.score >= digitThreshold * 0.9 && stats.gap < 0.05;

            if (best.score >= digitThreshold && gapOk && !ambiguous) {
                studentNo += best.opt;
                if (best.score < (digitThreshold + 0.06) || stats.gap < 0.07) {
                    if (digitLowConf.length < 3) digitLowConf.push(`H${col + 1}`);
                }
                continue;
            }

            if (best.score < digitThreshold && best.score > second.score * 1.8 && best.score >= digitBlankGuard) {
                studentNo += best.opt;
                if (digitLowConf.length < 3) digitLowConf.push(`H${col + 1}`);
                continue;
            }

            // Ambiguous or too weak.
            studentNo += '?';
            if (digitMissing.length < 3) digitMissing.push(`H${col + 1}`);
        }

        if (digitMissing.length) {
            suspiciousReasons.push(`Öğrenci no okunamadı (${digitMissing.join(', ')})`);
        } else if (digitLowConf.length) {
            suspiciousReasons.push(`Öğrenci no düşük güven (${digitLowConf.join(', ')})`);
        }
    }

    binary.delete();

    const net = (correct - wrong * penalty).toFixed(2);
    return { correct, wrong, blank, multi, net, perQuestion, studentNo, suspicious: suspiciousReasons.length > 0, suspiciousReasons };
}

export function processAnswerKeyFrame() {
    let src, binary, markerOverlay, warped;

    try {
        src = cv.imread('captureCanvas');
        const blurVar = estimateLaplacianVariance(src);
        if (blurVar !== null && blurVar < BLUR_VAR_REJECT) {
            setLog('cameraLog', `⚠️ Görüntü bulanık (netlik ${blurVar.toFixed(1)}). Telefonu sabitleyip tekrar deneyin.`, 'error');
            updateStatus('error', 'Görüntü bulanık');
            return false;
        }
        binary = preprocessToBinary(src);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
            setLog('cameraLog', '⚠️ Köşe markerları bulunamadı', 'error');
            return false;
        }
        const warpCheck = checkWarpQuality(markers, src.cols, src.rows);
        if (!warpCheck.ok) {
            setLog('cameraLog', `⚠️ Eğim/alan kontrolü başarısız: ${warpCheck.reasons.join(', ')}`, 'error');
            updateStatus('error', 'Eğim çok yüksek');
            return false;
        }

        const warpOut = warpPerspectiveWithQrCorrection(src, markers);
        warped = warpOut.warped;
        if (warpOut.corrected) {
            setLog('cameraLog', `↻ Form otomatik döndürüldü (${warpOut.rotationLabel}).`, 'info');
        }
        cv.imshow('warpCanvas', warped);

        const result = readAnswerKeyFromScan(warped);

        if (result.success) {
            state.answerKey = result.answers;
            document.dispatchEvent(new CustomEvent('answerKeyUpdated'));

            state.scanMode = 'student';
            document.getElementById('captureBtn').textContent = '📸 Öğrenci Formu Tara';
            const processBtn = document.getElementById('processFileBtn');
            if (processBtn) processBtn.textContent = '🔍 Formu Analiz Et';
            setLog('cameraLog', `✅ Cevap anahtarı yüklendi! ${result.count}/${result.total} cevap okundu.`, 'success');
            updateStatus('ready', '✓ Anahtar Yüklendi');
            return true;
        } else {
            const detail = Number.isFinite(result?.total) ? ` (${result.count}/${result.total}, min ${result.required})` : '';
            setLog('cameraLog', `⚠️ Cevap anahtarı eksik/okunamadı${detail}. Tekrar deneyin.`, 'error');
            updateStatus('error', 'Anahtar eksik');
            return false;
        }
    } catch (e) {
        setLog('cameraLog', 'Hata: ' + e.message, 'error');
        updateStatus('error', 'Hata');
        return false;
    } finally {
        if (warped) warped.delete();
        if (src) src.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
    }
}

function readAnswerKeyFromScan(warpMat) {
    const threshold = parseFloat(document.getElementById('fillThreshold').value) || 0.20;
    const fillParams = getFillParams();
    const blankGuard = Math.min(fillParams.blankGuard, threshold * 0.9);

    const binary = preprocessToBinary(warpMat);

    const w = warpMat.cols, h = warpMat.rows;
    const answers = {};
    let successCount = 0;

    const roiScale = Math.max(fillParams.roiScale, 1.02);
    const questions = state.layoutConfig?.questions || [];

    for (const q of questions) {
        let scores = scoreChoices(binary, q.choices, w, h, roiScale, fillParams.maskRatio);
        scores = refineScoresIfNeeded(binary, q.choices, w, h, roiScale, fillParams.maskRatio, scores, threshold, blankGuard);

        const stats = getScoreStats(scores, threshold);
        const thresholdEff = getAdaptiveFillThreshold(stats, threshold);
        const maxScore = stats.best.score;
        if (maxScore < blankGuard) continue;
        const filled = scores.filter(s => s.score >= thresholdEff);

        if (filled.length === 1) {
            answers[q.questionNumber] = filled[0].opt;
            successCount++;
        }
        else if (filled.length > 1) {
            const sorted = [...filled].sort((a, b) => b.score - a.score);
            const best = sorted[0];
            const second = sorted[1];
            const multiSecondMin = Math.max(threshold + 0.06, thresholdEff);
            const multiClose = second.score >= threshold && (second.score >= best.score * 0.88 || (best.score - second.score) < 0.06);
            const isMulti = second.score >= multiSecondMin && multiClose;
            if (!isMulti) {
                const baseline = stats.median ?? 0;
                const clearGap = (best.score - second.score) >= 0.06 || best.score >= second.score * 1.25;
                const clearAboveBaseline = (best.score - baseline) >= 0.10;
                if (clearGap || clearAboveBaseline) {
                    answers[q.questionNumber] = best.opt;
                    successCount++;
                }
            }
        }
        else if (filled.length === 0 && maxScore >= Math.max(fillParams.blankGuard, threshold * 0.6)) {
            const best = scores.find(s => s.score === maxScore);
            const secondMax = Math.max(...scores.filter(s => s.score !== maxScore).map(s => s.score));
            if (best && maxScore > secondMax * 1.35) {
                answers[q.questionNumber] = best.opt;
                successCount++;
            }
        }
    }

    binary.delete();

    const total = questions.length;
    const minSuccessRatio = 0.85;
    const required = total > 0 ? Math.max(1, Math.ceil(total * minSuccessRatio)) : 0;
    console.log(`Cevap anahtarı okuma: ${successCount}/${total} başarılı (min ${required})`);

    return {
        success: total > 0 && successCount >= required,
        answers: answers,
        count: successCount,
        required,
        total
    };
}
