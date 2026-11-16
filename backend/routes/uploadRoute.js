const express = require('express');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Subfolder uploads yang didukung
const allowedFolders = ['products', 'profiles', 'evidence', 'tasks', 'general'];
allowedFolders.forEach((folder) => {
  const dir = path.join(UPLOADS_DIR, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Endpoint POST /api/upload
// Body: { image: "data:image/png;base64,...", folder: "products" | "profiles" | ... , filename?: string }
router.post('/', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { image, folder = 'products', filename } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'Data gambar wajib disertakan' });
    }

    // Jika sudah berupa URL eksternal (http/https), langsung kembalikan
    if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))) {
      return res.status(200).json({ success: true, url: image });
    }

    // Periksa apakah format base64 data URI
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // Jika bukan base64 dan bukan URL, bisa jadi path lokal
      if (typeof image === 'string' && image.startsWith('/uploads/')) {
        return res.status(200).json({ success: true, url: image });
      }
      return res.status(400).json({ message: 'Format gambar tidak valid. Gunakan base64 atau URL' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Tentukan ekstensi file
    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';

    const safeFolder = allowedFolders.includes(folder) ? folder : 'general';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = filename
      ? `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}-${uniqueSuffix}.${ext}`
      : `img-${uniqueSuffix}.${ext}`;

    const filePath = path.join(UPLOADS_DIR, safeFolder, safeName);
    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/${safeFolder}/${safeName}`;
    const fullUrl = `http://localhost:${process.env.PORT || 5000}${relativeUrl}`;

    res.status(200).json({
      success: true,
      url: fullUrl,
      relativeUrl,
      filename: safeName,
    });
  } catch (err) {
    console.error('Error saat upload gambar:', err);
    res.status(500).json({ message: 'Gagal memproses upload gambar', error: err.message });
  }
});

module.exports = router;
