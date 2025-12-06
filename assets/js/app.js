// =====================================================
// GLOBAL STATE
// =====================================================
const MARKER_OFFSET = 8;
const MARKER_SIZE = 26;
const MARKER_INNER = 10;
const sessionResults = [];
let saveDirHandle = null;
let logFileHandle = null;
const LOG_FILE_NAME = 'session-log.txt';
const fileSaveSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
let layoutConfig = null;
let answerKey = {};
let videoStream = null;
let autoScanInterval = null;
let isAutoScanning = false;
let scanMode = 'student'; // 'student' veya 'answerKey'
let shadowMode = false;
const BASE_FILL_ROI_SCALE = 1.04;
const BASE_FILL_MASK_RATIO = 0.32;
const BASE_BLANK_GUARD = 0.18;
let availableCameras = [];
let preferredCameraId = null;
const WARP_SKEW_LIMIT = 0.15; // genişlik/yükseklik fark oranı (daha sıkı)
const WARP_AREA_MIN_RATIO = 0.10; // formun kapladığı alanın min oranı (daha sıkı)

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
  document.getElementById('downloadTxtBtn').addEventListener('click', downloadSessionTxt);
  document.getElementById('downloadCsvBtn').addEventListener('click', downloadSessionCsv);
  document.getElementById('downloadXlsxBtn').addEventListener('click', downloadSessionXlsx);
  document.getElementById('downloadXlsxBtn').addEventListener('contextmenu', async (e) => { e.preventDefault(); await requestSaveDirectory(); });
  const cameraSelectEl = document.getElementById('cameraSelect');
  if (cameraSelectEl) {
    cameraSelectEl.addEventListener('change', onCameraChange);
  }
  loadCameraDevices();
  const shadowToggle = document.getElementById('shadowMode');
  if (shadowToggle) {
    shadowToggle.addEventListener('change', () => {
      shadowMode = shadowToggle.checked;
    });
  }
  
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
               'answerKeyChoices', 'formWidth', 'formHeight', 'bubbleSize', 'rowGap', 'examId', 'webUrl',
               'qualityScale', 'headerRepeat'];
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

// =====================================================
// FORM GENERATION - Canvas Based
// =====================================================
function generateForm() {
  const config = getConfig();
  layoutConfig = config;
  drawForm(config);
  generateAnswerKeyData(config);
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
    bubbleSize: clampInt(document.getElementById('bubbleSize').value, 8, 24, 14),
    rowGap: clampInt(document.getElementById('rowGap').value, 1, 20, 4),
    qualityScale: clampInt(document.getElementById('qualityScale').value, 1, 4, 2),
    headerRepeat: clampInt(document.getElementById('headerRepeat').value, 3, 20, 5),
    examId: document.getElementById('examId').value || 'SINAV-001',
    webUrl: document.getElementById('webUrl').value || ''
  };
}

