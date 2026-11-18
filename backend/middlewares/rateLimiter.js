const rateLimit = require('express-rate-limit');

// Helper untuk memeriksa apakah request berasal dari localhost / IP lokal internal
const isLocalRequest = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
};

// 1. Limiter Umum untuk semua endpoint API (mencegah flooding & DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10000, // Diperbesar menjadi 10.000 request untuk mengakomodasi live polling dashboard Web & Mobile
  skip: isLocalRequest, // Lewati pembatasan untuk IP lokal agar demo dan polling tidak terblokir
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi beberapa saat kemudian.',
  },
});

// 2. Limiter Khusus Login (mencegah brute-force password & credential stuffing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 50, // Batas wajar untuk pengujian dan operasional
  skip: isLocalRequest, // Lewati untuk pengujian lokal
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

