const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Statik dosyaları serve et
app.use(express.static(__dirname));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📝 Optik Form Pro uygulaması hazır!`);
});

