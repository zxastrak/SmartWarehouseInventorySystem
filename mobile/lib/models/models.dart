import 'package:flutter/material.dart';

enum StockStatus { safe, critical, anomaly, discrepancy }

enum ScanMode { single, putaway, dispatch }

enum MovementKind { stockIn, stockOut, putaway, rackCount }

class StockItem {
  final int? id;
  final String sku, name;
  String rack, zone;
  int quantity;
  final int minimum;
  final double dailyUsage;
  final double price;
  final String unit;
  final String? category;
  final String? supplier;
  bool anomaly, discrepancy, pendingVerification;
  DateTime? verifiedAt;
  final Map<String, int> rackCounts = {};
  StockItem({
    this.id,
    required this.sku,
    required this.name,
    required this.rack,
    required this.zone,
    required this.quantity,
    required this.minimum,
    required this.dailyUsage,
    this.price = 0,
    this.unit = 'pcs',
    this.category,
    this.supplier,
    this.anomaly = false,
    this.discrepancy = false,
    this.pendingVerification = false,
  }) {
    rackCounts[rack] = quantity;
  }
  StockStatus get status =>
      anomaly
          ? StockStatus.anomaly
          : discrepancy
          ? StockStatus.discrepancy
          : quantity < minimum
          ? StockStatus.critical
          : StockStatus.safe;
  double get daysLeft => dailyUsage == 0 ? 0 : quantity / dailyUsage;
}

class StockFilter {
  final Set<StockStatus> statuses;
  final String zone;
  final bool pendingOnly;
  final String sort;
  const StockFilter({
    this.statuses = const {},
    this.zone = 'All Zones',
    this.pendingOnly = false,
    this.sort = 'Urgency',
  });
  bool get active =>
      statuses.isNotEmpty ||
      zone != 'All Zones' ||
      pendingOnly ||
      sort != 'Urgency';
}

class Activity {
  final String title, detail;
  final DateTime time;
  final MovementKind? kind;
  final int quantity;
  Activity(
    this.title,
    this.detail, {
    this.kind,
    this.quantity = 0,
    DateTime? time,
  }) : time = time ?? DateTime.now();
}

class WarehouseAlert {
  final String id, title, message, badge, sku;
  final String action;
  bool read;
  WarehouseAlert({
    required this.id,
    required this.title,
    required this.message,
    required this.badge,
    required this.sku,
    required this.action,
    this.read = false,
  });
}

class Staff {
  int? id;
  String name = '', email = '';
  String phone = '', staffId = '', badge = '';
  String emergency = '';
  String role = 'staf';
  bool haptics = true,
      localAcoustic = true,
      highContrast = false,
      biometric = true;
}

String statusLabel(StockStatus s) => switch (s) {
  StockStatus.safe => 'SAFE STOCK',
  StockStatus.critical => 'CRITICAL / SHORTAGE',
  StockStatus.anomaly => 'VELOCITY ANOMALY',
  StockStatus.discrepancy => 'STOCK DISCREPANCY',
};
Color statusColor(StockStatus s) => switch (s) {
  StockStatus.safe => const Color(0xff439e8a), // mint (warna angka 33.3% di ringkasan stok)
  StockStatus.critical => const Color(0xffe11d48),
  StockStatus.anomaly => const Color(0xffe11d48),
  StockStatus.discrepancy => const Color(0xffd97706),
};
String clock(DateTime time) =>
    '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
