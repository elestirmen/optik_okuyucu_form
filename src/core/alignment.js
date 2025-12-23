/**
 * Real-time Alignment Guide
 * Kamera görüntüsü üzerinde form hizalama rehberi
 */

import { MARKER_OFFSET, MARKER_SIZE } from '../features/config.js';

// Alignment durumları
export const ALIGNMENT_STATUS = {
    NONE: 'none',           // Form görünmüyor
    PARTIAL: 'partial',     // Kısmi tespit
    MISALIGNED: 'misaligned', // Hizalama bozuk
    READY: 'ready',         // Taramaya hazır
    PERFECT: 'perfect'      // Mükemmel hizalama
};

// Renk paleti
const COLORS = {
    target: 'rgba(255, 255, 255, 0.3)',     // Hedef alan arka plan
    targetBorder: 'rgba(255, 255, 255, 0.8)', // Hedef alan kenar
    detected: 'rgba(0, 255, 0, 0.8)',        // Tespit edilmiş marker
    missing: 'rgba(255, 0, 0, 0.8)',         // Eksik marker
    warning: 'rgba(255, 165, 0, 0.8)',       // Uyarı
    ready: 'rgba(0, 255, 100, 0.9)',         // Hazır
    guide: 'rgba(100, 200, 255, 0.6)'        // Rehber çizgiler
};

/**
 * Sabit kadraj konfigürasyonu
 * Form aspect ratio'su (genellikle A4 benzeri dikey format)
 */
const FRAME_CONFIG = {
    // Form aspect ratio (genişlik / yükseklik) - A4 benzeri dikey format
    formAspectRatio: 0.707, // ~A4 (210/297)
    // Kadrajın video içindeki oranı (ne kadar büyük olsun)
    frameScale: 0.85,
    // Köşe hedef alanı boyutu (sabit piksel değil, frame boyutuna göre oran)
    cornerSizeRatio: 0.08,
    // Minimum köşe boyutu (piksel)
    minCornerSize: 30,
    // Maximum köşe boyutu (piksel)
    maxCornerSize: 80
};

// Son hesaplanan kadraj (cache)
let lastFrameCache = null;
let lastVideoDimensions = { width: 0, height: 0 };

/**
 * Sabit aspect ratio ile kadraj hesapla
 * Video boyutu ne olursa olsun, kadraj oranları sabit kalır
 */
export function calculateTargetAreas(videoWidth, videoHeight, margin = 0.08) {
    // Video boyutu değişmediyse cache'den döndür
    if (lastFrameCache && 
        lastVideoDimensions.width === videoWidth && 
        lastVideoDimensions.height === videoHeight) {
        return lastFrameCache;
    }
    
    // Video'nun ortasına sabit aspect ratio'lu bir kadraj yerleştir
    const videoAspect = videoWidth / videoHeight;
    const formAspect = FRAME_CONFIG.formAspectRatio;
    
    let frameWidth, frameHeight, frameX, frameY;
    
    // Video aspect ratio'suna göre kadrajı sığdır
    if (videoAspect > formAspect) {
        // Video daha geniş - yüksekliğe göre sığdır
        frameHeight = videoHeight * FRAME_CONFIG.frameScale;
        frameWidth = frameHeight * formAspect;
    } else {
        // Video daha dar - genişliğe göre sığdır
        frameWidth = videoWidth * FRAME_CONFIG.frameScale;
        frameHeight = frameWidth / formAspect;
    }
    
    // Kadrajı ortala
    frameX = (videoWidth - frameWidth) / 2;
    frameY = (videoHeight - frameHeight) / 2;
    
    // Köşe boyutu (sabit oran)
    const cornerSize = Math.min(
        FRAME_CONFIG.maxCornerSize,
        Math.max(
            FRAME_CONFIG.minCornerSize,
            Math.min(frameWidth, frameHeight) * FRAME_CONFIG.cornerSizeRatio
        )
    );
    
    const result = {
        tl: {
            x: frameX,
            y: frameY,
            width: cornerSize,
            height: cornerSize,
            label: 'Sol Üst'
        },
        tr: {
            x: frameX + frameWidth - cornerSize,
            y: frameY,
            width: cornerSize,
            height: cornerSize,
            label: 'Sağ Üst'
        },
        bl: {
            x: frameX,
            y: frameY + frameHeight - cornerSize,
            width: cornerSize,
            height: cornerSize,
            label: 'Sol Alt'
        },
        br: {
            x: frameX + frameWidth - cornerSize,
            y: frameY + frameHeight - cornerSize,
            width: cornerSize,
            height: cornerSize,
            label: 'Sağ Alt'
        },
        // Ek bilgiler (çizim için)
        frame: {
            x: frameX,
            y: frameY,
            width: frameWidth,
            height: frameHeight
        }
    };
    
    // Cache'le
    lastFrameCache = result;
    lastVideoDimensions = { width: videoWidth, height: videoHeight };
    
    return result;
}

