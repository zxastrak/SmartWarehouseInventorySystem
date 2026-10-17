const userModel = require('../models/userModel');
const logAudit = require('../utils/audit');

const VALID_ROLES = ['manager', 'staf'];

// Ambil akun target dan pastikan itu akun staf
const getStafTarget = async (id) => {
  const rows = await userModel.findById(id);
  if (rows.length === 0) {
    return { error: { status: 404, message: 'Akun tidak ditemukan' } };
  }
  if (rows[0].role !== 'staf') {
    return { error: { status: 403, message: 'Hanya akun staf yang bisa dikelola melalui endpoint ini' } };
  }
  return { user: rows[0] };
};

const userController = {
  // Daftar akun, opsional ?role=staf atau ?role=manager
  getAll: async (req, res) => {
    try {
      const { role } = req.query;

      if (role && !VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: "Role harus 'manager' atau 'staf'" });
      }

      const users = await userModel.getAll(role);
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const rows = await userModel.findById(req.params.id);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Akun tidak ditemukan' });
      }
      res.status(200).json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email } = req.body || {};

      if (!name || !email) {
        return res.status(400).json({ message: 'Name dan email wajib diisi' });
      }

      const target = await getStafTarget(id);
      if (target.error) {
        return res.status(target.error.status).json({ message: target.error.message });
      }

      await userModel.update(id, { name, email });

      await logAudit({
        user_id: req.user.id,
        action: 'USER_UPDATED',
        table_affected: 'users',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Data staf berhasil diupdate' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Email sudah dipakai akun lain' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // "Hapus" = nonaktifkan (soft delete)
  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const target = await getStafTarget(id);
      if (target.error) {
        return res.status(target.error.status).json({ message: target.error.message });
      }
      if (!target.user.is_active) {
        return res.status(400).json({ message: 'Akun sudah nonaktif' });
      }

      await userModel.setActive(id, false);

      await logAudit({
        user_id: req.user.id,
        action: 'USER_DEACTIVATED',
        table_affected: 'users',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Akun staf berhasil dinonaktifkan' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  activate: async (req, res) => {
    try {
      const { id } = req.params;

      const target = await getStafTarget(id);
      if (target.error) {
        return res.status(target.error.status).json({ message: target.error.message });
      }
      if (target.user.is_active) {
        return res.status(400).json({ message: 'Akun sudah aktif' });
      }

      await userModel.setActive(id, true);

      await logAudit({
        user_id: req.user.id,
        action: 'USER_ACTIVATED',
        table_affected: 'users',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Akun staf berhasil diaktifkan kembali' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = userController;