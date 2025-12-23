import { state } from './state.js';

let xlsxModulePromise = null;

async function getXlsxModule() {
    if (typeof XLSX !== 'undefined' && XLSX?.utils) return XLSX;
    if (!xlsxModulePromise) {
        xlsxModulePromise = (async () => {
            try {
                return await import('xlsx');
            } catch {
                try {
                    return await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
                } catch (err) {
                    console.warn('XLSX kütüphanesi yüklenemedi:', err);
                    return null;
                }
            }
        })();
    }
    return xlsxModulePromise;
}

let sessionResults = [];
let saveDirHandle = null;
const LOG_FILE_NAME = 'session-log.txt';
const fileSaveSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export function addSessionResult(r) {
    const studentKnown = r.studentNo && !r.studentNo.includes('?');
    const studentKey = studentKnown ? r.studentNo : null;
    const existingIdx = studentKey ? sessionResults.findIndex(e => e.studentNo === studentKey) : -1;
    let entryId = sessionResults.length + 1;
    if (existingIdx >= 0) {
        entryId = sessionResults[existingIdx].id;
    }
    const entry = {
        id: entryId,
        studentNo: studentKey || 'Bilinmiyor',
        correct: r.correct,
        wrong: r.wrong,
        blank: r.blank,
        multi: r.multi,
        net: r.net,
        perQuestion: r.perQuestion.map(p => ({ ...p })),
        suspicious: !!r.suspicious,
        suspiciousReasons: r.suspiciousReasons || []
    };
    if (existingIdx >= 0) {
        sessionResults[existingIdx] = entry;
    } else {
        sessionResults.push(entry);
    }
    sessionResults = sessionResults
        .sort((a, b) => a.id - b.id)
        .map((e, idx) => ({ ...e, id: idx + 1 }));
    renderSessionList();
    persistAllEntriesSafely();
}

export function safeAddSessionResult(r) {
    try {
        addSessionResult(r);
    } catch (e) {
        console.warn('Session log hatasi', e);
    }
}

export function renderResults(r) {
    document.querySelector('.stat.correct .stat-value').textContent = r.correct;
    document.querySelector('.stat.wrong .stat-value').textContent = r.wrong;
    document.querySelectorAll('.stat')[2].querySelector('.stat-value').textContent = r.blank;
    document.querySelector('.stat.net .stat-value').textContent = r.net;

    let html = r.studentNo ? `<div style="margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:6px;"><b>Öğrenci No:</b> ${r.studentNo}</div>` : '';
    if (r.suspicious && r.suspiciousReasons?.length) {
        html += `<div style="margin-bottom:8px;color:#f59e0b;font-weight:600;">⚠️ Şüpheli okuma: ${r.suspiciousReasons.join(', ')}</div>`;
    }
    html += r.perQuestion.map(p => {
        const color = p.status === 'Doğru' ? '#10b981' : p.status === 'Yanlış' ? '#ef4444' : p.status === 'Boş' ? '#666' : '#f59e0b';
        const scoreInfo = p.maxScore ? ` <span style="color:#666;font-size:9px;">(${p.maxScore})</span>` : '';
        return `<div><span style="width:25px;display:inline-block;text-align:right;">${p.q}.</span> ${p.marked}${scoreInfo} <span style="color:${color}">${p.status}</span></div>`;
    }).join('');

    document.getElementById('resultDetails').innerHTML = html;
}

export function renderSessionList() {
    const listEl = document.getElementById('sessionList');
    const countEl = document.getElementById('sessionCount');
    if (!listEl) return;
    if (countEl) countEl.textContent = `${sessionResults.length} kayit`;
    if (sessionResults.length === 0) {
        listEl.textContent = 'Henuz kayit yok.';
        return;
    }
    const recent = sessionResults.slice(-8).reverse();
    listEl.innerHTML = recent.map(r => {
        const flag = r.suspicious ? '⚠️ ' : '';
        return `<div>${flag}#${r.id} - ${r.studentNo || 'Bilinmiyor'} | D:${r.correct} Y:${r.wrong} B:${r.blank} C:${r.multi} Net:${r.net}</div>`;
    }).join('');
}

