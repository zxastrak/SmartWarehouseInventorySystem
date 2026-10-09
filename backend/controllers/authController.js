const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const authController = {
  // Dipake Manager buat daftarin akun Staf baru
  register: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      // Validasi dasar
      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
      }

      // Cek email udah dipake belum
      const existingUser = await userModel.findByEmail(email);
      if (existingUser.length > 0) {
        return res.status(409).json({ message: 'Email sudah terdaftar' });
      }

      // Hash password SEBELUM masuk ke Model
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await userModel.create({ name, email, password: hashedPassword, role });

      res.status(201).json({ message: 'User berhasil dibuat', userId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Login — Manager & Staf sama-sama lewat sini
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

      // Bandingin password input sama hash yang tersimpan
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Email atau password salah' });
      }

      // Bikin JWT — payload isinya id & role (dipake buat validasi role di request berikutnya)
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
};

module.exports = authController;