const jwt = require('jsonwebtoken');

const authMiddleware = {
  verifyToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // format: "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // { id, role } nempel di req, bisa dipake Controller
      next(); // lanjut ke Controller
    } catch (err) {
      return res.status(403).json({ message: 'Token tidak valid atau sudah expired' });
    }
  },

  // Dipake gini: authorizeRole('manager') atau authorizeRole('manager', 'staf')
  authorizeRole: (...allowedRoles) => {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak untuk role ini' });
      }
      next();
    };
  },
};

module.exports = authMiddleware;