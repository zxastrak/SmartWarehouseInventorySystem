/**
 * Database Migration Runner for Warehouse Layout & Storage Mapping
 * Supports UP and DOWN migrations with clean rollback.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_warehouse_db',
  port: Number(process.env.DB_PORT) || 3306,
  multipleStatements: true,
};

async function getAdminConnection() {
  return await mysql.createConnection(dbConfig);
}

/**
 * Executes UP migration
 */
async function runMigrationUp() {
  const conn = await getAdminConnection();
  try {
    console.log('[MIGRATION] Menjalankan migration UP untuk Warehouse Layout...');

    const upSqlPath = path.join(
      __dirname,
      'migrations',
      '001_create_warehouse_layout_tables.sql'
    );
    const sql = fs.readFileSync(upSqlPath, 'utf8');

    await conn.query(sql);
    console.log('[MIGRATION] Tabel-tabel dan trigger berhasil dibuat.');

    // 1. Buat default warehouse jika belum ada
    const [whRows] = await conn.query(
      'SELECT id FROM warehouses WHERE code = ?',
      ['WH-MAIN']
    );

    let defaultWarehouseId;
    if (whRows.length === 0) {
      const [insWh] = await conn.query(
        `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
         VALUES ('WH-MAIN', 'Main Warehouse', 50000, 80000, 10000, 1)`
      );
      defaultWarehouseId = insWh.insertId;
      console.log(`[MIGRATION] Default warehouse dibuat (ID: ${defaultWarehouseId}).`);
    } else {
      defaultWarehouseId = whRows[0].id;
    }

    // 2. Daftarkan kode dari tabel locations lama ke code_registry agar tidak terjadi duplikasi kode
    try {
      const [legacyLocs] = await conn.query('SELECT location_code FROM locations');
      let registeredCount = 0;
      for (const loc of legacyLocs) {
        const norm = loc.location_code.trim().toUpperCase();
        const [regRows] = await conn.query(
          `INSERT IGNORE INTO code_registry (warehouse_id, code_type, normalized_code)
           VALUES (?, 'LOCATION', ?)`,
          [defaultWarehouseId, norm]
        );
        if (regRows.affectedRows > 0) {
          registeredCount++;
        }
      }
      if (registeredCount > 0) {
        console.log(`[MIGRATION] ${registeredCount} kode lokasi lama didaftarkan ke code_registry.`);
      }
    } catch (e) {
      console.warn('[MIGRATION] Peringatan sinkronisasi locations lama:', e.message);
    }

    console.log('[MIGRATION] Migration UP selesai dengan sukses.');
    return true;
  } catch (err) {
    console.error('[MIGRATION ERROR] Gagal menjalankan UP:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

/**
 * Executes DOWN migration (Rollback)
 */
async function runMigrationDown() {
  const conn = await getAdminConnection();
  try {
    console.log('[MIGRATION] Menjalankan migration DOWN (Rollback)...');

    const downSqlPath = path.join(
      __dirname,
      'migrations',
      '001_create_warehouse_layout_tables_down.sql'
    );
    const sql = fs.readFileSync(downSqlPath, 'utf8');

    await conn.query(sql);
    console.log('[MIGRATION] Migration DOWN (Rollback) selesai dengan sukses.');
    return true;
  } catch (err) {
    console.error('[MIGRATION ERROR] Gagal menjalankan DOWN:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

// CLI handler
if (require.main === module) {
  const command = process.argv[2] ? process.argv[2].toLowerCase() : 'up';
  if (command === 'down') {
    runMigrationDown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    runMigrationUp()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = {
  runMigrationUp,
  runMigrationDown,
};
