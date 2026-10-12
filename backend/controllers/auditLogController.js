const auditLogModel = require('../models/auditLogModel');

const auditLogController = {
  // Manager: semua log, atau difilter per user lewat ?user_id=
  getAll: async (req, res) => {
    try {
      const { user_id } = req.query;
      const logs = user_id
        ? await auditLogModel.getByUserId(user_id)
        : await auditLogModel.getAll();
      res.status(200).json(logs);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = auditLogController;