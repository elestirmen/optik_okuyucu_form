import { MARKER_OFFSET, MARKER_SIZE } from './config.js';
import { debounce, clampInt } from '../utils/helpers.js';
import { state } from './state.js';
import { initCamera } from '../core/camera.js';

let qrCodeModulePromise = null;

async function getQrCodeModule() {
    if (typeof QRCode !== 'undefined' && QRCode?.toCanvas) return QRCode;
    if (!qrCodeModulePromise) {
        qrCodeModulePromise = (async () => {
            try {
                const m = await import('qrcode');
                return m.default || m;
            } catch {
                try {
                    const m = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
                    return m.default || m;
                } catch (err) {
                    console.warn('QR kod kütüphanesi yüklenemedi:', err);
                    return null;
                }
            }
        })();
    }
    return qrCodeModulePromise;
}

export function setupTabs() {
    document.querySelectorAll('.tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(btn.dataset.view).classList.add('active');
            if (btn.dataset.view === 'reader') initCamera();
        });
    });
}

export function setupInputs() {
    const ids = ['questionCount', 'choiceCount', 'columnCount', 'studentDigits', 'showAnswerKey',
        'answerKeyChoices', 'formWidth', 'formHeight', 'bubbleSize', 'rowGap', 'examId', 'webUrl',
        'qualityScale', 'headerRepeat'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debounce(generateForm, 200));
    });
}

export function getConfig() {
    return {
        questionCount: clampInt(document.getElementById('questionCount').value, 1, 200, 30),
        choiceCount: clampInt(document.getElementById('choiceCount').value, 4, 5, 5),
        columnCount: clampInt(document.getElementById('columnCount').value, 1, 4, 2),
        studentDigits: clampInt(document.getElementById('studentDigits').value, 4, 15, 10),
        showAnswerKey: document.getElementById('showAnswerKey').value === 'yes',
        answerKeyChoices: clampInt(document.getElementById('answerKeyChoices').value, 4, 10, 10),
        formWidth: clampInt(document.getElementById('formWidth').value, 300, 1200, 600),
        formHeight: clampInt(document.getElementById('formHeight').value, 400, 2000, 900),
        bubbleSize: clampInt(document.getElementById('bubbleSize').value, 8, 24, 14),
        rowGap: clampInt(document.getElementById('rowGap').value, 1, 20, 4),
        qualityScale: clampInt(document.getElementById('qualityScale').value, 1, 4, 2),
        headerRepeat: clampInt(document.getElementById('headerRepeat').value, 3, 20, 5),
        examId: document.getElementById('examId').value || 'SINAV-001',
        webUrl: document.getElementById('webUrl').value || ''
    };
}

export function generateForm() {
    const config = getConfig();
    state.layoutConfig = config; // Update global state
    drawForm(config);
    generateAnswerKeyData(config);
}

function generateAnswerKeyData(cfg) {
    // This resets answer key data based on form config
    // Note: This logic was in main.js, slightly modified to update state
    // Ideally existing answers should be preserved if possible, but original code reset it.
    // Keeping original behavior but ensure we don't wipe state.answerKey if we want to keep it?
    // Original code: answerKey = {};
    // We will verify if we really want to reset it on every generateForm. 
    // Usually yes, if question count changes.
    // Let's implement keeping existing logic.
    // However, state.answerKey is used in OMR.
    // We'll leave it to user interactions or explicit reset.
    // But original `generateAnswerKeyData` filled it with A, B, C... pattern.
    const tempKey = {};
    const letters = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 1; i <= cfg.questionCount; i++) {
        tempKey[i] = letters[(i - 1) % cfg.choiceCount];
    }
    // Note: We are NOT overwriting state.answerKey here because that would kill manual entry
    // Wait, original main.js `generateForm` CALLED `generateAnswerKeyData`.
    // And `generateAnswerKeyData` SET `answerKey = {}` then filled it.
    // So yes, it resets it.
    // But `state.answerKey` is used for checking answers.
    // Let's replicate original behavior for now.
    // Actually, maybe we shouldn't auto-fill answer key on form gen?
    // The original code did: `answerKey = {}; ... loop ...`
    // It seems to create a default pattern.
    // state.answerKey = tempKey; // Uncomment if we want to enforce default pattern
}

