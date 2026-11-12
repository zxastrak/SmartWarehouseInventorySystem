const db = require('../config/db');

const inboundModel = {
  getAll: async () => {
    const sql = `
      SELECT i.*, 
             s.name AS supplier_name_from_db,
             po.po_number AS po_number_from_db,
             po.expected_date AS po_expected_date
      FROM inbound_shipments i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN purchase_orders po ON i.purchase_order_id = po.id
      ORDER BY i.scheduled_date ASC, i.scheduled_time ASC, i.id DESC
    `;
    const [rows] = await db.query(sql);

    // Ambil semua item produk untuk setiap inbound shipment
    for (const inb of rows) {
      let items = await inboundModel.getItemsByInboundId(inb.id);
      if ((!items || items.length === 0) && inb.purchase_order_id) {
        // Fallback dari purchase_order_items jika inbound_shipment_items belum diisi
        const [poItems] = await db.query(
          `SELECT poi.*, 
                  poi.quantity AS ordered_qty, 
                  poi.quantity AS expected_quantity,
                  poi.quantity AS quantity,
                  poi.received_quantity AS accepted_qty,
                  poi.received_quantity AS received_quantity,
                  p.name AS product_name, 
                  p.name AS name,
                  p.sku AS product_sku, 
                  p.sku AS sku, 
                  p.unit AS unit
           FROM purchase_order_items poi
           LEFT JOIN products p ON poi.product_id = p.id
           WHERE poi.purchase_order_id = ?`,
          [inb.purchase_order_id]
        );
        items = poItems;
      }
      inb.items = items || [];
    }

    return rows;
  },

  getById: async (id) => {
    const isNum = !isNaN(Number(id));
    const sql = isNum
      ? 'SELECT * FROM inbound_shipments WHERE id = ? OR inbound_number = ?'
      : 'SELECT * FROM inbound_shipments WHERE inbound_number = ?';
    const params = isNum ? [Number(id), String(id)] : [String(id)];
    const [rows] = await db.query(sql, params);
    return rows;
  },

  getItemsByInboundId: async (inboundId) => {
    const sql = `
      SELECT isi.*, 
             isi.ordered_qty AS expected_quantity,
             isi.ordered_qty AS quantity,
             isi.accepted_qty AS received_quantity,
             p.name AS product_name, 
             p.name AS name,
             p.sku AS product_sku, 
             p.sku AS sku, 
             p.unit AS unit
      FROM inbound_shipment_items isi
      LEFT JOIN products p ON isi.product_id = p.id
      WHERE isi.inbound_shipment_id = ?
    `;
    const [rows] = await db.query(sql, [inboundId]);
    if (rows && rows.length > 0) {
      return rows.map((r) => {
        let parsedBarcodes = [];
        if (r.barcodes) {
          try {
            parsedBarcodes = typeof r.barcodes === 'string' ? JSON.parse(r.barcodes) : r.barcodes;
          } catch (_) {
            parsedBarcodes = String(r.barcodes).split(',').map((s) => s.trim()).filter(Boolean);
          }
        }
        return {
          ...r,
          barcodes: Array.isArray(parsedBarcodes) ? parsedBarcodes : [],
        };
      });
    }

    // Fallback dari purchase_order_items jika shipment terhubung ke PO
    try {
      const [inbRows] = await db.query(
        'SELECT purchase_order_id FROM inbound_shipments WHERE id = ?',
        [inboundId]
      );
      if (inbRows.length > 0 && inbRows[0].purchase_order_id) {
        const [poItems] = await db.query(
          `SELECT poi.*, 
                  poi.quantity AS ordered_qty, 
                  poi.quantity AS expected_quantity,
                  poi.quantity AS quantity,
                  poi.received_quantity AS accepted_qty,
                  poi.received_quantity AS received_quantity,
                  p.name AS product_name, 
                  p.name AS name,
                  p.sku AS product_sku, 
                  p.sku AS sku, 
                  p.unit AS unit
           FROM purchase_order_items poi
           LEFT JOIN products p ON poi.product_id = p.id
           WHERE poi.purchase_order_id = ?`,
          [inbRows[0].purchase_order_id]
        );
        return poItems || [];
      }
    } catch (_) {}

    return [];
  },

  create: async (data) => {
    const {
      inbound_number,
      purchase_order_id,
      po_number,
      supplier_id,
      supplier_name,
      scheduled_date,
      scheduled_time,
      dock,
      assigned_staff,
      carrier,
      reference,
      units,
      items_count,
      status = 'Scheduled',
      notes,
      scheduled_by,
      items = [],
    } = data;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const insertSql = `
        INSERT INTO inbound_shipments 
        (inbound_number, purchase_order_id, po_number, supplier_id, supplier_name, scheduled_date, scheduled_time, dock, assigned_staff, carrier, reference, units, items_count, status, notes, scheduled_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await connection.query(insertSql, [
        inbound_number,
        purchase_order_id || null,
        po_number || null,
        supplier_id || null,
        supplier_name || null,
        scheduled_date || new Date().toISOString().slice(0, 10),
        scheduled_time || '08:00:00',
        dock || 'D-01',
        assigned_staff || 'Staff',
        carrier || null,
        reference || null,
        units || 0,
        items_count || (items.length || 1),
        status,
        notes || null,
        scheduled_by || null,
      ]);

      const shipmentId = result.insertId;

      if (Array.isArray(items) && items.length > 0) {
        const itemValues = items.map((it) => [
          shipmentId,
          it.product_id,
          it.ordered_qty || it.quantity || 0,
          it.accepted_qty || 0,
          it.damaged_qty || 0,
          it.notes || null,
        ]);
        const itemSql = `
          INSERT INTO inbound_shipment_items 
          (inbound_shipment_id, product_id, ordered_qty, accepted_qty, damaged_qty, notes)
          VALUES ?
        `;
        await connection.query(itemSql, [itemValues]);
      }

      await connection.commit();
      return { shipmentId };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  update: async (id, data) => {
    const isNum = !isNaN(Number(id));
    const whereClause = isNum ? 'WHERE id = ? OR inbound_number = ?' : 'WHERE inbound_number = ?';
    const params = [];

    const allowed = [
      'scheduled_date',
      'scheduled_time',
      'dock',
      'assigned_staff',
      'carrier',
      'reference',
      'units',
      'items_count',
      'notes',
      'evidence_url',
    ];
    const setClauses = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (setClauses.length === 0) return { affectedRows: 0 };

    if (isNum) {
      params.push(Number(id), String(id));
    } else {
      params.push(String(id));
    }

    const sql = `UPDATE inbound_shipments SET ${setClauses.join(', ')} ${whereClause}`;
    const [result] = await db.query(sql, params);
    return result;
  },

  updateStatus: async (id, status, notes = null, userId = null) => {
    const isNum = !isNaN(Number(id));
    const whereClause = isNum ? 'WHERE id = ? OR inbound_number = ?' : 'WHERE inbound_number = ?';
    const params = [status];

    let extraSet = '';
    if (status === 'Arrived') {
      extraSet = ', arrived_at = NOW()';
    } else if (status === 'Received') {
      extraSet = ', completed_at = NOW()';
    }

    if (notes !== null && notes !== undefined) {
      extraSet += ', notes = ?';
      params.push(notes);
    }

    if (isNum) {
      params.push(Number(id), String(id));
    } else {
      params.push(String(id));
    }

    const sql = `UPDATE inbound_shipments SET status = ? ${extraSet} ${whereClause}`;
    const [result] = await db.query(sql, params);

    // Otomasi Tugas saat status Arrived (Armada Tiba di Dok):
    if (status === 'Arrived') {
      try {
        const findParams = isNum ? [Number(id), String(id)] : [String(id)];
        const [inbRows] = await db.query(`SELECT * FROM inbound_shipments ${whereClause}`, findParams);
        if (inbRows.length > 0) {
          const shipment = inbRows[0];
          let staffId = null;
          if (shipment.assigned_staff) {
            const [userRows] = await db.query(
              'SELECT id FROM users WHERE name = ? OR email = ? LIMIT 1',
              [shipment.assigned_staff, shipment.assigned_staff]
            );
            if (userRows.length > 0) staffId = userRows[0].id;
          }
          if (!staffId) {
            const [defaultStaff] = await db.query('SELECT id FROM users WHERE role = "staf" LIMIT 1');
            if (defaultStaff.length > 0) staffId = defaultStaff[0].id;
          }

          const taskTitle = `[TUGAS DOK] Inspeksi Fisik & Scan Barcode ${shipment.inbound_number}`;
          const [existTask] = await db.query(
            'SELECT id FROM tasks WHERE title = ? AND status IN ("pending", "in_progress")',
            [taskTitle]
          );
          if (existTask.length === 0) {
            const taskDesc = `Armada pengiriman ${shipment.inbound_number} (${shipment.carrier || 'Logistik'}) telah tiba di Dok ${shipment.dock || 'D-01'}. Silakan lakukan pemeriksaan fisik barang dan pemindaian barcode satuan unit.`;
            await db.query(
              `INSERT INTO tasks (title, description, current_assignee_id, created_by, status, created_at)
               VALUES (?, ?, ?, ?, 'pending', NOW())`,
              [taskTitle, taskDesc, staffId || 6, userId || 1]
            );
          }
        }
      } catch (taskErr) {
        console.error('Error creating auto-task on Inbound Arrived:', taskErr);
      }
    }

    return result;
  },

  inspect: async (id, data = {}) => {
    const { inspector, notes, evidence_url, items = [], status } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const isNum = !isNaN(Number(id));
      const whereClause = isNum ? 'WHERE id = ? OR inbound_number = ?' : 'WHERE inbound_number = ?';
      const findParams = isNum ? [Number(id), String(id)] : [String(id)];

      const [shipments] = await connection.query(
        `SELECT * FROM inbound_shipments ${whereClause}`,
        findParams
      );

      if (shipments.length === 0) {
        throw new Error('Inbound shipment tidak ditemukan');
      }

      const shipment = shipments[0];
      const targetStatus = status || 'Inspected';
      const setClauses = ['status = ?'];
      const updateParams = [targetStatus];

      if (notes !== undefined && notes !== null) {
        setClauses.push('notes = ?');
        updateParams.push(notes);
      }
      if (evidence_url !== undefined && evidence_url !== null) {
        setClauses.push('evidence_url = ?');
        updateParams.push(evidence_url);
      }
      if (inspector) {
        setClauses.push('assigned_staff = ?');
        updateParams.push(inspector);
      }

      // Kumpulkan seluruh barcode hasil scan staf jika ada
      const allBarcodes = Array.isArray(items)
        ? items.flatMap((it) => (Array.isArray(it.barcodes) ? it.barcodes : []))
        : [];
      if (allBarcodes.length > 0) {
        setClauses.push('scanned_barcodes = ?');
        updateParams.push(JSON.stringify(allBarcodes));
      }

      updateParams.push(shipment.id);
      await connection.query(
        `UPDATE inbound_shipments SET ${setClauses.join(', ')} WHERE id = ?`,
        updateParams
      );

      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          if (it.product_id || it.id || it.sku) {
            const barcodeVal = Array.isArray(it.barcodes) && it.barcodes.length > 0
              ? JSON.stringify(it.barcodes)
              : (typeof it.barcodes === 'string' ? it.barcodes : null);

            let updateSql = `UPDATE inbound_shipment_items 
               SET accepted_qty = COALESCE(?, accepted_qty),
                   damaged_qty = COALESCE(?, damaged_qty),
                   notes = COALESCE(?, notes)`;
            const itemParams = [
              it.accepted_qty !== undefined ? it.accepted_qty : null,
              it.damaged_qty !== undefined ? it.damaged_qty : null,
              it.notes !== undefined ? it.notes : null,
            ];

            if (barcodeVal !== null) {
              updateSql += `, barcodes = ?`;
              itemParams.push(barcodeVal);
            }
            updateSql += ` WHERE inbound_shipment_id = ? AND (product_id = ? OR id = ? OR product_id IN (SELECT id FROM products WHERE sku = ?))`;
            itemParams.push(
              shipment.id,
              it.product_id || 0,
              it.id || 0,
              it.sku || '',
            );

            const [updateRes] = await connection.query(updateSql, itemParams);

            if (updateRes.affectedRows === 0 && (it.product_id || it.sku)) {
              await connection.query(
                `INSERT INTO inbound_shipment_items 
                 (inbound_shipment_id, product_id, ordered_qty, accepted_qty, damaged_qty, notes, barcodes)
                 VALUES (
                   ?, 
                   COALESCE(?, (SELECT id FROM products WHERE sku = ? LIMIT 1)),
                   ?, ?, ?, ?, ?
                 )`,
                [
                  shipment.id,
                  it.product_id || null,
                  it.sku || '',
                  it.ordered_qty || it.expected_quantity || it.quantity || 0,
                  it.accepted_qty || 0,
                  it.damaged_qty || 0,
                  it.notes || null,
                  barcodeVal,
                ]
              );
            }
          }
        }
      }

      // 1. Selesaikan tugas inspeksi dok staf sebelumnya
      try {
        await connection.query(
          `UPDATE tasks 
           SET status = 'done', completed_at = NOW() 
           WHERE title LIKE ? AND status IN ('pending', 'in_progress')`,
          [`%${shipment.inbound_number}%`]
        );

        // 2. Terbitkan notifikasi / tugas review untuk Manager
        let managerId = 1;
        const [mgrRows] = await connection.query('SELECT id FROM users WHERE role = "manager" LIMIT 1');
        if (mgrRows.length > 0) managerId = mgrRows[0].id;

        let staffCreatorId = 6;
        if (inspector) {
          const [stfRows] = await connection.query('SELECT id FROM users WHERE name = ? OR email = ? LIMIT 1', [inspector, inspector]);
          if (stfRows.length > 0) staffCreatorId = stfRows[0].id;
        }

        const reviewTitle = `[REVIEW & ACC] Pengiriman ${shipment.inbound_number} Siap Di-ACC`;
        const [existReview] = await connection.query(
          'SELECT id FROM tasks WHERE title = ? AND status = "pending"',
          [reviewTitle]
        );
        if (existReview.length === 0) {
          const reviewDesc = `Pemeriksaan fisik dan pemindaian barcode ${shipment.inbound_number} telah selesai dilaporkan oleh ${inspector || 'Staf Dok Lapangan'}. Silakan periksa hasil aktual dan berikan ACC di Web.`;
          await connection.query(
            `INSERT INTO tasks (title, description, current_assignee_id, created_by, status, created_at)
             VALUES (?, ?, ?, ?, 'pending', NOW())`,
            [reviewTitle, reviewDesc, managerId, staffCreatorId]
          );
        }
      } catch (tErr) {
        console.error('Error auto-managing tasks on Inbound inspect:', tErr);
      }

      await connection.commit();
      return { success: true, shipmentId: shipment.id };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  completeReceiving: async (id, itemsToReceive, notes = '', userId = null) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const isNum = !isNaN(Number(id));
      const [shipments] = await connection.query(
        isNum
          ? 'SELECT * FROM inbound_shipments WHERE id = ? OR inbound_number = ?'
          : 'SELECT * FROM inbound_shipments WHERE inbound_number = ?',
        isNum ? [Number(id), String(id)] : [String(id)]
      );

      if (shipments.length === 0) {
        throw new Error('Inbound shipment tidak ditemukan');
      }

      const shipment = shipments[0];

      // Strict validation guard: Wajib Inspected terlebih dahulu
      if (shipment.status !== 'Inspected') {
        throw new Error('Inbound shipment belum diinspeksi oleh staf dok. Inspeksi fisik dan pemindaian barcode wajib diselesaikan terlebih dahulu.');
      }

      let totalAccepted = 0;

      for (const item of itemsToReceive) {
        const qty = Number(item.accepted_qty) || 0;
        const damaged = Number(item.damaged_qty) || 0;
        if (item.product_id) {
          if (qty > 0) {
            totalAccepted += qty;

            // 1. Tambah stok produk dan alokasikan lokasi rak jika ada
            if (item.location_id) {
              await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity + ?, location_id = ? WHERE id = ?',
                [qty, item.location_id, item.product_id]
              );
            } else {
              await connection.query(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
                [qty, item.product_id]
              );
            }

            // 2. Catat stock transaction tipe 'in'
            await connection.query(
              'INSERT INTO stock_transactions (product_id, user_id, type, quantity, notes) VALUES (?, ?, "in", ?, ?)',
              [item.product_id, userId || shipment.scheduled_by || 1, qty, item.notes || `Penerimaan barang dari Inbound ${shipment.inbound_number}`]
            );
          }

          // 3. Catat di inbound_shipment_items
          await connection.query(
            `UPDATE inbound_shipment_items 
             SET accepted_qty = ?, damaged_qty = ?, notes = COALESCE(?, notes)
             WHERE inbound_shipment_id = ? AND product_id = ?`,
            [qty, damaged, item.notes || null, shipment.id, item.product_id]
          );
        }
      }

      // Update status shipment jadi 'Received'
      await connection.query(
        'UPDATE inbound_shipments SET status = "Received", accepted_units = ?, completed_at = NOW(), notes = COALESCE(?, notes) WHERE id = ?',
        [totalAccepted, notes || null, shipment.id]
      );

      // Jika ada PO terhubung, update PO jika perlu
      if (shipment.purchase_order_id) {
        await connection.query(
          'UPDATE purchase_orders SET status = "received" WHERE id = ?',
          [shipment.purchase_order_id]
        );
      }

      // Selesaikan tugas review manager untuk pengiriman ini
      try {
        await connection.query(
          `UPDATE tasks 
           SET status = 'done', completed_at = NOW() 
           WHERE title LIKE ? AND status IN ('pending', 'in_progress')`,
          [`%${shipment.inbound_number}%`]
        );
      } catch (closeErr) {
        console.error('Error completing review task on completeReceiving:', closeErr);
      }

      await connection.commit();
      return { success: true, acceptedUnits: totalAccepted };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  delete: async (id) => {
    const isNum = !isNaN(Number(id));
    const whereClause = isNum ? 'WHERE id = ? OR inbound_number = ?' : 'WHERE inbound_number = ?';
    const params = isNum ? [Number(id), String(id)] : [String(id)];

    const [result] = await db.query(`DELETE FROM inbound_shipments ${whereClause}`, params);
    return result;
  },
};

module.exports = inboundModel;