function drawForm(cfg) {
  const canvas = document.getElementById('formCanvas');
  const ctx = canvas.getContext('2d');
  
  // Yüksek kalite için ölçek faktörü (kullanıcı ayarlı)
  const scale = cfg.qualityScale;
  canvas.width = cfg.formWidth * scale;
  canvas.height = cfg.formHeight * scale;
  canvas.style.width = cfg.formWidth + 'px';
  canvas.style.height = cfg.formHeight + 'px';
  ctx.scale(scale, scale);
  
  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // Corner markers
  // Not: ctx.scale() uygulandığı için orijinal boyutları kullan
  drawCornerMarkers(ctx, cfg.formWidth, cfg.formHeight);
  
  const margin = 15;
  const bubbleR = cfg.bubbleSize / 2;
  const bubbleGap = cfg.bubbleSize + 3;
  const rowH = cfg.bubbleSize + cfg.rowGap;
  
  // Header başlangıcı: markerların bitişinden sonra yer aç
  let y = Math.max(margin + 10, MARKER_OFFSET + MARKER_SIZE + 10);
  
  // === HEADER: Öğrenci No + Anahtar ===
  const studentStartX = Math.max(margin, MARKER_OFFSET + MARKER_SIZE + 10);
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
  // Kolonlar arasında şık grubu sonrası boşluk bırakmak için ekstra boşluk ekle
  const columnGap = cfg.bubbleSize; // yaklaşık bir karakterlik boşluk
  const columnWidth = (cfg.formWidth - margin * 2 - columnGap * (cfg.columnCount - 1)) / cfg.columnCount;
  
  // Store bubble positions for OMR
  layoutConfig.questions = [];
  layoutConfig.studentId = { digits: cfg.studentDigits, bubbles: [] };
  
  // Store student ID bubble positions (scale faktörünü hesaba kat)
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < cfg.studentDigits; col++) {
      const bx = (studentStartX + col * digitGap + digitBubbleR) / cfg.formWidth;
      const by = (studentStartY + 20 + row * (digitBubbleSize + 2) + digitBubbleR) / cfg.formHeight;
      layoutConfig.studentId.bubbles.push({
        digit: row, col, x: bx, y: by, width: digitBubbleSize / cfg.formWidth, height: digitBubbleSize / cfg.formHeight
      });
    }
  }
  
  const letters = 'ABCDE'.split('').slice(0, cfg.choiceCount);
  const headerRepeatInterval = cfg.headerRepeat; // Her N soruda bir harf başlıkları tekrarla
  const numberYOffset = Math.max(3, Math.round(cfg.bubbleSize * 0.35)); // sayı ile balon arasında orta seviye dikey boşluk
  const numberXGap = Math.max(6, Math.round(cfg.bubbleSize * 0.4)); // sayı ile balon arasında yatay boşluk
  
  for (let col = 0; col < cfg.columnCount; col++) {
    const colX = margin + col * (columnWidth + columnGap);
    const labelStartX = colX + 25;
    
    // İlk sütun başlığı (A B C D E) - balonların hemen altında küçük boşlukla
    const labelToBubbleGap = Math.max(6, Math.round(cfg.bubbleSize * 0.4));
    const headerY = y + labelToBubbleGap;
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    for (let i = 0; i < letters.length; i++) {
      ctx.fillText(letters[i], labelStartX + i * bubbleGap, headerY);
    }
    
    // Draw questions
    let extraOffset = 0; // Eklenen başlıklar için ekstra offset
    
    for (let qIdx = 0; qIdx < questionsPerColumn; qIdx++) {
      const qNum = col * questionsPerColumn + qIdx + 1;
      if (qNum > cfg.questionCount) break;
      
      // Her 5 soruda bir (başlangıç hariç) harf başlıklarını tekrarla
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
      
      // Question number
      ctx.fillStyle = '#000';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'right';
      const numberX = labelStartX - bubbleR - numberXGap;
      ctx.fillText(qNum.toString(), numberX, qY + bubbleR + numberYOffset);
      
      // Choice bubbles
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
      
      layoutConfig.questions.push({ questionNumber: qNum, choices });
    }
  }
  
  // Store dimensions for OMR (orijinal boyutlar, scale'siz)
  layoutConfig.canvasWidth = cfg.formWidth;
  layoutConfig.canvasHeight = cfg.formHeight;
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
  // Create temporary container for QR
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
  
  // Wait for QR to render then draw to canvas
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
  }, 100);
  
  // Draw border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
}

