/**
 * Advanced Settings Manager
 * OMR parametrelerini yönetir, preset'leri uygular, kaydetme/yükleme yapar
 */

import { state } from '../features/state.js';

// Varsayılan ayarlar
export const DEFAULT_SETTINGS = {
    // Preprocessing
    claheEnabled: false,
    claheClipLimit: 2.0,
    blurSigma: 0,
    blockSize: 11,
    cValue: 2,
    shadowRemoval: false,
    whiteBalance: false,
    autoTuneEnabled: true,
    
    // Marker
    markerMethod: 'auto',
    markerQualityThreshold: 0.45,
    warpSkewLimit: 0.15,
    warpAreaMinRatio: 10,
    
    // Bubble Analysis
    fillThreshold: 0.20,
    roiScale: 1.04,
    maskRatio: 0.32,
    blankGuard: 0.18,
    offsetSearchEnabled: true,
    
    // Confidence & Consensus
    penalty: 0.25,
    multiReadEnabled: false,
    multiReadIterations: 3,
    gapThreshold: 0.06,
    anomalyDetectionEnabled: true,
    
    // Alignment
    alignmentGuideEnabled: true,
    showGrid: false,
    alignmentTolerance: 0.30,
    autoScanOnReady: false,
    
    // Performance
    captureMaxDim: 1280,
    blurVarWarn: 25,
    blurVarReject: 12,
    debugDrawEnabled: true,
    
    // Shadow mode (existing)
    shadowMode: false
};

// Preset tanımları
export const PRESETS = {
    balanced: {
        name: 'Dengeli',
        description: 'Standart koşullar için optimize edilmiş',
        settings: {
            claheEnabled: false,
            blurSigma: 0,
            blockSize: 11,
            fillThreshold: 0.20,
            roiScale: 1.04,
            maskRatio: 0.32,
            blankGuard: 0.18,
            autoTuneEnabled: true
        }
    },
    lowlight: {
        name: 'Düşük Işık',
        description: 'Karanlık ortamlar ve düşük ışık için',
        settings: {
            claheEnabled: true,
            claheClipLimit: 3.0,
            blurSigma: 1.0,
            blockSize: 13,
            fillThreshold: 0.24,
            roiScale: 1.08,
            maskRatio: 0.28,
            blankGuard: 0.14,
            shadowRemoval: true,
            whiteBalance: true,
            autoTuneEnabled: true
        }
    },
    highquality: {
        name: 'Yüksek Kalite',
        description: 'Maksimum doğruluk için detaylı analiz',
        settings: {
            claheEnabled: true,
            claheClipLimit: 2.0,
            blurSigma: 0.5,
            blockSize: 11,
            fillThreshold: 0.18,
            roiScale: 1.02,
            maskRatio: 0.34,
            blankGuard: 0.16,
            multiReadEnabled: true,
            multiReadIterations: 3,
            offsetSearchEnabled: true,
            anomalyDetectionEnabled: true,
            captureMaxDim: 1920,
            autoTuneEnabled: true
        }
    },
    fast: {
        name: 'Hızlı',
        description: 'Hızlı tarama, temel doğruluk',
        settings: {
            claheEnabled: false,
            blurSigma: 0,
            blockSize: 9,
            fillThreshold: 0.22,
            roiScale: 1.06,
            maskRatio: 0.30,
            offsetSearchEnabled: false,
            multiReadEnabled: false,
            captureMaxDim: 960,
            autoTuneEnabled: false,
            anomalyDetectionEnabled: false
        }
    },
    robust: {
        name: 'Robust',
        description: 'Zorlu koşullar için maksimum dayanıklılık',
        settings: {
            claheEnabled: true,
            claheClipLimit: 3.5,
            blurSigma: 1.5,
            blockSize: 15,
            cValue: 4,
            fillThreshold: 0.26,
            roiScale: 1.10,
            maskRatio: 0.26,
            blankGuard: 0.12,
            shadowRemoval: true,
            whiteBalance: true,
            markerQualityThreshold: 0.35,
            warpSkewLimit: 0.20,
            multiReadEnabled: true,
            multiReadIterations: 4,
            offsetSearchEnabled: true,
            autoTuneEnabled: true
        }
    }
};

// Mevcut ayarları tutan obje
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * Tüm ayarları al
 */
export function getSettings() {
    return { ...currentSettings };
}

/**
 * Tek bir ayarı al
 */
export function getSetting(key) {
    return currentSettings[key];
}

/**
 * Tek bir ayarı güncelle
 */
export function setSetting(key, value) {
    if (key in DEFAULT_SETTINGS) {
        currentSettings[key] = value;
        syncToState(key, value);
        saveToLocalStorage();
        return true;
    }
    return false;
}

/**
 * Birden fazla ayarı güncelle
 */
export function setSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
        if (key in DEFAULT_SETTINGS) {
            currentSettings[key] = value;
            syncToState(key, value);
        }
    }
    saveToLocalStorage();
}

/**
 * Varsayılana sıfırla
 */
