/**
 * RBAC Guard & Request ID Middleware for Warehouse Layout
 */

const crypto = require('crypto');

/**
 * Attaches requestId and standard response helper
 */
function attachLayoutContext(req, res, next) {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * Checks permission based on user role
 * @param {'layout.view'|'layout.edit'|'location.configure'} permission
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'staf';

    let allowed = false;
    if (permission === 'layout.view') {
      allowed = ['manager', 'staf'].includes(userRole);
    } else if (permission === 'layout.edit' || permission === 'location.configure') {
      allowed = userRole === 'manager';
    }

    if (!allowed) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        code: 'PERMISSION_DENIED',
        message: `Akses ditolak: Anda tidak memiliki izin '${permission}'`,
        requestId: req.requestId,
      });
    }

    next();
  };
}

module.exports = {
  attachLayoutContext,
  requirePermission,
};