/**
 * Kadraj cache'ini sıfırla
 */
export function resetFrameCache() {
    lastFrameCache = null;
    lastVideoDimensions = { width: 0, height: 0 };
}

/**
 * Marker'ın hedef alanda olup olmadığını kontrol et
 */
export function isMarkerInArea(marker, area, tolerance = 0.3) {
    if (!marker) return false;
    
    const expandedArea = {
        x: area.x - area.width * tolerance,
        y: area.y - area.height * tolerance,
        width: area.width * (1 + tolerance * 2),
        height: area.height * (1 + tolerance * 2)
    };
    
    return marker.x >= expandedArea.x &&
           marker.x <= expandedArea.x + expandedArea.width &&
           marker.y >= expandedArea.y &&
           marker.y <= expandedArea.y + expandedArea.height;
}

/**
 * Hizalama durumunu değerlendir
 */
export function assessAlignment(markers, targetAreas) {
    if (!markers) {
        return {
            status: ALIGNMENT_STATUS.NONE,
            score: 0,
            detectedCount: 0,
            issues: ['Form bulunamadı - formu kameraya gösterin'],
            positions: {}
        };
    }
    
    const positions = {
        tl: { detected: !!markers.tl, inTarget: isMarkerInArea(markers.tl, targetAreas.tl) },
        tr: { detected: !!markers.tr, inTarget: isMarkerInArea(markers.tr, targetAreas.tr) },
        bl: { detected: !!markers.bl, inTarget: isMarkerInArea(markers.bl, targetAreas.bl) },
        br: { detected: !!markers.br, inTarget: isMarkerInArea(markers.br, targetAreas.br) }
    };
    
    const detectedCount = Object.values(positions).filter(p => p.detected).length;
    const alignedCount = Object.values(positions).filter(p => p.inTarget).length;
    
    const issues = [];
    let status = ALIGNMENT_STATUS.NONE;
    let score = 0;
    
    if (detectedCount === 0) {
        issues.push('Köşe marker\'ları bulunamıyor');
        status = ALIGNMENT_STATUS.NONE;
    } else if (detectedCount < 4) {
        issues.push(`${4 - detectedCount} köşe eksik`);
        const missingCorners = Object.entries(positions)
            .filter(([k, v]) => !v.detected)
            .map(([k]) => targetAreas[k].label);
        if (missingCorners.length > 0) {
            issues.push(`Eksik: ${missingCorners.join(', ')}`);
        }
        status = ALIGNMENT_STATUS.PARTIAL;
        score = detectedCount * 20;
    } else if (alignedCount < 4) {
        issues.push('Formu köşelere hizalayın');
        status = ALIGNMENT_STATUS.MISALIGNED;
        score = 50 + alignedCount * 10;
    } else {
        // Geometrik kalite kontrolü
        const geoQuality = checkGeometricQuality(markers, targetAreas);
        
        if (geoQuality.score < 0.7) {
            issues.push(...geoQuality.issues);
            status = ALIGNMENT_STATUS.READY;
            score = 80;
        } else if (geoQuality.score < 0.9) {
            status = ALIGNMENT_STATUS.READY;
            score = 90;
        } else {
            status = ALIGNMENT_STATUS.PERFECT;
            score = 100;
        }
    }
    
    return {
        status,
        score,
        detectedCount,
        alignedCount,
        issues,
        positions
    };
}

/**
 * Geometrik kalite kontrolü
 */