export function resetToDefault() {
    currentSettings = { ...DEFAULT_SETTINGS };
    syncAllToState();
    saveToLocalStorage();
    updateUIFromSettings();
}

/**
 * Preset uygula
 */
export function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return false;
    
    // Önce varsayılana dön, sonra preset ayarlarını uygula
    currentSettings = { ...DEFAULT_SETTINGS, ...preset.settings };
    syncAllToState();
    saveToLocalStorage();
    updateUIFromSettings();
    
    return true;
}

/**
 * State ile senkronize et
 */
function syncToState(key, value) {
    // State'e yansıtılması gereken ayarlar
    const stateMapping = {
        shadowMode: 'shadowMode',
        alignmentGuideEnabled: 'alignmentGuideEnabled',
        autoTuneEnabled: 'autoTuneEnabled',
        multiReadEnabled: 'multiReadEnabled'
    };
    
    if (stateMapping[key]) {
        state[stateMapping[key]] = value;
    }
}

function syncAllToState() {
    syncToState('shadowMode', currentSettings.shadowMode);
    syncToState('alignmentGuideEnabled', currentSettings.alignmentGuideEnabled);
    syncToState('autoTuneEnabled', currentSettings.autoTuneEnabled);
    syncToState('multiReadEnabled', currentSettings.multiReadEnabled);
}

/**
 * LocalStorage'a kaydet
 */
function saveToLocalStorage() {
    try {
        localStorage.setItem('omr_settings', JSON.stringify(currentSettings));
    } catch (e) {
        console.warn('Settings kaydetme hatası:', e);
    }
}

/**
 * LocalStorage'dan yükle
 */
export function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('omr_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
            syncAllToState();
            return true;
        }
    } catch (e) {
        console.warn('Settings yükleme hatası:', e);
    }
    return false;
}

/**
 * JSON olarak export et
 */