export function drawForm(cfg) {
    const canvas = document.getElementById('formCanvas');
    const ctx = canvas.getContext('2d');

    const scale = cfg.qualityScale;
    canvas.width = cfg.formWidth * scale;
    canvas.height = cfg.formHeight * scale;
    canvas.style.width = cfg.formWidth + 'px';
    canvas.style.height = cfg.formHeight + 'px';
    ctx.scale(scale, scale);

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    drawCornerMarkers(ctx, cfg.formWidth, cfg.formHeight);

    const margin = 15;
    const bubbleR = cfg.bubbleSize / 2;
    const bubbleGap = cfg.bubbleSize + 3;
    const rowH = cfg.bubbleSize + cfg.rowGap;

    const studentStartX = Math.max(margin, MARKER_OFFSET + MARKER_SIZE + 10);
    const digitBubbleSize = Math.min(cfg.bubbleSize - 2, 12);
    const digitGap = digitBubbleSize + 2;
    const digitBubbleR = digitBubbleSize / 2;

    // Calculate header width to position QR code to the right
    const studentBlockWidth = cfg.studentDigits * digitGap;
    let headerContentWidth = studentBlockWidth;
    if (cfg.showAnswerKey) {
        headerContentWidth += 20 + 40;
    }

    const qrSize = 60;
    const qrX = studentStartX + headerContentWidth + 30;
    const maxQrX = cfg.formWidth - MARKER_OFFSET - MARKER_SIZE - qrSize - 5;
    const safeQrX = Math.min(qrX, maxQrX);

    // Position QR high up
    const qrY = Math.max(margin, MARKER_OFFSET + MARKER_SIZE); // +10 removed to save space? Keep +10.

    // Vertical Layout: Content starts high (original behavior)
    // We do NOT push y down by qrSize anymore.
    const studentStartY = Math.max(margin + 10, MARKER_OFFSET + MARKER_SIZE + 10);

    // Questions start below header
    const headerHeight = 20 + 10 * (digitBubbleSize + 2) + 15;
    let y = studentStartY + headerHeight;

    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
    ctx.fillText('Öğrenci No.', studentStartX, studentStartY);

    ctx.font = '7px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let d = 0; d < cfg.studentDigits; d++) {
        const x = studentStartX + d * digitGap + digitBubbleR;
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - digitBubbleR, studentStartY + 5, digitBubbleSize, digitBubbleSize);
    }

    for (let row = 0; row < 10; row++) {
        const rowY = studentStartY + 20 + row * (digitBubbleSize + 2);
        ctx.fillStyle = '#000';
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(row.toString(), studentStartX - 4, rowY + digitBubbleR + 3);

        for (let col = 0; col < cfg.studentDigits; col++) {
            const x = studentStartX + col * digitGap + digitBubbleR;
            drawBubble(ctx, x, rowY + digitBubbleR, digitBubbleR - 1);
        }
    }

    if (cfg.showAnswerKey) {
        // Move answer key slightly right to align with pushed down layout? 
        // studentStartY changed, so Answer Key moves down too. Ideally it should stay up if space allowed, but simpler to align.
        const keyStartX = studentStartX + cfg.studentDigits * digitGap + 20;
        const keyStartY = studentStartY;

        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Anahtar', keyStartX, keyStartY);

        const letters = 'ABCDEFGHIJ'.split('');
        ctx.font = '7px Inter, sans-serif';
        ctx.textAlign = 'center';

        for (let i = 0; i < cfg.answerKeyChoices; i++) {
            const rowY = keyStartY + 10 + i * (digitBubbleSize + 2);
            ctx.fillStyle = '#000';
            ctx.textAlign = 'right';
            ctx.fillText(letters[i], keyStartX - 4, rowY + digitBubbleR + 3);
            drawBubble(ctx, keyStartX + digitBubbleR, rowY + digitBubbleR, digitBubbleR - 1);
        }
    }

    // Draw horizontal separator line below header
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(canvas.width - margin, y);
    ctx.stroke();

    y += 10;

    const questionsPerColumn = Math.ceil(cfg.questionCount / cfg.columnCount);
    const columnGap = cfg.bubbleSize;
    const columnWidth = (cfg.formWidth - margin * 2 - columnGap * (cfg.columnCount - 1)) / cfg.columnCount;

    // Update state for OMR
    if (!state.layoutConfig) state.layoutConfig = {};
    state.layoutConfig.questions = [];
    state.layoutConfig.studentId = { digits: cfg.studentDigits, bubbles: [] };

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < cfg.studentDigits; col++) {
            const bx = (studentStartX + col * digitGap + digitBubbleR) / cfg.formWidth;
            const by = (studentStartY + 20 + row * (digitBubbleSize + 2) + digitBubbleR) / cfg.formHeight;
            state.layoutConfig.studentId.bubbles.push({
                digit: row, col, x: bx, y: by, width: digitBubbleSize / cfg.formWidth, height: digitBubbleSize / cfg.formHeight
            });
        }
    }

    const letters = 'ABCDE'.split('').slice(0, cfg.choiceCount);
    const headerRepeatInterval = cfg.headerRepeat;
    const numberYOffset = Math.max(3, Math.round(cfg.bubbleSize * 0.35));
    const numberXGap = Math.max(6, Math.round(cfg.bubbleSize * 0.4));

    for (let col = 0; col < cfg.columnCount; col++) {
        const colX = margin + col * (columnWidth + columnGap);
        const labelStartX = colX + 25;

        const labelToBubbleGap = Math.max(6, Math.round(cfg.bubbleSize * 0.4));
        const headerY = y + labelToBubbleGap;
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        for (let i = 0; i < letters.length; i++) {
            ctx.fillText(letters[i], labelStartX + i * bubbleGap, headerY);
        }

        let extraOffset = 0;

        for (let qIdx = 0; qIdx < questionsPerColumn; qIdx++) {
            const qNum = col * questionsPerColumn + qIdx + 1;
            if (qNum > cfg.questionCount) break;

            if (qIdx > 0 && qIdx % headerRepeatInterval === 0) {
                extraOffset += rowH * 0.8;
                const headerY = y + labelToBubbleGap + 12 + qIdx * rowH + extraOffset - rowH * 0.6;

                ctx.font = '8px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#666';
                for (let i = 0; i < letters.length; i++) {
                    ctx.fillText(letters[i], labelStartX + i * bubbleGap, headerY);
                }
            }

            const qY = y + 12 + qIdx * rowH + extraOffset;

            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'right';
            const numberX = labelStartX - bubbleR - numberXGap;
            ctx.fillText(qNum.toString(), numberX, qY + bubbleR + numberYOffset);

            const choices = [];
            for (let c = 0; c < cfg.choiceCount; c++) {
                const bx = labelStartX + c * bubbleGap;
                drawBubble(ctx, bx, qY + bubbleR, bubbleR - 1);

                choices.push({
                    option: letters[c],
                    x: bx / cfg.formWidth,
                    y: (qY + bubbleR) / cfg.formHeight,
                    width: cfg.bubbleSize / cfg.formWidth,
                    height: cfg.bubbleSize / cfg.formHeight
                });
            }

            state.layoutConfig.questions.push({ questionNumber: qNum, choices });
        }
    }

    state.layoutConfig.canvasWidth = cfg.formWidth;
    state.layoutConfig.canvasHeight = cfg.formHeight;

    // Call helper to draw QR
    drawQRCode(ctx, safeQrX, qrY, qrSize, cfg.webUrl + '?e=' + cfg.examId);
}

