const rateLimit = require('express-rate-limit');

// 1. Limiter Umum untuk semua endpoint API (mencegah flooding & DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300, // Maksimal 300 request per IP dalam 15 menit
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi beberapa saat kemudian.',
  },
});

// 2. Limiter Ketat khusus Login (mencegah brute-force password & credential stuffing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10, // Maksimal 10 percobaan login per IP dalam 15 menit
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Terlalu banyak percobaan login dari IP ini. Demi keamanan akun, silakan tunggu 15 menit sebelum mencoba lagi.',
  },
});

module.exports = {
  apiLimiter,
  loginLimiter,
};

