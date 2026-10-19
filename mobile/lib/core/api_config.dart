import 'package:flutter/foundation.dart';

class ApiConfig {
  static String? _overrideBaseUrl;

  static void setCustomBaseUrl(String? url) {
    _overrideBaseUrl = url;
  }

  static String get baseUrl {
    if (_overrideBaseUrl != null && _overrideBaseUrl!.isNotEmpty) {
      return _overrideBaseUrl!;
    }
    // Android emulator uses 10.0.2.2 to access host machine localhost
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000/api';
    }
    return 'http://localhost:5000/api';
  }

  // Endpoints
  static String get login => '$baseUrl/auth/login';
  static String get resetPassword => '$baseUrl/auth/reset-password';
  static String get products => '$baseUrl/products';
  static String productBySku(String sku) => '$baseUrl/products/sku/$sku';
  static String get stockTransactions => '$baseUrl/stock-transactions';
  static String get stockTransactionsMe => '$baseUrl/stock-transactions/me';
  static String get attendanceCheckIn => '$baseUrl/attendances/check-in';
  static String get attendanceCheckOut => '$baseUrl/attendances/check-out';
  static String get attendanceMe => '$baseUrl/attendances/me';
  static String get shiftsMe => '$baseUrl/shifts/me';
  static String get tasks => '$baseUrl/tasks';
}
