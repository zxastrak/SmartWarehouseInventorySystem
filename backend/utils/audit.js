const auditLogModel = require('../models/auditLogModel');

const logAudit = async ({ user_id, action, table_affected = null, record_id = null }) => {
  try {
    await auditLogModel.create({ user_id, action, table_affected, record_id });
  } catch (err) {
    // Kegagalan mencatat audit tidak boleh menggagalkan operasi utama
    console.error('Gagal mencatat audit log:', err.message);
  }
};

module.exports = logAudit;