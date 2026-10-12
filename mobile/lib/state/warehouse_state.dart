import 'package:flutter/foundation.dart';
import '../models/models.dart';

class WarehouseState extends ChangeNotifier {
  final staff = Staff();
  bool loggedIn = false;
  int page = 0;
  String? scanSku;
  ScanMode scanMode = ScanMode.single;
  MovementKind scanKind = MovementKind.stockIn;
  void openScanner(
    String sku, {
    ScanMode mode = ScanMode.single,
    MovementKind kind = MovementKind.stockIn,
  }) {
    scanSku = sku;
    scanMode = mode;
    scanKind = kind;
    page = 2;
    notifyListeners();
  }

  StockFilter filter = const StockFilter();
  String search = '';
  final List<StockItem> _items = [
    StockItem(
      sku: 'SKU-9249',
      name: 'Heavy-Duty Industrial Bearings 45mm',
      rack: 'RACK-A4-02-B',
      zone: 'Zone A',
      quantity: 142,
      minimum: 500,
      dailyUsage: 79,
      pendingVerification: true,
    ),
    StockItem(
      sku: 'SKU-1844',
      name: 'High-Density Polyethylene Drum 200L',
      rack: 'RACK-B2-01-C',
      zone: 'Zone B',
      quantity: 96,
      minimum: 450,
      dailyUsage: 38,
      anomaly: true,
    ),
    StockItem(
      sku: 'SKU-482',
      name: 'Micro-Controller Integrated Board v2',
      rack: 'RACK-C1-03-A',
      zone: 'Zone C',
      quantity: 380,
      minimum: 450,
      dailyUsage: 106,
      discrepancy: true,
      pendingVerification: true,
    ),
    StockItem(
      sku: 'SKU-911',
      name: 'Lithium-Ion Battery Pack 48V 100Ah',
      rack: 'RACK-D2-02-A',
      zone: 'Zone D',
      quantity: 640,
      minimum: 250,
      dailyUsage: 35,
    ),
    StockItem(
      sku: 'SKU-610',
      name: 'Hydraulic Seal Gasket Nitrile 80 A',
      rack: 'RACK-A1-01-A',
      zone: 'Zone A',
      quantity: 7238,
      minimum: 450,
      dailyUsage: 111,
    ),
  ];
  final List<PurchaseOrder> orders = const [
    PurchaseOrder(
      'PO-8821',
      'SKU-9249',
      'Confirmed',
      'Tomorrow, 08:00',
      1200,
      308400,
    ),
    PurchaseOrder(
      'PO-8819',
      'SKU-911',
      'Inbound Ready',
      'Today, 15:00',
      500,
      472500,
    ),
    PurchaseOrder(
      'PO-8815',
      'SKU-482',
      'Urgent Buffer',
      'Tomorrow, 10:00',
      300,
      56550,
    ),
  ];
  final List<Activity> _activities = [
    Activity(
      'SKU-911 Scanned for Dispatch',
      'Dock D01 • Tabina Naila',
      kind: MovementKind.stockOut,
      quantity: 80,
    ),
    Activity(
      'Pallet Repositioning Executed',
      'RACK-C2-01-C → RACK-C1-03-A',
      kind: MovementKind.putaway,
      quantity: 20,
    ),
    Activity(
      'Barcode Exception Triggered',
      'Physical package damaged • review pending',
    ),
  ];
  final List<WarehouseAlert> alerts = [
    WarehouseAlert(
      id: 'A01',
      title: 'Inbound Dock 02 Arrival',
      message:
          'PO-8821 arrived. 1,200 bearings require physical receiving count.',
      badge: 'URGENT DOCK TASK',
      sku: 'SKU-9249',
      action: 'receiving',
    ),
    WarehouseAlert(
      id: 'A02',
      title: 'Bin Discrepancy Flagged',
      message: 'Physical rack count requires verification at RACK-A4-02-B.',
      badge: 'ANOMALY',
      sku: 'SKU-9249',
      action: 'rack',
    ),
    WarehouseAlert(
      id: 'A03',
      title: 'Putaway Task Assigned',
      message: 'Move battery packs to the assigned rack.',
      badge: 'PUTAWAY',
      sku: 'SKU-911',
      action: 'putaway',
    ),
  ];
  List<StockItem> get items => List.unmodifiable(_items);
  List<Activity> get activities => List.unmodifiable(_activities);
  List<Activity> get movements =>
      _activities
          .where(
            (a) =>
                a.kind == MovementKind.stockIn ||
                a.kind == MovementKind.stockOut,
          )
          .toList();
  StockItem bySku(String sku) => _items.firstWhere((i) => i.sku == sku);
  StockItem? resolve(String code) {
    final normalized = code.trim().toUpperCase();
    for (final i in _items) {
      if (i.sku == normalized || i.rackCounts.containsKey(normalized)) return i;
    }
    return null;
  }

