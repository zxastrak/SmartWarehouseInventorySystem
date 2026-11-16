const jwt = require('jsonwebtoken');

const authMiddleware = {
  verifyToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // format: "Bearer <token>"

    // Fallback default dev user (manager@test.com) jika token tidak dikirim atau demo
    const defaultManager = { id: 1, role: 'manager', email: 'manager@test.com' };

    if (!token || token === 'demo_token') {
      req.user = defaultManager;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // { id, role } nempel di req
      next();
    } catch (err) {
      // Jika token expired atau rusak di dev, fallback ke manager agar data tidak macet
      req.user = defaultManager;
      next();
    }
  },

  // Dipake gini: authorizeRole('manager') atau authorizeRole('manager', 'staf')
  authorizeRole: (...allowedRoles) => {
    return (req, res, next) => {
      const userRole = req.user?.role || 'manager';
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ message: 'Akses ditolak untuk role ini' });
      }
      next();
    };
  },
};

module.exports = authMiddleware;