function generateAnswerKeyData(cfg) {
  answerKey = {};
  const letters = ['A', 'B', 'C', 'D', 'E'];
  for (let i = 1; i <= cfg.questionCount; i++) {
    answerKey[i] = letters[(i - 1) % cfg.choiceCount];
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

function getPreprocessParams() {
  const shadow = shadowMode || (document.getElementById('shadowMode')?.checked);
  if (shadow) {
    return { clahe: true, blurSigma: 1.0, blockSize: 13, cValue: 3 };
  }
  return { clahe: false, blurSigma: 0, blockSize: 11, cValue: 2 };
}

function preprocessToBinary(srcMat) {
  const p = getPreprocessParams();
  const gray = new cv.Mat();
  cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
  if (p.clahe && cv.CLAHE) {
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
    clahe.apply(gray, gray);
    clahe.delete();
  }
  const blur = new cv.Mat();
  if (p.blurSigma && p.blurSigma > 0) {
    cv.GaussianBlur(gray, blur, new cv.Size(0, 0), p.blurSigma, p.blurSigma);
  } else {
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
  }
  const binary = new cv.Mat();
  const block = p.blockSize && p.blockSize % 2 === 1 ? p.blockSize : (p.blockSize || 11) | 1;
  const cVal = p.cValue ?? 2;
  cv.adaptiveThreshold(blur, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, block, cVal);
  gray.delete(); blur.delete();
  return binary;
}

function getFillParams() {
  const shadow = shadowMode || (document.getElementById('shadowMode')?.checked);
  if (shadow) {
    return { roiScale: 1.02, maskRatio: 0.30, blankGuard: 0.14 };
  }
  return { roiScale: BASE_FILL_ROI_SCALE, maskRatio: BASE_FILL_MASK_RATIO, blankGuard: BASE_BLANK_GUARD };
}

async function loadCameraDevices() {
  const select = document.getElementById('cameraSelect');
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !select) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter(d => d.kind === 'videoinput');
    select.innerHTML = '';
    if (availableCameras.length === 0) {
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
    availableCameras.forEach((cam, idx) => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || `Kamera ${idx + 1}`;
      select.appendChild(opt);
    });
    if (preferredCameraId) {
      select.value = preferredCameraId;
    }
  } catch (e) {
    console.warn('Kamera listesi alınamadı', e);
  }
}

function onCameraChange(e) {
  preferredCameraId = e.target.value || null;
  stopCamera();
  initCamera();
}

// =====================================================
// CAMERA & OMR
// =====================================================
async function initCamera() {
  try {
    if (videoStream) return;
    const usePreferred = !!preferredCameraId;
    const baseConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    const constraints = usePreferred
      ? { video: { ...baseConstraints, deviceId: { exact: preferredCameraId } } }
      : { video: { ...baseConstraints, facingMode: 'environment' } };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (usePreferred) {
        console.warn('Seçilen kamera açılamadı, otomatiğe dönüyor', err);
        preferredCameraId = null;
        return initCamera();
      }
      throw err;
    }
    videoStream = stream;
    document.getElementById('video').srcObject = stream;
    await document.getElementById('video').play();
    await loadCameraDevices();
    document.getElementById('captureBtn').disabled = false;
    updateStatus('ready', 'Hazır');
    setLog('cameraLog', '✓ Kamera hazır', 'success');
  } catch (e) {
    setLog('cameraLog', '✗ Kamera hatası: ' + e.message, 'error');
  }
}

function stopCamera() {
  if (!videoStream) return;
  videoStream.getTracks().forEach(t => t.stop());
  videoStream = null;
  const videoEl = document.getElementById('video');
  if (videoEl) videoEl.srcObject = null;
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn) captureBtn.disabled = true;
  updateStatus('', 'Kamera kapalı');
}

function updateStatus(state, text) {
  const el = document.getElementById('scanStatus');
  el.className = 'scan-status ' + state;
  document.getElementById('scanStatusText').textContent = text;
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
  let src, binary, markerOverlay;
  
  try {
    src = cv.imread('captureCanvas');
    binary = preprocessToBinary(src);
    
    markerOverlay = src.clone();
    const markers = detectCornerMarkers(binary, markerOverlay);
    cv.imshow('markerCanvas', markerOverlay);
    
    if (!markers) {
      updateStatus('', 'Form bulunamadı');
      if (!isAuto) setLog('omrLog', 'Köşe markerları bulunamadı', 'error');
      return;
    }
    const warpCheck = checkWarpQuality(markers, src.cols, src.rows);
    if (!warpCheck.ok) {
      if (!isAuto) setLog('omrLog', `Eğim/alan kontrolü başarısız: ${warpCheck.reasons.join(', ')}`, 'error');
      updateStatus('error', 'Eğim çok yüksek');
      return;
    }
    
    const warped = warpPerspective(src, markers);
  cv.imshow('warpCanvas', warped);

  const result = analyzeBubbles(warped);
  renderResults(result);
  safeAddSessionResult(result);
  if (result.suspicious) {
    updateStatus('error', 'Şüpheli okuma');
    setLog('omrLog', `⚠️ Okuma şüpheli: ${result.suspiciousReasons.join(', ')}`, 'error');
  }
    
    updateStatus('ready', '✓ Okundu');
    setLog('omrLog', '✓ Tarama tamamlandı', 'success');
    
    warped.delete();
  } catch (e) {
    if (!isAuto) setLog('omrLog', 'Hata: ' + e.message, 'error');
  } finally {
    if (src) src.delete();
    if (binary) binary.delete();
    if (markerOverlay) markerOverlay.delete();
  }
}

