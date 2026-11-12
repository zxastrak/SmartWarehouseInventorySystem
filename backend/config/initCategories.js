const db = require('./db');

async function initCategories() {
  try {
    const [rows] = await db.query('SELECT COUNT(*) as count FROM categories');
    if (rows && rows[0] && rows[0].count === 0) {
      console.log('Master data categories kosong. Mengisi kategori default...');
      const defaultCategories = [
      ];
      for (const [name, description] of defaultCategories) {
        await db.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
      }
      console.log('Kategori default berhasil ditambahkan ke database.');
    }

    // Pastikan kolom pendukung barcode dan hasil inspeksi staf tersedia di tabel inbound
    try {
      await db.query('ALTER TABLE inbound_shipment_items ADD COLUMN barcodes TEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE inbound_shipments ADD COLUMN scanned_barcodes LONGTEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE inbound_shipments ADD COLUMN inspector VARCHAR(100) NULL');
    } catch (_) {}

    // Pastikan kolom pendukung dok, barcode, dan inspeksi staf tersedia di tabel outbound
    try {
      await db.query("ALTER TABLE outbound_shipments MODIFY COLUMN status ENUM('Scheduled','Arrived','Inspecting','Inspected','Shipped','Issue','Picking','Packing','Ready to Ship') NOT NULL DEFAULT 'Scheduled'");
    } catch (_) {}
    try {
      await db.query("ALTER TABLE outbound_shipments ADD COLUMN dock VARCHAR(20) NULL DEFAULT '1'");
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN arrived_at DATETIME NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN completed_at DATETIME NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN evidence_url LONGTEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN scanned_barcodes LONGTEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN inspector VARCHAR(100) NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipments ADD COLUMN fulfilled_units INT DEFAULT 0');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipment_items ADD COLUMN ordered_qty INT NOT NULL DEFAULT 0');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipment_items ADD COLUMN fulfilled_qty INT NOT NULL DEFAULT 0');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipment_items ADD COLUMN damaged_qty INT NOT NULL DEFAULT 0');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipment_items ADD COLUMN notes TEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE outbound_shipment_items ADD COLUMN barcodes TEXT NULL');
    } catch (_) {}

    // Pastikan kolom image_url dan description tersedia di tabel products
    try {
      await db.query('ALTER TABLE products ADD COLUMN image_url TEXT NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE products ADD COLUMN description TEXT NULL');
    } catch (_) {}

    // Pastikan kolom role_title dan warehouse tersedia di tabel users untuk profil staf
    try {
      await db.query('ALTER TABLE users ADD COLUMN role_title VARCHAR(100) NULL');
    } catch (_) {}
    try {
      await db.query('ALTER TABLE users ADD COLUMN warehouse VARCHAR(100) NULL');
    } catch (_) {}

    // Auto-enrich: Isi foto default untuk produk yang belum memiliki foto
    try {
      const [prods] = await db.query('SELECT id, name, sku, category_id, image_url FROM products WHERE image_url IS NULL OR image_url = ""');
      if (prods && prods.length > 0) {
        const defaultImages = [
          'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80', // Barcode scanner / box
          'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=400&auto=format&fit=crop&q=80', // Pallet rack warehouse
          'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&auto=format&fit=crop&q=80', // Cardboard storage box
          'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80', // Circuit / Electronics
          'https://images.unsplash.com/photo-1578873375953-61bba1a4732d?w=400&auto=format&fit=crop&q=80', // Safety PPE helmet
          'https://images.unsplash.com/photo-1586528116493-a029325540fa?w=400&auto=format&fit=crop&q=80', // Forklift logistics
          'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=400&auto=format&fit=crop&q=80', // Work gloves / tools
        ];
        for (let i = 0; i < prods.length; i++) {
          const img = defaultImages[i % defaultImages.length];
          await db.query('UPDATE products SET image_url = ? WHERE id = ?', [img, prods[i].id]);
        }
        console.log(`Enrich ${prods.length} produk dengan foto default warehouse.`);
      }
    } catch (enrichErr) {
      console.warn('Auto-enrich product images warning:', enrichErr.message);
    }
  } catch (err) {
    console.error('Inisialisasi kategori database dilewati:', err.message);
  }
}

module.exports = initCategories;
