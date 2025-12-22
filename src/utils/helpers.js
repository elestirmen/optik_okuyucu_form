export function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
}

export function clampInt(v, min, max, def) {
    const i = parseInt(v);
    if (isNaN(i)) return def;
    return Math.min(Math.max(i, min), max);
}

export function updateStatus(state, text) {
    const el = document.getElementById('scanStatus');
    const span = document.getElementById('scanStatusText');
    if (!el || !span) return;

    el.className = 'scan-status ' + state;
    span.textContent = text;
}

export function setLog(id, msg, type = '') {
    const el = document.getElementById(id);
    if (el) {
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'red' : (type === 'success' ? 'green' : '#666');
        el.innerHTML = `<span style="color:${color}">[${time}] ${msg}</span>`;
    }
}