function checkGeometricQuality(markers, targetAreas) {
    const issues = [];
    let score = 1.0;
    
    // Kenar uzunlukları
    const top = Math.hypot(markers.tr.x - markers.tl.x, markers.tr.y - markers.tl.y);
    const bottom = Math.hypot(markers.br.x - markers.bl.x, markers.br.y - markers.bl.y);
    const left = Math.hypot(markers.bl.x - markers.tl.x, markers.bl.y - markers.tl.y);
    const right = Math.hypot(markers.br.x - markers.tr.x, markers.br.y - markers.tr.y);
    
    // Yatay eğiklik
    const hSkew = Math.abs(top - bottom) / Math.max(top, bottom);
    if (hSkew > 0.15) {
        issues.push('Formu yatayda düzeltin');
        score -= 0.2;
    } else if (hSkew > 0.08) {
        score -= 0.1;
    }
    
    // Dikey eğiklik
    const vSkew = Math.abs(left - right) / Math.max(left, right);
    if (vSkew > 0.15) {
        issues.push('Formu dikeyde düzeltin');
        score -= 0.2;
    } else if (vSkew > 0.08) {
        score -= 0.1;
    }
    
    // Form boyutu (çok küçük veya çok büyük)
    const avgWidth = (top + bottom) / 2;
    const avgHeight = (left + right) / 2;
    const videoMin = Math.min(targetAreas.tr.x - targetAreas.tl.x, 
                              targetAreas.bl.y - targetAreas.tl.y);
    
    const sizeRatio = Math.min(avgWidth, avgHeight) / videoMin;
    if (sizeRatio < 0.5) {
        issues.push('Formu yaklaştırın');
        score -= 0.2;
    } else if (sizeRatio > 1.1) {
        issues.push('Formu uzaklaştırın');
        score -= 0.1;
    }
    
    return { score: Math.max(0, score), issues };
}

/**
 * Alignment overlay çiz
 */
