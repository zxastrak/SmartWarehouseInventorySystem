import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../core/app_theme.dart';
import '../widgets/warehouse_sections.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});
  void details(BuildContext context, PurchaseOrder po) {
    final i = context.read<WarehouseState>().bySku(po.sku);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder:
          (c) => SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PageTitle(po.id, 'Purchase order details • staff read-only'),
                  StockCard(i),
                  Text(
                    'Ordered quantity: ${po.quantity} units\nStatus: ${po.status}\nExpected arrival: ${po.arrival}\n'
                    'Value: IDR ${po.price.toStringAsFixed(0)}\nCreated by: Manager\n'
                    'Receiving location: Dock 02\nSupplier: ${po.sku == 'SKU-9249' ? 'Nippon Precision Co.' : 'Warehouse Partner'}',
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.pop(c),
                      child: const Text('Close Details'),
                    ),
                  ),
                ],
              ),
            ),
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    return Column(
      children: [
        SizedBox(
          height: 144,
          child: Row(
            children: [
              Expanded(
                child: Metric(
                  'Critical Stocks',
                  '${s.criticalCount}',
                  'Actions Required Immediately',
                  color: Colors.red,
                  icon: Icons.error_outline,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Metric(
                  'Pending Restock',
                  '${s.orders.length}',
                  'Orders • Valuation IDR 142,500',
                  icon: Icons.inventory_outlined,
                ),
              ),
            ],
          ),
        ),
        Panel(
          padding: const EdgeInsets.symmetric(vertical: 9),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (final entry in [
                (Icons.hourglass_empty, 'Pending (${s.orders.length})', amber),
                (Icons.check_circle_outline, 'Approved', olive),
                (
                  Icons.local_shipping_outlined,
                  'In Transit',
                  const Color(0xffefdf9e),
                ),
              ])
                Column(
                  children: [
                    Icon(entry.$1, size: 27, color: entry.$3),
                    const SizedBox(height: 3),
                    Text(
                      entry.$2,
                      style: const TextStyle(fontSize: 9, color: muted),
                    ),
                  ],
                ),
            ],
          ),
        ),
        Panel(
          child: Column(
            children: [
              SectionHeading(
                'Pending Purchase Orders',
                'Requires Ops Lead Sign-off',
                Icons.folder_outlined,
                trailing: Text(
                  '${s.orders.length} Pending',
                  style: const TextStyle(fontSize: 9, color: olive),
                ),
              ),
              ...s.orders.map(
                (po) => OrderCard(
                  po,
                  s.bySku(po.sku),
                  onDetails: () => details(context, po),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
