import 'dart:convert';
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
  final List<String> barcodes;
  Activity(
    this.title,
    this.detail, {
    this.kind,
    this.quantity = 0,
    List<String>? barcodes,
    DateTime? time,
  })  : barcodes = barcodes ?? const [],
        time = time ?? DateTime.now();
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

class InboundShipmentItemModel {
  final int? id;
  final int? productId;
  final String sku;
  final String name;
  final int orderedQty;
  int acceptedQty;
  int damagedQty;
  List<String> barcodes;
  String notes;

  InboundShipmentItemModel({
    this.id,
    this.productId,
    required this.sku,
    required this.name,
    required this.orderedQty,
    this.acceptedQty = 0,
    this.damagedQty = 0,
    List<String>? barcodes,
    this.notes = '',
  }) : barcodes = barcodes ?? [];

  factory InboundShipmentItemModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedBarcodes = [];
    if (json['barcodes'] != null) {
      if (json['barcodes'] is List) {
        parsedBarcodes = List<String>.from(json['barcodes'].map((e) => e.toString()));
      } else if (json['barcodes'] is String) {
        final str = json['barcodes'] as String;
        try {
          final decoded = jsonDecode(str);
          if (decoded is List) {
            parsedBarcodes = List<String>.from(decoded.map((e) => e.toString()));
          }
        } catch (_) {
          parsedBarcodes = str.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
        }
      }
    }

    final ord = json['ordered_qty'] ?? json['expected_quantity'] ?? json['quantity'] ?? 0;
    final acc = json['accepted_qty'] ?? json['received_quantity'] ?? 0;
    final dam = json['damaged_qty'] ?? 0;

    return InboundShipmentItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
      productId: json['product_id'] is int ? json['product_id'] : int.tryParse(json['product_id']?.toString() ?? ''),
      sku: json['product_sku'] ?? json['sku'] ?? 'SKU-000',
      name: json['product_name'] ?? json['name'] ?? 'Produk',
      orderedQty: ord is int ? ord : int.tryParse(ord.toString()) ?? 0,
      acceptedQty: acc is int ? acc : int.tryParse(acc.toString()) ?? 0,
      damagedQty: dam is int ? dam : int.tryParse(dam.toString()) ?? 0,
      barcodes: parsedBarcodes,
      notes: json['notes']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (productId != null) 'product_id': productId,
      'sku': sku,
      'name': name,
      'ordered_qty': orderedQty,
      'accepted_qty': acceptedQty,
      'damaged_qty': damagedQty,
      'barcodes': barcodes,
      'notes': notes,
    };
  }
}

class InboundShipmentModel {
  final dynamic id;
  final String inboundNumber;
  final String? poNumber;
  final String supplierName;
  final String scheduledDate;
  final String scheduledTime;
  final String dock;
  final String status;
  final String assignedStaff;
  final String? carrier;
  final String? reference;
  final int units;
  final String? notes;
  final List<InboundShipmentItemModel> items;

  InboundShipmentModel({
    required this.id,
    required this.inboundNumber,
    this.poNumber,
    required this.supplierName,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.dock,
    required this.status,
    required this.assignedStaff,
    this.carrier,
    this.reference,
    required this.units,
    this.notes,
    required this.items,
  });

  factory InboundShipmentModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    List<InboundShipmentItemModel> parsedItems = [];
    if (rawItems is List) {
      parsedItems = rawItems
          .map((it) => InboundShipmentItemModel.fromJson(Map<String, dynamic>.from(it)))
          .toList();
    }

    final rawId = json['id'] ?? json['inbound_number'] ?? '0';
    final inbNum = json['inbound_number'] ?? 'INB-$rawId';
    final poNum = json['po_number_from_db'] ?? json['po_number'] ?? json['purchase_order_id']?.toString();
    final sup = json['supplier_name_from_db'] ?? json['supplier_name'] ?? json['supplier'] ?? 'Supplier';
    final date = json['scheduled_date']?.toString() ?? DateTime.now().toIso8601String().substring(0, 10);
    final time = json['scheduled_time']?.toString() ?? '08:00';
    final dockStr = json['dock']?.toString() ?? 'D-01';
    final stat = json['status']?.toString() ?? 'Scheduled';
    final staff = json['assigned_staff']?.toString() ?? 'Staff';
    final carr = json['carrier']?.toString();
    final ref = json['reference']?.toString();
    final u = json['units'] is int ? json['units'] : int.tryParse(json['units']?.toString() ?? '0') ?? 0;
    final n = json['notes']?.toString();

    return InboundShipmentModel(
      id: rawId,
      inboundNumber: inbNum,
      poNumber: poNum,
      supplierName: sup,
      scheduledDate: date.length >= 10 ? date.substring(0, 10) : date,
      scheduledTime: time.length >= 5 ? time.substring(0, 5) : time,
      dock: dockStr,
      status: stat,
      assignedStaff: staff,
      carrier: carr,
      reference: ref,
      units: u,
      notes: n,
      items: parsedItems,
    );
  }
}

