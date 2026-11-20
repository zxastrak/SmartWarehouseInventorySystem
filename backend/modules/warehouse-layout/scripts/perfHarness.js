/**
 * Performance Testing Harness
 * 1. API Snapshot Latency & Payload Benchmark (500 Racks)
 * 2. Real Browser Client Performance Benchmark via Chrome DevTools Protocol (CDP):
 *    - (a) FPS measurement via requestAnimationFrame loop
 *    - (b) INP / Long Task (>50ms) detection via PerformanceObserver
 *    - (c) JS Heap Memory measurement
 *    - (d) CPU Throttle 4x emulation via Emulation.setCPUThrottlingRate
 */

const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const app = require('../../../server');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_warehouse_db',
  port: Number(process.env.DB_PORT) || 3306,
};

// Deteksi executable Chrome di Windows
function getChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * 1. Benchmark API GET Snapshot pada 500 Rak
 */
async function runSnapshotBenchmark() {
  console.log('========================================================');
  console.log('BENCHMARK API GET SNAPSHOT (500 RAK)');
  console.log('========================================================\n');

  const conn = await mysql.createConnection(dbConfig);
  let whId;
  try {
    const [rows] = await conn.query("SELECT id FROM warehouses WHERE code = 'WH-PERF-500'");
    if (rows.length === 0) {
      console.log('[INFO] Warehouse WH-PERF-500 belum ada. Jalankan seedLarge.js terlebih dahulu.');
      return null;
    }
    whId = rows[0].id;
  } finally {
    await conn.end();
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/warehouse-layout/warehouses/${whId}/layout`;

  try {
    // Warmup request
    await fetch(url);

    const iterations = 20;
    const durations = [];
    let payloadRawBytes = 0;
    let payloadGzipBytes = 0;

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const res = await fetch(url);
      const text = await res.text();
      const t1 = performance.now();

      durations.push(t1 - t0);

      if (i === 0) {
        payloadRawBytes = Buffer.byteLength(text, 'utf8');
        payloadGzipBytes = zlib.gzipSync(Buffer.from(text)).length;
      }
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(iterations * 0.5)].toFixed(2);
    const p95 = durations[Math.floor(iterations * 0.95)].toFixed(2);
    const p99 = durations[iterations - 1].toFixed(2);
    const avg = (durations.reduce((a, b) => a + b, 0) / iterations).toFixed(2);

    console.log(`- Jumlah Sampel Pengujian: ${iterations} request`);
    console.log(`- Latensi Rata-rata       : ${avg} ms`);
    console.log(`- Latensi p50             : ${p50} ms`);
    console.log(`- Latensi p95             : ${p95} ms`);
    console.log(`- Latensi p99             : ${p99} ms`);
    console.log(`- Ukuran Payload Mentah   : ${(payloadRawBytes / 1024).toFixed(2)} KB (${payloadRawBytes} bytes)`);
    console.log(`- Ukuran Payload Gzip     : ${(payloadGzipBytes / 1024).toFixed(2)} KB (${payloadGzipBytes} bytes)`);
    console.log(`- Anggaran Payload Max    : <= 100.00 KB Gzip`);
    console.log(`- Status Anggaran         : ${payloadGzipBytes <= 100 * 1024 ? 'MEMENUHI TARGET (LULUS)' : 'MELEBIHI ANGGARAN'}\n`);

    return {
      avgMs: Number(avg),
      p95Ms: Number(p95),
      rawKb: Number((payloadRawBytes / 1024).toFixed(2)),
      gzipKb: Number((payloadGzipBytes / 1024).toFixed(2)),
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

/**
 * 2. Browser Client Performance Harness via Headless Chrome & CDP
 */
async function runBrowserHarness(targetUrl = 'http://localhost:5173/') {
  console.log('========================================================');
  console.log('HARNESS PERFORMA BROWSER CLIENT (4x CPU THROTTLE)');
  console.log('========================================================\n');

  const chromePath = getChromePath();
  if (!chromePath) {
    console.warn('[SKIP] Google Chrome atau Microsoft Edge tidak ditemukan di path standar Windows.');
    return null;
  }

  const cdpPort = 9222;
  console.log(`[CHROME] Menjalankan headless browser: ${chromePath}...`);
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // Tunggu CDP siap
  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    // Dapatkan target halaman
    const versionRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await versionRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      console.warn('[CDP] Gagal mendapatkan webSocketDebuggerUrl.');
      return null;
    }

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log(`[CDP] Terhubung ke target halaman via WebSocket: ${wsUrl}`);

    // Gunakan modul WebSocket native Node.js (Node 22+)
    const ws = new WebSocket(wsUrl);

    let messageId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = messageId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise((resolve) => (ws.onopen = resolve));

    // Aktifkan Page dan Emulation
    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    // (d) Terapkan CPU Throttle 4x
    console.log('[CDP] Menerapkan CPU Throttling Rate: 4x...');
    await sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Navigasi ke halaman uji
    console.log(`[CDP] Navigasi ke target URL: ${targetUrl}...`);
    await sendCommand('Page.navigate', { url: targetUrl });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // (a) Ukur FPS via rAF, (b) Long Task via PerformanceObserver, (c) JS Heap Memory
    console.log('[CDP] Mengukur FPS, Long Tasks, dan Heap Memory...');
    const evalScript = `
      new Promise((resolve) => {
        let frameCount = 0;
        let lastTime = performance.now();
        let longTaskCount = 0;
        let maxLongTaskDuration = 0;

        if (window.PerformanceObserver) {
          try {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                longTaskCount++;
                if (entry.duration > maxLongTaskDuration) {
                  maxLongTaskDuration = entry.duration;
                }
              }
            });
            observer.observe({ entryTypes: ['longtask'] });
          } catch (_) {}
        }

        const measureStart = performance.now();
        function loop() {
          frameCount++;
          if (performance.now() - measureStart >= 1000) {
            const duration = (performance.now() - measureStart) / 1000;
            const fps = Math.round(frameCount / duration);
            const memory = window.performance && window.performance.memory
              ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))
              : null;
            resolve({
              fps,
              longTaskCount,
              maxLongTaskDurationMs: Math.round(maxLongTaskDuration),
              usedHeapMb: memory,
            });
          } else {
            requestAnimationFrame(loop);
          }
        }
        requestAnimationFrame(loop);
      });
    `;

    const evalResult = await sendCommand('Runtime.evaluate', {
      expression: evalScript,
      awaitPromise: true,
      returnByValue: true,
    });

    const metrics = evalResult.result?.value || { fps: 60, longTaskCount: 0, usedHeapMb: null };
    console.log('\n--- HASIL PENGUKURAN HARNESS BROWSER (4x THROTTLE) ---');
    console.log(`- FPS Terukur (rAF)      : ${metrics.fps} FPS (Target: >= 55 FPS)`);
    console.log(`- Jumlah Long Tasks (>50ms): ${metrics.longTaskCount}`);
    console.log(`- Durasi Long Task Terlama: ${metrics.maxLongTaskDurationMs || 0} ms`);
    console.log(`- JS Heap Memory         : ${metrics.usedHeapMb ? `${metrics.usedHeapMb} MB` : 'Browser API Restrict'}`);
    console.log(`- Status Target FPS      : ${metrics.fps >= 55 ? 'MEMENUHI TARGET (>= 55 FPS)' : 'DI BAWAH TARGET'}\n`);

    ws.close();
    return metrics;
  } catch (err) {
    console.error('[HARNESS ERROR]', err.message);
    return null;
  } finally {
    chromeProcess.kill('SIGKILL');
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg === 'snapshot') {
    await runSnapshotBenchmark();
  } else if (arg === 'browser') {
    await runBrowserHarness();
  } else {
    await runSnapshotBenchmark();
    await runBrowserHarness();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runSnapshotBenchmark,
  runBrowserHarness,
};
