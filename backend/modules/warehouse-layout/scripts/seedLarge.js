/**
 * Large Deterministic Seed Script for Performance Testing
 * Creates: 1 Warehouse, 4 Zones, 10 Aisles, 500 Racks, and ~100,000 Storage Locations.
 * Features:
 * - Blocked in Production
 * - Deterministic PRNG
 * - Chunked / Set-based batch insertion (5,000 rows/batch)
 * - Code Registry integration
 * - Idempotent
 */

const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const { renderPattern } = require('../../../../shared/layout-core/src/index');

// 1. SAFETY GUARD: Dilarang keras di production
if (process.env.NODE_ENV === 'production') {
  console.error('[SEED BLOCKED] Skrip seed skala besar dilarang dijalankan di lingkungan production!');
  process.exit(1);
}

// 2. Deterministic PRNG (Mulberry32)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261118);

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_warehouse_db',
  port: Number(process.env.DB_PORT) || 3306,
};

async function runLargeSeed() {
  const startTime = Date.now();
  console.log('========================================================');
  console.log('MEMULAI SEED BESAR (500 RAK & ~100.000 LOKASI PENYIMPANAN)');
  console.log('========================================================\n');

  const conn = await mysql.createConnection(dbConfig);
  try {
    const whCode = 'WH-PERF-500';

    // 1. Bersihkan data seeder sebelumnya jika ada (Idempotent)
    const [existingWh] = await conn.query('SELECT id FROM warehouses WHERE code = ?', [whCode]);
    if (existingWh.length > 0) {
      const oldId = existingWh[0].id;
      console.log(`[CLEANUP] Menghapus data uji sebelumnya untuk warehouse ID: ${oldId}...`);
      await conn.query('DELETE FROM rack_aisle_access WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [oldId]);
      await conn.query('DELETE FROM storage_locations WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM rack_bay_level_configs WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [oldId]);
      await conn.query('DELETE FROM rack_bays WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [oldId]);
      await conn.query('DELETE FROM rack_levels WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)', [oldId]);
      await conn.query('DELETE FROM racks WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM aisles WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM zones WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM layout_objects WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM code_registry WHERE warehouse_id = ?', [oldId]);
      await conn.query('DELETE FROM warehouses WHERE id = ?', [oldId]);
      console.log('[CLEANUP] Selesai membersihkan data lama.\n');
    }

    // 2. Buat Master Warehouse
    console.log('[1/5] Membuat Warehouse Master (80m x 100m)...');
    const [whRes] = await conn.query(
      `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
       VALUES (?, 'Warehouse Skala Besar Benchmark', 80000, 100000, 12000, 1)`,
      [whCode]
    );
    const warehouseId = whRes.insertId;

    // 3. Buat 4 Zona
    console.log('[2/5] Membuat 4 Zona...');
    const zonesData = [
      [warehouseId, 'ZONE-A', 'Zona Kering A', '#5c732b', 0, 0, 40000, 50000],
      [warehouseId, 'ZONE-B', 'Zona Kering B', '#3e5510', 40000, 0, 40000, 50000],
      [warehouseId, 'ZONE-C', 'Zona Pendingin C', '#0284c7', 0, 50000, 40000, 50000],
      [warehouseId, 'ZONE-D', 'Zona Buffer D', '#d97706', 40000, 50000, 40000, 50000],
    ];
    await conn.query(
      `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
       VALUES ?`,
      [zonesData]
    );
    const [zoneRows] = await conn.query('SELECT id, zone_code, x_mm, y_mm, width_mm, length_mm FROM zones WHERE warehouse_id = ?', [warehouseId]);

    // 4. Buat 10 Lorong (Aisles)
    console.log('[3/5] Membuat 10 Lorong Akses...');
    const aislesData = [];
    for (let i = 1; i <= 10; i++) {
      const code = `A-${String(i).padStart(2, '0')}`;
      const x = i * 7500;
      aislesData.push([warehouseId, code, `Lorong ${i}`, x, 2000, 2000, 96000, 'two_way']);
    }
    await conn.query(
      `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm, direction)
       VALUES ?`,
      [aislesData]
    );
    const [aisleRows] = await conn.query('SELECT id, aisle_code FROM aisles WHERE warehouse_id = ?', [warehouseId]);

    // 5. Buat 500 Rak (20 kolom x 25 baris)
    console.log('[4/5] Membuat 500 Rak beserta struktur Bay & Level...');
    const rackInsertValues = [];
    const rackRegistryValues = [];

    let rackIndex = 1;
    for (let r = 0; r < 25; r++) {
      for (let c = 0; c < 20; c++) {
        const code = `RACK-${String(rackIndex).padStart(3, '0')}`;
        const x = c * 3800 + 1000;
        const y = r * 3800 + 1000;
        const rotation = (c % 2 === 0 ? 0 : 90);

        // Cari zona yang melingkupi
        let matchedZoneId = zoneRows[0].id;
        for (const z of zoneRows) {
          if (x >= z.x_mm && x < z.x_mm + z.width_mm && y >= z.y_mm && y < z.y_mm + z.length_mm) {
            matchedZoneId = z.id;
            break;
          }
        }

        rackInsertValues.push([
          warehouseId,
          matchedZoneId,
          code,
          x,
          y,
          2400, // length_mm
          1000, // depth_mm
          4500, // height_mm
          rotation,
          5000.00, // max_weight_kg
          12.5000, // max_volume_m3
          1,
        ]);

        rackRegistryValues.push([warehouseId, 'RACK', code]);
        rackIndex++;
      }
    }

    // Insert 500 rak
    await conn.query(
      `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, max_weight_kg, max_volume_m3, version)
       VALUES ?`,
      [rackInsertValues]
    );

    // Registrasi kode rak ke code_registry
    await conn.query(
      `INSERT INTO code_registry (warehouse_id, code_type, normalized_code)
       VALUES ?`,
      [rackRegistryValues]
    );

    const [allRacks] = await conn.query(
      'SELECT id, rack_code, length_mm, depth_mm, height_mm FROM racks WHERE warehouse_id = ? ORDER BY id ASC',
      [warehouseId]
    );

    // Buat Bays dan Levels per rak (5 bays x 5 levels per rak)
    const baysData = [];
    const levelsData = [];

    for (const r of allRacks) {
      // 5 Bay per rak
      const bayWidth = Math.floor(r.length_mm / 5);
      for (let b = 1; b <= 5; b++) {
        baysData.push([r.id, b, bayWidth]);
      }

      // 5 Level per rak
      for (let l = 1; l <= 5; l++) {
        const hFloor = (l - 1) * 800 + 300;
        levelsData.push([r.id, l, hFloor, 1000.00, 2.5000]);
      }
    }

    // Insert bays in batch
    await conn.query('INSERT INTO rack_bays (rack_id, bay_number, width_mm) VALUES ?', [baysData]);
    // Insert levels in batch
    await conn.query('INSERT INTO rack_levels (rack_id, level_number, height_from_floor_mm, max_weight_kg, max_volume_m3) VALUES ?', [levelsData]);

    const [allBays] = await conn.query(
      'SELECT id, rack_id, bay_number FROM rack_bays WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)',
      [warehouseId]
    );
    const [allLevels] = await conn.query(
      'SELECT id, rack_id, level_number FROM rack_levels WHERE rack_id IN (SELECT id FROM racks WHERE warehouse_id = ?)',
      [warehouseId]
    );

    // Susun peta bay dan level per rack
    const rackBaysMap = new Map();
    for (const b of allBays) {
      if (!rackBaysMap.has(b.rack_id)) rackBaysMap.set(b.rack_id, []);
      rackBaysMap.get(b.rack_id).push(b);
    }

    const rackLevelsMap = new Map();
    for (const l of allLevels) {
      if (!rackLevelsMap.has(l.rack_id)) rackLevelsMap.set(l.rack_id, []);
      rackLevelsMap.get(l.rack_id).push(l);
    }

    // 6. Buat Configs & ~100.000 Storage Locations
    console.log('[5/5] Membuat 100.000 Storage Locations (Batch Chunks 5.000 baris)...');

    const configsBatch = [];
    let locationRowsBatch = [];
    let registryRowsBatch = [];
    let totalLocationsCount = 0;
    const CHUNK_SIZE = 5000;

    for (let i = 0; i < allRacks.length; i++) {
      const rack = allRacks[i];
      const bays = rackBaysMap.get(rack.id) || [];
      const levels = rackLevelsMap.get(rack.id) || [];
      const assignedAisle = aisleRows[i % aisleRows.length].aisle_code;

      for (const bay of bays) {
        for (const level of levels) {
          // Variasi jumlah posisi: (bay + level) % 3: 0 -> 6, 1 -> 8, 2 -> 10. Rata-rata = 8.
          // 500 rak * 5 bay * 5 level * 8 = tepat 100.000 lokasi!
          const variant = (bay.bay_number + level.level_number) % 3;
          const posCount = variant === 0 ? 6 : variant === 1 ? 8 : 10;

          configsBatch.push([rack.id, bay.id, level.id, posCount, posCount]);

          for (let p = 1; p <= posCount; p++) {
            const locCode = renderPattern({
              aisle: assignedAisle,
              rack: rack.rack_code,
              bay: bay.bay_number,
              level: level.level_number,
              position: p,
            });

            locationRowsBatch.push([
              warehouseId,
              rack.id,
              bay.id,
              level.id,
              p,
              locCode,
              1, // pattern_version
              400, // usable_width_mm
              900, // usable_depth_mm
              700, // usable_height_mm
              120.00, // max_weight_kg
              0.2500, // max_volume_m3
              'ACTIVE',
            ]);

            registryRowsBatch.push([warehouseId, 'LOCATION', locCode]);
            totalLocationsCount++;

            // Jika batch mencapai CHUNK_SIZE, flush ke DB
            if (locationRowsBatch.length >= CHUNK_SIZE) {
              await conn.query(
                `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code, pattern_version, usable_width_mm, usable_depth_mm, usable_height_mm, max_weight_kg, max_volume_m3, manual_status)
                 VALUES ?`,
                [locationRowsBatch]
              );
              await conn.query(
                `INSERT INTO code_registry (warehouse_id, code_type, normalized_code)
                 VALUES ?`,
                [registryRowsBatch]
              );
              locationRowsBatch = [];
              registryRowsBatch = [];
              process.stdout.write(`... ${totalLocationsCount.toLocaleString()} lokasi tersimpan\r`);
            }
          }
        }
      }
    }

    // Flush sisa baris terakhir jika ada
    if (locationRowsBatch.length > 0) {
      await conn.query(
        `INSERT INTO storage_locations (warehouse_id, rack_id, bay_id, level_id, position_number, location_code, pattern_version, usable_width_mm, usable_depth_mm, usable_height_mm, max_weight_kg, max_volume_m3, manual_status)
         VALUES ?`,
        [locationRowsBatch]
      );
      await conn.query(
        `INSERT INTO code_registry (warehouse_id, code_type, normalized_code)
         VALUES ?`,
        [registryRowsBatch]
      );
    }

    // Insert all configs
    await conn.query(
      `INSERT INTO rack_bay_level_configs (rack_id, bay_id, level_id, position_count, last_issued_position_number)
       VALUES ?`,
      [configsBatch]
    );

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n========================================================`);
    console.log('SEED BESAR SELESAI DENGAN SUKSES!');
    console.log(`- Warehouse ID         : ${warehouseId} (${whCode})`);
    console.log(`- Total Zona           : ${zoneRows.length} zona`);
    console.log(`- Total Lorong (Aisles): ${aisleRows.length} lorong`);
    console.log(`- Total Rak            : ${allRacks.length} rak`);
    console.log(`- Total Bay Fisik      : ${allBays.length} bay`);
    console.log(`- Total Level Fisik    : ${allLevels.length} level`);
    console.log(`- Total Storage Bins   : ${totalLocationsCount.toLocaleString()} lokasi`);
    console.log(`- Waktu Eksekusi Total : ${elapsedSeconds} detik`);
    console.log('========================================================');

    return {
      warehouseId,
      whCode,
      rackCount: allRacks.length,
      locationCount: totalLocationsCount,
      elapsedSeconds,
    };
  } catch (err) {
    console.error('\n[SEED ERROR] Terjadi kegagalan saat proses seed besar:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runLargeSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runLargeSeed;