function detectCornerMarkers(binary, overlay) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  const candidates = [];
  const imgArea = binary.rows * binary.cols;
  
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area < imgArea * 0.0003 || area > imgArea * 0.02) continue;
    
    const rect = cv.boundingRect(cnt);
    const aspect = rect.width / rect.height;
    if (aspect > 0.5 && aspect < 2) {
      const hull = new cv.Mat();
      cv.convexHull(cnt, hull);
      const solidity = area / cv.contourArea(hull);
      hull.delete();
      
      if (solidity > 0.6) {
        candidates.push({
          center: { x: rect.x + rect.width/2, y: rect.y + rect.height/2 },
          rect
        });
      }
    }
  }
  
  contours.delete(); hierarchy.delete();
  if (candidates.length < 4) return null;
  
  const cx = binary.cols / 2, cy = binary.rows / 2;
  let tl, tr, bl, br;
  let tlD = Infinity, trD = Infinity, blD = Infinity, brD = Infinity;
  
  for (const c of candidates) {
    const left = c.center.x < cx, top = c.center.y < cy;
    const d = (x, y) => Math.hypot(c.center.x - x, c.center.y - y);
    
    if (left && top && d(0, 0) < tlD) { tlD = d(0, 0); tl = c; }
    if (!left && top && d(binary.cols, 0) < trD) { trD = d(binary.cols, 0); tr = c; }
    if (left && !top && d(0, binary.rows) < blD) { blD = d(0, binary.rows); bl = c; }
    if (!left && !top && d(binary.cols, binary.rows) < brD) { brD = d(binary.cols, binary.rows); br = c; }
  }
  
  if (!tl || !tr || !bl || !br) return null;
  
  // Draw markers
  const green = new cv.Scalar(0, 255, 0, 255);
  [tl, tr, bl, br].forEach(m => {
    cv.rectangle(overlay, new cv.Point(m.rect.x, m.rect.y), 
                 new cv.Point(m.rect.x + m.rect.width, m.rect.y + m.rect.height), green, 2);
  });
  
  return {
    tl: tl.center,
    tr: tr.center,
    bl: bl.center,
    br: br.center
  };
}

function warpPerspective(src, markers) {
  const W = layoutConfig.canvasWidth || 600;
  const H = layoutConfig.canvasHeight || 900;
  const markerCenter = MARKER_OFFSET + MARKER_SIZE / 2;
  
  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    markers.tl.x, markers.tl.y, markers.tr.x, markers.tr.y,
    markers.br.x, markers.br.y, markers.bl.x, markers.bl.y
  ]);
  const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    markerCenter, markerCenter,
    W - markerCenter, markerCenter,
    W - markerCenter, H - markerCenter,
    markerCenter, H - markerCenter
  ]);
  const M = cv.getPerspectiveTransform(srcPts, dstPts);
  const dst = new cv.Mat();
  cv.warpPerspective(src, dst, M, new cv.Size(W, H));
  srcPts.delete(); dstPts.delete(); M.delete();
  return dst;
}

