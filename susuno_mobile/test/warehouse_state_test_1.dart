import 'package:flutter_test/flutter_test.dart';
import 'package:susuno_mobile/state/warehouse_state.dart';
import 'package:susuno_mobile/models/models.dart';

void main() {
  test('Invalid credentials do not enter the application', () {
    final s = WarehouseState();
    expect(s.login('wrong@example.com', 'wrong'), isNotNull);
    expect(s.loggedIn, isFalse);
    expect(s.login('tabinanaila@staff.co.id', 'Susuno123!'), isNull);
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
}
