#!/usr/bin/env node
/**
 * OMR benchmark otomasyonu
 * - generate_variations çıktılarındaki görselleri mevcut OMR arayüzünde okur
 * - filled-base.png'yi cevap anahtarı olarak yükler (Tarayarak Yükle + Dosya)
 * - Sonuçları benchmarks/results.csv dosyasına işler (Dogru/Yanlis/Bos/Coklu vb.)
 *
 * Gereksinim: playwright (npm i -D playwright)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const INDEX_URL = 'file://' + path.join(ROOT, 'index.html');
const RESULTS_CSV = path.join(ROOT, 'benchmarks', 'results.csv');
const BASE_KEY_IMG = path.join(ROOT, 'benchmarks', 'input', 'filled-base.png');

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const lines = text.split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] !== undefined ? cols[i] : '';
    });
    return row;
  });
}

function writeCsv(filePath, rows) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  rows.forEach((r) => {
    lines.push(headers.map((h) => (r[h] ?? '')).join(','));
  });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function waitForCvReady(page) {
  await page.waitForFunction(() => window.cvReady === true, { timeout: 20000 });
}

async function hookPage(page) {
  await page.evaluate(() => {
    window.__lastResult = null;
    window.__lastError = null;
    const origRender = window.renderResults;
    window.renderResults = (r) => {
      window.__lastResult = r;
      origRender(r);
    };
    const origSetLog = window.setLog;
    window.setLog = (id, msg, type = '') => {
      if (type === 'error') {
        window.__lastError = msg;
      }
      origSetLog(id, msg, type);
    };
  });
}

async function loadAnswerKeyFromFile(page, imgPath) {
  await page.click('text=Oku');
  await page.selectOption('#scanSource', 'file');
  await page.selectOption('#answerKeySource', 'scan');
  // Cevap anahtarı modunu ayarla
  await page.click('#scanKeyBtn');
  await page.setInputFiles('#fileInput', imgPath);
  await page.waitForSelector('#processFileBtn:not([disabled])', { timeout: 10000 });
  await page.click('#processFileBtn');
  await page.waitForFunction(
    () => Object.keys(window.answerKey || {}).length > 0,
    { timeout: 20000 }
  );
}

async function processImage(page, imgPath) {
  await page.evaluate(() => {
    window.__lastResult = null;
    window.__lastError = null;
  });
  await page.selectOption('#scanSource', 'file');
  await page.setInputFiles('#fileInput', imgPath);
  await page.waitForSelector('#processFileBtn:not([disabled])', { timeout: 10000 });
  await page.click('#processFileBtn');

  const res = await page.waitForFunction(
    () => window.__lastResult || window.__lastError,
    { timeout: 20000 }
  );
  const value = res.jsonValue ? await res.jsonValue() : res;
  if (value && value.__lastResult) return value.__lastResult;
  if (value && value.correct !== undefined) return value;
  if (typeof value === 'string') return { error: value };
  return value || null;
}

async function main() {
  if (!fs.existsSync(RESULTS_CSV)) {
    console.error('results.csv bulunamadı:', RESULTS_CSV);
    process.exit(1);
  }
  const rows = parseCsv(RESULTS_CSV);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(INDEX_URL);
  await waitForCvReady(page);
  await hookPage(page);
  await loadAnswerKeyFromFile(page, BASE_KEY_IMG);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const imgAbs = path.isAbsolute(r.Image)
      ? r.Image
      : path.join(ROOT, r.Image);
    if (!fs.existsSync(imgAbs)) {
      console.warn('Görüntü bulunamadı, atlanıyor:', imgAbs);
      continue;
    }
    const result = await processImage(page, imgAbs);
    if (!result || result.error) {
      r.Dogru = r.Yanlis = r.Bos = r.Coklu = '0';
      r.SupheliFlag = '1';
      r.MarkerOK = '0';
      r.OgrNoOK = '0';
      continue;
    }
    r.Dogru = result.correct ?? '0';
    r.Yanlis = result.wrong ?? '0';
    r.Bos = result.blank ?? '0';
    r.Coklu = result.multi ?? '0';
    r.SupheliFlag = result.suspicious ? '1' : '0';
    r.MarkerOK = '1';
    r.OgrNoOK = result.studentNo && !result.studentNo.includes('?') ? '1' : '0';
  }

  await browser.close();
  writeCsv(RESULTS_CSV, rows);
  console.log('Tamamlandı. Sonuçlar güncellendi:', RESULTS_CSV);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
