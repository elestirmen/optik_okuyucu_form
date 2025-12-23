export const state = {
    layoutConfig: null,
    answerKey: {},
    videoStream: null,
    autoScanInterval: null,
    isAutoScanning: false,
    scanMode: 'student', // 'student' or 'answerKey'
    shadowMode: false,
    // Yeni özellikler
    alignmentGuideEnabled: true,
    autoTuneEnabled: true,
    multiReadEnabled: false,
    lastImageQuality: null,
    preferredCameraId: null,
    availableCameras: []
};
