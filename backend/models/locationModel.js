const db = require('../config/db');

const locationModel = {
  create: async (locationData) => {
    const { location_code, zone } = locationData;
    const sql = 'INSERT INTO locations (location_code, zone) VALUES (?, ?)';
    const [result] = await db.query(sql, [location_code, zone]);
    return result;
  },

  getAll: async () => {
    const sql = 'SELECT * FROM locations';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM locations WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  update: async (id, locationData) => {
    const { location_code, zone } = locationData;
    const sql = 'UPDATE locations SET location_code = ?, zone = ? WHERE id = ?';
    const [result] = await db.query(sql, [location_code, zone, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM locations WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = locationModel;