export function drawAlignmentOverlay(ctx, videoWidth, videoHeight, markers, alignment) {
    const targetAreas = calculateTargetAreas(videoWidth, videoHeight);
    const frame = targetAreas.frame;
    
    ctx.save();
    
    // Dış alanı karart (kadraj dışı)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    // Üst
    ctx.fillRect(0, 0, videoWidth, frame.y);
    // Alt
    ctx.fillRect(0, frame.y + frame.height, videoWidth, videoHeight - frame.y - frame.height);
    // Sol
    ctx.fillRect(0, frame.y, frame.x, frame.height);
    // Sağ
    ctx.fillRect(frame.x + frame.width, frame.y, videoWidth - frame.x - frame.width, frame.height);
    
    // Kadraj çerçevesi
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);
    
    // Köşe hedef alanlarını çiz
    for (const [key, area] of Object.entries(targetAreas)) {
        if (key === 'frame') continue; // frame bilgisini atla
        
        const position = alignment?.positions?.[key];
        const detected = position?.detected || false;
        const inTarget = position?.inTarget || false;
        
        // Köşe çerçeveleri
        ctx.strokeStyle = detected && inTarget ? COLORS.detected : 
                          detected ? COLORS.warning : 
                          COLORS.missing;
        ctx.lineWidth = 3;
        ctx.setLineDash(detected ? [] : [6, 4]);
        
        // Köşe L şeklinde çiz (daha belirgin)
        const cornerLen = area.width * 0.6;
        ctx.beginPath();
        
        if (key === 'tl') {
            ctx.moveTo(area.x, area.y + cornerLen);
            ctx.lineTo(area.x, area.y);
            ctx.lineTo(area.x + cornerLen, area.y);
        }
        else if (key === 'tr') {
            ctx.moveTo(area.x + area.width - cornerLen, area.y);
            ctx.lineTo(area.x + area.width, area.y);
            ctx.lineTo(area.x + area.width, area.y + cornerLen);
        }
        else if (key === 'bl') {
            ctx.moveTo(area.x, area.y + area.height - cornerLen);
            ctx.lineTo(area.x, area.y + area.height);
            ctx.lineTo(area.x + cornerLen, area.y + area.height);
        }
        else if (key === 'br') {
            ctx.moveTo(area.x + area.width - cornerLen, area.y + area.height);
            ctx.lineTo(area.x + area.width, area.y + area.height);
            ctx.lineTo(area.x + area.width, area.y + area.height - cornerLen);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Tespit edildiyse hedef alanda yeşil nokta
        if (detected && inTarget) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(area.x + area.width / 2, area.y + area.height / 2, area.width / 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Tespit edilen marker'ları çiz
    if (markers) {
        for (const [key, marker] of Object.entries(markers)) {
            if (key === 'quality') continue; // quality objesini atla
            if (marker && typeof marker.x === 'number' && typeof marker.y === 'number') {
                const position = alignment?.positions?.[key];
                const inTarget = position?.inTarget || false;
                
                // Marker noktası
                ctx.fillStyle = inTarget ? COLORS.detected : COLORS.warning;
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // İç nokta
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    // Durum mesajı
    if (alignment) {
        drawStatusMessage(ctx, videoWidth, videoHeight, alignment);
    }
    
    ctx.restore();
}

/**
 * Durum mesajını çiz
 */
function drawStatusMessage(ctx, videoWidth, videoHeight, alignment) {
    const padding = 15;
    const boxHeight = 50;
    const boxY = videoHeight - boxHeight - padding;
    
    // Arka plan kutusu
    let bgColor, textColor, icon;
    
    switch (alignment.status) {
        case ALIGNMENT_STATUS.PERFECT:
            bgColor = 'rgba(0, 180, 0, 0.9)';
            textColor = '#fff';
            icon = '✓';
            break;
        case ALIGNMENT_STATUS.READY:
            bgColor = 'rgba(0, 150, 0, 0.85)';
            textColor = '#fff';
            icon = '◉';
            break;
        case ALIGNMENT_STATUS.MISALIGNED:
            bgColor = 'rgba(255, 165, 0, 0.85)';
            textColor = '#000';
            icon = '↔';
            break;
        case ALIGNMENT_STATUS.PARTIAL:
            bgColor = 'rgba(255, 100, 0, 0.85)';
            textColor = '#fff';
            icon = '◐';
            break;
        default:
            bgColor = 'rgba(150, 150, 150, 0.85)';
            textColor = '#fff';
            icon = '?';
    }
    
    // Ana kutu
    ctx.fillStyle = bgColor;
    const boxWidth = videoWidth - padding * 2;
    ctx.beginPath();
    ctx.roundRect(padding, boxY, boxWidth, boxHeight, 8);
    ctx.fill();
    
    // İkon
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, padding + 12, boxY + boxHeight / 2);
    
    // Ana metin
    let statusText;
    switch (alignment.status) {
        case ALIGNMENT_STATUS.PERFECT:
            statusText = 'MÜKEMMEL - Taramaya Hazır!';
            break;
        case ALIGNMENT_STATUS.READY:
            statusText = 'HAZIR - Tarayabilirsiniz';
            break;
        case ALIGNMENT_STATUS.MISALIGNED:
            statusText = 'Form Hizalanıyor...';
            break;
        case ALIGNMENT_STATUS.PARTIAL:
            statusText = `${alignment.detectedCount}/4 Köşe Tespit`;
            break;
        default:
            statusText = 'Form Bekleniyor';
    }
    
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(statusText, padding + 45, boxY + 18);
    
    // Alt metin (ipucu)
    if (alignment.issues && alignment.issues.length > 0) {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = textColor === '#fff' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';
        ctx.fillText(alignment.issues[0], padding + 45, boxY + 38);
    }
    
    // Skor göstergesi
    const scoreWidth = 60;
    const scoreX = videoWidth - padding - scoreWidth - 10;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${alignment.score}%`, scoreX + scoreWidth, boxY + boxHeight / 2);
}

/**
 * Canvas üzerine ızgara çiz (opsiyonel yardımcı)
 */
export function drawGrid(ctx, videoWidth, videoHeight, divisions = 3) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Dikey çizgiler
    for (let i = 1; i < divisions; i++) {
        const x = (videoWidth / divisions) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, videoHeight);
        ctx.stroke();
    }
    
    // Yatay çizgiler
    for (let i = 1; i < divisions; i++) {
        const y = (videoHeight / divisions) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(videoWidth, y);
        ctx.stroke();
    }
    
    ctx.restore();
}

/**
 * Alignment Guide yöneticisi
 * Basit ve güvenilir versiyon
 */
export class AlignmentGuide {
    constructor(videoElement, overlayCanvas) {
        this.video = videoElement;
        this.overlay = overlayCanvas;
        this.ctx = overlayCanvas?.getContext('2d');
        this.enabled = true;
        this.lastAlignment = null;
        this.stableCount = 0;
        this.onReady = null;
        this.lastSourceSize = { width: 0, height: 0 };
    }
    
    /**
     * Koordinatları dönüştür (kaynak canvas -> video koordinatları)
     */
    scaleMarkers(markers, sourceWidth, sourceHeight, targetWidth, targetHeight) {
        if (!markers) return null;
        if (sourceWidth <= 0 || sourceHeight <= 0) return markers;
        if (Math.abs(sourceWidth - targetWidth) < 5 && Math.abs(sourceHeight - targetHeight) < 5) {
            return markers; // Boyutlar aynı, dönüşüm gereksiz
        }
        
        const scaleX = targetWidth / sourceWidth;
        const scaleY = targetHeight / sourceHeight;
        
        const scaled = {};
        for (const corner of ['tl', 'tr', 'bl', 'br']) {
            if (markers[corner] && typeof markers[corner].x === 'number') {
                scaled[corner] = {
                    x: markers[corner].x * scaleX,
                    y: markers[corner].y * scaleY
                };
            }
        }
        
        return scaled;
    }
    
    /**
     * Overlay'ı güncelle
     * @param {Object} markers - Marker pozisyonları
     * @param {number} sourceWidth - Kaynak canvas genişliği (opsiyonel)
     * @param {number} sourceHeight - Kaynak canvas yüksekliği (opsiyonel)
     */
    update(markers, sourceWidth = 0, sourceHeight = 0) {
        if (!this.enabled || !this.ctx || !this.video) return null;
        
        // Video'nun gerçek boyutları
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        if (videoWidth <= 0 || videoHeight <= 0) return null;
        
        // Video elementi'nin ekrandaki gerçek boyutu
        const videoRect = this.video.getBoundingClientRect();
        const displayWidth = videoRect.width;
        const displayHeight = videoRect.height;
        
        // Video aspect ratio ve container aspect ratio
        const videoAspect = videoWidth / videoHeight;
        const containerAspect = displayWidth / displayHeight;
        
        // object-fit: contain hesaplaması
        let renderWidth, renderHeight, offsetX, offsetY;
        
        if (videoAspect > containerAspect) {
            // Video daha geniş, yanlarda boşluk var
            renderWidth = displayWidth;
            renderHeight = displayWidth / videoAspect;
            offsetX = 0;
            offsetY = (displayHeight - renderHeight) / 2;
        } else {
            // Video daha uzun, üst/altta boşluk var
            renderHeight = displayHeight;
            renderWidth = displayHeight * videoAspect;
            offsetX = (displayWidth - renderWidth) / 2;
            offsetY = 0;
        }
        
        // Canvas boyutunu ayarla (piksel olarak render boyutu)
        // Canvas internal resolution = video resolution (kaliteli çizim için)
        if (this.overlay.width !== videoWidth || this.overlay.height !== videoHeight) {
            this.overlay.width = videoWidth;
            this.overlay.height = videoHeight;
        }
        
        // Canvas CSS boyutunu video render alanıyla eşitle
        this.overlay.style.width = renderWidth + 'px';
        this.overlay.style.height = renderHeight + 'px';
        this.overlay.style.left = offsetX + 'px';
        this.overlay.style.top = offsetY + 'px';
        
        // Temizle
        this.ctx.clearRect(0, 0, videoWidth, videoHeight);
        
        // Kaynak boyut verilmişse koordinat dönüşümü yap (captureCanvas -> video koordinatları)
        let displayMarkers = markers;
        if (sourceWidth > 0 && sourceHeight > 0 && 
            (Math.abs(sourceWidth - videoWidth) > 5 || Math.abs(sourceHeight - videoHeight) > 5)) {
            displayMarkers = this.scaleMarkers(markers, sourceWidth, sourceHeight, videoWidth, videoHeight);
        }
        
        // Hedef alanları hesapla (video koordinatlarında)
        const targetAreas = calculateTargetAreas(videoWidth, videoHeight);
        
        // Hizalamayı değerlendir
        const alignment = assessAlignment(displayMarkers, targetAreas);
        
        // Kararlılık kontrolü
        if (alignment.status === ALIGNMENT_STATUS.READY || 
            alignment.status === ALIGNMENT_STATUS.PERFECT) {
            this.stableCount++;
            
            if (this.stableCount >= 3 && this.onReady) {
                this.onReady(alignment);
            }
        } else {
            this.stableCount = 0;
        }
        
        this.lastAlignment = alignment;
        
        // Overlay'ı çiz (video koordinatlarında)
        drawAlignmentOverlay(this.ctx, videoWidth, videoHeight, displayMarkers, alignment);
        
        return alignment;
    }
    
    /**
     * Guide'ı etkinleştir/devre dışı bırak
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled && this.ctx) {
            this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        }
    }
    
    /**
     * Hazır olduğunda çağrılacak callback
     */
    setOnReady(callback) {
        this.onReady = callback;
    }
    
    /**
     * Son hizalama durumunu al
     */
    getLastAlignment() {
        return this.lastAlignment;
    }
    
    /**
     * Kararlılık sayacını sıfırla
     */
    resetStability() {
        this.stableCount = 0;
    }
    
    /**
     * Sıfırla
     */
    reset() {
        this.stableCount = 0;
        this.lastAlignment = null;
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        }
    }
}

