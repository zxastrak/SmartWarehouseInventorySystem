
class ApiConfig {
  static const String _envBaseUrl = String.fromEnvironment('BASE_URL');
  static String? _overrideBaseUrl;

  static void setCustomBaseUrl(String? url) {
    if (url == null || url.trim().isEmpty) {
      _overrideBaseUrl = null;
      return;
    }
    String clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://$clean';
    }
    while (clean.endsWith('/')) {
      clean = clean.substring(0, clean.length - 1);
    }
    if (!clean.endsWith('/api')) {
      clean = '$clean/api';
    }
    _overrideBaseUrl = clean;
  }

  static String get baseUrl {
    if (_overrideBaseUrl != null && _overrideBaseUrl!.isNotEmpty) {
      return _overrideBaseUrl!;
    }
    if (_envBaseUrl.isNotEmpty) {
      return _envBaseUrl;
    }
    // Default to localhost:5000 (accessible via adb reverse over USB or desktop)
    return 'http://localhost:5000/api';
  }

  // Endpoints
  static String get login => '$baseUrl/auth/login';
  static String get resetPassword => '$baseUrl/auth/reset-password';
  static String get updateProfile => '$baseUrl/users/profile';
  static String get products => '$baseUrl/products';
  static String productBySku(String sku) => '$baseUrl/products/sku/$sku';
  static String productLocation(int id) => '$baseUrl/products/$id/location';
  static String productAdjustStock(int id) => '$baseUrl/products/$id/adjust-stock';
  static String get stockTransactions => '$baseUrl/stock-transactions';
  static String get stockTransactionsMe => '$baseUrl/stock-transactions/me';
  static String productTransactions(int id) =>
      '$baseUrl/stock-transactions/product/$id';
  static String get attendanceCheckIn => '$baseUrl/attendances/check-in';
  static String get attendanceCheckOut => '$baseUrl/attendances/check-out';
  static String get attendanceMe => '$baseUrl/attendances/me';
  static String get shiftsMe => '$baseUrl/shifts/me';
  static String shiftsMeDate(String date) => '$baseUrl/shifts/me?date=$date';
  static String get tasks => '$baseUrl/tasks';
  static String get taskNotifications => '$baseUrl/tasks/notifications';
  static String get taskDiscrepancy => '$baseUrl/tasks/discrepancy';
  static String taskStatus(int id) => '$baseUrl/tasks/$id/status';
  static String taskReassign(int id) => '$baseUrl/tasks/$id/reassign';
  static String taskHistory(int id) => '$baseUrl/tasks/$id/history';
  static String get locations => '$baseUrl/locations';
  static String get categories => '$baseUrl/categories';
  static String get suppliers => '$baseUrl/suppliers';
  static String get inbound => '$baseUrl/inbound';
  static String inboundDetail(dynamic id) => '$baseUrl/inbound/$id';
  static String inboundInspect(dynamic id) => '$baseUrl/inbound/$id/inspect';
  static String get outbound => '$baseUrl/outbound';
  static String outboundDetail(dynamic id) => '$baseUrl/outbound/$id';
  static String outboundInspect(dynamic id) => '$baseUrl/outbound/$id/inspect';
  static String get auditLogsMe => '$baseUrl/audit-logs/me';
}