function drawCornerMarkers(ctx, w, h) {
    drawCrossMarker(ctx, MARKER_OFFSET, MARKER_OFFSET, MARKER_SIZE);
    drawCrossMarker(ctx, w - MARKER_OFFSET - MARKER_SIZE, MARKER_OFFSET, MARKER_SIZE);
    drawCrossMarker(ctx, w - MARKER_OFFSET - MARKER_SIZE, h - MARKER_OFFSET - MARKER_SIZE, MARKER_SIZE);
    drawCrossMarker(ctx, MARKER_OFFSET, h - MARKER_OFFSET - MARKER_SIZE, MARKER_SIZE);
}

function drawCrossMarker(ctx, x, y, size) {
    const border = Math.max(2, Math.floor(size * 0.2));
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + border, y + border, size - border * 2, size - border * 2);
    ctx.fillStyle = '#000';
    const lineW = Math.max(2, Math.floor(size * 0.14));
    const midX = x + size / 2 - lineW / 2;
    const midY = y + size / 2 - lineW / 2;
    ctx.fillRect(midX, y + border, lineW, size - border * 2);
    ctx.fillRect(x + border, midY, size - border * 2, lineW);
}

function drawBubble(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
}

function drawQRCode(ctx, x, y, size, data) {
    getQrCodeModule().then((QRCodeLib) => {
        if (!QRCodeLib?.toCanvas) return;
        QRCodeLib.toCanvas(
            document.createElement('canvas'),
            data,
            { errorCorrectionLevel: 'M', width: size },
            (err, canvas) => {
                if (!err) {
                    ctx.drawImage(canvas, x, y, size, size);
                }
            }
        );
    });
}

export function downloadPNG() {
    const canvas = document.getElementById('formCanvas');
    const link = document.createElement('a');
    // Use state.layoutConfig for examId if available, else default
    const examId = state.layoutConfig?.examId || 'form';
    link.download = `optik-form-${examId}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
}
