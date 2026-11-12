const db = require('../config/db');

const purchaseOrderModel = {
  create: async (poData) => {
    const {
      po_number,
      supplier_id,
      created_by,
      expected_date,
      total_amount,
      payment_terms,
      reference,
      notes,
      deliver_to,
      status = 'pending',
      items = [],
    } = poData;

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const calculatedTotal =
        total_amount !== undefined
          ? total_amount
          : items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0), 0);

      const generatedPoNumber =
        po_number || `PO-${Date.now().toString().slice(-4)}`;

      const insertPoSql = `
        INSERT INTO purchase_orders 
        (po_number, supplier_id, created_by, status, expected_date, total_amount, payment_terms, reference, notes, deliver_to) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [poResult] = await connection.query(insertPoSql, [
        generatedPoNumber,
        supplier_id,
        created_by || null,
        status,
        expected_date || null,
        calculatedTotal,
        payment_terms || 'Net 30',
        reference || null,
        notes || null,
        deliver_to || 'Main Warehouse',
      ]);

      const poId = poResult.insertId;

      if (Array.isArray(items) && items.length > 0) {
        const values = items.map((item) => [
          poId,
          item.product_id,
          item.quantity,
          item.price,
          item.discount_percent || 0,
          item.tax_percent || 0,
          item.received_quantity || 0,
        ]);
        const insertItemsSql = `
          INSERT INTO purchase_order_items 
          (purchase_order_id, product_id, quantity, price, discount_percent, tax_percent, received_quantity) 
          VALUES ?
        `;
        await connection.query(insertItemsSql, [values]);
      }

      await connection.commit();
      return { poId, po_number: generatedPoNumber };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  getById: async (id) => {
    const sql = `
      SELECT po.*, s.name AS supplier_name, u.name AS creator_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ? OR po.po_number = ?
    `;
    const [rows] = await db.query(sql, [id, id]);
    return rows;
  },

  getAll: async () => {
    const sql = `
      SELECT po.*, 
             s.name AS supplier_name, 
             u.name AS creator_name,
             app.name AS approver_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.created_by = u.id
      LEFT JOIN users app ON po.approved_by = app.id
      ORDER BY po.created_at DESC
    `;
    const [rows] = await db.query(sql);

    // Fetch items for each PO
    for (const po of rows) {
      const [items] = await db.query(
        `SELECT poi.*, p.name AS product_name, p.sku AS sku, p.unit AS unit
         FROM purchase_order_items poi
         LEFT JOIN products p ON poi.product_id = p.id
         WHERE poi.purchase_order_id = ?`,
        [po.id]
      );
      po.items = items;
    }

    return rows;
  },

  getItemsByPoId: async (po_id) => {
    const sql = `
      SELECT poi.*, p.name AS product_name, p.sku AS sku, p.unit AS unit
      FROM purchase_order_items poi
      LEFT JOIN products p ON poi.product_id = p.id
      WHERE poi.purchase_order_id = ?
    `;
    const [rows] = await db.query(sql, [po_id]);
    return rows;
  },

  updateStatus: async (id, status, approverId = null) => {
    const cleanStatus = status.toLowerCase();
    let approvedSql = '';
    const params = [cleanStatus];

    if (cleanStatus === 'approved') {
      approvedSql = ', approved_at = NOW()';
      if (approverId) {
        approvedSql += ', approved_by = ?';
        params.push(approverId);
      }
    }

    params.push(id);
    const sql = `UPDATE purchase_orders SET status = ? ${approvedSql} WHERE id = ?`;
    const [result] = await db.query(sql, params);

    // Otomatis jadwalkan inbound shipment jika statusnya 'approved' atau 'in transit'
    if (['approved', 'in transit', 'in_transit'].includes(cleanStatus)) {
      try {
        const [existingInb] = await db.query(
          'SELECT id FROM inbound_shipments WHERE purchase_order_id = ?',
          [id]
        );
        if (existingInb.length === 0) {
          const [poRows] = await db.query(
            `SELECT po.*, s.name AS supplier_name 
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplier_id = s.id 
             WHERE po.id = ?`,
            [id]
          );
          if (poRows.length > 0) {
            const po = poRows[0];
            const [poItemsList] = await db.query(
              'SELECT product_id, quantity, price FROM purchase_order_items WHERE purchase_order_id = ?',
              [id]
            );
            const totalUnits = poItemsList.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
            const itemsCount = poItemsList.length || 1;
            const inbNumber = `INB-${String(po.id).padStart(4, '0')}`;

            const [inbRes] = await db.query(
              `INSERT INTO inbound_shipments 
               (inbound_number, purchase_order_id, po_number, supplier_id, supplier_name, scheduled_date, scheduled_time, dock, assigned_staff, carrier, units, items_count, status, notes)
               VALUES (?, ?, ?, ?, ?, COALESCE(?, CURDATE()), '08:00:00', 'D-01', 'Staff', 'Logistics Partner', ?, ?, 'Scheduled', ?)`,
              [
                inbNumber,
                po.id,
                po.po_number || `PO-${String(po.id).padStart(4, '0')}`,
                po.supplier_id,
                po.supplier_name || 'Warehouse Partner',
                po.expected_date,
                totalUnits,
                itemsCount,
                `Kedatangan barang terjadwal untuk PO ${po.po_number || po.id}`,
              ]
            );

            if (inbRes.insertId && poItemsList.length > 0) {
              const itemValues = poItemsList.map((it) => [
                inbRes.insertId,
                it.product_id,
                it.quantity || 0,
                0,
                0,
                `PO Item ${po.po_number || po.id}`,
              ]);
              await db.query(
                `INSERT INTO inbound_shipment_items 
                 (inbound_shipment_id, product_id, ordered_qty, accepted_qty, damaged_qty, notes)
                 VALUES ?`,
                [itemValues]
              );
            }
          }
        }
      } catch (inbErr) {
        console.warn('Auto schedule inbound warning:', inbErr.message);
      }
    }

    return result;
  },

  update: async (id, data) => {
    const allowed = ['expected_date', 'status', 'notes', 'payment_terms', 'deliver_to'];
    const setClauses = [];
    const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (setClauses.length === 0) return { affectedRows: 0 };
    params.push(id);

    const sql = `UPDATE purchase_orders SET ${setClauses.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, params);
    return result;
  },
};

module.exports = purchaseOrderModel;