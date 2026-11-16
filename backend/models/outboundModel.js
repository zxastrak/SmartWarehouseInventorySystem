const db = require('../config/db');

const outboundModel = {
  getItemsByOutboundId: async (outboundId) => {
    const sql = `
      SELECT osi.*,
             COALESCE(osi.ordered_qty, osi.quantity) AS requested_qty,
             COALESCE(osi.ordered_qty, osi.quantity) AS ordered_qty,
             COALESCE(osi.ordered_qty, osi.quantity) AS expected_quantity,
             COALESCE(osi.ordered_qty, osi.quantity) AS quantity,
             COALESCE(osi.fulfilled_qty, osi.shipped_qty) AS picked_qty,
             COALESCE(osi.fulfilled_qty, osi.shipped_qty) AS fulfilled_qty,
             COALESCE(osi.fulfilled_qty, osi.shipped_qty) AS accepted_qty,
             COALESCE(osi.fulfilled_qty, osi.shipped_qty) AS shipped_qty,
             osi.damaged_qty AS damaged_qty,
             p.name AS product_name,
             p.name AS name,
             p.sku AS product_sku,
             p.sku AS sku,
             p.unit AS unit,
             p.stock_quantity AS current_stock,
             p.price AS price,
             p.image_url AS image_url,
             l.location_code AS rack
      FROM outbound_shipment_items osi
      JOIN products p ON osi.product_id = p.id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE osi.outbound_shipment_id = ?
    `;
    const [rows] = await db.query(sql, [outboundId]);
    if (rows && rows.length > 0) {
      return rows.map((r) => {
        let parsedBarcodes = [];
        if (r.barcodes) {
          try {
            parsedBarcodes = JSON.parse(r.barcodes);
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
    return rows;
  },

  getAll: async () => {
    const sql = `
      SELECT o.*, u.name AS creator_name
      FROM outbound_shipments o
      LEFT JOIN users u ON o.created_by = u.id
      ORDER BY o.scheduled_date ASC, o.scheduled_time ASC, o.id DESC
    `;
    const [rows] = await db.query(sql);

    for (const out of rows) {
      const items = await outboundModel.getItemsByOutboundId(out.id);
      out.items = items || [];
      out.items_count = items.length;
      out.units = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      out.dock = out.dock || '1';
    }

    return rows;
  },

  getById: async (id) => {
    const isNum = !isNaN(Number(id));
    const sql = isNum
      ? 'SELECT * FROM outbound_shipments WHERE id = ? OR outbound_number = ?'
      : 'SELECT * FROM outbound_shipments WHERE outbound_number = ?';
    const params = isNum ? [Number(id), String(id)] : [String(id)];
    const [rows] = await db.query(sql, params);

    if (rows.length > 0) {
      const items = await outboundModel.getItemsByOutboundId(rows[0].id);
      rows[0].items = items || [];
      rows[0].items_count = items.length;
      rows[0].units = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      rows[0].dock = rows[0].dock || '1';
    }

    return rows;
  },

  create: async (data) => {
    const {
      outbound_number,
      outbound_type = 'Customer order',
      destination,
      reference,
      scheduled_date,
      scheduled_time,
      assigned_staff,
      dock = '1',
      status = 'Scheduled',
      units = 0,
      items_count = 1,
      priority = 'Normal',
      notes,
      carrier,
      tracking_number,
      created_by,
      items = [],
    } = data;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const insertSql = `
        INSERT INTO outbound_shipments
        (outbound_number, outbound_type, destination, reference, scheduled_date, scheduled_time, assigned_staff, dock, status, units, items_count, priority, notes, carrier, tracking_number, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await connection.query(insertSql, [
        outbound_number,
        outbound_type,
        destination || 'Main Customer',
        reference || null,
        scheduled_date || new Date().toISOString().slice(0, 10),
        scheduled_time || '09:00:00',
        assigned_staff || 'Staf Dok',
        dock || '1',
        status,
        units || 0,
        items_count || 1,
        priority,
        notes || null,
        carrier || null,
        tracking_number || null,
        created_by || null,
      ]);

      const shipmentId = result.insertId;

      if (Array.isArray(items) && items.length > 0) {
        const itemValues = items.map((it) => {
          const qty = Number(it.quantity) || Number(it.ordered_qty) || 0;
          return [
            shipmentId,
            it.product_id,
            qty,
            qty,
            0,
            0,
            0,
            null,
            null,
          ];
        });
        const itemSql = `
          INSERT INTO outbound_shipment_items
          (outbound_shipment_id, product_id, quantity, ordered_qty, shipped_qty, fulfilled_qty, damaged_qty, notes, barcodes)
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

  inspect: async (id, data = {}) => {
    const { inspector, notes, evidence_url, items = [], status } = data;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const isNum = !isNaN(Number(id));
      const whereClause = isNum ? 'WHERE id = ? OR outbound_number = ?' : 'WHERE outbound_number = ?';
      const findParams = isNum ? [Number(id), String(id)] : [String(id)];

      const [shipments] = await connection.query(
        `SELECT * FROM outbound_shipments ${whereClause}`,
        findParams
      );

      if (shipments.length === 0) {
        throw new Error('Outbound shipment tidak ditemukan');
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
        setClauses.push('inspector = ?');
        updateParams.push(inspector);
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

      let totalFulfilled = 0;
      if (Array.isArray(items) && items.length > 0) {
        for (const it of items) {
          const fulfilled = Number(it.fulfilled_qty ?? it.accepted_qty ?? it.quantity ?? 0);
          const damaged = Number(it.damaged_qty ?? 0);
          const barcodeJson = it.barcodes ? JSON.stringify(it.barcodes) : null;
          totalFulfilled += fulfilled;

          if (it.id) {
            await connection.query(
              `UPDATE outbound_shipment_items 
               SET fulfilled_qty = ?, shipped_qty = ?, damaged_qty = ?, barcodes = COALESCE(?, barcodes)
               WHERE id = ? AND outbound_shipment_id = ?`,
              [fulfilled, fulfilled, damaged, barcodeJson, it.id, shipment.id]
            );
          } else if (it.product_id) {
            await connection.query(
              `UPDATE outbound_shipment_items 
               SET fulfilled_qty = ?, shipped_qty = ?, damaged_qty = ?, barcodes = COALESCE(?, barcodes)
               WHERE outbound_shipment_id = ? AND product_id = ?`,
              [fulfilled, fulfilled, damaged, barcodeJson, shipment.id, it.product_id]
            );
          }
        }
      }

      if (totalFulfilled > 0) {
        setClauses.push('fulfilled_units = ?');
        updateParams.push(totalFulfilled);
      }

      if (isNum) {
        updateParams.push(Number(id), String(id));
      } else {
        updateParams.push(String(id));
      }

      await connection.query(
        `UPDATE outbound_shipments SET ${setClauses.join(', ')} ${whereClause}`,
        updateParams
      );

      await connection.commit();
      return { success: true, shipmentId: shipment.id, status: targetStatus, totalFulfilled };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  dispatchShipment: async (id, { carrier, tracking_number, items = [], notes = '', user_id = null } = {}) => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const isNum = !isNaN(Number(id));
      const whereClause = isNum ? 'WHERE id = ? OR outbound_number = ?' : 'WHERE outbound_number = ?';
      const findParams = isNum ? [Number(id), String(id)] : [String(id)];

      const [shipments] = await connection.query(`SELECT * FROM outbound_shipments ${whereClause}`, findParams);
      if (shipments.length === 0) {
        throw new Error('Outbound shipment tidak ditemukan');
      }

      const shipment = shipments[0];
      const shipmentId = shipment.id;
      const actorId = user_id || shipment.created_by || 1;

      // Ambil items yang sudah terdaftar di outbound
      const [existingItems] = await connection.query(
        `SELECT osi.*, p.sku FROM outbound_shipment_items osi 
         JOIN products p ON osi.product_id = p.id 
         WHERE osi.outbound_shipment_id = ?`,
        [shipmentId]
      );

      let totalShippedUnits = 0;

      for (const existItem of existingItems) {
        // Cari kuantitas yang disetujui / di-ACC dari input items atau dari database
        const matchInput = Array.isArray(items)
          ? items.find((i) => i.id === existItem.id || i.product_id === existItem.product_id)
          : null;

        const qty = matchInput
          ? Number(matchInput.fulfilled_qty ?? matchInput.accepted_qty ?? matchInput.quantity ?? existItem.fulfilled_qty ?? existItem.quantity)
          : Number(existItem.fulfilled_qty || existItem.quantity || 0);

        const productId = existItem.product_id;

        if (productId && qty > 0) {
          totalShippedUnits += qty;

          // 1. Potong stok produk di master products
          await connection.query(
            'UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?',
            [qty, productId]
          );

          // 2. Catat ke stock_transactions (tipe 'out')
          await connection.query(
            'INSERT INTO stock_transactions (product_id, type, quantity, notes, user_id) VALUES (?, "out", ?, ?, ?)',
            [
              productId,
              qty,
              notes || `Pengeluaran barang selesai untuk Outbound ${shipment.outbound_number || shipmentId}`,
              actorId,
            ]
          );

          // 3. Update shipped_qty dan fulfilled_qty di outbound_shipment_items
          await connection.query(
            `UPDATE outbound_shipment_items 
             SET shipped_qty = ?, fulfilled_qty = ? 
             WHERE id = ?`,
            [qty, qty, existItem.id]
          );
        }
      }

      // 4. Update status shipment menjadi 'Shipped'
      const finalUnits = totalShippedUnits > 0 ? totalShippedUnits : shipment.units;
      await connection.query(
        `UPDATE outbound_shipments 
         SET status = 'Shipped', 
             shipped_at = NOW(), 
             completed_at = NOW(),
             carrier = COALESCE(?, carrier), 
             tracking_number = COALESCE(?, tracking_number),
             fulfilled_units = ?,
             units = ?
         WHERE id = ?`,
        [carrier || null, tracking_number || null, finalUnits, finalUnits, shipmentId]
      );

      // Selesaikan tugas terkait di tabel tasks jika ada
      try {
        const taskTitle = `[TUGAS DOK] Picking & Scan Barcode Outbound ${shipment.outbound_number}`;
        await connection.query(
          'UPDATE tasks SET status = "completed", completed_at = NOW() WHERE title = ?',
          [taskTitle]
        );
      } catch (_) {}

      await connection.commit();
      return { success: true, shipmentId, shippedUnits: finalUnits };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  updateStatus: async (id, status, extra = {}) => {
    const isNum = !isNaN(Number(id));
    const whereClause = isNum ? 'WHERE id = ? OR outbound_number = ?' : 'WHERE outbound_number = ?';
    const params = [status];

    let extraSet = '';
    if (status === 'Arrived') {
      extraSet = ', arrived_at = NOW()';
    } else if (status === 'Shipped') {
      extraSet = ', shipped_at = NOW(), completed_at = NOW()';
      if (extra.carrier) {
        extraSet += ', carrier = ?';
        params.push(extra.carrier);
      }
      if (extra.tracking) {
        extraSet += ', tracking_number = ?';
        params.push(extra.tracking);
      }
    }

    if (isNum) {
      params.push(Number(id), String(id));
    } else {
      params.push(String(id));
    }

    const sql = `UPDATE outbound_shipments SET status = ? ${extraSet} ${whereClause}`;
    const [result] = await db.query(sql, params);

    // Otomasi Tugas Dok saat status Arrived (Armada Pengambilan Tiba di Dok):
    if (status === 'Arrived') {
      try {
        const findParams = isNum ? [Number(id), String(id)] : [String(id)];
        const [outRows] = await db.query(`SELECT * FROM outbound_shipments ${whereClause}`, findParams);
        if (outRows.length > 0) {
          const shipment = outRows[0];
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

          const taskTitle = `[TUGAS DOK] Picking & Scan Barcode Outbound ${shipment.outbound_number}`;
          const [existTask] = await db.query(
            'SELECT id FROM tasks WHERE title = ? AND status IN ("pending", "in_progress")',
            [taskTitle]
          );
          if (existTask.length === 0) {
            const taskDesc = `Armada pengeluaran ${shipment.outbound_number} telah tiba di Dok ${shipment.dock || '1'}. Silakan ambil fisik barang dari rak dan lakukan pemindaian barcode fisik unit.`;
            await db.query(
              `INSERT INTO tasks (title, description, current_assignee_id, created_by, status, created_at)
               VALUES (?, ?, ?, ?, 'pending', NOW())`,
              [taskTitle, taskDesc, staffId || 1, extra.userId || 1]
            );
          }
        }
      } catch (taskErr) {
        console.error('Error creating auto-task on Outbound Arrived:', taskErr);
      }
    }

    return result;
  },

  delete: async (id) => {
    const isNum = !isNaN(Number(id));
    const whereClause = isNum ? 'WHERE id = ? OR outbound_number = ?' : 'WHERE outbound_number = ?';
    const params = isNum ? [Number(id), String(id)] : [String(id)];
    const [result] = await db.query(`DELETE FROM outbound_shipments ${whereClause}`, params);
    return result;
  },
};

module.exports = outboundModel;
