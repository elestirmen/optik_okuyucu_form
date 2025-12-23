/**
 * Confidence Score System & Multi-Read Consensus
 * Her soru için güven skoru hesaplar ve çoklu okuma ile doğruluk artırır
 */

import { state } from '../features/state.js';

// Confidence seviyeleri
export const CONFIDENCE_LEVELS = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    VERY_LOW: 'very_low'
};

/**
 * Tek bir soru için güven skoru hesapla
 */
export function calculateQuestionConfidence(scores, threshold, blankGuard) {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const best = sorted[0] || { opt: '', score: 0 };
    const second = sorted[1] || { opt: '', score: 0 };
    const third = sorted[2] || { opt: '', score: 0 };
    
    const gap = best.score - second.score;
    const maxScore = best.score;
    const mean = scores.reduce((sum, s) => sum + s.score, 0) / Math.max(1, scores.length);
    const median = sorted[Math.floor(sorted.length / 2)]?.score ?? mean;
    
    // Confidence metrikleri
    const metrics = {
        gap,
        maxScore,
        mean,
        median,
        gapRatio: second.score > 0 ? best.score / second.score : best.score > 0 ? Infinity : 0,
        aboveThreshold: scores.filter(s => s.score >= threshold).length,
        clearWinner: gap > 0.08 && maxScore > threshold * 1.2,
        multipleHigh: second.score >= threshold * 0.9
    };
    
    // Confidence level hesapla
    let level = CONFIDENCE_LEVELS.LOW;
    let score = 0.5;
    let reasons = [];
    
    // Boş kontrol
    if (maxScore < blankGuard) {
        return {
            level: CONFIDENCE_LEVELS.HIGH,
            score: 0.95,
            answer: null,
            isBlank: true,
            reasons: ['Tüm seçenekler eşik altında'],
            metrics
        };
    }
    
    // Yüksek güven kriterleri
    if (gap > 0.15 && maxScore > threshold * 1.4) {
        level = CONFIDENCE_LEVELS.HIGH;
        score = 0.95;
        reasons.push('Çok net ayrım');
    } else if (gap > 0.10 && maxScore > threshold * 1.2) {
        level = CONFIDENCE_LEVELS.HIGH;
        score = 0.90;
        reasons.push('Net ayrım');
    } else if (gap > 0.06 && maxScore > threshold) {
        level = CONFIDENCE_LEVELS.MEDIUM;
        score = 0.75;
        reasons.push('Orta düzey ayrım');
    } else if (maxScore > threshold) {
        level = CONFIDENCE_LEVELS.LOW;
        score = 0.55;
        reasons.push('Düşük ayrım');
    }
    
    // Çoklu işaretleme riski
    if (metrics.multipleHigh) {
        level = CONFIDENCE_LEVELS.LOW;
        score = Math.min(score, 0.50);
        reasons.push('Birden fazla yüksek skor');
    }
    
    // Çok düşük maksimum skor
    if (maxScore < threshold && maxScore >= blankGuard) {
        level = CONFIDENCE_LEVELS.VERY_LOW;
        score = 0.30;
        reasons.push('Eşik altı maksimum skor');
    }
    
    // Baseline yakın (gürültülü görüntü)
    if (median > 0.12 && maxScore < median + 0.10) {
        level = CONFIDENCE_LEVELS.VERY_LOW;
        score = Math.min(score, 0.35);
        reasons.push('Yüksek baseline');
    }
    
    return {
        level,
        score,
        answer: best.opt,
        secondChoice: second.opt,
        isBlank: false,
        reasons,
        metrics
    };
}

/**
 * Tüm sonuçlar için güven özeti
 */
export function summarizeConfidence(perQuestion) {
    const counts = {
        [CONFIDENCE_LEVELS.HIGH]: 0,
        [CONFIDENCE_LEVELS.MEDIUM]: 0,
        [CONFIDENCE_LEVELS.LOW]: 0,
        [CONFIDENCE_LEVELS.VERY_LOW]: 0
    };
    
    let totalScore = 0;
    const lowConfidenceQuestions = [];
    
    for (const q of perQuestion) {
        if (q.confidence) {
            counts[q.confidence.level]++;
            totalScore += q.confidence.score;
            
            if (q.confidence.level === CONFIDENCE_LEVELS.LOW || 
                q.confidence.level === CONFIDENCE_LEVELS.VERY_LOW) {
                lowConfidenceQuestions.push(q.q);
            }
        }
    }
    
    const total = perQuestion.length;
    const avgScore = total > 0 ? totalScore / total : 0;
    const highRatio = total > 0 ? counts[CONFIDENCE_LEVELS.HIGH] / total : 0;
    
    return {
        counts,
        avgScore,
        highRatio,
        lowConfidenceQuestions,
        overallLevel: avgScore > 0.85 ? 'HIGH' : avgScore > 0.65 ? 'MEDIUM' : 'LOW',
        needsReview: lowConfidenceQuestions.length > total * 0.1
    };
}

