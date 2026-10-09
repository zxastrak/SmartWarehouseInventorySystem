const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./config/db');
const authRoute = require('./routes/authRoute');
const categoryRoute = require('./routes/categoryRoute');
const locationRoute = require('./routes/locationRoute');
const supplierRoute = require('./routes/supplierRoute');
const productRoute = require('./routes/productRoute');
const stockTransactionRoute = require('./routes/stockTransactionRoute');
const taskRoute = require('./routes/taskRoute');
const shiftRoute = require('./routes/shiftRoute');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoute);
app.use('/api/categories', categoryRoute);
app.use('/api/locations', locationRoute);
app.use('/api/suppliers', supplierRoute);
app.use('/api/products', productRoute);
app.use('/api/stock-transactions', stockTransactionRoute);
app.use('/api/tasks', taskRoute);
app.use('/api/shifts', shiftRoute);


app.get('/', (req, res) => {
  res.send('Backend Smart Warehouse jalan!');
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});