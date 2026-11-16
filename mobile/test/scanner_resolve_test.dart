import 'package:flutter_test/flutter_test.dart';
import 'package:susuno_mobile/models/models.dart';
import 'package:susuno_mobile/state/warehouse_state.dart';

void main() {
  group('WarehouseState QR and Barcode Resolver', () {
    late WarehouseState state;

    setUp(() {
      state = WarehouseState();
      state.addTestItem(
        StockItem(
          id: 1,
          sku: 'CYCGRG',
          name: 'Cycle Guard Ring',
          rack: 'A-01',
          zone: 'Zone A',
          quantity: 25,
          minimum: 10,
          dailyUsage: 2.0,
          barcode: '8991234567890',
        ),
      );
      state.addTestItem(
        StockItem(
          id: 2,
          sku: 'BRKPD-01',
          name: 'Brake Pad Standard',
          rack: 'B-02',
          zone: 'Zone B',
          quantity: 50,
          minimum: 20,
          dailyUsage: 5.0,
          barcode: '8999876543210',
        ),
      );
    });

    test('normalizeRackCode cleans JSON, prefixes, and decorators', () {
      expect(state.normalizeRackCode('A-01'), 'A-01');
      expect(state.normalizeRackCode('RACK: A-01'), 'A-01');
      expect(state.normalizeRackCode('LOC: B-02'), 'B-02');
      expect(state.normalizeRackCode('{"rack":"C-03"}'), 'C-03');
      expect(state.normalizeRackCode('{"location_code":"D-04"}'), 'D-04');
      expect(state.normalizeRackCode('║▌║ RACK-A1-01-A ║▌║'), 'RACK-A1-01-A');
    });

    test('validRack accepts common warehouse rack and dock formats', () {
      expect(state.validRack('A-01'), isTrue);
      expect(state.validRack('B-05'), isTrue);
      expect(state.validRack('RACK-A1-01-A'), isTrue);
      expect(state.validRack('RACK-D2-03-B'), isTrue);
      expect(state.validRack('DOCK-STAGING'), isTrue);
      expect(state.validRack('DOK-01'), isTrue);
      expect(state.validRack('{"rack":"A-01"}'), isTrue);
      expect(state.validRack('RACK: B-02'), isTrue);
      expect(state.validRack('INVALID_RACK_CODE_XYZ'), isFalse);
    });

    test('resolve matches direct SKU', () {
      final item = state.resolve('CYCGRG');
      expect(item, isNotNull);
      expect(item!.sku, 'CYCGRG');

      final lower = state.resolve('cycgrg');
      expect(lower, isNotNull);
      expect(lower!.sku, 'CYCGRG');
    });

    test('resolve matches physical barcode', () {
      final item = state.resolve('8991234567890');
      expect(item, isNotNull);
      expect(item!.sku, 'CYCGRG');
    });

    test('resolve matches Web-generated Master QR Code (SKU-BatchCode)', () {
      // Format: CYCGRG-26111601
      final item = state.resolve('CYCGRG-26111601');
      expect(item, isNotNull);
      expect(item!.sku, 'CYCGRG');
    });

    test('resolve matches Web-generated Sequential Serial QR Code (SKU-BatchCode-Serial)', () {
      // Format: CYCGRG-26111601-001
      final item = state.resolve('CYCGRG-26111601-001');
      expect(item, isNotNull);
      expect(item!.sku, 'CYCGRG');
    });

    test('resolve matches SKU with dash in name like BRKPD-01 batch/serial', () {
      // Format: BRKPD-01-26111601-005
      final item = state.resolve('BRKPD-01-26111601-005');
      expect(item, isNotNull);
      expect(item!.sku, 'BRKPD-01');
    });

    test('resolve parses JSON payload QR', () {
      final itemSku = state.resolve('{"sku":"CYCGRG"}');
      expect(itemSku, isNotNull);
      expect(itemSku!.sku, 'CYCGRG');

      final itemBarcode = state.resolve('{"barcode":"8999876543210"}');
      expect(itemBarcode, isNotNull);
      expect(itemBarcode!.sku, 'BRKPD-01');
    });

    test('resolve strips prefixes and barcode decorators', () {
      final itemPrefix = state.resolve('SKU: CYCGRG');
      expect(itemPrefix, isNotNull);
      expect(itemPrefix!.sku, 'CYCGRG');

      final itemDecorated = state.resolve('║▌║ BRKPD-01 ║▌║');
      expect(itemDecorated, isNotNull);
      expect(itemDecorated!.sku, 'BRKPD-01');
    });
  });
}