/**
 * Multi-Read Consensus - Çoklu okuma ve oylama
 */
export class MultiReadConsensus {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.readings = [];
        this.parameterSets = this.generateParameterSets();
    }
    
    /**
     * Farklı parametre setleri oluştur
     */
    generateParameterSets() {
        return [
            { threshold: 0.18, roiScale: 1.02, maskRatio: 0.34, label: 'sensitive' },
            { threshold: 0.20, roiScale: 1.04, maskRatio: 0.32, label: 'balanced' },
            { threshold: 0.22, roiScale: 1.06, maskRatio: 0.30, label: 'strict' },
            { threshold: 0.24, roiScale: 1.08, maskRatio: 0.28, label: 'very_strict' }
        ];
    }
    
    /**
     * Okuma ekle
     */
    addReading(result, params) {
        this.readings.push({
            result,
            params,
            timestamp: Date.now()
        });
    }
    
    /**
     * Okumaları temizle
     */
    clear() {
        this.readings = [];
    }
    
    /**
     * Consensus hesapla
     */
    getConsensus() {
        if (this.readings.length === 0) {
            return null;
        }
        
        if (this.readings.length === 1) {
            return {
                result: this.readings[0].result,
                agreement: 1.0,
                consensus: 'single',
                needsReview: false
            };
        }
        
        const questionResults = {};
        const questionCount = this.readings[0].result.perQuestion?.length || 0;
        
        // Her soru için oyları topla
        for (let q = 1; q <= questionCount; q++) {
            const votes = {};
            const confidences = [];
            
            for (const reading of this.readings) {
                const qResult = reading.result.perQuestion?.find(pq => pq.q === q);
                if (qResult) {
                    const answer = qResult.marked || '-';
                    votes[answer] = (votes[answer] || 0) + 1;
                    
                    if (qResult.confidence) {
                        confidences.push({
                            answer,
                            score: qResult.confidence.score
                        });
                    }
                }
            }
            
            // En çok oy alan cevabı bul
            let winner = '-';
            let maxVotes = 0;
            for (const [answer, count] of Object.entries(votes)) {
                if (count > maxVotes) {
                    maxVotes = count;
                    winner = answer;
                }
            }
            
            // Ağırlıklı oylama (confidence bazlı)
            if (confidences.length > 0) {
                const weightedVotes = {};
                for (const c of confidences) {
                    weightedVotes[c.answer] = (weightedVotes[c.answer] || 0) + c.score;
                }
                
                let weightedWinner = winner;
                let maxWeight = 0;
                for (const [answer, weight] of Object.entries(weightedVotes)) {
                    if (weight > maxWeight) {
                        maxWeight = weight;
                        weightedWinner = answer;
                    }
                }
                
                // Ağırlıklı oylama farklı sonuç verdiyse kontrol et
                if (weightedWinner !== winner && maxVotes < this.readings.length * 0.7) {
                    winner = weightedWinner;
                }
            }
            
            questionResults[q] = {
                answer: winner,
                votes: maxVotes,
                total: this.readings.length,
                agreement: maxVotes / this.readings.length,
                needsReview: maxVotes < this.readings.length * 0.7,
                allVotes: votes
            };
        }
        
        // Genel sonuç oluştur
        const consensusResult = this.buildConsensusResult(questionResults);
        
        return {
            result: consensusResult,
            questionDetails: questionResults,
            readingCount: this.readings.length,
            agreement: this.calculateOverallAgreement(questionResults),
            needsReview: Object.values(questionResults).some(q => q.needsReview)
        };
    }
    
    /**
     * Consensus sonucunu oluştur
     */
    buildConsensusResult(questionResults) {
        let correct = 0, wrong = 0, blank = 0, multi = 0;
        const perQuestion = [];
        
        for (const [qNum, qResult] of Object.entries(questionResults)) {
            const answer = qResult.answer;
            const key = state.answerKey ? state.answerKey[parseInt(qNum)] : null;
            
            let status = 'Boş';
            if (answer === '-') {
                blank++;
            } else if (answer.includes('*')) {
                multi++;
                status = 'Çoklu';
            } else if (key) {
                if (key === answer) {
                    correct++;
                    status = 'Doğru';
                } else {
                    wrong++;
                    status = 'Yanlış';
                }
            }
            
            perQuestion.push({
                q: parseInt(qNum),
                marked: answer,
                status,
                agreement: qResult.agreement,
                needsReview: qResult.needsReview
            });
        }
        
        const penalty = parseFloat(document.getElementById('penalty')?.value) || 0.25;
        const net = (correct - wrong * penalty).toFixed(2);
        
        return {
            correct,
            wrong,
            blank,
            multi,
            net,
            perQuestion,
            studentNo: this.readings[0]?.result.studentNo || '',
            suspicious: false,
            suspiciousReasons: [],
            isConsensus: true
        };
    }
    
    /**
     * Genel uyum oranı
     */
    calculateOverallAgreement(questionResults) {
        const agreements = Object.values(questionResults).map(q => q.agreement);
        return agreements.reduce((a, b) => a + b, 0) / Math.max(1, agreements.length);
    }
}

