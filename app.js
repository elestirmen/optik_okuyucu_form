// =====================================================
// GLOBAL STATE
// =====================================================
const MARKER_OFFSET = 5;
const MARKER_SIZE = 32; // Bullseye marker çapı
const MARKER_OUTER_R = MARKER_SIZE / 2;
const MARKER_RING_R = MARKER_OUTER_R * 0.65;
const MARKER_CORE_R = MARKER_OUTER_R * 0.35;
const FILL_ROI_SCALE = 1.04; // Baloncuk ROI'sini hafif büyüt, gürültü kapma riskini azalt
const FILL_MASK_RATIO = 0.32; // ROI içinde ölçüm yapılacak iç daire oranı (çerçeveyi daha az say)
const BLANK_GUARD = 0.15; // max skor bunun altındaysa eşikten bağımsız olarak Boş kabul et
const QR_SIGNATURE_VERSION = 1;
const sessionResults = [];
let saveDirHandle = null;
let logFileHandle = null;
const LOG_FILE_NAME = 'session-log.txt';
const fileSaveSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
let availableCameras = [];
let currentDeviceId = '';
let layoutConfig = null;
let answerKey = {};
let videoStream = null;
let autoScanInterval = null;
let isAutoScanning = false;
let scanMode = 'student'; // 'student' veya 'answerKey'

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupInputs();
  generateForm();
  setupAnswerKeyUI();

  document.getElementById('refreshBtn').addEventListener('click', generateForm);
  document.getElementById('downloadPngBtn').addEventListener('click', downloadPNG);
  document.getElementById('downloadPdfBtn').addEventListener('click', () => window.print());
  document.getElementById('startCameraBtn').addEventListener('click', initCamera);
  document.getElementById('captureBtn').addEventListener('click', () => captureAndProcess());
  document.getElementById('autoScanBtn').addEventListener('click', toggleAutoScan);
  const camSelect = document.getElementById('cameraSelect');
  if (camSelect) camSelect.addEventListener('change', () => { stopCamera(); initCamera(true); });
  document.getElementById('downloadTxtBtn').addEventListener('click', downloadSessionTxt);
  document.getElementById('downloadCsvBtn').addEventListener('click', downloadSessionCsv);
  document.getElementById('downloadXlsxBtn').addEventListener('click', downloadSessionXlsx);
  document.getElementById('downloadXlsxBtn').addEventListener('contextmenu', async (e) => { e.preventDefault(); await requestSaveDirectory(); });

  // Cevap anahtarı event listener'ları
  document.getElementById('answerKeySource').addEventListener('change', toggleAnswerKeyMode);
  document.getElementById('generateKeyGridBtn').addEventListener('click', generateAnswerKeyGrid);
  document.getElementById('clearKeyBtn').addEventListener('click', clearAnswerKey);
  document.getElementById('randomKeyBtn').addEventListener('click', generateRandomKey);
  document.getElementById('scanKeyBtn').addEventListener('click', startAnswerKeyScan);
  document.getElementById('answerKeyCount').addEventListener('change', generateAnswerKeyGrid);

  // Dosya yükleme event listener'ları
  document.getElementById('scanSource').addEventListener('change', toggleScanSource);
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  document.getElementById('processFileBtn').addEventListener('click', processUploadedFile);
  document.getElementById('clearFileBtn').addEventListener('click', clearUploadedFile);

  renderSessionList();
  loadCameras();
  window.addEventListener('resize', debounce(adjustVideoLayout, 150));
});

    function setupTabs() {
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

    function setupInputs() {
      const ids = ['questionCount', 'choiceCount', 'columnCount', 'studentDigits', 'showAnswerKey',
        'answerKeyChoices', 'formWidth', 'formHeight', 'qrSize', 'bubbleSize', 'rowGap',
        'examId', 'qualityScale', 'headerRepeat', 'useMarkers'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', debounce(generateForm, 200));
      });
    }

function debounce(fn, delay) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : Math.min(Math.max(n, min), max);
}

function calculateQrBand(qrSize) {
  const quietZone = Math.max(24, Math.round(qrSize * 0.35));
  return qrSize + quietZone;
}

function parseQrMeta(data) {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      v: parsed.v ?? null,
      id: parsed.id || '',
      w: parsed.w || parsed.width,
      h: parsed.h || parsed.height,
      q: parsed.q || parsed.questions,
      c: parsed.c || parsed.choices,
      b: parsed.b
    };
  } catch (e) {
    return null;
  }
}

function metasClose(exp, got) {
  if (!exp || !got) return false;
  const tol = 0.03;
  const close = (a, b) => {
    if (a === undefined || b === undefined) return false;
    return Math.abs(a - b) <= Math.max(tol * Math.max(Math.abs(a), Math.abs(b)), 2);
  };
  const bandClose = (a, b) => {
    if (a === undefined || b === undefined) return true;
    return close(a, b);
  };
  return exp.id === got.id
    && close(exp.w, got.w)
    && close(exp.h, got.h)
    && exp.q === got.q
    && exp.c === got.c
    && bandClose(exp.b, got.b);
}

