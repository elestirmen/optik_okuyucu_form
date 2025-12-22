const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

if (!fs.existsSync(DIST_DIR)) {
    console.warn('⚠️  UYARI: "dist" klasörü bulunamadı! Lütfen önce "npm run build" çalıştırın.');
}

// Statik dosyaları serve et (production build)
app.use(express.static(DIST_DIR));

// Ana sayfa ve diğer route'lar için index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
    console.log(`📂 Serving content from: ${DIST_DIR}`);
});
