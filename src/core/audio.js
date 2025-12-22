import { SOUND_COOLDOWN_MS } from '../features/config.js';

let audioCtx = null;
let lastSuccessSoundAt = 0;

export function ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) {
        audioCtx = new AudioCtor();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playTone(ctx, freq, startTime, duration = 0.18, volume = 0.08) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.stop(startTime + duration);
}

export function playSuccessChime() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = Date.now();
    if (now - lastSuccessSoundAt < SOUND_COOLDOWN_MS) return;
    lastSuccessSoundAt = now;
    const t = ctx.currentTime;
    playTone(ctx, 900, t, 0.12, 0.07);
    playTone(ctx, 1250, t + 0.14, 0.1, 0.06);
}

export function primeAudio() {
    ensureAudioContext();
}
