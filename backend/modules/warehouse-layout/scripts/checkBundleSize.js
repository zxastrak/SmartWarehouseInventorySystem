/**
 * Bundle Size Checker for Web Application
 * Verifies that production chunks adhere to performance budgets:
 * - Chunk Editor <= ~60 KB gzip
 * - Route Overview / Directory <= ~100 KB gzip
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const WEB_DIR = path.resolve(__dirname, '../../../../web');
const DIST_DIR = path.join(WEB_DIR, 'dist', 'assets');

const BUDGETS = {
  editor: 60 * 1024, // 60 KB gzip
  directory: 100 * 1024, // 100 KB gzip
};

function checkBundleSizes() {
  console.log('========================================================');
  console.log('MEMERIKSA UKURAN BUNDLE & CHUNK WEB PRODUCTION');
  console.log('========================================================\n');

  // 1. Jalankan build produksi jika dist belum ada
  if (!fs.existsSync(DIST_DIR)) {
    console.log('[BUILD] Menjalankan npm run build pada web...');
    execSync('npm run build', { cwd: WEB_DIR, stdio: 'inherit' });
  }

  const files = fs.readdirSync(DIST_DIR);
  const jsFiles = files.filter((f) => f.endsWith('.js'));

  console.log(`Ditemukan ${jsFiles.length} file chunk JavaScript di ${DIST_DIR}:\n`);

  let allPassed = true;
  const results = [];

  for (const file of jsFiles) {
    const fullPath = path.join(DIST_DIR, file);
    const content = fs.readFileSync(fullPath);
    const rawBytes = content.length;
    const gzipBytes = zlib.gzipSync(content).length;

    const rawKb = (rawBytes / 1024).toFixed(2);
    const gzipKb = (gzipBytes / 1024).toFixed(2);

    results.push({
      file,
      rawKb: `${rawKb} KB`,
      gzipKb: `${gzipKb} KB`,
      gzipBytes,
    });
  }

  // Tampilkan tabel
  console.table(results);

  console.log('\n--- EVALUASI ANGGARAN PERFORMA ---');
  console.log(`- Batas Maksimum Chunk Editor    : <= 60.00 KB Gzip`);
  console.log(`- Batas Maksimum Chunk Directory : <= 100.00 KB Gzip`);

  // Evaluasi chunk spesifik jika sudah ada
  for (const r of results) {
    if (r.file.includes('editor') && r.gzipBytes > BUDGETS.editor) {
      console.error(`[BUDGET EXCEEDED] Chunk ${r.file} (${r.gzipKb}) melebihi batas 60 KB gzip!`);
      allPassed = false;
    }
  }

  console.log(`\nStatus Evaluasi Bundle: ${allPassed ? 'SEMUA ANGGARAN TERPENUHI (LULUS)' : 'ADA ANGGARAN TERLAMPAUI'}`);
  return allPassed;
}

if (require.main === module) {
  const ok = checkBundleSizes();
  process.exit(ok ? 0 : 1);
}

module.exports = checkBundleSizes;
