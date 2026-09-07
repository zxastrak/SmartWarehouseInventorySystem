const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend Smart Warehouse jalan!');
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});