function checkWarpQuality(markers, imgW, imgH) {
  const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const wt = dist(markers.tl, markers.tr);
  const wb = dist(markers.bl, markers.br);
  const hl = dist(markers.tl, markers.bl);
  const hr = dist(markers.tr, markers.br);
  const avgW = (wt + wb) / 2;
  const avgH = (hl + hr) / 2;
  const areaRatio = (avgW * avgH) / (imgW * imgH);
  const skewW = Math.abs(wt - wb) / Math.max(wt, wb);
  const skewH = Math.abs(hl - hr) / Math.max(hl, hr);
  const reasons = [];
  if (skewW > WARP_SKEW_LIMIT) reasons.push(`Yatay eğiklik yüksek (${(skewW*100).toFixed(1)}%)`);
  if (skewH > WARP_SKEW_LIMIT) reasons.push(`Dikey eğiklik yüksek (${(skewH*100).toFixed(1)}%)`);
  if (areaRatio < WARP_AREA_MIN_RATIO) reasons.push(`Form alanı çok küçük (${(areaRatio*100).toFixed(1)}%)`);
  return { ok: reasons.length === 0, reasons };
}

function analyzeBubbles(warpMat, debugDraw = true) {
  const threshold = parseFloat(document.getElementById('fillThreshold').value) || 0.20;
  const penalty = parseFloat(document.getElementById('penalty').value) || 0.25;
  const fillParams = getFillParams();
  
  const binary = preprocessToBinary(warpMat);
  
  const w = warpMat.cols, h = warpMat.rows;
  let correct = 0, wrong = 0, blank = 0, multi = 0;
  const suspiciousReasons = [];
  const perQuestion = [];
  
  // Debug: ROI'leri çizmek için warpMat'in kopyasını al
  let debugMat = null;
  if (debugDraw) {
    debugMat = warpMat.clone();
  }
  
  console.log(`Warp boyutu: ${w}x${h}, Layout boyutu: ${layoutConfig.canvasWidth}x${layoutConfig.canvasHeight}`);
  console.log(`Toplam soru: ${layoutConfig.questions.length}`);
  
  for (const q of layoutConfig.questions) {
      const scores = q.choices.map(c => {
        // ROI boyutlarını hesapla
        const roiW = Math.round(c.width * w * fillParams.roiScale);
        const roiH = Math.round(c.height * h * fillParams.roiScale);
      
      // Merkez koordinatlarından sol üst köşeyi hesapla
      const rectX = Math.max(0, Math.round(c.x * w - roiW / 2));
      const rectY = Math.max(0, Math.round(c.y * h - roiH / 2));
      
      const rect = new cv.Rect(rectX, rectY, roiW, roiH);
      
      // Sınır kontrolü
      if (rect.x + rect.width > w) rect.width = w - rect.x;
      if (rect.y + rect.height > h) rect.height = h - rect.y;
      if (rect.width <= 0 || rect.height <= 0) return { opt: c.option, score: 0 };
      
      // Debug: ROI'yi çiz
      if (debugMat && q.questionNumber <= 5) {
        const color = new cv.Scalar(0, 255, 0, 255); // Yeşil
        cv.rectangle(debugMat, new cv.Point(rect.x, rect.y), 
                    new cv.Point(rect.x + rect.width, rect.y + rect.height), color, 1);
      }
      
      const roi = binary.roi(rect);
          let score = 0;
          // Dairesel maske ile i? b?lgeyi oku (?er?eve ?izgisini hari? tut)
          if (roi.rows > 0 && roi.cols > 0) {
            const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
            const r = Math.floor(Math.min(roi.rows, roi.cols) * fillParams.maskRatio);
            const cx = Math.floor(roi.cols / 2);
            const cy = Math.floor(roi.rows / 2);
            cv.circle(mask, new cv.Point(cx, cy), r, new cv.Scalar(255, 255, 255, 255), -1);
            const masked = new cv.Mat();
            cv.bitwise_and(roi, mask, masked);
        const maskArea = cv.countNonZero(mask);
        score = maskArea > 0 ? cv.countNonZero(masked) / maskArea : 0;
        masked.delete(); mask.delete();
      }
      roi.delete();
      
      // Debug log for first question
      if (q.questionNumber === 1) {
        console.log(`S1 ${c.option}: rect(${rect.x},${rect.y},${rect.width},${rect.height}) score=${score.toFixed(3)}`);
      }
      
      return { opt: c.option, score };
    });
    
    // En yüksek skora sahip olanı bul
    const maxScore = Math.max(...scores.map(s => s.score));
    // Gürültü alt sınırı: max skor çok düşükse doğrudan boş kabul et
    if (maxScore < fillParams.blankGuard) {
      blank++;
      perQuestion.push({ q: q.questionNumber, marked: '-', status: 'Boş', maxScore: maxScore.toFixed(2) });
      continue;
    }

    const filled = scores.filter(s => s.score >= threshold);
    
    let status = 'Boş';
    let candidate = null;
    let markedLabel = '-';
    
    // Tek seçim için: en yüksek skor threshold'u geçmese bile,
    // belirgin şekilde diğerlerinden yüksekse al
    if (filled.length === 0 && maxScore > 0.05) {
      const sortedScores = [...scores].sort((a, b) => b.score - a.score);
      const best = sortedScores[0];
      const second = sortedScores[1];
      // En yüksek, ikinciden en az %50 daha yüksekse
      if (best.score > second.score * 1.5 || (best.score > 0.1 && best.score > second.score * 1.3)) {
        candidate = best;
      }
    } else if (filled.length > 1) {
      // Çoklu işaret varsa en yüksek skorlu seçeneği al
      candidate = filled.reduce((a, b) => (a.score >= b.score ? a : b));
      if (candidate) markedLabel = candidate.opt + '*';
      multi++;
      suspiciousReasons.push(`S${q.questionNumber}: çoklu işaret`);
    } else if (filled.length === 1) {
      candidate = filled[0];
    }
    
    if (candidate) {
      const key = answerKey[q.questionNumber];
      status = key === candidate.opt ? 'Doğru' : 'Yanlış';
      if (markedLabel === '-') markedLabel = candidate.opt;
      if (status === 'Doğru') correct++; else wrong++;
    } else {
      blank++;
      if (maxScore >= threshold * 0.6) {
        suspiciousReasons.push(`S${q.questionNumber}: belirsiz işaret (skor ${maxScore.toFixed(2)})`);
      }
    }
    
    perQuestion.push({ q: q.questionNumber, marked: markedLabel, status, maxScore: maxScore.toFixed(2) });
  }
  
  // Debug görüntüsünü göster
  if (debugMat) {
    cv.imshow('warpCanvas', debugMat);
    debugMat.delete();
  }
  
  // Read student ID
  let studentNo = '';
  if (layoutConfig.studentId) {
    for (let col = 0; col < layoutConfig.studentId.digits; col++) {
      const colBubbles = layoutConfig.studentId.bubbles.filter(b => b.col === col);
      let best = null, bestScore = 0;
    for (const b of colBubbles) {
      const rect = new cv.Rect(
          Math.max(0, Math.round(b.x * w - b.width * w / 2)),
          Math.max(0, Math.round(b.y * h - b.height * h / 2)),
          Math.round(b.width * w), Math.round(b.height * h)
        );
        if (rect.x + rect.width > w || rect.y + rect.height > h) continue;
      const roi = binary.roi(rect);
        const score = cv.countNonZero(roi) / (rect.width * rect.height);
      roi.delete();
        if (score > bestScore) { bestScore = score; best = b.digit; }
      }
      studentNo += bestScore >= threshold ? best : '?';
    }
  }
  if (studentNo.includes('?')) {
    suspiciousReasons.push('Öğrenci no okunamadı');
  }

  binary.delete();
  
  const net = (correct - wrong * penalty).toFixed(2);
  return { correct, wrong, blank, multi, net, perQuestion, studentNo, suspicious: suspiciousReasons.length > 0, suspiciousReasons };
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

// =====================================================
// SESSION LOG / EXPORT
// =====================================================
function addSessionResult(r) {
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
  // ID'leri sıralı tut
  sessionResults = sessionResults
    .sort((a, b) => a.id - b.id)
    .map((e, idx) => ({ ...e, id: idx + 1 }));
  renderSessionList();
  persistAllEntriesSafely();
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
  const header = ['Sira','OgrenciNo','Dogru','Yanlis','Bos','Coklu','Net'];
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

async function writeFullLog(entries) {
  if (!fileSaveSupported) return false;
  try {
    const handle = await ensureLogFileHandle();
    if (!handle) return false;
    const writable = await handle.createWritable({ keepExistingData: false });
    const lines = entries.map(e => formatEntryLine(e, false)).join('\\n') + '\\n';
    await writable.write(lines);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('Log yazma hatasi', e);
    return false;
  }
}

function persistAllEntriesSafely() {
  writeFullLog(sessionResults).then((ok) => {
    if (!ok) fallbackDownloadLog();
  });
}

function downloadSessionXlsx() {
  if (sessionResults.length === 0) { alert('Kayit yok.'); return; }
  const maxQ = Math.max(...sessionResults.map(r => (r.perQuestion || []).length || 0));
  const header = ['Sira','OgrenciNo','Dogru','Yanlis','Bos','Coklu','Net'];
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
  canvas.width = Math.min(640, video.videoWidth);
  canvas.height = Math.floor(canvas.width * video.videoHeight / video.videoWidth);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  if (scanMode === 'answerKey') {
    processAnswerKeyFrame();
  } else {
    processFrame(isAuto);
  }
}

function processAnswerKeyFrame() {
  let src, binary, markerOverlay;
  
  try {
    src = cv.imread('captureCanvas');
    binary = preprocessToBinary(src);
    
    markerOverlay = src.clone();
    const markers = detectCornerMarkers(binary, markerOverlay);
    cv.imshow('markerCanvas', markerOverlay);
    
    if (!markers) {
      setLog('cameraLog', '⚠️ Köşe markerları bulunamadı', 'error');
      return;
    }
    const warpCheck = checkWarpQuality(markers, src.cols, src.rows);
    if (!warpCheck.ok) {
      setLog('cameraLog', `⚠️ Eğim/alan kontrolü başarısız: ${warpCheck.reasons.join(', ')}`, 'error');
      updateStatus('error', 'Eğim çok yüksek');
      return;
    }
    
    const warped = warpPerspective(src, markers);
    cv.imshow('warpCanvas', warped);
    
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
        if (binary) binary.delete();
        if (markerOverlay) markerOverlay.delete();
      }
    }

function readAnswerKeyFromScan(warpMat) {
  const threshold = parseFloat(document.getElementById('fillThreshold').value) || 0.20;
  const fillParams = getFillParams();
  
  const binary = preprocessToBinary(warpMat);
  
  const w = warpMat.cols, h = warpMat.rows;
  const answers = {};
  let successCount = 0;
  
  // ROI boyut çarpanı
  const roiScale = Math.max(fillParams.roiScale, 1.02);
  
  for (const q of layoutConfig.questions) {
    const scores = q.choices.map(c => {
      const roiW = Math.round(c.width * w * roiScale);
      const roiH = Math.round(c.height * h * roiScale);
      
      const rect = new cv.Rect(
        Math.max(0, Math.round(c.x * w - roiW / 2)),
        Math.max(0, Math.round(c.y * h - roiH / 2)),
        roiW,
        roiH
      );
      
      // Sınır kontrolü
      if (rect.x + rect.width > w) rect.width = w - rect.x;
      if (rect.y + rect.height > h) rect.height = h - rect.y;
      if (rect.width <= 0 || rect.height <= 0) return { opt: c.option, score: 0 };
      
          const roi = binary.roi(rect);
          let score = 0;
          // Dairesel maske ile i? b?lgeyi oku (?er?eve ?izgisini hari? tut)
          if (roi.rows > 0 && roi.cols > 0) {
            const mask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
            const r = Math.floor(Math.min(roi.rows, roi.cols) * fillParams.maskRatio);
            const cx = Math.floor(roi.cols / 2);
            const cy = Math.floor(roi.rows / 2);
            cv.circle(mask, new cv.Point(cx, cy), r, new cv.Scalar(255, 255, 255, 255), -1);
            const masked = new cv.Mat();
            cv.bitwise_and(roi, mask, masked);
        const maskArea = cv.countNonZero(mask);
        score = maskArea > 0 ? cv.countNonZero(masked) / maskArea : 0;
        masked.delete(); mask.delete();
      }
      roi.delete();
      return { opt: c.option, score };
    });
    
        // En yüksek skora sahip şıkkı bul
        const maxScore = Math.max(...scores.map(s => s.score));
        const filled = scores.filter(s => s.score >= threshold);
        
        // Tek işaretli cevap varsa al
        if (filled.length === 1) {
          answers[q.questionNumber] = filled[0].opt;
          successCount++;
        } 
        // Hiçbiri threshold'u geçmiyorsa ama belirgin bir işaret varsa
        else if (filled.length === 0 && maxScore >= Math.max(fillParams.blankGuard, threshold * 0.6)) {
          const best = scores.find(s => s.score === maxScore);
          // Diğerlerinden belirgin şekilde yüksek olmalı
          const secondMax = Math.max(...scores.filter(s => s.score !== maxScore).map(s => s.score));
          if (best && maxScore > secondMax * 1.35) {
            answers[q.questionNumber] = best.opt;
            successCount++;
          }
        }
      }
  
      binary.delete();
      
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
  const camRow = document.getElementById('cameraSelectRow');
  if (camRow) camRow.style.display = source === 'camera' ? 'block' : 'none';
  
  // Scan mode'u sıfırla
  scanMode = 'student';
  document.getElementById('processFileBtn').textContent = '🔍 Formu Analiz Et';
  
  if (source === 'camera') {
    initCamera();
    loadCameraDevices();
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
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
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
      document.getElementById('fileName').textContent = `✓ ${file.name} (${Math.round(file.size/1024)} KB)`;
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
  let src, binary, markerOverlay;
  
  try {
    src = cv.imread('captureCanvas');
    if (src.empty()) {
      throw new Error('Resim okunamadı');
    }
    
    binary = preprocessToBinary(src);
    
    markerOverlay = src.clone();
    const markers = detectCornerMarkers(binary, markerOverlay);
    cv.imshow('markerCanvas', markerOverlay);
    
    if (!markers) {
      setLog('cameraLog', '⚠️ Köşe markerları bulunamadı. Formun köşeleri görünür olmalı.', 'error');
      updateStatus('error', 'Marker bulunamadı');
      return;
    }
    const warpCheck = checkWarpQuality(markers, src.cols, src.rows);
    if (!warpCheck.ok) {
      setLog('cameraLog', `⚠️ Eğim/alan kontrolü başarısız: ${warpCheck.reasons.join(', ')}`, 'error');
      updateStatus('error', 'Eğim çok yüksek');
      return;
    }
    
    const warped = warpPerspective(src, markers);
    cv.imshow('warpCanvas', warped);
    
    const result = analyzeBubbles(warped);
    renderResults(result);
    if (result.suspicious) {
      updateStatus('ready', 'Şüpheli okuma');
      setLog('cameraLog', `⚠️ Şüpheli okuma: ${result.suspiciousReasons.join(', ')}`, 'error');
    } else {
      updateStatus('found', '✓ Form okundu!');
      setLog('cameraLog', '✅ Analiz tamamlandı!', 'success');
    }
    safeAddSessionResult(result);
    
    warped.delete();
  } catch (e) {
    console.error(e);
    setLog('cameraLog', '❌ Hata: ' + e.message, 'error');
    updateStatus('error', 'Hata');
  } finally {
    if (src) src.delete();
    if (binary) binary.delete();
    if (markerOverlay) markerOverlay.delete();
  }
}

function processAnswerKeyFromFile() {
  let src, binary, markerOverlay;
  
  try {
    src = cv.imread('captureCanvas');
    binary = preprocessToBinary(src);
    
    markerOverlay = src.clone();
    const markers = detectCornerMarkers(binary, markerOverlay);
    cv.imshow('markerCanvas', markerOverlay);
    
    if (!markers) {
      setLog('cameraLog', '⚠️ Köşe markerları bulunamadı', 'error');
      return;
    }
    
    const warped = warpPerspective(src, markers);
    cv.imshow('warpCanvas', warped);
    
    const result = readAnswerKeyFromScan(warped);
    
    if (result.success) {
      answerKey = result.answers;
      const answerCountInput = document.getElementById('answerKeyCount');
      if (answerCountInput && layoutConfig?.questions?.length) {
        answerCountInput.value = layoutConfig.questions.length;
      }
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
