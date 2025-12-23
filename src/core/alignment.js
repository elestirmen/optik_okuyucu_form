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
 * Hedef köşe alanlarını hesapla
 */
export function calculateTargetAreas(videoWidth, videoHeight, margin = 0.08) {
    const markerSizeRatio = 0.08; // Video boyutuna göre marker boyutu
    const markerSize = Math.min(videoWidth, videoHeight) * markerSizeRatio;
    const padding = Math.min(videoWidth, videoHeight) * margin;
    
    return {
        tl: {
            x: padding,
            y: padding,
            width: markerSize * 1.5,
            height: markerSize * 1.5,
            label: 'Sol Üst'
        },
        tr: {
            x: videoWidth - padding - markerSize * 1.5,
            y: padding,
            width: markerSize * 1.5,
            height: markerSize * 1.5,
            label: 'Sağ Üst'
        },
        bl: {
            x: padding,
            y: videoHeight - padding - markerSize * 1.5,
            width: markerSize * 1.5,
            height: markerSize * 1.5,
            label: 'Sol Alt'
        },
        br: {
            x: videoWidth - padding - markerSize * 1.5,
            y: videoHeight - padding - markerSize * 1.5,
            width: markerSize * 1.5,
            height: markerSize * 1.5,
            label: 'Sağ Alt'
        }
    };
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
    
    ctx.save();
    
    // Köşe hedef alanlarını çiz
    for (const [key, area] of Object.entries(targetAreas)) {
        const position = alignment?.positions?.[key];
        const detected = position?.detected || false;
        const inTarget = position?.inTarget || false;
        
        // Arka plan
        ctx.fillStyle = detected && inTarget ? 'rgba(0, 255, 0, 0.15)' : 
                        detected ? 'rgba(255, 165, 0, 0.15)' : 
                        COLORS.target;
        ctx.fillRect(area.x, area.y, area.width, area.height);
        
        // Köşe çerçeveleri
        ctx.strokeStyle = detected && inTarget ? COLORS.detected : 
                          detected ? COLORS.warning : 
                          COLORS.missing;
        ctx.lineWidth = 3;
        ctx.setLineDash(detected ? [] : [8, 8]);
        
        // Köşe L şeklinde çiz
        const cornerSize = area.width * 0.3;
        ctx.beginPath();
        
        // Sol üst köşe
        if (key === 'tl') {
            ctx.moveTo(area.x, area.y + cornerSize);
            ctx.lineTo(area.x, area.y);
            ctx.lineTo(area.x + cornerSize, area.y);
        }
        // Sağ üst köşe
        else if (key === 'tr') {
            ctx.moveTo(area.x + area.width - cornerSize, area.y);
            ctx.lineTo(area.x + area.width, area.y);
            ctx.lineTo(area.x + area.width, area.y + cornerSize);
        }
        // Sol alt köşe
        else if (key === 'bl') {
            ctx.moveTo(area.x, area.y + area.height - cornerSize);
            ctx.lineTo(area.x, area.y + area.height);
            ctx.lineTo(area.x + cornerSize, area.y + area.height);
        }
        // Sağ alt köşe
        else if (key === 'br') {
            ctx.moveTo(area.x + area.width - cornerSize, area.y + area.height);
            ctx.lineTo(area.x + area.width, area.y + area.height);
            ctx.lineTo(area.x + area.width, area.y + area.height - cornerSize);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Tespit edilen marker'ları çiz
    if (markers) {
        ctx.fillStyle = COLORS.detected;
        for (const [key, marker] of Object.entries(markers)) {
            if (marker && marker.x && marker.y) {
                ctx.beginPath();
                ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Bağlantı çizgisi
                const target = targetAreas[key];
                if (target) {
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(marker.x, marker.y);
                    ctx.lineTo(target.x + target.width / 2, target.y + target.height / 2);
                    ctx.stroke();
                }
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
    }
    
    /**
     * Overlay'ı güncelle
     */
    update(markers) {
        if (!this.enabled || !this.ctx || !this.video) return;
        
        const vw = this.video.videoWidth || this.overlay.width;
        const vh = this.video.videoHeight || this.overlay.height;
        
        // Canvas boyutunu ayarla
        if (this.overlay.width !== vw || this.overlay.height !== vh) {
            this.overlay.width = vw;
            this.overlay.height = vh;
        }
        
        // Temizle
        this.ctx.clearRect(0, 0, vw, vh);
        
        // Hedef alanları hesapla
        const targetAreas = calculateTargetAreas(vw, vh);
        
        // Hizalamayı değerlendir
        const alignment = assessAlignment(markers, targetAreas);
        
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
        
        // Overlay'ı çiz
        drawAlignmentOverlay(this.ctx, vw, vh, markers, alignment);
        
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
}

