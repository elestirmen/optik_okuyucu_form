import { state } from '../features/state.js';
import { updateStatus, setLog } from '../utils/helpers.js';

export async function loadCameraDevices() {
    const select = document.getElementById('cameraSelect');
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !select) return;
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        state.availableCameras = devices.filter(d => d.kind === 'videoinput');
        select.innerHTML = '';
        if (state.availableCameras.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Kamera bulunamadı';
            select.appendChild(opt);
            select.disabled = true;
            return;
        }
        select.disabled = false;
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Otomatik (arka)';
        select.appendChild(defaultOpt);
        state.availableCameras.forEach((cam, idx) => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || `Kamera ${idx + 1}`;
            select.appendChild(opt);
        });
        if (state.preferredCameraId) {
            select.value = state.preferredCameraId;
        }
    } catch (e) {
        console.warn('Kamera listesi alınamadı', e);
    }
}

export function onCameraChange(e) {
    state.preferredCameraId = e.target.value || null;
    stopCamera();
    initCamera();
}

export async function initCamera() {
    try {
        if (state.videoStream) return;
        const usePreferred = !!state.preferredCameraId;
        const baseConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
        const constraints = usePreferred
            ? { video: { ...baseConstraints, deviceId: { exact: state.preferredCameraId } } }
            : { video: { ...baseConstraints, facingMode: 'environment' } };
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            if (usePreferred) {
                console.warn('Seçilen kamera açılamadı, otomatiğe dönüyor', err);
                state.preferredCameraId = null;
                return initCamera();
            }
            throw err;
        }
        state.videoStream = stream;
        const videoEl = document.getElementById('video');
        videoEl.srcObject = stream;
        await videoEl.play();
        await loadCameraDevices();
        document.getElementById('captureBtn').disabled = false;
        updateStatus('ready', 'Hazır');
        setLog('cameraLog', '✓ Kamera hazır', 'success');
    } catch (e) {
        setLog('cameraLog', '✗ Kamera hatası: ' + e.message, 'error');
    }
}

export function stopCamera() {
    if (!state.videoStream) return;
    state.videoStream.getTracks().forEach(t => t.stop());
    state.videoStream = null;
    const videoEl = document.getElementById('video');
    if (videoEl) videoEl.srcObject = null;
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.disabled = true;
    updateStatus('', 'Kamera kapalı');
}
