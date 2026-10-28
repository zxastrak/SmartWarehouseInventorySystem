import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../core/api_config.dart';

class ApiService {
  final http.Client _client;

  ApiService({http.Client? client}) : _client = client ?? http.Client();

  Map<String, String> _headers({String? token}) {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConfig.login),
            headers: _headers(),
            body: jsonEncode({
              'email': email.trim(),
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 8));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'token': data['token'],
          'user': data['user'],
          'message': data['message'] ?? 'Login berhasil',
        };
      }

      return {
        'success': false,
        'message': data['message'] ?? 'Login gagal (${response.statusCode})',
      };
    } on SocketException catch (_) {
      return {
        'success': false,
        'isNetworkError': true,
        'message':
            'Tidak dapat terhubung ke server backend (${ApiConfig.baseUrl}). Pastikan "node server.js" menyala di PC.',
      };
    } on TimeoutException catch (_) {
      return {
        'success': false,
        'isNetworkError': true,
        'message': 'Koneksi ke backend timeout. Periksa server.',
      };
    } catch (e) {
      return {
        'success': false,
        'isNetworkError': true,
        'message': 'Error jaringan: $e',
      };
    }
  }

  Future<List<Map<String, dynamic>>?> getProducts(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.products), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getProductBySku(
    String token,
    String sku,
  ) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConfig.productBySku(sku)),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getStockTransactions(String token) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConfig.stockTransactionsMe),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>> createStockTransaction({
    required String token,
    required int productId,
    required String type, // 'in' or 'out'
    required int quantity,
    String? notes,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConfig.stockTransactions),
            headers: _headers(token: token),
            body: jsonEncode({
              'product_id': productId,
              'type': type,
              'quantity': quantity,
              'notes': notes ?? '',
            }),
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      if (response.statusCode == 201 || response.statusCode == 200) {
        return {'success': true, 'data': data};
      }
      return {
        'success': false,
        'message': data['message'] ?? 'Gagal mencatat transaksi',
      };
    } catch (e) {
      return {'success': false, 'message': 'Gagal mencatat ke backend: $e'};
    }
  }

  Future<Map<String, dynamic>> checkIn(String token) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConfig.attendanceCheckIn),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      return {'success': response.statusCode == 201, 'message': data['message']};
    } catch (e) {
      return {'success': false, 'message': 'Error: $e'};
    }
  }

  Future<Map<String, dynamic>> checkOut(String token) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConfig.attendanceCheckOut),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      return {'success': response.statusCode == 201, 'message': data['message']};
    } catch (e) {
      return {'success': false, 'message': 'Error: $e'};
    }
  }

  Future<List<Map<String, dynamic>>?> getMyShifts(
    String token, {
    String? date,
  }) async {
    try {
      final url = date != null ? ApiConfig.shiftsMeDate(date) : ApiConfig.shiftsMe;
      final response = await _client
          .get(Uri.parse(url), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getTasks(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.tasks), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getLocations(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.locations), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getCategories(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.categories), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getSuppliers(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.suppliers), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getProductTransactions(
    String token,
    int productId,
  ) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConfig.productTransactions(productId)),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>?> getTaskHistory(
    String token,
    int taskId,
  ) async {
    try {
      final response = await _client
          .get(
            Uri.parse(ApiConfig.taskHistory(taskId)),
            headers: _headers(token: token),
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>> updateTaskStatus({
    required String token,
    required int taskId,
    required String status, // 'pending', 'in_progress', or 'done'
  }) async {
    try {
      final response = await _client
          .patch(
            Uri.parse(ApiConfig.taskStatus(taskId)),
            headers: _headers(token: token),
            body: jsonEncode({'status': status}),
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      return {'success': response.statusCode == 200, 'message': data['message']};
    } catch (e) {
      return {'success': false, 'message': 'Gagal update status: $e'};
    }
  }

  Future<Map<String, dynamic>> reassignTask({
    required String token,
    required int taskId,
    String? reason,
  }) async {
    try {
      final body = reason != null ? jsonEncode({'reason': reason}) : jsonEncode({});
      final response = await _client
          .patch(
            Uri.parse(ApiConfig.taskReassign(taskId)),
            headers: _headers(token: token),
            body: body,
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      return {'success': response.statusCode == 200, 'message': data['message']};
    } catch (e) {
      return {'success': false, 'message': 'Gagal mengambil alih task: $e'};
    }
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse(ApiConfig.resetPassword),
            headers: _headers(),
            body: jsonEncode({
              'email': email.trim(),
              'new_password': newPassword,
            }),
          )
          .timeout(const Duration(seconds: 6));

      final data = jsonDecode(response.body);
      return {'success': response.statusCode == 200, 'message': data['message']};
    } catch (e) {
      return {'success': false, 'message': 'Gagal reset password: $e'};
    }
  }

  Future<List<Map<String, dynamic>>?> getAttendancesMe(String token) async {
    try {
      final response = await _client
          .get(Uri.parse(ApiConfig.attendanceMe), headers: _headers(token: token))
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded is List) {
          return List<Map<String, dynamic>>.from(decoded);
        }
      }
    } catch (_) {}
    return null;
  }
}