  bool validRack(String rack) => RegExp(
    r'^RACK-[A-D][0-9]+-[0-9]+-[A-Z]$',
  ).hasMatch(rack.trim().toUpperCase());
  double get safePercent =>
      _items.where((i) => i.status == StockStatus.safe).length /
      _items.length *
      100;
  int get criticalCount => _items.where((i) => i.quantity < i.minimum).length;
  int get pendingCount => _items.where((i) => i.pendingVerification).length;
  int get inflow => _todayTotal(MovementKind.stockIn);
  int get outflow => _todayTotal(MovementKind.stockOut);
  int _todayTotal(MovementKind kind) {
    final now = DateTime.now();
    return _activities
        .where(
          (a) =>
              a.kind == kind &&
              a.time.year == now.year &&
              a.time.month == now.month &&
              a.time.day == now.day,
        )
        .fold(0, (sum, a) => sum + a.quantity);
  }

  int get inboundTotal => 12450 + inflow;
  int get outboundTotal => 15820 + outflow;
  List<StockItem> get filteredItems {
    final q = search.trim().toLowerCase();
    final list =
        _items
            .where(
              (i) =>
                  (q.isEmpty ||
                      '${i.name} ${i.sku} ${i.rackCounts.keys.join(' ')} ${i.zone}'
                          .toLowerCase()
                          .contains(q)) &&
                  (filter.statuses.isEmpty ||
                      filter.statuses.contains(i.status)) &&
                  (filter.zone == 'All Zones' ||
                      i.rackCounts.entries.any(
                        (e) =>
                            e.value > 0 &&
                            'Zone ${e.key.substring(5, 6)}' == filter.zone,
                      )) &&
                  (!filter.pendingOnly || i.pendingVerification),
            )
            .toList();
    if (filter.sort == 'SKU') {
      list.sort((a, b) => a.sku.compareTo(b.sku));
    } else if (filter.sort == 'Days Left') {
      list.sort((a, b) => a.daysLeft.compareTo(b.daysLeft));
    } else {
      int priority(StockItem i) => switch (i.status) {
        StockStatus.critical => 0,
        StockStatus.anomaly => 1,
        StockStatus.discrepancy => 2,
        StockStatus.safe => 3,
      };
      list.sort((a, b) => priority(a).compareTo(priority(b)));
    }
    return list;
  }

  String? login(String email, String password) {
    if (email.trim().toLowerCase() != staff.email.toLowerCase() ||
        password != 'Susuno123!') {
      return 'Invalid employee email or password.';
    }
    loggedIn = true;
    page = 0;
    notifyListeners();
    return null;
  }

  void logout() {
    loggedIn = false;
    page = 0;
    notifyListeners();
  }

  void navigate(int value) {
    page = value;
    notifyListeners();
  }

  void setSearch(String value) {
    search = value;
    notifyListeners();
  }

  void applyFilter(StockFilter value) {
    filter = value;
    notifyListeners();
  }

  void readAlert(String id) {
    alerts.firstWhere((a) => a.id == id).read = true;
    notifyListeners();
  }

