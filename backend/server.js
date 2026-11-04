const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
require('./config/db');

const { apiLimiter } = require('./middlewares/rateLimiter');

const authRoute = require('./routes/authRoute');
const categoryRoute = require('./routes/categoryRoute');
const locationRoute = require('./routes/locationRoute');
const supplierRoute = require('./routes/supplierRoute');
const productRoute = require('./routes/productRoute');
const stockTransactionRoute = require('./routes/stockTransactionRoute');
const taskRoute = require('./routes/taskRoute');
const shiftRoute = require('./routes/shiftRoute');
const attendanceRoute = require('./routes/attendanceRoute');
const purchaseOrderRoute = require('./routes/purchaseOrderRoute');
const auditLogRoute = require('./routes/auditLogRoute');
const userRoute = require('./routes/userRoute');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. HELMET: Proteksi HTTP Headers & Anti-Fingerprinting (sembunyikan X-Powered-By)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.disable('x-powered-by');

// 2. CORS: Origin Whitelist (Mencegah domain asing menembak API)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti Mobile Flutter, Postman, curl)
    // atau origin lokal / yang terdaftar di whitelist
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://192.168.')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Akses diblokir oleh kebijakan CORS (Origin tidak diizinkan)'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// 3. Body Parser dengan Limit Ukuran JSON (mencegah DoS payload besar)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. FLOODING / RATE LIMITING: Batasi request ke semua endpoint /api/*
app.use('/api/', apiLimiter);

// 5. Routes
app.use('/api/auth', authRoute);
app.use('/api/categories', categoryRoute);
app.use('/api/locations', locationRoute);
app.use('/api/suppliers', supplierRoute);
app.use('/api/products', productRoute);
app.use('/api/stock-transactions', stockTransactionRoute);
app.use('/api/tasks', taskRoute);
app.use('/api/shifts', shiftRoute);
app.use('/api/attendances', attendanceRoute);
app.use('/api/purchase-orders', purchaseOrderRoute);
app.use('/api/audit-logs', auditLogRoute);
app.use('/api/users', userRoute);

app.get('/', (req, res) => {
  res.send('Backend Smart Warehouse jalan!');
});

// 6. ERROR LOGGING & INFORMATION DISCLOSURE PROTECTION: Centralized Error Handler
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${req.method} ${req.originalUrl}:`, err.stack || err.message || err);

  // Jika error spesifik dari CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      message: err.message,
    });
  }

  // Sembunyikan detail stack trace / error internal SQL dari client
  res.status(err.status || 500).json({
    message: err.status && err.message ? err.message : 'Terjadi kesalahan internal pada server.',
  });
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
