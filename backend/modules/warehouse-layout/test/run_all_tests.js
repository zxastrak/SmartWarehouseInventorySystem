/**
 * Master Test Runner for Warehouse Layout & Storage Mapping
 * Runs all unit and integration test suites sequentially to avoid connection pool conflicts.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { name: '1. Shared Layout-Core Geometry & Rules', cmd: 'node', args: ['--test', 'shared/layout-core/test/geometry.test.js', 'shared/layout-core/test/spatialHash.test.js', 'shared/layout-core/test/structureValidation.test.js', 'shared/layout-core/test/code.test.js'] },
  { name: '2. Web Layout UI & Engine Tests', cmd: 'node', args: ['--test', 'web/src/features/warehouse-layout/test/engine.test.js', 'web/src/features/warehouse-layout/test/editorHistory.test.js', 'web/src/features/warehouse-layout/test/rackElevation.test.js', 'web/src/features/warehouse-layout/test/locationGeneratorUi.test.js', 'web/src/features/warehouse-layout/test/locationDirectoryUi.test.js', 'web/src/features/warehouse-layout/test/pathfindingUi.test.js'] },
  { name: '3. Backend API CRUD & Geometry Validation', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/apiCrud.test.js'] },
  { name: '4. Backend Snapshot, Batch Patch & Versioning', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/snapshotBatch.test.js'] },
  { name: '5. Backend Rack Physical Structure & Matrix', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/rackStructure.test.js'] },
  { name: '6. Backend Bulk Location Generator', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/locationGenerator.test.js'] },
  { name: '7. Backend Location Directory & Inspector', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/locationDirectory.test.js'] },
  { name: '8. Backend Database Integration & Migration Cycle', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/databaseIntegration.test.js'] },
  { name: '9. Shared Layout-Core Pathfinding & Routing', cmd: 'node', args: ['--test', 'shared/layout-core/test/occupancyGrid.test.js', 'shared/layout-core/test/navGraph.test.js', 'shared/layout-core/test/pathfinder.test.js', 'shared/layout-core/test/gridBuilder.test.js'] },
  { name: '10. Backend Pathfinding REST API', cmd: 'node', args: ['--test', 'backend/modules/warehouse-layout/test/pathApi.test.js'] }
];

console.log('================================================================');
console.log('MASTER TEST SUITE RUNNER: WAREHOUSE LAYOUT & STORAGE MAPPING');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  process.stdout.write(`Menjalankan [${suite.name}]... `);
  const start = Date.now();
  const res = spawnSync(suite.cmd, suite.args, {
    stdio: 'pipe',
    encoding: 'utf8',
    shell: true
  });
  const dur = ((Date.now() - start) / 1000).toFixed(2);

  if (res.status === 0) {
    console.log(`LULUS (${dur}s)`);
    // Hitung jumlah tests dari stdout
    const passMatch = res.stdout.match(/ℹ pass (\d+)/) || res.stdout.match(/✔/g);
    const count = passMatch && passMatch[1] ? parseInt(passMatch[1], 10) : (res.stdout.match(/✔/g) || []).length;
    totalPassed += count;
    results.push({ name: suite.name, status: 'PASS', count, duration: `${dur}s` });
  } else {
    console.log(`GAGAL (${dur}s)`);
    console.error(res.stdout);
    console.error(res.stderr);
    totalFailed++;
    results.push({ name: suite.name, status: 'FAIL', duration: `${dur}s` });
  }
}

console.log('\n================================================================');
console.log('RINGKASAN HASIL MASTER TEST SUITE:');
console.log('================================================================');
results.forEach((r) => {
  console.log(`- ${r.name.padEnd(52)}: ${r.status} (${r.count || 0} tests, ${r.duration})`);
});
console.log('----------------------------------------------------------------');
console.log(`TOTAL PENGUJIAN: ${totalPassed} LULUS, ${totalFailed} GAGAL`);
console.log('================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
