const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const versionConfigPath = path.join(__dirname, '../config/appVersion.json');
const defaultApkPath = path.join(__dirname, '../uploads/susuno-mobile.apk');

// GET /api/app/latest - Ambil info versi mobile terbaru
router.get('/latest', (req, res) => {
  try {
    let versionData = {
      version: '1.0.0',
      versionCode: 1,
      changelog: 'Rilis perdana aplikasi SUSUNO Mobile.',
      releaseDate: new Date().toISOString().slice(0, 10),
      downloadUrl: '/api/app/download'
    };

    if (fs.existsSync(versionConfigPath)) {
      const raw = fs.readFileSync(versionConfigPath, 'utf8');
      versionData = JSON.parse(raw);
    }

    // Bangun URL download penuh jika requested via host
    const host = req.get('host');
    const protocol = req.protocol;
    const fullDownloadUrl = `${protocol}://${host}${versionData.downloadUrl}`;

    return res.json({
      success: true,
      data: {
        ...versionData,
        fullDownloadUrl,
        apkAvailable: fs.existsSync(defaultApkPath)
      }
    });
  } catch (error) {
    console.error('Error membaca versi app:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil informasi versi aplikasi.' });
  }
});

// GET /api/app/download - Download APK versi terbaru langsung ke HP
router.get('/download', (req, res) => {
  // Cek apakah ada file APK di uploads
  if (fs.existsSync(defaultApkPath)) {
    return res.download(defaultApkPath, 'susuno-mobile.apk');
  }

  // Cek juga di folder build flutter jika ada
  const flutterBuildApkPath = path.join(__dirname, '../../mobile/build/app/outputs/flutter-apk/app-release.apk');
  if (fs.existsSync(flutterBuildApkPath)) {
    return res.download(flutterBuildApkPath, 'susuno-mobile.apk');
  }

  return res.status(404).json({
    success: false,
    message: 'File APK terbaru belum diunggah atau belum di-build. Jalankan "flutter build apk --release" di folder mobile.'
  });
});

// POST /api/app/publish - Update metadata versi baru
router.post('/publish', (req, res) => {
  try {
    const { version, versionCode, changelog } = req.body;
    if (!version || !versionCode) {
      return res.status(400).json({ success: false, message: 'Version dan versionCode wajib diisi.' });
    }

    const nextData = {
      version: String(version),
      versionCode: Number(versionCode),
      changelog: changelog || 'Pembaruan stabilitas dan fitur gudang.',
      releaseDate: new Date().toISOString().slice(0, 10),
      downloadUrl: '/api/app/download'
    };

    fs.writeFileSync(versionConfigPath, JSON.stringify(nextData, null, 2), 'utf8');
    return res.json({ success: true, message: 'Informasi versi aplikasi berhasil diperbarui.', data: nextData });
  } catch (error) {
    console.error('Error publish version:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui versi aplikasi.' });
  }
});

module.exports = router;
