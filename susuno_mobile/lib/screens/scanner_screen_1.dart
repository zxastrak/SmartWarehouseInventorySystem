import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/barcode_input.dart';
import '../core/app_theme.dart';
import 'stock_flows.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late ScanMode mode;
  late MovementKind kind;
  String? sku, rack;
  int quantity = 1;
  bool checked = false;
  @override
  void initState() {
    super.initState();
    final s = context.read<WarehouseState>();
    mode = s.scanMode;
    kind = s.scanKind;
    sku = s.scanSku;
  }

  void itemScanned(String code) {
    final item = context.read<WarehouseState>().resolve(code);
    if (item == null || item.sku != code.toUpperCase()) {
      message(context, 'Item barcode not found. Use a known SKU.');
      return;
    }
    setState(() {
      sku = item.sku;
      quantity = 1;
      rack = null;
      checked = false;
    });
  }

  void rackScanned(String code) {
    final s = context.read<WarehouseState>();
    if (!s.validRack(code)) {
      message(context, 'Invalid rack barcode format.');
      return;
    }
    setState(() {
      rack = code.toUpperCase();
      checked = false;
    });
  }

  void save() {
    if (sku == null) {
      message(context, 'Scan an item first.');
      return;
    }
    if (!checked) {
      message(context, 'Confirm the physical count before saving.');
      return;
    }
    if (mode != ScanMode.single && rack == null) {
      message(context, 'Scan the destination rack first.');
      return;
    }
    final s = context.read<WarehouseState>();
    final error = s.saveMovement(
      sku: sku!,
      quantity: quantity,
      kind: mode == ScanMode.putaway ? MovementKind.putaway : kind,
      rack: mode == ScanMode.single ? null : rack,
    );
    if (error != null) {
      message(context, error);
      return;
    }
    message(context, 'Saved. Stock, activity logs and dashboard updated.');
    setState(() {
      sku = null;
      rack = null;
      quantity = 1;
      checked = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = sku == null ? null : s.bySku(sku!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Panel(
          child: PageTitle(
            'SUSUNO Floor Scan',
            'Physical Audit Protocol',
            trailing: Tag('● Zebra TC-57', color: Color(0xff506b9d)),
          ),
        ),
        Wrap(
          spacing: 5,
          runSpacing: 5,
          children:
              ScanMode.values
                  .map(
                    (m) => ChoiceChip(
                      label: Text(switch (m) {
                        ScanMode.single => 'Single Scan',
                        ScanMode.itemRack => 'Scan Item & Rack',
                        ScanMode.putaway => 'Putaway',
                      }),
                      selected: mode == m,
                      onSelected:
                          (_) => setState(() {
                            mode = m;
                            rack = null;
                            checked = false;
                          }),
                    ),
                  )
                  .toList(),
        ),
        const SizedBox(height: 10),
        if (mode != ScanMode.putaway)
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Stock In'),
                selected: kind == MovementKind.stockIn,
                onSelected:
                    (_) => setState(() {
                      kind = MovementKind.stockIn;
                      checked = false;
                    }),
              ),
              ChoiceChip(
                label: const Text('Stock Out'),
                selected: kind == MovementKind.stockOut,
                onSelected:
                    (_) => setState(() {
                      kind = MovementKind.stockOut;
                      checked = false;
                    }),
              ),
            ],
          ),
        const SizedBox(height: 18),
        BarcodeInput(
          title: 'Scan item barcode',
          demoCode: 'SKU-9249',
          onResult: itemScanned,
        ),
        if (mode != ScanMode.single)
          BarcodeInput(
            title: 'Scan destination rack',
            demoCode:
                mode == ScanMode.putaway
                    ? 'RACK-D3-01-A'
                    : item?.rack ?? 'RACK-A4-02-B',
            onResult: rackScanned,
          ),
        if (item != null) ...[
          StockCard(item, compact: true),
          if (rack != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Tag('Destination: $rack'),
            ),
          Panel(
            tint: const Color(0xfff8f9ff),
            child: Column(
              children: [
                Text(
                  mode == ScanMode.putaway
                      ? 'Units to relocate (total stock remains unchanged)'
                      : 'Units in this stock movement',
                  style: const TextStyle(fontSize: 11, color: muted),
                ),
                CountControl(
                  system:
                      mode == ScanMode.putaway
                          ? (item.rackCounts[item.rack] ?? 0)
                          : null,
                  value: quantity,
                  onChanged:
                      (n) => setState(() {
                        quantity = n;
                        checked = false;
                      }),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: checked,
                  title: const Text(
                    'I physically counted and checked these units',
                    style: TextStyle(fontSize: 11),
                  ),
                  onChanged: (v) => setState(() => checked = v ?? false),
                ),
              ],
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: save,
              icon: const Icon(Icons.check),
              label: const Text('Confirm Physical Count & Save'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => openDiscrepancy(context, item.sku),
              icon: const Icon(Icons.warning_amber, color: Colors.orange),
              label: const Text('Report Quantity Mismatch'),
            ),
          ),
        ] else
          const Panel(
            child: Text('Scan an item to display its location and quantity.'),
          ),
      ],
    );
  }
}
