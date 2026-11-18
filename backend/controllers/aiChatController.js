const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  getKnowledgeBaseContext,
  loadKnowledgeBase,
  getKnowledgeBaseStats
} = require('../services/knowledgeBaseService');

/**
 * Controller untuk menangani percakapan AI Chatbot dengan Knowledge Base & Multi-turn History
 */
exports.chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Pesan (message) wajib diisi.'
      });
    }

    // Jika key belum ada di memory, baca file .env secara dinamis dengan path absolut
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_KEY.trim()) {
      try {
        require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
      } catch (e) {
        // abaikan jika sudah loaded
      }
    }

    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

    // Cek apakah API Key sudah dikonfigurasi
    if (!apiKey) {
      return res.status(200).json({
        success: false,
        configured: false,
        reply: '⚠️ **Koneksi AI Belum Dikonfigurasi**\n\nKunci API Gemini (`GEMINI_API_KEY`) belum disetel di file `.env` backend.\n\nSilakan:\n1. Buka [Google AI Studio](https://aistudio.google.com/apikey) dan buat API Key gratis.\n2. Masukkan ke file `backend/.env`:\n   ```env\n   GEMINI_API_KEY=AIzaSy...\n   ```\n3. Simpan dan mulai chat kembali.'
      });
    }

    // Ambil dokumen Knowledge Base dari memory cache
    const kbContext = getKnowledgeBaseContext();

    // Inisialisasi Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Kamu adalah Asisten AI SUSUNO, asisten operasional pergudangan internal yang cerdas, praktis, dan ramah.

PRINSIP BAHASA & KOMUNIKASI:
1. BAHASA ALAMI & LUGAS: Gunakan Bahasa Indonesia yang luwes, santai tapi profesional, dan to-the-point layaknya rekan kerja senior yang berpengalaman di gudang. JANGAN gunakan bahasa kaku seperti robot terjemahan.
2. HINDARI BASA-BASI & TEMPLATE KAKU:
   - JANGAN mengulang sapaan panjang seperti "Halo! Berdasarkan Panduan Operasional Sistem SUSUNO bla bla bla".
   - JANGAN menyertakan kalimat penutup klise seperti "Apakah ada hal lain yang ingin Anda ketahui?".
   - Langsung berikan jawaban yang dicari pengguna.
3. FORMAT JELAS & MUDAH DIBACA:
   - Jika menjelaskan tahapan atau alur, gunakan nomor urut (1, 2, 3) yang ringkas.
   - Tebalkan istilah penting (bold).
   - Buat penjelasan singkat dan padat, jangan berbelit-belit.
4. SUMBER KNOWLEDGE BASE:
   Seluruh jawaban operasional harus bersumber dari data resmi SUSUNO berikut:
---
${kbContext}
---
5. JIKA DI LUAR SOP:
   Jika hal yang ditanyakan belum ada di SOP di atas, sampaikan dengan santai dan jelas:
   "Hal ini belum tercantum di SOP SUSUNO saat ini. Sebaiknya langsung konfirmasikan ke Supervisor atau Manajer Gudang ya."`;

    // Format riwayat chat untuk Gemini API (maksimal 10 pesan terakhir)
    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-10)
          .map(item => ({
            role: item.role === 'model' || item.role === 'ai' ? 'model' : 'user',
            parts: [{ text: String(item.text || item.content || '').trim() }]
          }))
          .filter(h => h.parts[0].text.length > 0)
      : [];

    // Pastikan history tidak diakhiri dengan peran 'user' agar aman saat sendMessage dipanggil
    while (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
      formattedHistory.pop();
    }

    // Daftar model kandidat aktif (dimulai dari model paling cepat & andal)
    const CANDIDATE_MODELS = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ];

    let replyText = null;
    let lastError = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.2
          }
        });

        const chatSession = model.startChat({
          history: formattedHistory
        });

        const result = await chatSession.sendMessage(message.trim());
        replyText = result.response.text();
        if (replyText) break;
      } catch (err) {
        lastError = err;
        console.warn(`[AIChatController] Percobaan model ${modelName} gagal: ${err.message}. Mencoba kandidat berikutnya...`);
      }
    }

    if (!replyText) {
      throw lastError || new Error('Semua model Gemini tidak dapat diakses saat ini.');
    }

    return res.status(200).json({
      success: true,
      configured: true,
      reply: replyText
    });
  } catch (error) {
    console.error('[AIChatController] Error:', error.message);

    let friendlyMessage = 'Maaf, terjadi kesalahan saat menghubungi layanan AI.';

    if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
      friendlyMessage = '⚠️ **API Key Tidak Valid**\n\nKunci `GEMINI_API_KEY` pada file `backend/.env` tidak valid. Mohon periksa kembali di Google AI Studio.';
    } else if (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
      friendlyMessage = '⏳ **Batas Kuota Tercapai**\n\nPermintaan ke model AI melebihi batas kuota (Rate Limit). Silakan tunggu 1-2 menit sebelum mencoba lagi.';
    } else if (error.message.includes('FETCH_ERROR') || error.message.includes('ENOTFOUND')) {
      friendlyMessage = '🌐 **Koneksi Terputus**\n\nBackend tidak dapat terhubung ke server Google AI. Pastikan koneksi internet server aktif.';
    }

    return res.status(200).json({
      success: false,
      configured: true,
      reply: friendlyMessage,
      errorDetail: error.message
    });
  }
};

/**
 * Controller untuk me-reload cache Knowledge Base tanpa perlu restart server
 */
exports.reloadKnowledgeBase = async (req, res) => {
  try {
    const result = loadKnowledgeBase();
    const stats = getKnowledgeBaseStats();
    return res.status(200).json({
      success: true,
      message: 'Knowledge Base berhasil dimuat ulang ke memory cache.',
      stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat ulang Knowledge Base.',
      error: error.message
    });
  }
};

/**
 * Controller untuk mengecek status Knowledge Base & konfigurasi AI
 */
exports.getStatus = async (req, res) => {
  const stats = getKnowledgeBaseStats();
  const configured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

  return res.status(200).json({
    success: true,
    configured,
    stats
  });
};