function applyLayoutFromQr(meta) {
  if (!meta) return false;

  const setIfChanged = (id, val, min, max) => {
    const el = document.getElementById(id);
    if (!el || val === undefined || val === null) return false;
    const num = parseInt(val, 10);
    if (Number.isNaN(num)) return false;
    const clamped = Math.min(Math.max(num, min), max);
    if (String(el.value) !== String(clamped)) {
      el.value = clamped;
      return true;
    }
    return false;
  };

  let changed = false;
  changed = setIfChanged('questionCount', meta.q, 1, 200) || changed;
  changed = setIfChanged('choiceCount', meta.c, 4, 5) || changed;

  const examInput = document.getElementById('examId');
  if (examInput && meta.id && examInput.value !== meta.id) {
    examInput.value = meta.id;
    changed = true;
  }

  // Genişlik ve yükseklik meta'sı varsa, QR bandını düşerek içerik yüksekliğini tahmin et
  if (meta.w) {
    changed = setIfChanged('formWidth', meta.w, 300, 1200) || changed;
  }
  if (meta.h) {
    const qrSizeInput = clampInt(document.getElementById('qrSize')?.value || 120, 64, 240, 120);
    const qrBandFromMeta = meta.b && meta.b > 0 ? meta.b : calculateQrBand(qrSizeInput);
    const contentH = Math.max(300, Math.round(meta.h - qrBandFromMeta));
    changed = setIfChanged('formHeight', contentH, 400, 2000) || changed;
  }

  if (changed) {
    generateForm();
  }
  return changed;
}

    // =====================================================
    // FORM GENERATION - Canvas Based
    // =====================================================
    function generateForm() {
      const previousLayout = layoutConfig;
      const config = getConfig();
      layoutConfig = { ...config };
      drawForm(layoutConfig);
      syncAnswerKeyWithConfig(layoutConfig, previousLayout);
    }

    function getConfig() {
      return {
        questionCount: clampInt(document.getElementById('questionCount').value, 1, 200, 30),
        choiceCount: clampInt(document.getElementById('choiceCount').value, 4, 5, 5),
        columnCount: clampInt(document.getElementById('columnCount').value, 1, 4, 2),
        studentDigits: clampInt(document.getElementById('studentDigits').value, 4, 15, 10),
        showAnswerKey: document.getElementById('showAnswerKey').value === 'yes',
        answerKeyChoices: clampInt(document.getElementById('answerKeyChoices').value, 4, 10, 10),
        formWidth: clampInt(document.getElementById('formWidth').value, 300, 1200, 600),
        formHeight: clampInt(document.getElementById('formHeight').value, 400, 2000, 900),
        qrSize: clampInt(document.getElementById('qrSize').value, 64, 240, 120),
        bubbleSize: clampInt(document.getElementById('bubbleSize').value, 8, 24, 14),
        rowGap: clampInt(document.getElementById('rowGap').value, 1, 20, 4),
        qualityScale: clampInt(document.getElementById('qualityScale').value, 1, 4, 2),
        headerRepeat: clampInt(document.getElementById('headerRepeat').value, 3, 20, 5),
        useMarkers: document.getElementById('useMarkers').value === 'yes',
        examId: document.getElementById('examId').value || 'SINAV-001'
      };
    }

    function drawForm(cfg) {
      const canvas = document.getElementById('formCanvas');
      const ctx = canvas.getContext('2d');

      // Yüksek kalite için ölçek faktörü (kullanıcı ayarlı)
      const scale = cfg.qualityScale;
      const contentHeight = cfg.formHeight;
      const qrSize = cfg.qrSize || 120;
      const qrBand = calculateQrBand(qrSize); // QR için ayrı bant
      const qrQuietZone = qrBand - qrSize;
      const totalHeight = contentHeight + qrBand;
      canvas.width = cfg.formWidth * scale;
      canvas.height = totalHeight * scale;
      canvas.style.width = cfg.formWidth + 'px';
      canvas.style.height = totalHeight + 'px';
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // QR bandı üstte, içerikten ayrı
      const qrX = cfg.formWidth / 2 - qrSize / 2;
      const qrY = (qrBand - qrSize) / 2;
      const qrPayloadData = {
        examId: cfg.examId,
        formWidth: cfg.formWidth,
        formHeight: totalHeight,
        questionCount: cfg.questionCount,
        choiceCount: cfg.choiceCount,
        qrBand
      };
      const qrPayloadMeta = {
        id: qrPayloadData.examId || '',
        w: qrPayloadData.formWidth,
        h: qrPayloadData.formHeight,
        q: qrPayloadData.questionCount,
        c: qrPayloadData.choiceCount,
        b: qrBand
      };
      const qrPayload = buildQrPayload(qrPayloadData);
      layoutConfig.qrPayload = qrPayload;
      layoutConfig.qrPayloadMeta = qrPayloadMeta;
      drawQRCode(ctx, qrX, qrY, qrSize, qrPayload);
      ctx.fillStyle = '#000';
      ctx.font = '8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Doğrulama', qrX + qrSize / 2, qrY + qrSize + 10);

      // İçerik alanını qrBand kadar aşağı kaydır
      ctx.save();
      ctx.translate(0, qrBand);

      // Border (kalın ve kenar tespiti için belirgin)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, cfg.formWidth - 3, contentHeight - 3);

      // Corner markers (isteğe bağlı)
      if (cfg.useMarkers) {
        drawCornerMarkers(ctx, cfg.formWidth, contentHeight);
      }

      // Markerların üzerine yazı gelmemesi için sol/üst boşluk marker boyutuna göre ayarlandı
      const margin = cfg.useMarkers ? Math.max(15, MARKER_OFFSET + MARKER_SIZE + 10) : 20;
      const bubbleR = cfg.bubbleSize / 2;
      const bubbleGap = cfg.bubbleSize + 3;
      const rowH = cfg.bubbleSize + cfg.rowGap;

      let y = margin + 10;

      // === HEADER: Öğrenci No + Anahtar ===
      const studentStartX = margin;
      const studentStartY = y;

      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Öğrenci No.', studentStartX, studentStartY);

      // Draw student number grid (horizontal: digits, vertical: 0-9)
      const digitBubbleSize = Math.min(cfg.bubbleSize - 2, 12);
      const digitBubbleR = digitBubbleSize / 2;
      const digitGap = digitBubbleSize + 2;

      // Column headers (1, 2, 3, ...)
      ctx.font = '7px Inter, sans-serif';
      ctx.textAlign = 'center';
      for (let d = 0; d < cfg.studentDigits; d++) {
        const x = studentStartX + d * digitGap + digitBubbleR;
        ctx.fillStyle = '#000';
        // Draw box for column number
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - digitBubbleR, studentStartY + 5, digitBubbleSize, digitBubbleSize);
      }

      // 0-9 rows
      for (let row = 0; row < 10; row++) {
        const rowY = studentStartY + 20 + row * (digitBubbleSize + 2);

        // Row label (0-9)
        ctx.fillStyle = '#000';
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(row.toString(), studentStartX - 4, rowY + digitBubbleR + 3);

        // Bubbles for each digit position
        for (let col = 0; col < cfg.studentDigits; col++) {
          const x = studentStartX + col * digitGap + digitBubbleR;
          drawBubble(ctx, x, rowY + digitBubbleR, digitBubbleR - 1);
        }
      }

      // === Cevap Anahtarı Section (if enabled) ===
      if (cfg.showAnswerKey) {
        const keyStartX = studentStartX + cfg.studentDigits * digitGap + 20;
        const keyStartY = studentStartY;

        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Anahtar', keyStartX, keyStartY);

        // A, B, C, D, E... labels
        const letters = 'ABCDEFGHIJ'.split('');
        ctx.font = '7px Inter, sans-serif';
        ctx.textAlign = 'center';

        for (let i = 0; i < cfg.answerKeyChoices; i++) {
          const rowY = keyStartY + 10 + i * (digitBubbleSize + 2);

          // Letter label
          ctx.fillStyle = '#000';
          ctx.textAlign = 'right';
          ctx.fillText(letters[i], keyStartX - 4, rowY + digitBubbleR + 3);

          // Single bubble
          drawBubble(ctx, keyStartX + digitBubbleR, rowY + digitBubbleR, digitBubbleR - 1);
        }
      }

      // Header section height
      const headerHeight = 20 + 10 * (digitBubbleSize + 2) + 15;
      y = studentStartY + headerHeight;

      // Horizontal line separator
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(canvas.width - margin, y);
      ctx.stroke();

      y += 10;

      // === QUESTIONS SECTION ===
      const questionsPerColumn = Math.ceil(cfg.questionCount / cfg.columnCount);
      // Not: canvas.width scale edilmiş, çizimde cfg.formWidth kullanmalıyız
      const columnWidth = (cfg.formWidth - margin * 2) / cfg.columnCount;

      // Store bubble positions for OMR
      layoutConfig.questions = [];
      layoutConfig.studentId = { digits: cfg.studentDigits, bubbles: [] };

      // Store student ID bubble positions (scale faktörünü hesaba kat)
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < cfg.studentDigits; col++) {
          const bx = (studentStartX + col * digitGap + digitBubbleR) / cfg.formWidth;
          const by = (qrBand + studentStartY + 20 + row * (digitBubbleSize + 2) + digitBubbleR) / totalHeight;
          layoutConfig.studentId.bubbles.push({
            digit: row, col, x: bx, y: by, width: digitBubbleSize / cfg.formWidth, height: digitBubbleSize / totalHeight
          });
        }
      }

      const letters = 'ABCDE'.split('').slice(0, cfg.choiceCount);
      const headerRepeatInterval = cfg.headerRepeat; // Her N soruda bir harf başlıkları tekrarla

      for (let col = 0; col < cfg.columnCount; col++) {
        const colX = margin + col * columnWidth;
        const labelStartX = colX + 25;

        // İlk sütun başlığı (A B C D E)
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        for (let i = 0; i < letters.length; i++) {
          ctx.fillText(letters[i], labelStartX + i * bubbleGap, y);
        }

        // Draw questions
        let extraOffset = 0; // Eklenen başlıklar için ekstra offset

        for (let qIdx = 0; qIdx < questionsPerColumn; qIdx++) {
          const qNum = col * questionsPerColumn + qIdx + 1;
          if (qNum > cfg.questionCount) break;

          // Her 5 soruda bir (başlangıç hariç) harf başlıklarını tekrarla
          if (qIdx > 0 && qIdx % headerRepeatInterval === 0) {
            extraOffset += rowH * 0.8;
            const headerY = y + 12 + qIdx * rowH + extraOffset - rowH * 0.6;

            ctx.font = '8px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#666';
            for (let i = 0; i < letters.length; i++) {
              ctx.fillText(letters[i], labelStartX + i * bubbleGap, headerY);
            }
          }

          const qY = y + 12 + qIdx * rowH + extraOffset;

          // Question number
          ctx.fillStyle = '#000';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(qNum.toString(), colX + 18, qY + bubbleR + 3);

          // Choice bubbles
          const choices = [];
          for (let c = 0; c < cfg.choiceCount; c++) {
            const bx = labelStartX + c * bubbleGap;
            drawBubble(ctx, bx, qY + bubbleR, bubbleR - 1);

            choices.push({
              option: letters[c],
              x: bx / cfg.formWidth,
              y: (qrBand + qY + bubbleR) / totalHeight,
              width: cfg.bubbleSize / cfg.formWidth,
              height: cfg.bubbleSize / totalHeight
            });
          }

          layoutConfig.questions.push({ questionNumber: qNum, choices });
        }
      }

      // Store dimensions for OMR (orijinal boyutlar, scale'siz)
      layoutConfig.canvasWidth = cfg.formWidth;
      layoutConfig.canvasHeight = totalHeight;
      layoutConfig.qrBand = qrBand;
      layoutConfig.qrSize = qrSize;
      layoutConfig.qrQuietZone = qrQuietZone;

      ctx.restore();
    }

    function drawCornerMarkers(ctx, w, h) {
      const centers = [
        { x: MARKER_OFFSET + MARKER_OUTER_R, y: MARKER_OFFSET + MARKER_OUTER_R }, // TL
        { x: w - MARKER_OFFSET - MARKER_OUTER_R, y: MARKER_OFFSET + MARKER_OUTER_R }, // TR
        { x: MARKER_OFFSET + MARKER_OUTER_R, y: h - MARKER_OFFSET - MARKER_OUTER_R }, // BL
        { x: w - MARKER_OFFSET - MARKER_OUTER_R, y: h - MARKER_OFFSET - MARKER_OUTER_R } // BR
      ];
      centers.forEach(c => {
        // Outer black ring
        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(c.x, c.y, MARKER_OUTER_R, 0, Math.PI * 2);
        ctx.fill();
        // White ring to break QR benzerliği
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(c.x, c.y, MARKER_RING_R, 0, Math.PI * 2);
        ctx.fill();
        // Core black dot
        ctx.beginPath();
        ctx.fillStyle = '#000';
        ctx.arc(c.x, c.y, MARKER_CORE_R, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawBubble(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    function buildQrPayload(cfg) {
      return JSON.stringify({
        v: QR_SIGNATURE_VERSION,
        id: cfg.examId || '',
        w: cfg.formWidth,
        h: cfg.formHeight,
        q: cfg.questionCount,
        c: cfg.choiceCount,
        b: cfg.qrBand
      });
    }

    function readQrFromMat(mat) {
      if (!mat || typeof jsQR !== 'function') return null;
      try {
        // RGBA formatına dönüştür
        let rgba = mat;
        let needsDelete = false;
        if (mat.channels() === 1) {
          rgba = new cv.Mat();
          cv.cvtColor(mat, rgba, cv.COLOR_GRAY2RGBA);
          needsDelete = true;
        } else if (mat.channels() === 3) {
          rgba = new cv.Mat();
          cv.cvtColor(mat, rgba, cv.COLOR_BGR2RGBA);
          needsDelete = true;
        }
        const imgData = new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows);
        const res = jsQR(imgData.data, imgData.width, imgData.height);
        if (needsDelete) rgba.delete();

        if (res) {
          return {
            data: res.data,
            location: {
              tl: res.location.topLeftCorner,
              tr: res.location.topRightCorner,
              br: res.location.bottomRightCorner,
              bl: res.location.bottomLeftCorner
            }
          };
        }
        return null;
      } catch (e) {
        console.warn('QR okuma hatası:', e);
        return null;
      }
    }

    function readQrRobust(mat) {
      if (!mat) return null;
      const attempts = [];
      // Orijinal mat
      attempts.push({ mat: mat, scale: 1.0, offsetY: 0 });

      // Form üst bandı
      if (layoutConfig?.qrBand && layoutConfig?.canvasHeight) {
        const bandH = Math.min(mat.rows, Math.max(40, Math.round(mat.rows * (layoutConfig.qrBand / layoutConfig.canvasHeight))));
        if (bandH > 0 && bandH < mat.rows) {
          const roi = mat.roi(new cv.Rect(0, 0, mat.cols, bandH));
          attempts.push({ mat: roi, scale: 1.0, offsetY: 0, isRoi: true });
        }
      }

      // Upscale
      if (mat.cols < 400) {
        const scaled = new cv.Mat();
        cv.resize(mat, scaled, new cv.Size(mat.cols * 1.5, mat.rows * 1.5), 0, 0, cv.INTER_CUBIC);
        attempts.push({ mat: scaled, scale: 1.5, offsetY: 0, isTemp: true });
      }

      let result = null;

      for (const attempt of attempts) {
        if (result) break; // Bulunduysa çık

        const m = attempt.mat;
        result = readQrFromMat(m);
        // if (!result) result = readQrWithCv(m); // OpenCV QR bazen daha yavaştır, jsQR öncelikli.

        if (result) {
          // Koordinatları orijinal uzaya geri döndür
          if (attempt.scale !== 1.0) {
            ['tl', 'tr', 'br', 'bl'].forEach(k => {
              if (result.location[k]) {
                result.location[k].x /= attempt.scale;
                result.location[k].y /= attempt.scale;
              }
            });
          }
          // ROI offset ekle (şu an ROI hep (0,0) başlıyor ama ilerde değişirse)
          if (attempt.offsetY) {
            ['tl', 'tr', 'br', 'bl'].forEach(k => { result.location[k].y += attempt.offsetY; });
          }
        }

        if (attempt.isRoi) m.delete();
        if (attempt.isTemp) m.delete();
      }

      return result;
    }

    function readQrWithCv(mat) {
      // OpenCV QR implementasyonu - şimdilik pas geçiyoruz, jsQR daha stabil
      return null;
    }

    // QR bölgesi çizimi için yardımcı fonksiyon
    function drawQrRegion(overlay, loc, colorName) {
      if (!overlay || !loc) return;
      const colors = { 'green': [0, 255, 0, 255], 'red': [255, 0, 0, 255] };
      const c = new cv.Scalar(...(colors[colorName] || [0, 255, 255, 255]));

      const pts = [loc.tl, loc.tr, loc.br, loc.bl];
      for (let i = 0; i < 4; i++) {
        cv.line(overlay, new cv.Point(pts[i].x, pts[i].y), new cv.Point(pts[(i + 1) % 4].x, pts[(i + 1) % 4].y), c, 2);
      }
    }

    function verifyQrAgainstLayout(warpMat) {
      if (!layoutConfig) return { ok: false, reason: 'no-layout' };

      const fallbackMeta = {
        id: layoutConfig.examId || '',
        w: layoutConfig.canvasWidth,
        h: layoutConfig.canvasHeight,
        q: layoutConfig.questions?.length || 0,
        c: layoutConfig.questions?.[0]?.choices?.length || 0,
        b: layoutConfig.qrBand
      };
      const expectedMeta = layoutConfig.qrPayloadMeta || fallbackMeta;
      const expectedPayload = layoutConfig.qrPayload || buildQrPayload({
        examId: expectedMeta.id,
        formWidth: expectedMeta.w,
        formHeight: expectedMeta.h,
        questionCount: expectedMeta.q,
        choiceCount: expectedMeta.c
      });

      const result = readQrRobust(warpMat);
      if (!result || !result.data) return { ok: false, reason: 'qr-missing' };

      const data = result.data;
      const rect = result.location; // {x, y, width, height} veya benzeri
      const parsed = parseQrMeta(data);

      const matchesExact = data === expectedPayload;
      const matchesLoose = metasClose(expectedMeta, parsed);

      return {
        ok: matchesExact || matchesLoose,
        rect,
        meta: parsed,
        raw: data,
        reason: matchesExact || matchesLoose ? 'ok' : 'qr-mismatch'
      };
    }

    function drawQRCode(ctx, x, y, size, data) {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const qr = new QRCode(tempDiv, {
        text: data,
        width: size,
        height: size,
        correctLevel: QRCode.CorrectLevel.M
      });

      setTimeout(() => {
        const qrImg = tempDiv.querySelector('img');
        if (qrImg && qrImg.complete) {
          ctx.drawImage(qrImg, x, y, size, size);
        } else {
          const qrCanvas = tempDiv.querySelector('canvas');
          if (qrCanvas) {
            ctx.drawImage(qrCanvas, x, y, size, size);
          }
        }
        document.body.removeChild(tempDiv);
      }, 80);

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, size, size);
    }

    function syncAnswerKeyWithConfig(cfg, prevLayout) {
      const validLetters = ['A', 'B', 'C', 'D', 'E'].slice(0, cfg.choiceCount);
      const hadExistingAnswers = answerKey && Object.keys(answerKey).length > 0;
      const nextKey = {};

      for (let i = 1; i <= cfg.questionCount; i++) {
        const prev = answerKey?.[i];
        const normalizedPrev = typeof prev === 'string' ? prev.replace('*', '') : '';
        if (normalizedPrev && validLetters.includes(normalizedPrev)) {
          nextKey[i] = normalizedPrev;
        } else if (!hadExistingAnswers) {
          nextKey[i] = validLetters[(i - 1) % validLetters.length];
        }
      }

      answerKey = nextKey;

      const keyCountInput = document.getElementById('answerKeyCount');
      if (keyCountInput && keyCountInput.value !== String(cfg.questionCount)) {
        keyCountInput.value = cfg.questionCount;
      }

      const shouldRebuildGrid = !prevLayout
        || prevLayout.questionCount !== cfg.questionCount
        || prevLayout.choiceCount !== cfg.choiceCount
        || !hadExistingAnswers;

      if (shouldRebuildGrid && document.getElementById('answerKeyGrid')) {
        generateAnswerKeyGrid();
      } else {
        updateAnswerKeyStatus();
      }
    }

    function downloadPNG() {
      const canvas = document.getElementById('formCanvas');
      const link = document.createElement('a');
      link.download = `optik-form-${layoutConfig.examId}.png`;
      // Yüksek kaliteli PNG (varsayılan olarak zaten en iyi kalite)
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    }

    // =====================================================
    // CAMERA & OMR
    // =====================================================
    async function initCamera(forceReload = false) {
      try {
        if (videoStream && !forceReload) return;
        if (videoStream) stopCamera();
        const selectedId = document.getElementById('cameraSelect')?.value || '';
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        if (selectedId) {
          constraints.video.deviceId = { exact: selectedId };
        } else {
          constraints.video.facingMode = { ideal: 'environment' };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoStream = stream;
        const actualId = stream.getVideoTracks()[0]?.getSettings()?.deviceId || selectedId;
        if (actualId) currentDeviceId = actualId;
        document.getElementById('video').srcObject = stream;
        await document.getElementById('video').play();
        adjustVideoLayout();
        document.getElementById('captureBtn').disabled = false;
        updateStatus('ready', 'Hazır');
        setLog('cameraLog', '✓ Kamera hazır', 'success');
        // Kamera listesi etiketleri izin sonrası güncellenir
        loadCameras();
      } catch (e) {
        setLog('cameraLog', '✗ Kamera hatası: ' + e.message, 'error');
      }
    }

    function updateStatus(state, text) {
      const el = document.getElementById('scanStatus');
      el.className = 'scan-status ' + state;
      document.getElementById('scanStatusText').textContent = text;
    }

    function adjustVideoLayout() {
      const video = document.getElementById('video');
      const wrap = video?.parentElement;
      if (!video || !wrap) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const wrapWidth = wrap.clientWidth || video.clientWidth || 0;
      if (!wrapWidth) return;
      const targetHeight = Math.round(wrapWidth * vh / vw);
      wrap.style.height = targetHeight + 'px';
    }

    function stopCamera() {
      if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
        isAutoScanning = false;
        const autoBtn = document.getElementById('autoScanBtn');
        if (autoBtn) autoBtn.textContent = '🔄 Otomatik';
      }
      if (videoStream) {
        videoStream.getTracks().forEach(t => t.stop());
        videoStream = null;
      }
      const video = document.getElementById('video');
      if (video) {
        video.pause?.();
        video.srcObject = null;
      }
      const wrap = video?.parentElement;
      if (wrap) wrap.style.height = '';
      const captureBtn = document.getElementById('captureBtn');
      if (captureBtn) captureBtn.disabled = true;
      updateStatus('', 'Bekleniyor');
      clearLiveOverlay();
    }

    async function loadCameras() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(d => d.kind === 'videoinput');
        const select = document.getElementById('cameraSelect');
        if (!select) return;
        select.innerHTML = '';
        if (availableCameras.length === 0) {
          select.disabled = true;
          select.innerHTML = '<option>kamera yok</option>';
          return;
        }
        select.disabled = false;
        availableCameras.forEach((cam, idx) => {
          const opt = document.createElement('option');
          opt.value = cam.deviceId || '';
          opt.textContent = cam.label || `Kamera ${idx + 1}`;
          select.appendChild(opt);
        });
        // Önceki seçim varsa koru, yoksa ilkine geç
        if (currentDeviceId) select.value = currentDeviceId;
        if (!select.value && select.options.length > 0) select.selectedIndex = 0;
        currentDeviceId = select.value;
      } catch (e) {
        console.warn('Kamera listesi alınamadı', e);
      }
    }

    function setLog(id, msg, type = '') {
      const el = document.getElementById(id);
      el.textContent = msg;
      el.className = 'log ' + type;
    }

    function toggleAutoScan() {
      if (isAutoScanning) {
        clearInterval(autoScanInterval);
        isAutoScanning = false;
        document.getElementById('autoScanBtn').textContent = '🔄 Otomatik';
      } else {
        isAutoScanning = true;
        document.getElementById('autoScanBtn').textContent = '⏹️ Durdur';
        autoScanInterval = setInterval(() => captureAndProcess(true), 800);
      }
    }

    function processFrame(isAuto) {
      let src, gray, blurred, binary, markerOverlay;

      try {
        src = cv.imread('captureCanvas');
        gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        blurred = new cv.Mat(); cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        binary = new cv.Mat(); cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay) || findLayoutFrame(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
          updateStatus('error', '❌ Form bulunamadı');
          updateQualityIndicator(0);
          clearLiveOverlay();
          if (!isAuto) setLog('omrLog', '❌ Form çerçevesi algılanamadı. Formu ekrana tam ortalayın.', 'error');
          return;
        }

        // Kalite skoru hesapla
        const quality = evaluateFrameQuality(markers, binary.cols, binary.rows);
        updateQualityIndicator(quality.score);

        // Düşük kaliteli çerçeveleri reddet
        if (quality.score < 40) {
          updateStatus('error', `⚠️ Kalite: ${quality.score}/100`);
          renderLiveMarkers(markers, binary.cols, binary.rows, 'low');
          if (!isAuto) setLog('omrLog', `❌ Çerçeve kalitesi düşük (${quality.score}/100). Formu düz tutun ve tüm köşeler görünsün.`, 'error');
          return;
        }

        const geom = evaluateMarkerGeometry(markers, binary.cols, binary.rows);
        if (!geom.ok) {
          updateStatus('error', 'Hizalama zayıf');
          renderLiveMarkers(markers, binary.cols, binary.rows, 'medium');
          if (!isAuto) setLog('omrLog', `⚠️ Hizalama zayıf (${geom.reason}). Formu düz tutun.`, 'error');
          return;
        }

        // İyi kalite - yeşil çerçeve göster
        const qualityLevel = quality.score >= 70 ? 'high' : 'medium';
        renderLiveMarkers(markers, binary.cols, binary.rows, qualityLevel);

        let warped = warpPerspective(src, markers);
        cv.imshow('warpCanvas', warped);

        let validQr = verifyQrAgainstLayout(warped);
        if (validQr.meta) {
          const layoutChanged = applyLayoutFromQr(validQr.meta);
          if (layoutChanged) {
            warped.delete();
            warped = warpPerspective(src, markers);
            cv.imshow('warpCanvas', warped);
            validQr = verifyQrAgainstLayout(warped);
          }
        }

        if (validQr.ok) {
          // QR bulundu ve doğrulandı - Yeşil kutu çiz
          if (validQr.rect) {
            drawQrRegion(markerOverlay, validQr.rect, 'green');
            cv.imshow('markerCanvas', markerOverlay);
          }
        } else {
          // QR hatası
          console.warn('QR doğrulama:', validQr.reason);

          if (document.getElementById('strictQr').checked) {
            // Strict mod aktifse ve QR yoksa/hatalıysa reddet
            updateStatus('error', '⚠️ QR okunamadı');
            updateQualityIndicator(30); // Kaliteyi düşür

            if (validQr.rect) {
              drawQrRegion(markerOverlay, validQr.rect, 'red'); // Hatalı içerik
              cv.imshow('markerCanvas', markerOverlay);
            }

            if (!isAuto) {
              let msg = '❌ QR Kod okunamadı veya hatalı.';
              if (validQr.reason === 'qr-missing') msg += ' Görüntü net değil veya perspektif bozuk.';
              if (validQr.reason === 'qr-mismatch') msg += ' Yanlış form şablonu (Sınav ID uyuşmuyor).';
              setLog('omrLog', msg, 'error');
            }
            // İşlemi durdur
            warped.delete();
            return;
          }
        }

        const debugEnabled = document.getElementById('debugView')?.checked || false;
        const result = analyzeBubbles(warped, debugEnabled);

        // Okuma güvenilirliğini kontrol et
        const confidence = calculateReadingConfidence(result);
        result.confidence = confidence;

        if (confidence.overall < 50) {
          updateStatus('warn', `⚠️ Güvenilirlik: ${confidence.overall}%`);
          renderResults(result);
          if (!isAuto) {
            setLog('omrLog', `⚠️ Okuma güvenilirliği düşük (%${confidence.overall}). ${confidence.lowConfidenceCount} soruda belirsizlik var. Yeniden deneyin.`, 'error');
          }
          // Düşük güvenilirlikli sonuçları otomatik modda kaydetme
          if (isAuto) {
            warped.delete();
            return;
          }
        } else {
          renderResults(result);
          safeAddSessionResult(result);

          if (isAuto && result.correct + result.wrong > 0) {
            toggleAutoScan();
          }

          updateStatus('ready', `✓ Okundu (${confidence.overall}%)`);
          setLog('omrLog', `✅ Tarama tamamlandı - Güvenilirlik: %${confidence.overall}`, 'success');
        }

        warped.delete();
      } catch (e) {
        if (!isAuto) setLog('omrLog', 'Hata: ' + e.message, 'error');
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
      }
    }

    // Okuma güvenilirlik skoru hesaplama
    function calculateReadingConfidence(result) {
      if (!result || !result.perQuestion) return { overall: 0, lowConfidenceCount: 0 };

      let totalConfidence = 0;
      let lowConfidenceCount = 0;
      let questionCount = result.perQuestion.length;

      for (const q of result.perQuestion) {
        const score = parseFloat(q.maxScore) || 0;

        // Her soru için güvenilirlik hesapla
        let qConfidence = 100;

        if (q.status === 'Boş') {
          // Boş sorular için maxScore çok düşükse güvenilir
          qConfidence = score < 0.1 ? 90 : 70;
        } else if (q.marked?.includes('*')) {
          // Çoklu işaretleme - düşük güvenilirlik
          qConfidence = 40;
          lowConfidenceCount++;
        } else {
          // Normal işaretleme - skor yüksekliğine göre güvenilirlik
          if (score >= 0.5) {
            qConfidence = 95;
          } else if (score >= 0.35) {
            qConfidence = 80;
          } else if (score >= 0.25) {
            qConfidence = 65;
          } else {
            qConfidence = 45;
            lowConfidenceCount++;
          }
        }

        totalConfidence += qConfidence;
      }

      const overall = questionCount > 0 ? Math.round(totalConfidence / questionCount) : 0;
      return { overall, lowConfidenceCount };
    }

    // Kalite göstergesini güncelle
    function updateQualityIndicator(score) {
      const statusEl = document.getElementById('scanStatus');
      if (!statusEl) return;

      statusEl.classList.remove('quality-high', 'quality-medium', 'quality-low');

      if (score >= 70) {
        statusEl.classList.add('quality-high');
      } else if (score >= 40) {
        statusEl.classList.add('quality-medium');
      } else {
        statusEl.classList.add('quality-low');
      }
    }

    function detectCornerMarkers(binary, overlay) {
      if (!layoutConfig?.useMarkers) return null;
      // QR bandındaki finder pattern'lerin markerlarla karışmaması için üst bandı maskeler
      const work = new cv.Mat();
      binary.copyTo(work);
      if (layoutConfig?.qrBand && layoutConfig?.canvasHeight) {
        const cut = Math.min(work.rows, Math.max(0, Math.round(work.rows * (layoutConfig.qrBand / layoutConfig.canvasHeight)) + 4));
        if (cut > 0) {
          cv.rectangle(work, new cv.Point(0, 0), new cv.Point(work.cols, cut), new cv.Scalar(0, 0, 0, 0), cv.FILLED);
        }
      }

      const cleaned = new cv.Mat();
      const kernel = cv.Mat.ones(3, 3, cv.CV_8UC1);
      cv.morphologyEx(work, cleaned, cv.MORPH_CLOSE, kernel);
      kernel.delete();
      work.delete();

      // Önce dairesel bullseye marker araması, sonra kare fallback
      const markers = findBullseyeMarkers(cleaned, overlay) || findMarkersWithHoles(cleaned, overlay) || findMarkersSimple(cleaned, overlay);
      cleaned.delete();
      return markers;
    }

    function findLayoutFrame(binary, overlay) {
      // Mobil için geliştirilmiş çerçeve algılama
      // - Daha sıkı eşik değerleri
      // - Dörtgen doğrulama
      // - Çerçeve kalite kontrolü
      const work = new cv.Mat();
      binary.copyTo(work);
      if (layoutConfig?.qrBand && layoutConfig?.canvasHeight) {
        const cut = Math.min(work.rows, Math.max(0, Math.round(work.rows * (layoutConfig.qrBand / layoutConfig.canvasHeight)) + 4));
        if (cut > 0) cv.rectangle(work, new cv.Point(0, 0), new cv.Point(work.cols, cut), new cv.Scalar(0, 0, 0, 0), cv.FILLED);
      }
      const kernel = cv.Mat.ones(3, 3, cv.CV_8UC1);
      cv.morphologyEx(work, work, cv.MORPH_CLOSE, kernel);
      cv.dilate(work, work, kernel);
      kernel.delete();

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(work, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      work.delete();
      const imgArea = binary.rows * binary.cols;
      let bestRect = null;
      let bestApprox = null;
      let bestScore = 0;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        // Mobil için sıkı eşik: formun görüntünün en az %8'ini kaplaması gerekir
        if (area < imgArea * 0.08) continue;
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        // Daha sıkı köşe yaklaşımı
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        const usableH = (layoutConfig?.canvasHeight && layoutConfig?.qrBand) ? layoutConfig.canvasHeight - layoutConfig.qrBand : layoutConfig?.canvasHeight;
        const expectedAspect = (layoutConfig?.canvasWidth && usableH)
          ? layoutConfig.canvasWidth / usableH
          : aspect;
        // Sıkılaştırılmış aspect ratio kontrolü
        if (aspect < expectedAspect * 0.65 || aspect > expectedAspect * 1.35) { approx.delete(); continue; }
        const fitRatio = area / (rect.width * rect.height);
        if (fitRatio < 0.5) { approx.delete(); continue; }

        // Dörtgen tercih skorlaması: 4 köşeli konturları tercih et
        let score = area;
        if (approx.rows === 4) {
          score *= 1.5; // 4 köşeli konturu tercih et
        } else if (approx.rows > 6) {
          score *= 0.5; // Çok köşeli konturları cezalandır
        }

        if (score > bestScore) {
          if (bestApprox) bestApprox.delete();
          bestApprox = approx;
          bestRect = { rect, area };
          bestScore = score;
        } else {
          approx.delete();
        }
      }
      hierarchy.delete();
      contours.delete();
      if (!bestRect || !bestApprox) return null;

      let pts = [];
      if (bestApprox.rows === 4) {
        for (let i = 0; i < bestApprox.rows; i++) pts.push({ x: bestApprox.intPtr(i, 0)[0], y: bestApprox.intPtr(i, 0)[1] });
      } else {
        // Dörtgen değilse boundingRect köşelerini kullan
        const r = bestRect.rect;
        pts = [
          { x: r.x, y: r.y },
          { x: r.x + r.width, y: r.y },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x, y: r.y + r.height }
        ];
      }
      bestApprox.delete();
      const ordered = orderCorners(pts);
      if (!ordered) return null;
      if (overlay) {
        const green = new cv.Scalar(255, 0, 255, 255);
        const arr = [ordered.tl, ordered.tr, ordered.br, ordered.bl];
        for (let i = 0; i < 4; i++) {
          const p1 = arr[i], p2 = arr[(i + 1) % 4];
          cv.line(overlay, new cv.Point(p1.x, p1.y), new cv.Point(p2.x, p2.y), green, 2);
        }
      }
      return ordered;
    }

    function orderCorners(pts) {
      if (!pts || pts.length !== 4) return null;
      // Yükseğe göre sırala
      pts.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
      const [p0, p1, p2, p3] = pts;
      const top = [p0, p1].sort((a, b) => a.x - b.x);
      const bottom = [p2, p3].sort((a, b) => a.x - b.x);
      return { tl: top[0], tr: top[1], bl: bottom[0], br: bottom[1] };
    }

    function evaluateMarkerGeometry(markers, imgW, imgH) {
      if (!markers) return { ok: false, reason: 'markers-missing' };
      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const topW = dist(markers.tl, markers.tr);
      const bottomW = dist(markers.bl, markers.br);
      const leftH = dist(markers.tl, markers.bl);
      const rightH = dist(markers.tr, markers.br);
      const diag1 = dist(markers.tl, markers.br);
      const diag2 = dist(markers.tr, markers.bl);
      const avgW = (topW + bottomW) / 2;
      const avgH = (leftH + rightH) / 2;
      if (avgW < 20 || avgH < 20) return { ok: false, reason: 'markers-too-small' };
      const aspect = avgW / avgH;
      const usableH = (layoutConfig?.canvasHeight || imgH) - (layoutConfig?.qrBand || 0);
      const expectedAspect = (layoutConfig?.canvasWidth && usableH > 0)
        ? layoutConfig.canvasWidth / usableH
        : imgW / imgH;
      // +/- %45 tolerans - daha geniş
      if (aspect < expectedAspect * 0.55 || aspect > expectedAspect * 1.45) {
        return { ok: false, reason: 'aspect-mismatch' };
      }
      const skewW = Math.abs(topW - bottomW) / avgW;
      const skewH = Math.abs(leftH - rightH) / avgH;
      if (skewW > 0.45 || skewH > 0.45) return { ok: false, reason: 'skew-high' };
      const diagRatio = Math.max(diag1, diag2) / Math.min(diag1, diag2);
      if (diagRatio > 1.5) return { ok: false, reason: 'diag-mismatch' };
      return { ok: true };
    }

    // Çerçeve kalite skoru (0-100) - Mobil için geliştirilmiş
    function evaluateFrameQuality(markers, imgW, imgH) {
      if (!markers) return { score: 0, details: 'no-markers' };

      const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const topW = dist(markers.tl, markers.tr);
      const bottomW = dist(markers.bl, markers.br);
      const leftH = dist(markers.tl, markers.bl);
      const rightH = dist(markers.tr, markers.br);
      const avgW = (topW + bottomW) / 2;
      const avgH = (leftH + rightH) / 2;

      let score = 100;
      const details = [];

      // 1. Boyut kontrolü - form görüntünün yeterli kısmını kaplamalı
      const formArea = avgW * avgH;
      const imgArea = imgW * imgH;
      const areaRatio = formArea / imgArea;
      if (areaRatio < 0.15) {
        score -= 40;
        details.push('form-too-small');
      } else if (areaRatio < 0.25) {
        score -= 20;
        details.push('form-small');
      }

      // 2. Kenar paralelliği - üst/alt ve sol/sağ kenarlar paralel olmalı
      const widthSkew = Math.abs(topW - bottomW) / avgW;
      const heightSkew = Math.abs(leftH - rightH) / avgH;
      if (widthSkew > 0.25 || heightSkew > 0.25) {
        score -= 30;
        details.push('skew-high');
      } else if (widthSkew > 0.15 || heightSkew > 0.15) {
        score -= 15;
        details.push('skew-medium');
      }

      // 3. Köşe açıları - 90 dereceye yakın olmalı
      const angle = (p1, vertex, p2) => {
        const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
        const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.hypot(v1.x, v1.y);
        const mag2 = Math.hypot(v2.x, v2.y);
        return Math.acos(dot / (mag1 * mag2)) * 180 / Math.PI;
      };

      const angles = [
        angle(markers.tr, markers.tl, markers.bl), // TL corner
        angle(markers.tl, markers.tr, markers.br), // TR corner
        angle(markers.tr, markers.br, markers.bl), // BR corner
        angle(markers.tl, markers.bl, markers.br)  // BL corner
      ];

      const avgAngleDeviation = angles.reduce((sum, a) => sum + Math.abs(90 - a), 0) / 4;
      if (avgAngleDeviation > 20) {
        score -= 25;
        details.push('angles-bad');
      } else if (avgAngleDeviation > 10) {
        score -= 10;
        details.push('angles-moderate');
      }

      // 4. Diyagonal oran - köşegen oranı 1'e yakın olmalı
      const diag1 = dist(markers.tl, markers.br);
      const diag2 = dist(markers.tr, markers.bl);
      const diagRatio = Math.max(diag1, diag2) / Math.min(diag1, diag2);
      if (diagRatio > 1.3) {
        score -= 15;
        details.push('diag-mismatch');
      }

      // 5. Aspect ratio kontrolü 
      const aspect = avgW / avgH;
      const usableH = (layoutConfig?.canvasHeight || imgH) - (layoutConfig?.qrBand || 0);
      const expectedAspect = (layoutConfig?.canvasWidth && usableH > 0)
        ? layoutConfig.canvasWidth / usableH
        : imgW / imgH;
      const aspectDiff = Math.abs(aspect - expectedAspect) / expectedAspect;
      if (aspectDiff > 0.3) {
        score -= 20;
        details.push('aspect-mismatch');
      } else if (aspectDiff > 0.15) {
        score -= 10;
      }

      score = Math.max(0, Math.min(100, score));
      return { score, details: details.join(',') || 'ok' };
    }

    function clearLiveOverlay() {
      const c = document.getElementById('liveOverlay');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
    }

    function renderLiveMarkers(markers, srcW, srcH, qualityLevel = 'high') {
      const c = document.getElementById('liveOverlay');
      const video = document.getElementById('video');
      if (!c || !video) return;
      const w = video.clientWidth || srcW;
      const h = video.clientHeight || srcH;
      if (!w || !h || !srcW || !srcH) return;
      if (c.width !== w || c.height !== h) {
        c.width = w; c.height = h;
      }
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      if (!markers) return;
      const sx = w / srcW;
      const sy = h / srcH;

      // Kalite seviyesine göre renk
      const colors = {
        high: 'rgba(16, 185, 129, 0.9)',    // Yeşil
        medium: 'rgba(245, 158, 11, 0.9)',  // Sarı/Turuncu
        low: 'rgba(239, 68, 68, 0.9)'       // Kırmızı
      };
      ctx.strokeStyle = colors[qualityLevel] || colors.high;
      ctx.lineWidth = qualityLevel === 'high' ? 3 : 2;

      const pts = ['tl', 'tr', 'br', 'bl'].map(k => markers[k]).filter(Boolean);
      if (pts.length === 4) {
        ctx.beginPath();
        ctx.moveTo(markers.tl.x * sx, markers.tl.y * sy);
        ctx.lineTo(markers.tr.x * sx, markers.tr.y * sy);
        ctx.lineTo(markers.br.x * sx, markers.br.y * sy);
        ctx.lineTo(markers.bl.x * sx, markers.bl.y * sy);
        ctx.closePath();
        ctx.stroke();

        // Kalite seviyesine göre arka plan
        if (qualityLevel === 'high') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
          ctx.fill();
        } else if (qualityLevel === 'low') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.fill();
        }
      }
      pts.forEach(p => {
        const x = p.x * sx, y = p.y * sy;
        const size = qualityLevel === 'high' ? 20 : 16;
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      });
    }

    function findMarkersWithHoles(binary, overlay) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

      const imgArea = binary.rows * binary.cols;
      const minArea = imgArea * 0.00005;
      const maxArea = imgArea * 0.03;
      const candidates = [];

      for (let i = 0; i < contours.size(); i++) {
        const childCount = countChildren(i, hierarchy);
        if (childCount === 0) continue; // iç delik yoksa geç
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < minArea || area > maxArea) continue;
        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        if (aspect < 0.7 || aspect > 1.3) continue;
        const hull = new cv.Mat();
        cv.convexHull(cnt, hull);
        const solidity = area / cv.contourArea(hull);
        hull.delete();
        if (solidity < 0.7) continue;

        const childIdx = firstChild(i, hierarchy);
        if (childIdx >= 0) {
          const childArea = Math.abs(cv.contourArea(contours.get(childIdx)));
          const ratio = childArea / area;
          if (ratio < 0.05 || ratio > 0.5) continue;
        }

        candidates.push({
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          rect,
          area
        });
      }

      contours.delete(); hierarchy.delete();
      return pickCornersFromCandidates(candidates, binary, overlay);
    }

    function findBullseyeMarkers(binary, overlay) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

      const imgArea = binary.rows * binary.cols;
      const minArea = imgArea * 0.0001;
      const maxArea = imgArea * 0.05;
      const candidates = [];

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = Math.abs(cv.contourArea(cnt));
        if (area < minArea || area > maxArea) continue;
        const perimeter = cv.arcLength(cnt, true);
        if (!perimeter) continue;
        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
        // Kare QR finder'larından kaçınmak için daha yüksek eşik
        if (circularity < 0.83) continue;
        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        if (aspect < 0.8 || aspect > 1.25) continue;

        candidates.push({
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          rect,
          area
        });
      }

      contours.delete(); hierarchy.delete();
      return pickCornersFromCandidates(candidates, binary, overlay);
    }

    function findMarkersSimple(binary, overlay) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const imgArea = binary.rows * binary.cols;
      const minArea = imgArea * 0.00008;
      const maxArea = imgArea * 0.05;
      const candidates = [];

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < minArea || area > maxArea) continue;

        const rect = cv.boundingRect(cnt);
        const aspect = rect.width / rect.height;
        if (aspect < 0.7 || aspect > 1.3) continue;

        const hull = new cv.Mat();
        cv.convexHull(cnt, hull);
        const solidity = area / cv.contourArea(hull);
        hull.delete();
        if (solidity < 0.75) continue;

        candidates.push({
          center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          rect,
          area
        });
      }

      contours.delete(); hierarchy.delete();
      return pickCornersFromCandidates(candidates, binary, overlay);
    }

    function countChildren(idx, hierarchy) {
      let count = 0;
      let child = hierarchy.intPtr(0, idx)[2];
      while (child !== -1) {
        count++;
        child = hierarchy.intPtr(0, child)[0]; // next sibling
      }
      return count;
    }

    function firstChild(idx, hierarchy) {
      return hierarchy.intPtr(0, idx)[2];
    }

    function pickCornersFromCandidates(candidates, binary, overlay) {
      if (!candidates || candidates.length < 4) return null;

      // Birbirine çok yakın olanları bastır
      const deduped = [];
      for (const c of candidates) {
        const tooClose = deduped.some(d => Math.hypot(d.center.x - c.center.x, d.center.y - c.center.y) < Math.min(d.rect.width, c.rect.width) * 0.8);
        if (!tooClose) deduped.push(c);
      }
      if (deduped.length < 4) return null;

      const W = binary.cols, H = binary.rows;
      const scoreCorner = (pt, targetX, targetY) => {
        const dx = pt.x - targetX;
        const dy = pt.y - targetY;
        return Math.hypot(dx, dy);
      };

      const corners = { tl: null, tr: null, bl: null, br: null };
      let best = { tl: Infinity, tr: Infinity, bl: Infinity, br: Infinity };

      deduped.forEach(c => {
        const dTL = scoreCorner(c.center, 0, 0);
        if (dTL < best.tl) { best.tl = dTL; corners.tl = c; }
        const dTR = scoreCorner(c.center, W, 0);
        if (dTR < best.tr) { best.tr = dTR; corners.tr = c; }
        const dBL = scoreCorner(c.center, 0, H);
        if (dBL < best.bl) { best.bl = dBL; corners.bl = c; }
        const dBR = scoreCorner(c.center, W, H);
        if (dBR < best.br) { best.br = dBR; corners.br = c; }
      });

      if (!corners.tl || !corners.tr || !corners.bl || !corners.br) return null;

      if (overlay) {
        const green = new cv.Scalar(0, 255, 0, 255);
        [corners.tl, corners.tr, corners.bl, corners.br].forEach(m => {
          cv.rectangle(overlay, new cv.Point(m.rect.x, m.rect.y),
            new cv.Point(m.rect.x + m.rect.width, m.rect.y + m.rect.height), green, 2);
        });
      }

      return {
        tl: corners.tl.center,
        tr: corners.tr.center,
        bl: corners.bl.center,
        br: corners.br.center
      };
    }

    function warpPerspective(src, markers) {
      const W = layoutConfig.canvasWidth || 600;
      const H = layoutConfig.canvasHeight || 900;
      // QR bandı dahil tam form boyutu kullan
      const padding = layoutConfig.useMarkers ? (MARKER_OFFSET + MARKER_OUTER_R) : 6;

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        markers.tl.x, markers.tl.y, markers.tr.x, markers.tr.y,
        markers.br.x, markers.br.y, markers.bl.x, markers.bl.y
      ]);
      // İçerik alanı için hedef noktalar - QR bandı hariç
      const qrBand = layoutConfig.qrBand || 0;
      const contentH = H - qrBand;
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        padding, qrBand + padding,
        W - padding, qrBand + padding,
        W - padding, H - padding,
        padding, H - padding
      ]);
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(W, H));
      srcPts.delete(); dstPts.delete(); M.delete();
      return dst;
    }

    // --- OMR PRE-PROCESSING (literatürde önerilen topo-hat + çift thresholding) ---
    function preprocessForOmr(mat) {
      const gray = new cv.Mat(); cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      const denoised = new cv.Mat(); cv.medianBlur(gray, denoised, 3);

      // Black-hat (topo-hat) ile arka plan aydınlatmasını bastır, işaretleri öne çıkar
      const blackhat = new cv.Mat();
      const bhKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
      cv.morphologyEx(denoised, blackhat, cv.MORPH_BLACKHAT, bhKernel);
      bhKernel.delete();

      // Güçlendirilmiş gri görüntü
      const enhanced = new cv.Mat();
      cv.addWeighted(denoised, 1.0, blackhat, 1.25, 0, enhanced);
      blackhat.delete();

      // Literatürde yaygın çift eşik: adaptif + Otsu, sonra OR
      const adaptive = new cv.Mat();
      cv.adaptiveThreshold(enhanced, adaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 4);

      const otsu = new cv.Mat();
      cv.threshold(enhanced, otsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

      const binary = new cv.Mat();
      cv.bitwise_or(adaptive, otsu, binary);
      const cleanKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
      cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, cleanKernel);
      cv.medianBlur(binary, binary, 3);
      cleanKernel.delete();

      gray.delete(); denoised.delete();
      return { enhanced, binary, adaptive, otsu };
    }

    function cleanupPreprocess(mats) {
      if (!mats) return;
      ['enhanced', 'binary', 'adaptive', 'otsu'].forEach(k => { if (mats[k]) mats[k].delete(); });
    }

    function buildRoiRect(choice, w, h, scale = FILL_ROI_SCALE) {
      const roiW = Math.round(choice.width * w * scale);
      const roiH = Math.round(choice.height * h * scale);
      const rectX = Math.max(0, Math.round(choice.x * w - roiW / 2));
      const rectY = Math.max(0, Math.round(choice.y * h - roiH / 2));
      const rect = new cv.Rect(rectX, rectY, roiW, roiH);
      if (rect.x + rect.width > w) rect.width = w - rect.x;
      if (rect.y + rect.height > h) rect.height = h - rect.y;
      return rect;
    }

    function scoreBubbleRect(rect, mats) {
      const { binary, enhanced } = mats;
      const roiBin = binary.roi(rect);
      const roiGray = enhanced.roi(rect);

      const mask = new cv.Mat.zeros(rect.height, rect.width, cv.CV_8UC1);
      const r = Math.max(1, Math.floor(Math.min(rect.height, rect.width) * FILL_MASK_RATIO));
      const cx = Math.floor(rect.width / 2);
      const cy = Math.floor(rect.height / 2);
      cv.circle(mask, new cv.Point(cx, cy), r, new cv.Scalar(255, 255, 255, 255), -1);
      const maskArea = cv.countNonZero(mask) || 1;

      const masked = new cv.Mat();
      cv.bitwise_and(roiBin, mask, masked);
      const globalScore = cv.countNonZero(masked) / maskArea;

      const localOtsu = new cv.Mat();
      cv.threshold(roiGray, localOtsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const localMasked = new cv.Mat();
      cv.bitwise_and(localOtsu, mask, localMasked);
      const localScore = cv.countNonZero(localMasked) / maskArea;

      // Ağırlıklı birleşim: adaptif OR + lokal Otsu (literatürdeki hibrit yaklaşım)
      const score = globalScore * 0.6 + localScore * 0.4;

      roiBin.delete(); roiGray.delete(); mask.delete(); masked.delete(); localOtsu.delete(); localMasked.delete();
      return { score, globalScore, localScore };
    }

    function analyzeBubbles(warpMat, debugDraw = true) {
      // RELATIVE DARKNESS METHOD (Bağıl Karanlık Yöntemi)
      // Mutlak threshold yerine, şıklar arasındaki koyuluk farkını kullanır.
      // Işık değişimlerine ve gölgelere karşı çok daha dayanıklıdır.

      const gray = new cv.Mat();
      cv.cvtColor(warpMat, gray, cv.COLOR_RGBA2GRAY);

      // Gürültüyü azalt
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

      const w = warpMat.cols, h = warpMat.rows;
      let correct = 0, wrong = 0, blank = 0, multi = 0;
      const perQuestion = [];

      // Debug çizimi için kopya
      let debugMat = null;
      if (debugDraw) debugMat = warpMat.clone();

      // Parametreler
      const minDominance = 15; // En koyu şık ile ikinci arasındaki minimum fark (0-255 skala)
      const maxBrightness = 180; // İşaretli sayılması için maksimum parlaklık (daha koyu olmalı)

      for (const q of layoutConfig.questions) {
        const choiceMeans = q.choices.map(c => {
          // Baloncuğun sadece merkezini (%60) analiz et - kenar çizgilerinden kaçın
          const scale = 0.6;
          const roiW = Math.round(c.width * w * scale);
          const roiH = Math.round(c.height * h * scale);
          const roiX = Math.round(c.x * w - roiW / 2);
          const roiY = Math.round(c.y * h - roiH / 2);

          if (roiX < 0 || roiY < 0 || roiX + roiW > w || roiY + roiH > h) {
            return { opt: c.option, mean: 255, rect: null };
          }

          const rect = new cv.Rect(roiX, roiY, roiW, roiH);
          const roi = blurred.roi(rect);
          const mean = cv.mean(roi); // Ortalama parlaklık (0=siyah, 255=beyaz)
          roi.delete();

          // Debug çizim
          if (debugMat) {
            const color = new cv.Scalar(0, 255, 0, 255); // Varsayılan yeşil çerçeve
            cv.rectangle(debugMat, rect, color, 1);
          }

          return { opt: c.option, mean: mean[0], rect };
        });

        // En koyu (en düşük mean) şıkkı bul
        // Sırala: Küçükten büyüğe (Koyu -> Açık)
        const sorted = [...choiceMeans].sort((a, b) => a.mean - b.mean);

        const darkest = sorted[0];
        const secondDarkest = sorted[1];

        const contrast = secondDarkest.mean - darkest.mean;

        let status = 'Boş';
        let markedLabel = '-';
        let isMarked = false;

        // Karar Mantığı:
        // 1. En koyu şık yeterince belirgin mi? (ikinci ile fark > minDominance)
        // 2. En koyu şık çok mu açık renk? (maxBrightness kontrolü - boş kağıt mı?)
        if (contrast > minDominance && darkest.mean < maxBrightness) {
          isMarked = true;
          markedLabel = darkest.opt;

          // Debug: İşaretli olanı doldur
          if (debugMat && darkest.rect) {
            cv.rectangle(debugMat, darkest.rect, new cv.Scalar(0, 0, 255, 255), 2); // Kırmızı kalın
          }
        }

        // Çoklu işaretleme kontrolü: İkinci de yeterince koyuysa
        if (secondDarkest.mean < maxBrightness && contrast < minDominance) {
          if (darkest.mean < maxBrightness - 20) { // Her ikisi de baya koyuysa
            markedLabel = darkest.opt + '*'; // Şüpheli/Çoklu
            multi++;
            isMarked = true; // Yine de işaretli say
          }
        }

        if (isMarked) {
          if (!markedLabel.includes('*')) {
            const key = answerKey[q.questionNumber];
            if (key) {
              status = key === markedLabel ? 'Doğru' : 'Yanlış';
              if (status === 'Doğru') correct++; else wrong++;
            } else {
              // Cevap anahtarı yoksa sadece işaretli say
              status = 'Cevap';
              // correct/wrong artırma
            }
          }
        } else {
          blank++;
        }

        perQuestion.push({
          q: q.questionNumber,
          marked: markedLabel,
          status,
          maxScore: (255 - darkest.mean).toFixed(0) // Skoru ters çevir (koyuluk puanı)
        });
      }

      if (debugMat) {
        cv.imshow('warpCanvas', debugMat);
        debugMat.delete();
      }

      blurred.delete();
      gray.delete();

      // Öğrenci No okuma (benzer mantık)
      let studentNo = '';
      if (layoutConfig.studentId) {
        for (let col = 0; col < layoutConfig.studentId.digits; col++) {
          const colBubbles = layoutConfig.studentId.bubbles.filter(b => b.col === col);
          const colMeans = colBubbles.map(b => {
            const scale = 0.6;
            const roiW = Math.round(b.width * w * scale);
            const roiH = Math.round(b.height * h * scale);
            const roiX = Math.round(b.x * w - roiW / 2);
            const roiY = Math.round(b.y * h - roiH / 2);
            if (roiX < 0 || roiX + roiW > w) return { digit: b.digit, mean: 255 };

            const rect = new cv.Rect(roiX, roiY, roiW, roiH);
            const roi = blurred.roi(rect);
            const mean = cv.mean(roi);
            roi.delete();
            return { digit: b.digit, mean: mean[0] };
          });

          colMeans.sort((a, b) => a.mean - b.mean);
          const best = colMeans[0];
          const second = colMeans[1];

          if (second.mean - best.mean > minDominance && best.mean < maxBrightness) {
            studentNo += best.digit;
          } else {
            studentNo += '?';
          }
        }
      }

      const penalty = parseFloat(document.getElementById('penalty').value) || 0.25;
      const net = (correct - wrong * penalty).toFixed(2);

      return { correct, wrong, blank, multi, net, perQuestion, studentNo };
    }

    function safeAddSessionResult(r) {
      try {
        addSessionResult(r);
      } catch (e) {
        console.warn('Session log hatasi', e);
      }
    }

    function renderResults(r) {
      document.querySelector('.stat.correct .stat-value').textContent = r.correct;
      document.querySelector('.stat.wrong .stat-value').textContent = r.wrong;
      document.querySelectorAll('.stat')[2].querySelector('.stat-value').textContent = r.blank;
      document.querySelector('.stat.net .stat-value').textContent = r.net;

      let html = r.studentNo ? `<div style="margin-bottom:8px;border-bottom:1px solid var(--border);padding-bottom:6px;"><b>Öğrenci No:</b> ${r.studentNo}</div>` : '';
      html += r.perQuestion.map(p => {
        const color = p.status === 'Doğru' ? '#10b981' : p.status === 'Yanlış' ? '#ef4444' : p.status === 'Boş' ? '#666' : '#f59e0b';
        const scoreInfo = p.maxScore ? ` <span style="color:#666;font-size:9px;">(${p.maxScore})</span>` : '';
        return `<div><span style="width:25px;display:inline-block;text-align:right;">${p.q}.</span> ${p.marked}${scoreInfo} <span style="color:${color}">${p.status}</span></div>`;
      }).join('');

      document.getElementById('resultDetails').innerHTML = html;
    }

    // =====================================================
    // SESSION LOG / EXPORT
    // =====================================================
    function addSessionResult(r) {
      const entry = {
        id: sessionResults.length + 1,
        studentNo: (r.studentNo && !r.studentNo.includes('?')) ? r.studentNo : 'Bilinmiyor',
        correct: r.correct,
        wrong: r.wrong,
        blank: r.blank,
        multi: r.multi,
        net: r.net,
        perQuestion: r.perQuestion.map(p => ({ ...p }))
      };
      sessionResults.push(entry);
      renderSessionList();
      persistEntrySafely(entry);
    }

    function renderSessionList() {
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
        return `<div>#${r.id} - ${r.studentNo || 'Bilinmiyor'} | D:${r.correct} Y:${r.wrong} B:${r.blank} C:${r.multi} Net:${r.net}</div>`;
      }).join('');
    }

    function downloadSessionTxt() {
      if (sessionResults.length === 0) { alert('Kayit yok.'); return; }
      const lines = sessionResults.map(r => formatEntryLine(r, false));
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

    function downloadSessionCsv() {
      if (sessionResults.length === 0) { alert('Kayit yok.'); return; }
      const maxQ = Math.max(...sessionResults.map(r => (r.perQuestion || []).length || 0));
      const header = ['Sira', 'OgrenciNo', 'Dogru', 'Yanlis', 'Bos', 'Coklu', 'Net'];
      for (let i = 1; i <= maxQ; i++) header.push(`S${i}`);
      const rows = sessionResults.map(r => {
        const base = [r.id, r.studentNo || '', r.correct, r.wrong, r.blank, r.multi, r.net];
        const answers = r.perQuestion || [];
        for (let i = 0; i < maxQ; i++) {
          base.push(answers[i] ? (answers[i].marked || '') : '');
        }
        return base.map(csvEscape).join(',');
      });
      const csv = [header.map(csvEscape).join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oturum-sonuclari.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function formatEntryLine(entry, verbose = true) {
      const answers = (entry.perQuestion || []).map(p => `${p.q}:${p.marked || '-'}`).join(' ');
      if (!verbose) {
        return `#${entry.id}\t${entry.studentNo || 'Bilinmiyor'}\tD:${entry.correct}\tY:${entry.wrong}\tB:${entry.blank}\tCoklu:${entry.multi}\tNet:${entry.net}\t${answers}`;
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
      if (logFileHandle) return logFileHandle;
      if (!saveDirHandle) {
        const dir = await requestSaveDirectory();
        if (!dir) return null;
        saveDirHandle = dir;
      }
      logFileHandle = await saveDirHandle.getFileHandle(LOG_FILE_NAME, { create: true });
      return logFileHandle;
    }

    async function appendEntryToLog(entry) {
      if (!fileSaveSupported) return false;
      try {
        const handle = await ensureLogFileHandle();
        if (!handle) return false;
        const file = await handle.getFile();
        const writable = await handle.createWritable({ keepExistingData: true });
        const line = formatEntryLine(entry, false) + '\\n';
        await writable.seek(file.size);
        await writable.write(line);
        await writable.close();
        return true;
      } catch (e) {
        console.warn('Log yazma hatasi', e);
        return false;
      }
    }

    function fallbackDownloadLog() {
      const lines = sessionResults.map(r => formatEntryLine(r, false));
      const blob = new Blob([lines.join('\\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = LOG_FILE_NAME;
      a.click();
      URL.revokeObjectURL(url);
    }

    async function persistEntrySafely(entry) {
      // Mümkünse mevcut klasörde tek dosyaya ekle, aksi halde toplu log indir
      appendEntryToLog(entry).then((ok) => {
        if (!ok) fallbackDownloadLog();
      });
    }

    function downloadSessionXlsx() {
      if (sessionResults.length === 0) { alert('Kayit yok.'); return; }
      const maxQ = Math.max(...sessionResults.map(r => (r.perQuestion || []).length || 0));
      const header = ['Sira', 'OgrenciNo', 'Dogru', 'Yanlis', 'Bos', 'Coklu', 'Net'];
      for (let i = 1; i <= maxQ; i++) header.push(`S${i}`);
      const data = [header];
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

    // =====================================================
    // CEVAP ANAHTARI YÖNETİMİ
    // =====================================================

    function setupAnswerKeyUI() {
      generateAnswerKeyGrid();
      updateAnswerKeyStatus();
    }

    function toggleAnswerKeyMode() {
      const source = document.getElementById('answerKeySource').value;
      document.getElementById('manualKeySection').style.display = source === 'manual' ? 'block' : 'none';
      document.getElementById('scanKeySection').style.display = source === 'scan' ? 'block' : 'none';
    }

    function generateAnswerKeyGrid() {
      const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
      const choiceCount = clampInt(document.getElementById('choiceCount')?.value || 5, 4, 5, 5);
      const grid = document.getElementById('answerKeyGrid');
      const letters = ['A', 'B', 'C', 'D', 'E'].slice(0, choiceCount);

      let html = '';
      for (let i = 1; i <= count; i++) {
        const currentAnswer = answerKey[i] || '';
        html += `<div class="answer-key-item">
          <span>${i}.</span>
          <select data-question="${i}" onchange="updateSingleAnswer(${i}, this.value)">
            <option value="">-</option>
            ${letters.map(l => `<option value="${l}" ${currentAnswer === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>`;
      }

      grid.innerHTML = html;
      updateAnswerKeyStatus();
    }

    function updateSingleAnswer(questionNum, answer) {
      if (answer) {
        answerKey[questionNum] = answer;
      } else {
        delete answerKey[questionNum];
      }
      updateAnswerKeyStatus();
    }

    function clearAnswerKey() {
      answerKey = {};
      generateAnswerKeyGrid();
      updateAnswerKeyStatus();
    }

    function generateRandomKey() {
      const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
      const choiceCount = clampInt(document.getElementById('choiceCount')?.value || 5, 4, 5, 5);
      const letters = ['A', 'B', 'C', 'D', 'E'].slice(0, choiceCount);

      answerKey = {};
      for (let i = 1; i <= count; i++) {
        answerKey[i] = letters[Math.floor(Math.random() * letters.length)];
      }

      generateAnswerKeyGrid();
      updateAnswerKeyStatus();
    }

    function updateAnswerKeyStatus() {
      const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
      const filledCount = Object.keys(answerKey).length;
      const statusEl = document.getElementById('answerKeyStatus');

      if (filledCount === 0) {
        statusEl.className = 'answer-key-status empty';
        statusEl.innerHTML = '⚠️ Cevap anahtarı henüz girilmedi';
      } else if (filledCount < count) {
        statusEl.className = 'answer-key-status empty';
        statusEl.innerHTML = `⚠️ ${filledCount}/${count} soru cevaplandı - eksik cevaplar var`;
      } else {
        statusEl.className = 'answer-key-status';
        statusEl.innerHTML = `✅ Cevap anahtarı hazır (${filledCount} soru)`;
      }
    }

    function startAnswerKeyScan() {
      scanMode = 'answerKey';
      const source = document.getElementById('scanSource').value;
      if (source === 'camera') {
        document.getElementById('captureBtn').textContent = '📷 Cevap Anahtarı Tara';
        setLog('cameraLog', '📋 Cevap anahtarı formunu tarayın...', 'success');
      } else {
        document.getElementById('processFileBtn').textContent = '🔑 Cevap Anahtarı Analiz Et';
        setLog('cameraLog', '📋 Cevap anahtarı resmini yükleyin ve analiz edin...', 'success');
      }
      updateStatus('ready', 'Anahtar Tarama');
    }

    function captureAndProcess(isAuto = false) {
      if (!cvReady) { setLog('omrLog', 'OpenCV bekleniyor...', 'error'); return; }

      const video = document.getElementById('video');
      if (!video || video.readyState < 2) return;

      const canvas = document.getElementById('captureCanvas');
      const ctx = canvas.getContext('2d');
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const targetW = Math.min(1280, vw);
      const targetH = Math.round(targetW * vh / vw);
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height);

      if (scanMode === 'answerKey') {
        processAnswerKeyFrame();
      } else {
        processFrame(isAuto);
      }
    }

    function processAnswerKeyFrame() {
      let src, gray, blurred, binary, markerOverlay;

      try {
        src = cv.imread('captureCanvas');
        gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        blurred = new cv.Mat(); cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        binary = new cv.Mat(); cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay) || findLayoutFrame(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
          setLog('cameraLog', '⚠️ Köşe markerları/çerçeve bulunamadı', 'error');
          clearLiveOverlay();
          return;
        }

        const geom = evaluateMarkerGeometry(markers, binary.cols, binary.rows);
        if (!geom.ok) {
          setLog('cameraLog', `⚠️ Marker hizası zayıf (${geom.reason})`, 'error');
          clearLiveOverlay();
          return;
        }

        let warped = warpPerspective(src, markers);
        cv.imshow('warpCanvas', warped);
        let qrCheck = verifyQrAgainstLayout(warped);
        if (qrCheck.meta) {
          const layoutChanged = applyLayoutFromQr(qrCheck.meta);
          if (layoutChanged) {
            warped.delete();
            warped = warpPerspective(src, markers);
            cv.imshow('warpCanvas', warped);
            qrCheck = verifyQrAgainstLayout(warped);
          }
        }
        if (!qrCheck.ok) {
          // QR eşleşmese bile devam et
          console.warn('QR doğrulama (anahtar kamera):', qrCheck.reason);
        }

        // Cevap anahtarını oku
        const result = readAnswerKeyFromScan(warped);

        if (result.success) {
          answerKey = result.answers;
          generateAnswerKeyGrid();
          updateAnswerKeyStatus();

          // Normal tarama moduna geri dön
          scanMode = 'student';
          document.getElementById('captureBtn').textContent = '📸 Öğrenci Formu Tara';
          setLog('cameraLog', `✅ Cevap anahtarı yüklendi! ${Object.keys(answerKey).length} cevap okundu.`, 'success');
          updateStatus('ready', '✓ Anahtar Yüklendi');
        } else {
          setLog('cameraLog', '⚠️ Cevap anahtarı okunamadı, tekrar deneyin', 'error');
        }

        warped.delete();
      } catch (e) {
        setLog('cameraLog', 'Hata: ' + e.message, 'error');
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
      }
    }

    function readAnswerKeyFromScan(warpMat) {
      const threshold = 0.30; // Sabit threshold (element kaldırıldı)

      const mats = preprocessForOmr(warpMat);
      const w = warpMat.cols, h = warpMat.rows;
      const answers = {};
      let successCount = 0;

      // ROI boyut çarpanı (anahtar için biraz geniş)
      const roiScale = 1.25;

      for (const q of layoutConfig.questions) {
        const scores = q.choices.map(c => {
          const rect = buildRoiRect(c, w, h, roiScale);
          if (rect.width <= 0 || rect.height <= 0) return { opt: c.option, score: 0 };
          const bubbleScore = scoreBubbleRect(rect, mats);
          return { opt: c.option, ...bubbleScore };
        });

        const sorted = [...scores].sort((a, b) => b.score - a.score);
        const best = sorted[0] || { score: 0 };
        const second = sorted[1] || { score: 0 };
        const maxScore = best.score;
        const dominance = maxScore - second.score;
        const ratio = second.score > 0 ? maxScore / second.score : 10;

        if (maxScore < BLANK_GUARD) continue;

        const filled = scores.filter(s => s.score >= threshold);

        if (filled.length === 1) {
          answers[q.questionNumber] = filled[0].opt;
          successCount++;
        } else if (filled.length > 1 && (dominance >= 0.1 || ratio >= 1.5)) {
          // Çoklu olsa bile baskın şıkkı al
          answers[q.questionNumber] = best.opt;
          successCount++;
        } else if (maxScore >= BLANK_GUARD && (dominance >= 0.12 || ratio >= 1.7 || maxScore >= threshold * 0.8)) {
          answers[q.questionNumber] = best.opt;
          successCount++;
        }
      }

      cleanupPreprocess(mats);

      console.log(`Cevap anahtarı okuma: ${successCount}/${layoutConfig.questions.length} başarılı`);

      return {
        success: successCount > 0,
        answers: answers,
        count: successCount
      };
    }

    // =====================================================
    // DOSYA YÜKLEME FONKSİYONLARI
    // =====================================================

    let uploadedImage = null;

    function toggleScanSource() {
      const source = document.getElementById('scanSource').value;
      document.getElementById('cameraSection').style.display = source === 'camera' ? 'block' : 'none';
      document.getElementById('fileSection').style.display = source === 'file' ? 'block' : 'none';

      // Scan mode'u sıfırla
      scanMode = 'student';
      document.getElementById('processFileBtn').textContent = '🔍 Formu Analiz Et';

      if (source === 'camera') {
        initCamera();
      } else {
        stopCamera();
        setLog('cameraLog', '📁 Dosya yükleme modu aktif. Resim seçin.', 'info');
      }
    }

    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.match('image.*')) {
        setLog('cameraLog', '❌ Lütfen bir resim dosyası seçin (PNG, JPG, JPEG)', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          uploadedImage = img;

          // Resmi captureCanvas'a çiz
          const canvas = document.getElementById('captureCanvas');
          const ctx = canvas.getContext('2d');

          // Canvas boyutunu resme göre ayarla (max 1280px genişlik)
          const maxWidth = 1280;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.floor(img.width * scale);
          canvas.height = Math.floor(img.height * scale);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Dosya adını göster
          document.getElementById('fileName').textContent = `✓ ${file.name} (${Math.round(file.size / 1024)} KB)`;
          document.getElementById('processFileBtn').disabled = false;
          document.getElementById('clearFileBtn').style.display = 'inline-flex';

          setLog('cameraLog', `✅ Resim yüklendi: ${file.name}`, 'success');
          updateStatus('ready', 'Resim hazır');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function processUploadedFile() {
      if (!uploadedImage || !cvReady) {
        setLog('cameraLog', '⚠️ Önce bir resim yükleyin ve OpenCV hazır olsun.', 'error');
        return;
      }

      if (!layoutConfig || !layoutConfig.questions || layoutConfig.questions.length === 0) {
        setLog('cameraLog', '⚠️ Önce form tasarımını oluşturun (Tasarla sekmesi).', 'error');
        return;
      }

      setLog('cameraLog', '🔍 Resim analiz ediliyor...', 'info');
      updateStatus('scanning', 'Analiz ediliyor...');

      // captureCanvas'daki resmi işle
      if (scanMode === 'answerKey') {
        processAnswerKeyFromFile();
        // Normal moda geri dön
        scanMode = 'student';
        document.getElementById('processFileBtn').textContent = '🔍 Formu Analiz Et';
      } else {
        processStudentFormFromFile();
      }
    }

    function processStudentFormFromFile() {
      let src, gray, blurred, binary, markerOverlay;

      try {
        src = cv.imread('captureCanvas');
        if (src.empty()) {
          throw new Error('Resim okunamadı');
        }

        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        binary = new cv.Mat();
        cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay) || findLayoutFrame(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
          setLog('cameraLog', '⚠️ Köşe markerları/çerçeve bulunamadı. Form sınırı net görünmeli.', 'error');
          updateStatus('error', 'Marker bulunamadı');
          clearLiveOverlay();
          return;
        }

        const geom = evaluateMarkerGeometry(markers, binary.cols, binary.rows);
        if (!geom.ok) {
          setLog('cameraLog', `⚠️ Hizalama zayıf (${geom.reason})`, 'error');
          updateStatus('error', 'Hizalama zayıf');
          clearLiveOverlay();
          return;
        }

        let warped = warpPerspective(src, markers);
        renderLiveMarkers(markers, binary.cols, binary.rows);
        cv.imshow('warpCanvas', warped);

        let qrCheck = verifyQrAgainstLayout(warped);
        if (qrCheck.meta) {
          const layoutChanged = applyLayoutFromQr(qrCheck.meta);
          if (layoutChanged) {
            warped.delete();
            warped = warpPerspective(src, markers);
            renderLiveMarkers(markers, binary.cols, binary.rows);
            cv.imshow('warpCanvas', warped);
            qrCheck = verifyQrAgainstLayout(warped);
          }
        }
        if (!qrCheck.ok) {
          // QR eşleşmese bile devam et - form yapısını kontrol ettik
          console.warn('QR doğrulama (dosya):', qrCheck.reason);
        }

        const result = analyzeBubbles(warped);
        renderResults(result);
        safeAddSessionResult(result);

        updateStatus('found', '✓ Form okundu!');
        setLog('cameraLog', '✅ Analiz tamamlandı!', 'success');

        warped.delete();
      } catch (e) {
        console.error(e);
        setLog('cameraLog', '❌ Hata: ' + e.message, 'error');
        updateStatus('error', 'Hata');
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
      }
    }

    function processAnswerKeyFromFile() {
      let src, gray, blurred, binary, markerOverlay;

      try {
        src = cv.imread('captureCanvas');
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        binary = new cv.Mat();
        cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

        markerOverlay = src.clone();
        const markers = detectCornerMarkers(binary, markerOverlay) || findLayoutFrame(binary, markerOverlay);
        cv.imshow('markerCanvas', markerOverlay);

        if (!markers) {
          setLog('cameraLog', '⚠️ Köşe markerları/çerçeve bulunamadı', 'error');
          clearLiveOverlay();
          return;
        }

        const geom = evaluateMarkerGeometry(markers, binary.cols, binary.rows);
        if (!geom.ok) {
          setLog('cameraLog', `⚠️ Marker hizası zayıf (${geom.reason})`, 'error');
          clearLiveOverlay();
          return;
        }

        let warped = warpPerspective(src, markers);
        renderLiveMarkers(markers, binary.cols, binary.rows);
        cv.imshow('warpCanvas', warped);

        let qrCheck = verifyQrAgainstLayout(warped);
        if (qrCheck.meta) {
          const layoutChanged = applyLayoutFromQr(qrCheck.meta);
          if (layoutChanged) {
            warped.delete();
            warped = warpPerspective(src, markers);
            renderLiveMarkers(markers, binary.cols, binary.rows);
            cv.imshow('warpCanvas', warped);
            qrCheck = verifyQrAgainstLayout(warped);
          }
        }
        if (!qrCheck.ok) {
          // QR eşleşmese bile devam et
          console.warn('QR doğrulama (anahtar dosya):', qrCheck.reason);
        }

        const result = readAnswerKeyFromScan(warped);

        if (result.success) {
          answerKey = result.answers;
          generateAnswerKeyGrid();
          updateAnswerKeyStatus();

          scanMode = 'student';
          document.getElementById('captureBtn').textContent = '📸 Öğrenci Formu Tara';
          setLog('cameraLog', `✅ Cevap anahtarı yüklendi! ${Object.keys(answerKey).length} cevap okundu.`, 'success');
          updateStatus('ready', '✓ Anahtar Yüklendi');
        } else {
          setLog('cameraLog', '⚠️ Cevap anahtarı okunamadı, tekrar deneyin', 'error');
        }

        warped.delete();
      } catch (e) {
        setLog('cameraLog', 'Hata: ' + e.message, 'error');
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
      }
    }

    function clearUploadedFile() {
      uploadedImage = null;
      document.getElementById('fileInput').value = '';
      document.getElementById('fileName').textContent = '';
      document.getElementById('processFileBtn').disabled = true;
      document.getElementById('clearFileBtn').style.display = 'none';

      // Canvas'ları temizle
      const canvases = ['captureCanvas', 'markerCanvas', 'warpCanvas'];
      canvases.forEach(id => {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });

      setLog('cameraLog', '🗑️ Yüklenen resim temizlendi', 'info');
      updateStatus('ready', 'Hazır');
    }
