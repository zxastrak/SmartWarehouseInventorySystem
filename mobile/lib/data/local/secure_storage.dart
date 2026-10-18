import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  // Inisialisasi secure storage
  static const _secureStorage = FlutterSecureStorage();

  // Key rahasia untuk menyimpan token
  static const _keyToken = 'jwt_token';

  // Simpan token saat login berhasil
  static Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _keyToken, value: token);
  }

  // Ambil token saat aplikasi dibuka / request ke API
  static Future<String?> getToken() async {
    return await _secureStorage.read(key: _keyToken);
  }

  // Hapus token saat logout / session expired
  static Future<void> deleteToken() async {
    await _secureStorage.delete(key: _keyToken);
  }
}