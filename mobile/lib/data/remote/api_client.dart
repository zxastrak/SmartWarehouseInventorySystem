import 'dart:convert';
import 'package:http/http.dart' as http;
import '../local/secure_storage.dart';

class ApiClient {
  static const String baseUrl = 'http://localhost:5000/api';

  // Method Helper untuk Header HTTP & Menyertakan Token JWT secara Otomatis
  static Future<Map<String, String>> _getHeaders() async {
    String? token = await TokenStorage.getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // 1. GET Request (Mengambil Data)
  static Future<http.Response> get(String endpoint) async {
    final headers = await _getHeaders();
    return await http.get(Uri.parse('$baseUrl$endpoint'), headers: headers);
  }

  // 2. POST Request (Menambah Data Baru)
  static Future<http.Response> post(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    final headers = await _getHeaders();
    return await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(data),
    );
  }

  // 3. PUT Request (Mengubah/Memperbarui Seluruh Data)
  static Future<http.Response> put(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    final headers = await _getHeaders();
    return await http.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(data),
    );
  }

  // 4. PATCH Request (Memperbarui Sebagian Data / Partial Update)
  static Future<http.Response> patch(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    final headers = await _getHeaders();
    return await http.patch(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(data),
    );
  }

  // 5. DELETE Request (Menghapus Data)
  static Future<http.Response> delete(String endpoint) async {
    final headers = await _getHeaders();
    return await http.delete(Uri.parse('$baseUrl$endpoint'), headers: headers);
  }
}