class OutboundShipmentItemModel {
  final int? id;
  final int? productId;
  final String sku;
  final String name;
  final String rack;
  final int orderedQty;
  int fulfilledQty;
  int damagedQty;
  List<String> barcodes;
  String notes;

  OutboundShipmentItemModel({
    this.id,
    this.productId,
    required this.sku,
    required this.name,
    this.rack = 'A-01',
    required this.orderedQty,
    this.fulfilledQty = 0,
    this.damagedQty = 0,
    List<String>? barcodes,
    this.notes = '',
  }) : barcodes = barcodes ?? [];

  factory OutboundShipmentItemModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedBarcodes = [];
    if (json['barcodes'] != null) {
      if (json['barcodes'] is List) {
        parsedBarcodes = List<String>.from(json['barcodes'].map((b) => b.toString()));
      } else if (json['barcodes'] is String) {
        final str = json['barcodes'] as String;
        try {
          final decoded = jsonDecode(str);
          if (decoded is List) {
            parsedBarcodes = List<String>.from(decoded.map((b) => b.toString()));
          }
        } catch (_) {
          parsedBarcodes = str.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
        }
      }
    }

    final rawOrdered = json['ordered_qty'] ?? json['requested_qty'] ?? json['quantity'] ?? 0;
    final ord = rawOrdered is int ? rawOrdered : int.tryParse(rawOrdered.toString()) ?? 0;

    final rawFulfilled = json['fulfilled_qty'] ?? json['shipped_qty'] ?? json['accepted_qty'] ?? 0;
    final ful = rawFulfilled is int ? rawFulfilled : int.tryParse(rawFulfilled.toString()) ?? 0;

    final rawDamaged = json['damaged_qty'] ?? 0;
    final dam = rawDamaged is int ? rawDamaged : int.tryParse(rawDamaged.toString()) ?? 0;

    return OutboundShipmentItemModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
      productId: json['product_id'] is int ? json['product_id'] : int.tryParse(json['product_id']?.toString() ?? ''),
      sku: json['sku'] ?? json['product_sku'] ?? '',
      name: json['name'] ?? json['product_name'] ?? 'Item',
      rack: json['rack']?.toString() ?? 'A-01',
      orderedQty: ord,
      fulfilledQty: ful,
      damagedQty: dam,
      barcodes: parsedBarcodes,
      notes: json['notes'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'product_id': productId,
      'sku': sku,
      'name': name,
      'ordered_qty': orderedQty,
      'fulfilled_qty': fulfilledQty,
      'damaged_qty': damagedQty,
      'barcodes': barcodes,
      'notes': notes,
    };
  }
}

class OutboundShipmentModel {
  final dynamic id;
  final String outboundNumber;
  final String destination;
  final String? reference;
  final String scheduledDate;
  final String scheduledTime;
  final String dock;
  final String status;
  final String assignedStaff;
  final String? carrier;
  final int units;
  final String? notes;
  final List<OutboundShipmentItemModel> items;

  OutboundShipmentModel({
    required this.id,
    required this.outboundNumber,
    required this.destination,
    this.reference,
    required this.scheduledDate,
    required this.scheduledTime,
    required this.dock,
    required this.status,
    required this.assignedStaff,
    this.carrier,
    required this.units,
    this.notes,
    required this.items,
  });

  factory OutboundShipmentModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    List<OutboundShipmentItemModel> parsedItems = [];
    if (rawItems is List) {
      parsedItems = rawItems
          .map((it) => OutboundShipmentItemModel.fromJson(Map<String, dynamic>.from(it)))
          .toList();
    }

    final rawId = json['id'] ?? json['outbound_number'] ?? '0';
    final outNum = json['outbound_number'] ?? 'OUT-$rawId';
    final dest = json['destination'] ?? 'Customer';
    final ref = json['reference']?.toString();
    final date = json['scheduled_date']?.toString() ?? DateTime.now().toIso8601String().substring(0, 10);
    final time = json['scheduled_time']?.toString() ?? '09:00';
    final dockStr = json['dock']?.toString() ?? '1';
    final stat = json['status']?.toString() ?? 'Scheduled';
    final staff = json['assigned_staff']?.toString() ?? 'Staff';
    final carr = json['carrier']?.toString();
    final u = json['units'] is int ? json['units'] : int.tryParse(json['units']?.toString() ?? '0') ?? 0;
    final n = json['notes']?.toString();

    return OutboundShipmentModel(
      id: rawId,
      outboundNumber: outNum,
      destination: dest,
      reference: ref,
      scheduledDate: date.length >= 10 ? date.substring(0, 10) : date,
      scheduledTime: time.length >= 5 ? time.substring(0, 5) : time,
      dock: dockStr,
      status: stat,
      assignedStaff: staff,
      carrier: carr,
      units: u,
      notes: n,
      items: parsedItems,
    );
  }
}
