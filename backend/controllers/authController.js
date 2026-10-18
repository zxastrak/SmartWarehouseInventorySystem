const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const logAudit = require('../utils/audit');

const authController = {
  register: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
      }

      const existingUser = await userModel.findByEmail(email);
      if (existingUser.length > 0) {
        return res.status(409).json({ message: 'Email sudah terdaftar' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await userModel.create({ name, email, password: hashedPassword, role });

      await logAudit({
        user_id: req.user.id,
        action: 'USER_CREATED',
        table_affected: 'users',
        record_id: result.insertId,
      });

      res.status(201).json({ message: 'User berhasil dibuat', userId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password wajib diisi' });
      }

      const users = await userModel.findByEmail(email);
      if (users.length === 0) {
        return res.status(401).json({ message: 'Email atau password salah' });
      }

      const user = users[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Email atau password salah' });
      }

      // Dicek setelah password benar, supaya status akun tidak bocor ke orang yang tidak punya password
      if (!user.is_active) {
        return res.status(403).json({ message: 'Akun Anda dinonaktifkan, silakan hubungi Manager' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.status(200).json({
        message: 'Login berhasil',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Lupa password (Opsi A): endpoint publik, tanpa OTP. Hanya untuk akun staf yang aktif.
  resetPassword: async (req, res) => {
    try {
      const { email, new_password } = req.body || {};

      if (!email || typeof new_password !== 'string') {
        return res.status(400).json({ message: 'Email dan password baru wajib diisi' });
      }

      if (new_password.length < 8) {
        return res.status(400).json({ message: 'Password baru minimal 8 karakter' });
      }

      const users = await userModel.findByEmail(email);

      if (users.length === 0 || users[0].role !== 'staf' || !users[0].is_active) {
        return res.status(400).json({ message: 'Akun tidak ditemukan atau tidak dapat direset melalui halaman ini' });
      }

      const hashedPassword = await bcrypt.hash(new_password, 10);
      await userModel.updatePassword(users[0].id, hashedPassword);

      await logAudit({
        user_id: users[0].id,
        action: 'PASSWORD_RESET',
        table_affected: 'users',
        record_id: users[0].id,
      });

      res.status(200).json({ message: 'Password berhasil diubah' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = authController;