function formatEntryLine(entry, verbose = true) {
    const answers = (entry.perQuestion || []).map(p => `${p.q}:${p.marked || '-'}`).join(' ');
    const susp = entry.suspicious ? 1 : 0;
    if (!verbose) {
        return `#${entry.id}\t${entry.studentNo || 'Bilinmiyor'}\tD:${entry.correct}\tY:${entry.wrong}\tB:${entry.blank}\tCoklu:${entry.multi}\tNet:${entry.net}\tSupheli:${susp}\t${answers}`;
    }
    const answersVerbose = (entry.perQuestion || []).map(p => `${p.q}:${p.marked || '-'}/${p.status}`).join(' ');
    return [
        `Sira: ${entry.id}`,
        `OgrenciNo: ${entry.studentNo || 'Bilinmiyor'}`,
        `Dogru: ${entry.correct}`,
        `Yanlis: ${entry.wrong}`,
        `Bos: ${entry.blank}`,
        `Coklu: ${entry.multi}`,
        `Net: ${entry.net}`,
        `Supheli: ${susp}`,
        `Cevaplar: ${answersVerbose}`
    ].join('\n');
}

async function requestSaveDirectory() {
    if (!fileSaveSupported) return null;
    try {
        saveDirHandle = await window.showDirectoryPicker({ id: 'omr-save', mode: 'readwrite' });
        return saveDirHandle;
    } catch (e) {
        console.warn('Klasor secimi iptal/izin yok', e);
        return null;
    }
}

async function ensureLogFileHandle() {
    if (!fileSaveSupported) return null;
    if (logFileHandle) return import.meta.logFileHandle; // Using module level if possible, but keeping simple
    // actually we need persistent handle
    // Let's rely on saveDirHandle being global module scope
    if (!saveDirHandle) {
        const dir = await requestSaveDirectory();
        if (!dir) return null;
        saveDirHandle = dir;
    }
    return await saveDirHandle.getFileHandle(LOG_FILE_NAME, { create: true });
}

async function writeFullLog(entries) {
    if (!fileSaveSupported) return false;
    try {
        const handle = await ensureLogFileHandle();
        if (!handle) return false;
        const writable = await handle.createWritable({ keepExistingData: false });
        const lines = entries.map(e => formatEntryLine(e, false)).join('\n') + '\n';
        await writable.write(lines);
        await writable.close();
        return true;
    } catch (e) {
        console.warn('Log yazma hatasi', e);
        return false;
    }
}

function fallbackDownloadLog() {
    const lines = sessionResults.map(r => formatEntryLine(r, false));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = LOG_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
}

function persistAllEntriesSafely() {
    writeFullLog(sessionResults).then((ok) => {
        if (!ok && sessionResults.length > 0 && Math.random() < 0.1) {
            // Occasional console log backup? 
            // Or just do nothing, fallback download is only on user action usually
        }
    });
}

