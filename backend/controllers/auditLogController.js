const auditLogModel = require('../models/auditLogModel');

const auditLogController = {
  // Manager: semua log, atau difilter lewat ?action= atau ?user_id= (action diprioritaskan)
  getAll: async (req, res) => {
    try {
      const { user_id, action } = req.query;

      let logs;
      if (action) {
        logs = await auditLogModel.getByAction(action);
      } else if (user_id) {
        logs = await auditLogModel.getByUserId(user_id);
      } else {
        logs = await auditLogModel.getAll();
      }

      res.status(200).json(logs);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = auditLogController;