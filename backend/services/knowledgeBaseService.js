const fs = require('fs');
const path = require('path');

// Lokasi folder ai/knowledge-base relatif dari backend/services/
const KB_DIR = path.resolve(__dirname, '../../ai/knowledge-base');

let cachedContext = '';
let loadedFiles = [];
let lastLoadedAt = null;

/**
 * Membaca seluruh file .md dan .txt dari folder ai/knowledge-base/ dan menyimpannya ke memori RAM
 */
function loadKnowledgeBase() {
  try {
    if (!fs.existsSync(KB_DIR)) {
      console.warn(`[KnowledgeBase] Direktori tidak ditemukan: ${KB_DIR}. Membuat folder baru...`);
      fs.mkdirSync(KB_DIR, { recursive: true });
    }

    const files = fs.readdirSync(KB_DIR);
    // Hanya memuat dokumen SOP (abaikan README.md petunjuk developer agar hemat token)
    const validFiles = files.filter(
      f => (f.endsWith('.md') || f.endsWith('.txt')) && f.toLowerCase() !== 'readme.md'
    );

    if (validFiles.length === 0) {
      console.warn('[KnowledgeBase] Tidak ada file dokumen (.md / .txt) di folder ai/knowledge-base/.');
      cachedContext = 'Belum ada dokumen SOP khusus yang dimuat.';
      loadedFiles = [];
      lastLoadedAt = new Date();
      return { count: 0, files: [] };
    }

    const contents = [];
    const filesMeta = [];

    for (const fileName of validFiles) {
      const fullPath = path.join(KB_DIR, fileName);
      try {
        const text = fs.readFileSync(fullPath, 'utf-8');
        contents.push(`=== DOKUMEN: ${fileName} ===\n${text.trim()}`);
        filesMeta.push({
          name: fileName,
          size: fs.statSync(fullPath).size
        });
      } catch (err) {
        console.error(`[KnowledgeBase] Gagal membaca file ${fileName}:`, err.message);
      }
    }

    cachedContext = contents.join('\n\n');
    loadedFiles = filesMeta;
    lastLoadedAt = new Date();

    console.log(`[KnowledgeBase] Berhasil memuat ${filesMeta.length} file dokumen ke memory cache.`);
    return {
      count: filesMeta.length,
      files: filesMeta,
      lastLoadedAt
    };
  } catch (error) {
    console.error('[KnowledgeBase] Terjadi kesalahan saat memuat Knowledge Base:', error.message);
    return { error: error.message };
  }
}

/**
 * Mengambil teks context Knowledge Base dari memory cache
 */
function getKnowledgeBaseContext() {
  if (!cachedContext || loadedFiles.length === 0) {
    loadKnowledgeBase();
  }
  return cachedContext;
}

/**
 * Informasi status cache saat ini
 */
function getKnowledgeBaseStats() {
  return {
    fileCount: loadedFiles.length,
    files: loadedFiles,
    lastLoadedAt: lastLoadedAt ? lastLoadedAt.toISOString() : null,
    contextLength: cachedContext.length
  };
}

// Inisialisasi awal saat service dimuat
loadKnowledgeBase();

module.exports = {
  loadKnowledgeBase,
  getKnowledgeBaseContext,
  getKnowledgeBaseStats
};
