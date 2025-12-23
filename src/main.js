import { setupTabs, setupInputs, generateForm, downloadPNG } from './features/designer.js';
import { renderSessionList, downloadSessionTxt, downloadSessionCsv, downloadSessionXlsx } from './features/results.js';
import { initCamera, loadCameraDevices, onCameraChange } from './core/camera.js';
import { toggleAutoScan, captureAndProcess, toggleScanSource, handleFileSelect, processUploadedFile, startAnswerKeyScan, clearUploadedFile, getPreprocessParams, preprocessToBinary, detectCornerMarkers, warpPerspective, checkWarpQuality, analyzeBubbles, initAlignmentGuide, startMultiReadConsensus, resetMarkerStabilization } from './core/omr.js';
import { debounce, clampInt } from './utils/helpers.js';
import { ensureAudioContext } from './core/audio.js';
import { state } from './features/state.js';
import { initSettingsPanel, getSettings, getSetting } from './core/settings.js';

// Global exports for debugging if needed
window.captureAndProcess = captureAndProcess;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupInputs();
  generateForm();

  // Gelişmiş ayarlar panelini başlat
  initSettingsPanel();

  // Setup answer key UI logic (moved here or in results.js, let's keep it here for wiring)
  setupAnswerKeyUI();

  document.getElementById('refreshBtn')?.addEventListener('click', generateForm);
  document.getElementById('downloadPngBtn')?.addEventListener('click', downloadPNG);
  document.getElementById('downloadPdfBtn')?.addEventListener('click', () => window.print());
  document.getElementById('startCameraBtn')?.addEventListener('click', initCamera);
  document.getElementById('captureBtn')?.addEventListener('click', () => captureAndProcess(false));
  document.getElementById('autoScanBtn')?.addEventListener('click', toggleAutoScan);
  document.getElementById('resetStabilizationBtn')?.addEventListener('click', () => {
    resetMarkerStabilization();
    console.log('Stabilizasyon sıfırlandı');
  });
  document.getElementById('downloadTxtBtn')?.addEventListener('click', downloadSessionTxt);
  document.getElementById('downloadCsvBtn')?.addEventListener('click', downloadSessionCsv);
  document.getElementById('downloadXlsxBtn')?.addEventListener('click', downloadSessionXlsx);

  const cameraSelectEl = document.getElementById('cameraSelect');
  if (cameraSelectEl) {
    cameraSelectEl.addEventListener('change', onCameraChange);
  }
  loadCameraDevices();

  const shadowToggle = document.getElementById('shadowMode');
  if (shadowToggle) {
    shadowToggle.addEventListener('change', () => {
      // state.shadowMode is updated? config.js didn't export setter, but we can access directly
      state.shadowMode = shadowToggle.checked;
    });
  }

  // Alignment Guide Toggle
  const alignmentGuideToggle = document.getElementById('alignmentGuideToggle');
  if (alignmentGuideToggle) {
    alignmentGuideToggle.addEventListener('change', () => {
      state.alignmentGuideEnabled = alignmentGuideToggle.checked;
      const overlay = document.getElementById('alignmentOverlay');
      if (overlay) {
        overlay.style.display = alignmentGuideToggle.checked ? 'block' : 'none';
      }
    });
  }

  // Initialize Alignment Guide
  const video = document.getElementById('video');
  const alignmentOverlay = document.getElementById('alignmentOverlay');
  if (video && alignmentOverlay) {
    const guide = initAlignmentGuide(video, alignmentOverlay);
    if (guide) {
      guide.setOnReady((alignment) => {
        // Otomatik okuma için kullanılabilir
        console.log('Form hazır:', alignment.status);
      });
    }
  }

  // Cevap anahtarı event listener
  document.getElementById('answerKeySource')?.addEventListener('change', toggleAnswerKeyMode);
  document.getElementById('generateKeyGridBtn')?.addEventListener('click', generateAnswerKeyGrid);
  document.getElementById('clearKeyBtn')?.addEventListener('click', clearAnswerKey);
  document.getElementById('randomKeyBtn')?.addEventListener('click', generateRandomKey);
  document.getElementById('scanKeyBtn')?.addEventListener('click', startAnswerKeyScan);
  document.getElementById('answerKeyCount')?.addEventListener('change', generateAnswerKeyGrid);

  // Listen for custom answer key update event
  document.addEventListener('answerKeyUpdated', () => {
    generateAnswerKeyGrid();
    updateAnswerKeyStatus();
  });

  // File upload logic
  document.getElementById('scanSource')?.addEventListener('change', toggleScanSource);
  document.getElementById('fileInput')?.addEventListener('change', handleFileSelect);
  document.getElementById('processFileBtn')?.addEventListener('click', processUploadedFile);
  document.getElementById('clearFileBtn')?.addEventListener('click', clearUploadedFile);

  // Audio
  const primeAudio = () => ensureAudioContext();
  document.body.addEventListener('click', primeAudio, { once: true });
  document.body.addEventListener('keydown', primeAudio, { once: true });

  renderSessionList();
});

// Answer Key UI Functions (kept in main for simplicity of wiring, or could be in separate module)
// Since they interact with DOM heavily, let's put them here or in features/results.js?
// Original was in main.js. Let's keep them here for now, or move to features/answerKey.js?
// Let's implement them here.

function setupAnswerKeyUI() {
  generateAnswerKeyGrid();
  updateAnswerKeyStatus();
}

function toggleAnswerKeyMode() {
  const source = document.getElementById('answerKeySource').value;
  document.getElementById('manualKeySection').style.display = source === 'manual' ? 'block' : 'none';
  document.getElementById('scanKeySection').style.display = source === 'scan' ? 'block' : 'none';
}

// Make globally available for inline onclick handlers if any (though we used addEventListener mostly)
window.updateSingleAnswer = updateSingleAnswer;

function generateAnswerKeyGrid() {
  const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
  const choiceCount = clampInt(document.getElementById('choiceCount')?.value || 5, 4, 5, 5);
  const grid = document.getElementById('answerKeyGrid');
  const letters = ['A', 'B', 'C', 'D', 'E'].slice(0, choiceCount);

  let html = '';
  // Use state.answerKey
  for (let i = 1; i <= count; i++) {
    const currentAnswer = state.answerKey[i] || '';
    html += `<div class="answer-key-item">
      <span>${i}.</span>
      <select data-question="${i}" onchange="window.updateSingleAnswer(${i}, this.value)">
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
    state.answerKey[questionNum] = answer;
  } else {
    delete state.answerKey[questionNum];
  }
  updateAnswerKeyStatus();
}

function clearAnswerKey() {
  state.answerKey = {};
  generateAnswerKeyGrid();
  updateAnswerKeyStatus();
}

function generateRandomKey() {
  const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
  const choiceCount = clampInt(document.getElementById('choiceCount')?.value || 5, 4, 5, 5);
  const letters = ['A', 'B', 'C', 'D', 'E'].slice(0, choiceCount);

  state.answerKey = {};
  for (let i = 1; i <= count; i++) {
    state.answerKey[i] = letters[Math.floor(Math.random() * letters.length)];
  }

  generateAnswerKeyGrid();
  updateAnswerKeyStatus();
}

function updateAnswerKeyStatus() {
  const count = clampInt(document.getElementById('answerKeyCount').value, 1, 200, 30);
  const filledCount = Object.keys(state.answerKey).length;
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
