/**
 * Performance Benchmark for SpatialHash
 * Simulates collision queries across 500 racks during 100 continuous drag steps.
 */

import SpatialHash from '../src/spatialHash.js';

function runBenchmark() {
  const sh = new SpatialHash(1000); // 1000 mm cell size
  const rackCount = 500;
  const rackLength = 2400;
  const rackDepth = 1000;

  // Grid layout 25 baris x 20 kolom = 500 rak
  let rackIndex = 0;
  for (let r = 0; r < 25; r++) {
    for (let c = 0; c < 20; c++) {
      const x = c * 3000 + 500;
      const y = r * 2000 + 500;
      sh.insert(`rack-${rackIndex++}`, {
        x,
        y,
        width: rackLength,
        depth: rackDepth,
      });
    }
  }

  // Simulasi drag rack-0 sebanyak 100 langkah (misal digeser sejauh 20 mm per langkah)
  const dragSteps = 100;
  const draggedRect = { x: 500, y: 500, width: rackLength, depth: rackDepth };

  const startHr = process.hrtime.bigint();

  let totalCollisionsDetected = 0;
  for (let i = 0; i < dragSteps; i++) {
    draggedRect.x += 20;
    draggedRect.y += 10;
    // Query collision sambil exclude self ('rack-0')
    const collisions = sh.query(draggedRect, 'rack-0');
    totalCollisionsDetected += collisions.length;
  }

  const endHr = process.hrtime.bigint();
  const totalDurationNs = Number(endHr - startHr);
  const totalDurationMs = totalDurationNs / 1_000_000;
  const avgPerStepMs = totalDurationMs / dragSteps;
  const opsPerSec = Math.round((dragSteps / totalDurationMs) * 1000);

  console.log('=== BENCHMARK SPATIAL HASH (500 RAK) ===');
  console.log(`Jumlah Rak di-Index   : ${sh.size} rak`);
  console.log(`Langkah Drag Diuji    : ${dragSteps} langkah`);
  console.log(`Total Waktu Eksekusi  : ${totalDurationMs.toFixed(3)} ms`);
  console.log(`Rata-rata per Langkah : ${avgPerStepMs.toFixed(4)} ms/langkah`);
  console.log(`Throughput Query      : ${opsPerSec.toLocaleString()} queries/sec`);
  console.log(`Target Anggaran       : < 1.0 ms/langkah (untuk menjamin 60 FPS Canvas)`);
  console.log(
    `Status Performa       : ${avgPerStepMs < 1.0 ? 'MEMENUHI TARGET (SANGAT CEPAT)' : 'MELEBIHI ANGGARAN'}`
  );

  return {
    rackCount: sh.size,
    dragSteps,
    totalDurationMs,
    avgPerStepMs,
    opsPerSec,
  };
}

if (require.main === module) {
  runBenchmark();
}

module.exports = runBenchmark;
