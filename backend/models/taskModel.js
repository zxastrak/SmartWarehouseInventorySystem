const db = require('../config/db');

const taskModel = {
  // General view — SEMUA staff bisa lihat semua task & statusnya
  getAll: async () => {
    const sql = 'SELECT * FROM tasks ORDER BY created_at DESC';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM tasks WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  // Bikin task baru + assignment pertama, atomic
  create: async (taskData) => {
    const { title, description, location_id, related_product_id, current_assignee_id, created_by } = taskData;
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const insertTaskSql = `INSERT INTO tasks 
        (title, description, location_id, related_product_id, current_assignee_id, created_by, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
      const [result] = await connection.query(insertTaskSql, [title, description, location_id, related_product_id, current_assignee_id, created_by]);

      const insertAssignmentSql = `INSERT INTO task_assignments (task_id, user_id, reason) VALUES (?, ?, 'initial')`;
      await connection.query(insertAssignmentSql, [result.insertId, current_assignee_id]);

      await connection.commit();
      return { taskId: result.insertId };

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // INTI fitur backup PIC — reassign, atomic + tersimpan riwayatnya
  reassign: async (taskId, newUserId, reason) => {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Tutup assignment yang lagi aktif (released_at masih NULL)
      await connection.query(
        'UPDATE task_assignments SET released_at = NOW() WHERE task_id = ? AND released_at IS NULL',
        [taskId]
      );

      // Buka assignment baru buat PIC pengganti
      await connection.query(
        'INSERT INTO task_assignments (task_id, user_id, reason) VALUES (?, ?, ?)',
        [taskId, newUserId, reason]
      );

      // Update quick-lookup di tabel tasks
      await connection.query(
        'UPDATE tasks SET current_assignee_id = ? WHERE id = ?',
        [newUserId, taskId]
      );

      await connection.commit();
      return { taskId, newAssignee: newUserId };

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // Riwayat siapa aja yang pernah pegang task ini
  getAssignmentHistory: async (taskId) => {
    const sql = 'SELECT * FROM task_assignments WHERE task_id = ? ORDER BY assigned_at ASC';
    const [rows] = await db.query(sql, [taskId]);
    return rows;
  },

  updateStatus: async (id, status) => {
    const completedAt = status === 'done' ? 'NOW()' : 'NULL';
    const sql = `UPDATE tasks SET status = ?, completed_at = ${completedAt} WHERE id = ?`;
    const [result] = await db.query(sql, [status, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM tasks WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = taskModel;