  String? saveMovement({
    required String sku,
    required int quantity,
    required MovementKind kind,
    String? rack,
  }) {
    if (quantity <= 0) return 'Quantity must be greater than zero.';
    final item = bySku(sku);
    final location = (rack ?? item.rack).toUpperCase();
    if (!validRack(location)) return 'Scan a valid rack barcode.';
    if (kind == MovementKind.stockOut) {
      final available = item.rackCounts[location] ?? 0;
      if (quantity > available) {
        return 'Stock out exceeds rack stock ($available units).';
      }
      item.rackCounts[location] = available - quantity;
      item.quantity -= quantity;
    } else if (kind == MovementKind.stockIn) {
      item.rackCounts[location] = (item.rackCounts[location] ?? 0) + quantity;
      item.quantity += quantity;
    } else if (kind == MovementKind.putaway) {
      if (rack == null) return 'Scan a destination rack first.';
      if (location == item.rack) {
        return 'Destination must differ from the source rack.';
      }
      final available = item.rackCounts[item.rack] ?? 0;
      if (quantity > available) {
        return 'Putaway exceeds stock in source rack ($available).';
      }
      item.rackCounts[item.rack] = available - quantity;
      item.rackCounts[location] = (item.rackCounts[location] ?? 0) + quantity;
      if (item.rackCounts[item.rack] == 0) {
        item.rack = location;
        item.zone = 'Zone ${location.substring(5, 6)}';
      }
    } else {
      return 'Use the rack verification flow for physical counts.';
    }
    _activities.insert(
      0,
      Activity(
        '${kind.name} • ${item.name}',
        '${item.sku} • $location • ${staff.name}',
        kind: kind,
        quantity: quantity,
      ),
    );
    scanSku = null;
    notifyListeners();
    return null;
  }

  String? verifyRack(String sku, String rack) {
    if (rack.trim().toUpperCase() != bySku(sku).rack) {
      return 'Wrong rack. Scan ${bySku(sku).rack}.';
    }
    return null;
  }

  String? saveRackCount(String sku, int quantity, bool checked) {
    if (!checked) return 'Confirm that you physically counted all units.';
    if (quantity < 0) return 'Count cannot be negative.';
    final item = bySku(sku);
    final previous = item.rackCounts[item.rack] ?? 0;
    item.quantity += quantity - previous;
    item.rackCounts[item.rack] = quantity;
    item.discrepancy = false;
    item.pendingVerification = false;
    item.verifiedAt = DateTime.now();
    _activities.insert(
      0,
      Activity(
        'Rack count verified',
        '${item.sku} • ${item.rack} • system $previous → physical $quantity',
        kind: MovementKind.rackCount,
        quantity: quantity,
      ),
    );
    notifyListeners();
    return null;
  }

  String? report(String sku, int physical, String reason) {
    final item = bySku(sku);
    if (physical < 0) return 'Physical count cannot be negative.';
    if (physical == item.quantity) return 'No quantity discrepancy was found.';
    if (reason.trim().length < 5) {
      return 'Please explain the discrepancy (min. 5 characters).';
    }
    item.discrepancy = true;
    item.pendingVerification = true;
    _activities.insert(
      0,
      Activity(
        'Stock discrepancy reported',
        '${item.sku} • system ${item.quantity}, physical $physical • ${reason.trim()}',
      ),
    );
    alerts.insert(
      0,
      WarehouseAlert(
        id: 'R${DateTime.now().microsecondsSinceEpoch}',
        title: 'Discrepancy awaiting manager review',
        message: '${item.sku}: ${reason.trim()}',
        badge: 'ANOMALY',
        sku: sku,
        action: 'rack',
      ),
    );
    notifyListeners();
    return null;
  }

  String? updateStaff(String name, String phone, String emergency) {
    if (name.trim().isEmpty) return 'Name cannot be empty.';
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(phone.trim())) {
      return 'Phone number is invalid.';
    }
    staff.name = name.trim();
    staff.phone = phone.trim();
    staff.emergency = emergency.trim();
    _activities.insert(0, Activity('Profile updated', staff.name));
    notifyListeners();
    return null;
  }

  void setting(String key, bool value) {
    switch (key) {
      case 'haptics':
        staff.haptics = value;
        break;
      case 'acoustic':
        staff.localAcoustic = value;
        break;
      case 'contrast':
        staff.highContrast = value;
        break;
      case 'biometric':
        staff.biometric = value;
        break;
    }
    notifyListeners();
  }
}