export function downloadSessionTxt() {
    if (sessionResults.length === 0 && Object.keys(state.answerKey || {}).length === 0) { alert('Kayit yok.'); return; }
    const lines = [];
    const maxQ = getMaxQuestionCount();
    const answerKeyEntry = buildAnswerKeyEntry(maxQ);
    if (answerKeyEntry) lines.push(formatEntryLine(answerKeyEntry, false));
    lines.push(...sessionResults.map(r => formatEntryLine(r, false)));
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oturum-listesi.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function csvEscape(v) {
    const s = v === undefined || v === null ? '' : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
}

function getMaxQuestionCount() {
    const sessionMax = sessionResults.length
        ? Math.max(...sessionResults.map(r => (r.perQuestion || []).length || 0))
        : 0;
    const keyNums = Object.keys(state.answerKey || {})
        .map(k => parseInt(k, 10))
        .filter(n => Number.isFinite(n));
    const keyMax = keyNums.length ? Math.max(...keyNums) : 0;
    const layoutMax = state.layoutConfig?.questions?.length || 0;
    return Math.max(sessionMax, keyMax, layoutMax);
}

function buildAnswerKeyEntry(maxQ) {
    const key = state.answerKey || {};
    if (Object.keys(key).length === 0) return null;
    const perQuestion = [];
    for (let i = 1; i <= maxQ; i++) {
        perQuestion.push({ q: i, marked: key[i] || '-', status: 'Anahtar' });
    }
    return {
        id: 0,
        studentNo: 'Cevap Anahtarı',
        correct: '',
        wrong: '',
        blank: '',
        multi: '',
        net: '',
        perQuestion,
        suspicious: false,
        suspiciousReasons: []
    };
}

export function downloadSessionCsv() {
    if (sessionResults.length === 0 && Object.keys(state.answerKey || {}).length === 0) { alert('Kayit yok.'); return; }
    const maxQ = getMaxQuestionCount();
    const header = ['Sira', 'OgrenciNo', 'Dogru', 'Yanlis', 'Bos', 'Coklu', 'Net'];
    for (let i = 1; i <= maxQ; i++) header.push(`S${i}`);
    const rows = [];
    const keyEntry = buildAnswerKeyEntry(maxQ);
    if (keyEntry) {
        const keyRow = [keyEntry.id, keyEntry.studentNo, keyEntry.correct, keyEntry.wrong, keyEntry.blank, keyEntry.multi, keyEntry.net];
        const answers = keyEntry.perQuestion || [];
        for (let i = 0; i < maxQ; i++) keyRow.push(answers[i] ? (answers[i].marked || '') : '');
        rows.push(keyRow.map(csvEscape).join(','));
    }
    rows.push(...sessionResults.map(r => {
        const base = [r.id, r.studentNo || '', r.correct, r.wrong, r.blank, r.multi, r.net];
        const answers = r.perQuestion || [];
        for (let i = 0; i < maxQ; i++) {
            base.push(answers[i] ? (answers[i].marked || '') : '');
        }
        return base.map(csvEscape).join(',');
    }));
    const csv = [header.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oturum-sonuclari.csv';
    a.click();
    URL.revokeObjectURL(url);
}

export async function downloadSessionXlsx() {
    if (sessionResults.length === 0 && Object.keys(state.answerKey || {}).length === 0) { alert('Kayit yok.'); return; }
    const XLSX = await getXlsxModule();
    if (!XLSX?.utils?.aoa_to_sheet || !XLSX?.write) {
        alert('XLSX kütüphanesi yüklenemedi. İnterneti kontrol edin.');
        return;
    }
    const maxQ = getMaxQuestionCount();
    const header = ['Sira', 'OgrenciNo', 'Dogru', 'Yanlis', 'Bos', 'Coklu', 'Net'];
    for (let i = 1; i <= maxQ; i++) header.push(`S${i}`);
    const data = [header];
    const keyEntry = buildAnswerKeyEntry(maxQ);
    if (keyEntry) {
        const keyRow = [keyEntry.id, keyEntry.studentNo, keyEntry.correct, keyEntry.wrong, keyEntry.blank, keyEntry.multi, keyEntry.net];
        const answers = keyEntry.perQuestion || [];
        for (let i = 0; i < maxQ; i++) keyRow.push(answers[i] ? (answers[i].marked || '') : '');
        data.push(keyRow);
    }
    sessionResults.forEach(r => {
        const row = [r.id, r.studentNo || '', r.correct, r.wrong, r.blank, r.multi, r.net];
        const answers = r.perQuestion || [];
        for (let i = 0; i < maxQ; i++) row.push(answers[i] ? (answers[i].marked || '') : '');
        data.push(row);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sonuclar');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oturum-sonuclari.xlsx';
    a.click();
    URL.revokeObjectURL(url);
}
