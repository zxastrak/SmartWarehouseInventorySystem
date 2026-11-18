const taskModel = require('../models/taskModel');
const userModel = require('../models/userModel');
const productModel = require('../models/productModel');
const db = require('../config/db');
const logAudit = require('../utils/audit');

const VALID_STATUS = ['pending', 'in_progress', 'done'];

const taskController = {
  getNotifications: async (req, res) => {
    try {
      const userId = req.user.id;
      const rawNotifications = await taskModel.getNotificationsByUserId(userId);

      // Ambil data pengiriman inbound aktif untuk memperkaya detail tugas
      const [inbounds] = await db.query(
        'SELECT id, inbound_number, po_number, supplier_name, carrier, dock, status FROM inbound_shipments WHERE status IN ("Arrived", "Inspect", "Inspecting", "Order", "Scheduled")'
      ).catch(() => [[]]);

      const inbMap = {};
      for (const inb of inbounds) {
        inbMap[inb.inbound_number] = inb;
      }

      const notifications = rawNotifications.map((t) => {
        const isDockTask = (t.title || '').includes('[TUGAS DOK]') || (t.title || '').includes('[PENUGASAN DOK]');
        const isAssignedToMe = t.current_assignee_id !== null && Number(t.current_assignee_id) === Number(userId);
        const hasAssignee = t.current_assignee_id !== null && t.current_assignee_id !== undefined;

        let template_type = 'default';
        let display_title = t.title;
        let display_desc = t.description;
        let badge_label = 'TUGAS DOK';

        // Cari data shipment yang sesuai jika ada
        let matchedShipment = null;
        for (const inbNum in inbMap) {
          if (t.title.includes(inbNum) || (t.description && t.description.includes(inbNum))) {
            matchedShipment = inbMap[inbNum];
            break;
          }
        }

        const inboundNum = matchedShipment?.inbound_number || '';
        const dockName = matchedShipment?.dock ? `Dok ${matchedShipment.dock}` : 'Dok Penerimaan';

        if (isDockTask) {
          if (!hasAssignee) {
            // Template Default: Semua staf mendapat notifikasi kedatangan dok
            template_type = 'default';
            badge_label = 'KEDATANGAN DOK • SEMUA STAF';
            display_title = `[TUGAS DOK] Kedatangan Armada ${inboundNum || 'Inbound'}`;
            display_desc = `Armada pengiriman ${inboundNum} telah tiba di ${dockName}. Menunggu pemeriksaan fisik barang & scan barcode satuan unit.`;
          } else if (isAssignedToMe) {
            // Template 1: Khusus untuk staf yang menerima tugas (konsep: ia mendapat tugas)
            template_type = 'assigned_to_me';
            badge_label = 'TUGAS KHUSUS ANDA';
            display_title = `[PENUGASAN DOK] Anda Ditugaskan: Inspeksi ${inboundNum || 'Inbound'}`;
            display_desc = `Anda telah ditugaskan secara khusus oleh Manajer untuk melakukan pemeriksaan fisik barang dan pemindaian barcode armada ${inboundNum} di ${dockName}. Silakan menuju dok penerimaan.`;
          } else {
            // Template 2: Tugas dialihkan ke staf lain, namun staf ini tetap bisa melihat detail tugas
            template_type = 'reassigned_to_other';
            const assigneeName = t.assignee_name || 'Staf Lain';
            badge_label = `DIALIHKAN KE ${assigneeName.toUpperCase()}`;
            display_title = `[INFO DOK] Tugas Inspeksi ${inboundNum || ''} Dialihkan ke ${assigneeName}`;
            display_desc = `Tugas inspeksi armada ${inboundNum} di ${dockName} telah dialihkan kepada ${assigneeName}. Anda tetap dapat memantau dan melihat rincian detail tugas ini.`;
          }
        } else {
          if (isAssignedToMe) {
            template_type = 'assigned_to_me';
            badge_label = 'TUGAS ANDA';
          } else {
            template_type = 'general';
            badge_label = 'INFO OPERASIONAL';
          }
        }

        return {
          ...t,
          template_type,
          is_assigned_to_me: isAssignedToMe,
          badge_label,
          display_title,
          display_desc,
          assignee_name: t.assignee_name || (hasAssignee ? 'Staf Lain' : 'Semua Staf Lapangan'),
          shipment_info: matchedShipment || null,
        };
      });

      // Deduplikasi ketat per pengiriman Inbound (TIDAK BOLEH ADA DOUBLE NOTIFIKASI)
      const seenInbound = new Set();
      const uniqueNotifications = [];

      for (const n of notifications) {
        let inbKey = n.shipment_info?.inbound_number;
        if (!inbKey && n.title) {
          const match = n.title.match(/INB-[0-9A-Za-z-]+/);
          if (match) inbKey = match[0];
        }

        if (inbKey) {
          if (seenInbound.has(inbKey)) {
            continue; // Lewati duplikasi untuk nomor INB yang sama
          }
          seenInbound.add(inbKey);
        }

        uniqueNotifications.push(n);
      }

      const pendingCount = uniqueNotifications.filter(
        (n) => n.status === 'pending' && n.template_type !== 'reassigned_to_other'
      ).length;

      res.status(200).json({
        notifications: uniqueNotifications,
        total: uniqueNotifications.length,
        pending: pendingCount,
      });
    } catch (err) {
      console.error('[ERROR getNotifications]', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  reportDiscrepancy: async (req, res) => {
    try {
      const { sku, physical_quantity, reason } = req.body;
      if (!sku) {
        return res.status(400).json({ message: 'SKU produk wajib diisi' });
      }

      const products = await productModel.findBySku(sku);
      if (!products || products.length === 0) {
        return res.status(404).json({ message: `Produk dengan SKU ${sku} tidak ditemukan` });
      }
      const product = products[0];
      const reporterId = req.user.id;
      const systemStock = product.stock_quantity ?? 0;
      const physicalQty = physical_quantity !== undefined ? Number(physical_quantity) : 0;
      const diff = physicalQty - systemStock;
      const diffText = diff > 0 ? `+${diff}` : `${diff}`;

      const title = `[SELISIH STOK] ${product.name} (${product.sku})`;
      const description = `Laporan selisih stok fisik oleh staf (ID: ${reporterId}). Stok sistem: ${systemStock}, Stok fisik: ${physicalQty} (Selisih: ${diffText}). Alasan/Catatan: ${reason || '-'}`;

      const result = await taskModel.create({
        title,
        description,
        location_id: product.location_id || null,
        related_product_id: product.id,
        current_assignee_id: reporterId,
        created_by: reporterId,
      });

      await logAudit({
        user_id: reporterId,
        action: 'TASK_CREATED',
        table_affected: 'tasks',
        record_id: result.taskId,
      });

      res.status(201).json({
        message: 'Laporan selisih stok berhasil dibuat sebagai tugas',
        taskId: result.taskId,
      });
    } catch (err) {
      console.error('[ERROR reportDiscrepancy]', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const showAll = req.query.all === 'true' || req.query.history === 'true';
      let tasks = await taskModel.getAll({ all: showAll });
      if (req.user && req.user.role === 'staf') {
        tasks = tasks.filter((t) => {
          const title = (t.title || '').toUpperCase();
          const desc = (t.description || '').toUpperCase();
          return !title.includes('REVIEW') && !title.includes('ACC') && !desc.includes('REVIEW & ACC');
        });
      }
      res.status(200).json(tasks);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Notifikasi khusus untuk staf yang sedang login
  getNotifications: async (req, res) => {
    try {
      const notifications = await taskModel.getNotificationsByUserId(req.user.id);
      const pendingCount = notifications.filter(n => n.status === 'pending').length;
      res.status(200).json({
        notifications,
        total: notifications.length,
        pending: pendingCount,
      });
    } catch (err) {
      console.error('[ERROR getNotifications]', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const task = await taskModel.getById(req.params.id);
      if (task.length === 0) {
        return res.status(404).json({ message: 'Task tidak ditemukan' });
      }
      res.status(200).json(task[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getHistory: async (req, res) => {
    try {
      const task = await taskModel.getById(req.params.id);
      if (task.length === 0) {
        return res.status(404).json({ message: 'Task tidak ditemukan' });
      }
      const history = await taskModel.getAssignmentHistory(req.params.id);
      res.status(200).json(history);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { title, description, location_id, related_product_id, current_assignee_id } = req.body;
      const created_by = req.user.id;

      if (!title || !current_assignee_id) {
        return res.status(400).json({ message: 'Title dan current_assignee_id wajib diisi' });
      }

      const assignee = await userModel.findById(current_assignee_id);
      if (assignee.length === 0 || assignee[0].role !== 'staf') {
        return res.status(400).json({ message: 'PIC harus berupa akun staf yang terdaftar' });
      }

      const result = await taskModel.create({
        title,
        description: description || null,
        location_id: location_id || null,
        related_product_id: related_product_id || null,
        current_assignee_id,
        created_by,
      });

      await logAudit({
        user_id: created_by,
        action: 'TASK_CREATED',
        table_affected: 'tasks',
        record_id: result.taskId,
      });

      res.status(201).json({ message: 'Task berhasil dibuat', taskId: result.taskId });
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ message: 'location_id atau related_product_id tidak valid' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Laporan selisih stok dari staf lapangan ke manajer
  reportDiscrepancy: async (req, res) => {
    try {
      const { sku, physical_quantity, reason } = req.body || {};

      if (!sku || physical_quantity === undefined || !reason) {
        return res.status(400).json({ message: 'SKU, jumlah fisik, dan alasan selisih wajib diisi' });
      }

      const products = await productModel.findBySku(sku);
      if (products.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      const product = products[0];
      const title = `[SELISIH STOK] ${product.sku} - ${product.name}`;
      const description = `Laporan dari staf: "${reason.trim()}". Stok sistem: ${product.stock_quantity}, Hasil hitung fisik: ${physical_quantity}. Lokasi: ${product.zone_location || '-'}`;

      const result = await taskModel.create({
        title,
        description,
        location_id: product.location_id || null,
        related_product_id: product.id,
        current_assignee_id: req.user.id,
        created_by: req.user.id,
      });

      await logAudit({
        user_id: req.user.id,
        action: 'STOCK_DISCREPANCY_REPORTED',
        table_affected: 'tasks',
        record_id: result.taskId,
      });

      res.status(201).json({
        message: 'Laporan selisih stok berhasil dikirim ke manajer sebagai tugas investigasi',
        taskId: result.taskId,
      });
    } catch (err) {
      console.error('[ERROR reportDiscrepancy]', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  reassign: async (req, res) => {
    try {
      const { id } = req.params;
      const { new_assignee_id, reason } = req.body || {};

      const task = await taskModel.getById(id);
      if (task.length === 0) {
        return res.status(404).json({ message: 'Task tidak ditemukan' });
      }
      if (task[0].status === 'done') {
        return res.status(400).json({ message: 'Task sudah selesai, tidak bisa dialihkan' });
      }

      let targetId;
      let finalReason;

      if (req.user.role === 'staf') {
        targetId = req.user.id;
        finalReason = reason || 'backup_takeover';
      } else {
        if (!new_assignee_id) {
          return res.status(400).json({ message: 'new_assignee_id wajib diisi' });
        }
        targetId = Number(new_assignee_id);
        finalReason = reason || 'reassigned_by_manager';
      }

      if (targetId === task[0].current_assignee_id) {
        return res.status(400).json({ message: 'Task ini sudah dipegang PIC tersebut' });
      }

      const target = await userModel.findById(targetId);
      if (target.length === 0 || target[0].role !== 'staf') {
        return res.status(400).json({ message: 'PIC pengganti harus berupa akun staf yang terdaftar' });
      }

      await taskModel.reassign(id, targetId, finalReason);

      await logAudit({
        user_id: req.user.id,
        action: 'TASK_REASSIGNED',
        table_affected: 'tasks',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'PIC berhasil dialihkan', newAssignee: targetId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!VALID_STATUS.includes(status)) {
        return res.status(400).json({ message: "Status harus 'pending', 'in_progress', atau 'done'" });
      }

      const task = await taskModel.getById(id);
      if (task.length === 0) {
        return res.status(404).json({ message: 'Task tidak ditemukan' });
      }

      if (req.user.role === 'staf' && task[0].current_assignee_id !== req.user.id) {
        return res.status(403).json({ message: 'Hanya PIC task ini yang boleh mengubah status' });
      }

      await taskModel.updateStatus(id, status);

      await logAudit({
        user_id: req.user.id,
        action: 'TASK_STATUS_UPDATED',
        table_affected: 'tasks',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Status task berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = taskController;