/**
 * Anomali tespiti
 */
export function detectAnomalies(result) {
    const anomalies = [];
    const total = result.perQuestion?.length || 0;
    
    // 1. Çok fazla boş cevap
    if (result.blank > total * 0.3) {
        anomalies.push({
            type: 'HIGH_BLANK_RATE',
            severity: 'warning',
            message: `Boş cevap oranı yüksek (%${Math.round(result.blank / total * 100)})`
        });
    }
    
    // 2. Ardışık aynı cevaplar
    const consecutive = findConsecutivePattern(result.perQuestion);
    if (consecutive.maxStreak > 8) {
        anomalies.push({
            type: 'SUSPICIOUS_PATTERN',
            severity: 'warning',
            message: `${consecutive.maxStreak} ardışık ${consecutive.letter} cevabı (S${consecutive.start}-S${consecutive.end})`
        });
    }
    
    // 3. Öğrenci numarasında belirsizlik
    const unknownDigits = (result.studentNo?.match(/\?/g) || []).length;
    if (unknownDigits > 2) {
        anomalies.push({
            type: 'STUDENT_ID_UNCLEAR',
            severity: 'error',
            message: `Öğrenci numarasında ${unknownDigits} belirsiz hane`
        });
    }
    
    // 4. Çok fazla çoklu işaretleme
    if (result.multi > total * 0.1) {
        anomalies.push({
            type: 'HIGH_MULTI_MARK',
            severity: 'warning',
            message: `Çoklu işaretleme oranı yüksek (${result.multi} soru)`
        });
    }
    
    // 5. Düşük güven oranı
    const lowConfCount = result.perQuestion?.filter(q => 
        q.confidence?.level === CONFIDENCE_LEVELS.LOW || 
        q.confidence?.level === CONFIDENCE_LEVELS.VERY_LOW
    ).length || 0;
    
    if (lowConfCount > total * 0.2) {
        anomalies.push({
            type: 'LOW_CONFIDENCE',
            severity: 'warning',
            message: `${lowConfCount} soruda düşük güven`
        });
    }
    
    return anomalies;
}

/**
 * Ardışık cevap pattern'i bul
 */
function findConsecutivePattern(perQuestion) {
    if (!perQuestion || perQuestion.length === 0) {
        return { maxStreak: 0, letter: '', start: 0, end: 0 };
    }
    
    let maxStreak = 1;
    let currentStreak = 1;
    let currentLetter = perQuestion[0]?.marked || '';
    let maxLetter = currentLetter;
    let streakStart = 1;
    let maxStart = 1;
    let maxEnd = 1;
    
    for (let i = 1; i < perQuestion.length; i++) {
        const letter = perQuestion[i]?.marked || '';
        
        if (letter === currentLetter && letter !== '-' && letter !== '') {
            currentStreak++;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                maxLetter = currentLetter;
                maxStart = streakStart;
                maxEnd = i + 1;
            }
        } else {
            currentStreak = 1;
            currentLetter = letter;
            streakStart = i + 1;
        }
    }
    
    return {
        maxStreak,
        letter: maxLetter,
        start: maxStart,
        end: maxEnd
    };
}

/**
 * Güven raporunu HTML olarak formatla
 */
export function formatConfidenceReport(summary) {
    const levelLabels = {
        [CONFIDENCE_LEVELS.HIGH]: '✓ Yüksek',
        [CONFIDENCE_LEVELS.MEDIUM]: '◐ Orta',
        [CONFIDENCE_LEVELS.LOW]: '◯ Düşük',
        [CONFIDENCE_LEVELS.VERY_LOW]: '⚠ Çok Düşük'
    };
    
    let html = '<div class="confidence-report">';
    html += `<div class="conf-overall">Genel Güven: <strong>${summary.overallLevel}</strong> (${(summary.avgScore * 100).toFixed(0)}%)</div>`;
    html += '<div class="conf-breakdown">';
    
    for (const [level, count] of Object.entries(summary.counts)) {
        if (count > 0) {
            html += `<span class="conf-item conf-${level}">${levelLabels[level]}: ${count}</span> `;
        }
    }
    
    html += '</div>';
    
    if (summary.lowConfidenceQuestions.length > 0 && summary.lowConfidenceQuestions.length <= 10) {
        html += `<div class="conf-warning">⚠ Düşük güvenli sorular: S${summary.lowConfidenceQuestions.join(', S')}</div>`;
    }
    
    html += '</div>';
    
    return html;
}