export function exportSettings() {
    const data = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        settings: currentSettings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omr-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * JSON'dan import et
 */
export function importSettings(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings) {
                    currentSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                    syncAllToState();
                    saveToLocalStorage();
                    updateUIFromSettings();
                    resolve(true);
                } else {
                    reject(new Error('Geçersiz ayar dosyası'));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * UI'dan ayarları oku
 */
export function readFromUI() {
    const elements = {
        // Preprocessing
        claheEnabled: document.getElementById('claheEnabled'),
        claheClipLimit: document.getElementById('claheClipLimit'),
        blurSigma: document.getElementById('blurSigma'),
        blockSize: document.getElementById('blockSize'),
        cValue: document.getElementById('cValue'),
        shadowRemoval: document.getElementById('shadowRemoval'),
        whiteBalance: document.getElementById('whiteBalance'),
        autoTuneEnabled: document.getElementById('autoTuneEnabled'),
        
        // Marker
        markerMethod: document.getElementById('markerMethod'),
        markerQualityThreshold: document.getElementById('markerQualityThreshold'),
        warpSkewLimit: document.getElementById('warpSkewLimit'),
        warpAreaMinRatio: document.getElementById('warpAreaMinRatio'),
        
        // Bubble
        fillThreshold: document.getElementById('fillThreshold'),
        roiScale: document.getElementById('roiScale'),
        maskRatio: document.getElementById('maskRatio'),
        blankGuard: document.getElementById('blankGuard'),
        offsetSearchEnabled: document.getElementById('offsetSearchEnabled'),
        
        // Confidence
        penalty: document.getElementById('penalty'),
        multiReadEnabled: document.getElementById('multiReadEnabled'),
        multiReadIterations: document.getElementById('multiReadIterations'),
        gapThreshold: document.getElementById('gapThreshold'),
        anomalyDetectionEnabled: document.getElementById('anomalyDetectionEnabled'),
        
        // Alignment
        alignmentGuideEnabled: document.getElementById('alignmentGuideEnabled'),
        showGrid: document.getElementById('showGrid'),
        alignmentTolerance: document.getElementById('alignmentTolerance'),
        autoScanOnReady: document.getElementById('autoScanOnReady'),
        
        // Performance
        captureMaxDim: document.getElementById('captureMaxDim'),
        blurVarWarn: document.getElementById('blurVarWarn'),
        blurVarReject: document.getElementById('blurVarReject'),
        debugDrawEnabled: document.getElementById('debugDrawEnabled'),
        
        // Shadow mode
        shadowMode: document.getElementById('shadowMode')
    };
    
    for (const [key, el] of Object.entries(elements)) {
        if (!el) continue;
        
        if (el.type === 'checkbox') {
            currentSettings[key] = el.checked;
        } else if (el.type === 'number') {
            currentSettings[key] = parseFloat(el.value);
        } else {
            currentSettings[key] = el.value;
        }
    }
    
    syncAllToState();
    saveToLocalStorage();
}

/**
 * UI'ı ayarlardan güncelle
 */
export function updateUIFromSettings() {
    const elements = {
        claheEnabled: document.getElementById('claheEnabled'),
        claheClipLimit: document.getElementById('claheClipLimit'),
        blurSigma: document.getElementById('blurSigma'),
        blockSize: document.getElementById('blockSize'),
        cValue: document.getElementById('cValue'),
        shadowRemoval: document.getElementById('shadowRemoval'),
        whiteBalance: document.getElementById('whiteBalance'),
        autoTuneEnabled: document.getElementById('autoTuneEnabled'),
        markerMethod: document.getElementById('markerMethod'),
        markerQualityThreshold: document.getElementById('markerQualityThreshold'),
        warpSkewLimit: document.getElementById('warpSkewLimit'),
        warpAreaMinRatio: document.getElementById('warpAreaMinRatio'),
        fillThreshold: document.getElementById('fillThreshold'),
        roiScale: document.getElementById('roiScale'),
        maskRatio: document.getElementById('maskRatio'),
        blankGuard: document.getElementById('blankGuard'),
        offsetSearchEnabled: document.getElementById('offsetSearchEnabled'),
        penalty: document.getElementById('penalty'),
        multiReadEnabled: document.getElementById('multiReadEnabled'),
        multiReadIterations: document.getElementById('multiReadIterations'),
        gapThreshold: document.getElementById('gapThreshold'),
        anomalyDetectionEnabled: document.getElementById('anomalyDetectionEnabled'),
        alignmentGuideEnabled: document.getElementById('alignmentGuideEnabled'),
        showGrid: document.getElementById('showGrid'),
        alignmentTolerance: document.getElementById('alignmentTolerance'),
        autoScanOnReady: document.getElementById('autoScanOnReady'),
        captureMaxDim: document.getElementById('captureMaxDim'),
        blurVarWarn: document.getElementById('blurVarWarn'),
        blurVarReject: document.getElementById('blurVarReject'),
        debugDrawEnabled: document.getElementById('debugDrawEnabled'),
        shadowMode: document.getElementById('shadowMode')
    };
    
    for (const [key, el] of Object.entries(elements)) {
        if (!el || !(key in currentSettings)) continue;
        
        if (el.type === 'checkbox') {
            el.checked = currentSettings[key];
        } else {
            el.value = currentSettings[key];
        }
    }
}

/**
 * Settings panelini başlat
 */
export function initSettingsPanel() {
    // LocalStorage'dan yükle
    loadFromLocalStorage();
    
    // UI'ı güncelle
    updateUIFromSettings();
    
    // Event listener'ları ekle
    setupEventListeners();
}

function setupEventListeners() {
    // Toggle button
    const toggleBtn = document.getElementById('advancedSettingsBtn');
    const panel = document.getElementById('advancedSettings');
    
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                panel.classList.add('visible');
            }
            toggleBtn.textContent = isVisible ? '⚙️ Gelişmiş' : '✕ Kapat';
        });
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Tüm ayarlar varsayılana döndürülecek. Emin misiniz?')) {
                resetToDefault();
            }
        });
    }
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (applyPreset(preset)) {
                // Aktif preset'i işaretle
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
    
    // Export/Import buttons
    const exportBtn = document.getElementById('exportSettingsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSettings);
    }
    
    const importBtn = document.getElementById('importSettingsBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        await importSettings(file);
                        alert('Ayarlar başarıyla yüklendi!');
                    } catch (err) {
                        alert('Ayar yükleme hatası: ' + err.message);
                    }
                }
            };
            input.click();
        });
    }
    
    // Input change listeners
    const inputs = document.querySelectorAll('#advancedSettings input, #advancedSettings select');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            readFromUI();
        });
    });
    
    // Ana ayarlardaki inputlar
    ['fillThreshold', 'penalty', 'shadowMode'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                readFromUI();
            });
        }
    });
}

/**
 * Preprocessing parametrelerini al
 */
export function getPreprocessingParams() {
    return {
        clahe: currentSettings.claheEnabled,
        claheClipLimit: currentSettings.claheClipLimit,
        claheTileSize: 8,
        blurSigma: currentSettings.blurSigma,
        blockSize: parseInt(currentSettings.blockSize),
        cValue: currentSettings.cValue,
        shadowRemoval: currentSettings.shadowRemoval,
        whiteBalance: currentSettings.whiteBalance
    };
}

/**
 * Fill parametrelerini al
 */
export function getFillParams() {
    return {
        roiScale: currentSettings.roiScale,
        maskRatio: currentSettings.maskRatio,
        blankGuard: currentSettings.blankGuard
    };
}

/**
 * Marker parametrelerini al
 */
export function getMarkerParams() {
    return {
        method: currentSettings.markerMethod,
        qualityThreshold: currentSettings.markerQualityThreshold,
        skewLimit: currentSettings.warpSkewLimit,
        areaMinRatio: currentSettings.warpAreaMinRatio / 100
    };
}

/**
 * Performance parametrelerini al
 */
export function getPerformanceParams() {
    return {
        maxDim: currentSettings.captureMaxDim,
        blurWarn: currentSettings.blurVarWarn,
        blurReject: currentSettings.blurVarReject,
        debugDraw: currentSettings.debugDrawEnabled
    };
}

