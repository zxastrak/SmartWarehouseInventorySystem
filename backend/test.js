const productModel = require('./models/productModel');

async function runTest() {
  try {
    const created = await productModel.create({
      name: 'Kabel HDMI 2m',
      sku: 'SKU-001',
      category_id: 1,        // sesuaikan dengan id kategori yang udah ada
      supplier_id: 1,        // sesuaikan dengan id supplier yang udah ada
      stock_quantity: 50,
      unit: 'pcs',
      price: 45000,
      zone_location: 'Zone-A-Rak3',
      location_id: 1,        // sesuaikan dengan id location yang udah ada
    });
    console.log('Berhasil insert, ID:', created.insertId);

    const byId = await productModel.getById(created.insertId);
    console.log('Data by ID:', byId);

    const bySku = await productModel.findBySku('SKU-001');
    console.log('Data by SKU (simulasi scan barcode):', bySku);

    const stockUpdate = await productModel.updateStock(created.insertId, 45);
    console.log('Stock ter-update, baris terpengaruh:', stockUpdate.affectedRows);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

runTest();