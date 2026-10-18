const taskModel = require('../models/taskModel');
const userModel = require('../models/userModel');
const logAudit = require('../utils/audit');

const VALID_STATUS = ['pending', 'in_progress', 'done'];

const taskController = {
  getAll: async (req, res) => {
    try {
      const tasks = await taskModel.getAll();
      res.status(200).json(tasks);
    } catch (err) {
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