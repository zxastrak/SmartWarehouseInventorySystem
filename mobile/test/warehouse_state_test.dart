import 'package:flutter_test/flutter_test.dart';
import 'package:susuno_mobile/state/warehouse_state.dart';
import 'package:susuno_mobile/models/models.dart';

void main() {
  test('Invalid credentials do not enter the application', () async {
    final s = WarehouseState();
    expect(await s.login('wrong@example.com', 'wrong'), isNotNull);
    expect(s.loggedIn, isFalse);
    expect(await s.login('tabinanaila@staff.co.id', 'Susuno123!'), isNull);
    expect(s.loggedIn, isTrue);
    s.logout();
    expect(s.loggedIn, isFalse);
  });
  test('Confirmed stock movement updates stock, log and totals together', () {
    final s = WarehouseState();
    final item = s.bySku('SKU-9249');
    final before = item.quantity;
    final incoming = s.inflow;
    final logs = s.movements.length;
    var notifications = 0;
    s.addListener(() => notifications++);
    expect(
      s.saveMovement(sku: item.sku, quantity: 10, kind: MovementKind.stockIn),
      isNull,
    );
    expect(item.quantity, before + 10);
    expect(s.inflow, incoming + 10);
    expect(s.movements.length, logs + 1);
    expect(notifications, 1);
    expect(
      s.saveMovement(sku: item.sku, quantity: 10, kind: MovementKind.stockOut),
      isNull,
    );
    expect(item.quantity, before);
  });
  test('Rejected stock out leaves quantities and logs unchanged', () {
    final s = WarehouseState();
    final item = s.bySku('SKU-9249');
    final before = item.quantity;
    final logs = s.activities.length;
    expect(
      s.saveMovement(
        sku: item.sku,
        quantity: before + 1,
        kind: MovementKind.stockOut,
      ),
      isNotNull,
    );
    expect(item.quantity, before);
    expect(s.activities.length, logs);
  });
  test('Putaway moves rack balances while preserving total stock', () {
    final s = WarehouseState();
    final item = s.bySku('SKU-911');
    final before = item.quantity;
    final source = item.rack;
    final incoming = s.inflow;
    final outgoing = s.outflow;
    expect(
      s.saveMovement(
        sku: item.sku,
        quantity: 20,
        kind: MovementKind.putaway,
        rack: 'RACK-D3-01-A',
      ),
      isNull,
    );
    expect(item.quantity, before);
    expect(item.rackCounts[source], before - 20);
    expect(item.rackCounts['RACK-D3-01-A'], 20);
    expect(s.inflow, incoming);
    expect(s.outflow, outgoing);
  });
  test('Mismatch reports do not silently change quantities', () {
    final s = WarehouseState();
    final item = s.bySku('SKU-9249');
    final before = item.quantity;
    expect(
      s.report(item.sku, before - 2, 'Two units are missing from the rack'),
      isNull,
    );
    expect(item.quantity, before);
    expect(item.discrepancy, isTrue);
    expect(item.pendingVerification, isTrue);
  });
  test(
    'Physical rack count requires confirmation and applies the correction',
    () {
      final s = WarehouseState();
      final item = s.bySku('SKU-9249');
      final before = item.quantity;
      expect(s.saveRackCount(item.sku, before - 1, false), isNotNull);
      expect(item.quantity, before);
      expect(s.verifyRack(item.sku, 'RACK-B2-01-C'), isNotNull);
      expect(s.verifyRack(item.sku, item.rack), isNull);
      expect(s.saveRackCount(item.sku, before - 1, true), isNull);
      expect(item.quantity, before - 1);
      expect(item.verifiedAt, isNotNull);
    },
  );
  test('Selected conditions are OR matched and zone is AND matched', () {
    final s = WarehouseState();
    s.applyFilter(
      const StockFilter(
        statuses: {StockStatus.critical, StockStatus.anomaly},
        zone: 'Zone A',
      ),
    );
    expect(s.filteredItems, isNotEmpty);
    expect(s.filteredItems.every((i) => i.zone == 'Zone A'), isTrue);
    expect(
      s.filteredItems.every(
        (i) => {StockStatus.critical, StockStatus.anomaly}.contains(i.status),
      ),
      isTrue,
    );
  });

  test('Attendance check-in and check-out update status and log activity', () async {
    final s = WarehouseState();
    expect(s.isCheckedIn, isFalse);
    expect(s.lastAttendanceTime, isNull);

    // Check in
    final inRes = await s.checkIn();
    expect(inRes, isNull);
    expect(s.isCheckedIn, isTrue);
    expect(s.lastAttendanceTime, isNotNull);
    expect(s.activities.first.title, 'Check-in Masuk');

    // Check out
    final outRes = await s.checkOut();
    expect(outRes, isNull);
    expect(s.isCheckedIn, isFalse);
    expect(s.activities.first.title, 'Check-out Pulang');
  });

  test('Tasks can be updated and taken over by staff', () async {
    final s = WarehouseState();
    s.tasks = [
      {
        'id': 101,
        'title': 'Pindahkan Box ke Rak B',
        'status': 'pending',
        'current_assignee_id': s.staff.id,
      },
      {
        'id': 102,
        'title': 'Audit Rak C',
        'status': 'pending',
        'current_assignee_id': 999,
        'assignee_name': 'Ahmad',
      },
    ];

    // Update status to in_progress
    await s.updateTaskStatus(101, 'in_progress');
    expect(s.tasks.firstWhere((t) => t['id'] == 101)['status'], 'in_progress');

    // Takeover task 102
    await s.takeOverTask(102);
    expect(s.tasks.firstWhere((t) => t['id'] == 102)['current_assignee_id'], s.staff.id);
  });

  test('validRack accepts locations from database and standard regex', () {
    final s = WarehouseState();
    s.locations = [
      {'id': 1, 'location_code': 'CUSTOM-LOC-01', 'zone': 'Zone X'},
    ];

    expect(s.validRack('CUSTOM-LOC-01'), isTrue);
    expect(s.validRack('RACK-A1-01-A'), isTrue);
    expect(s.validRack('INVALID-LOCATION-XYZ'), isFalse);
  });
}
