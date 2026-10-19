import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/task_chart.dart';
import '../widgets/warehouse_sections.dart';
import '../core/app_theme.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: line),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            children: [
              const Icon(Icons.person_outline, size: 13, color: olive),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  '${s.staff.name} • ${s.currentShift}',
                  style: const TextStyle(fontSize: 8, color: muted),
                ),
              ),
              Tag(s.isBackendConnected ? 'DB Connected' : 'Local / Offline'),
            ],
          ),
        ),
        const PageTitle(
          'Real-time Inventory Telemetry',
          '',
          icon: Icons.bar_chart,
        ),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 9,
          mainAxisSpacing: 0,
          mainAxisExtent: 148,
          children: [
            Metric(
              'Total Active SKU',
              '${s.items.length}',
              '${s.items.length} produk terdaftar',
              icon: Icons.inventory_2_outlined,
            ),
            Metric(
              'Total Stock Units',
              '${s.totalStockUnits}',
              'Total stok fisik saat ini',
              icon: Icons.layers_outlined,
            ),
            Metric(
              'Total Inbound\nToday',
              '${s.inflow}',
              s.inflow > 0
                  ? '${s.inflow} unit masuk hari ini'
                  : 'Belum ada barang masuk',
              icon: Icons.move_to_inbox_outlined,
            ),
            Metric(
              'Total Outbound\nToday',
              '${s.outflow}',
              s.outflow > 0
                  ? '${s.outflow} unit keluar hari ini'
                  : 'Belum ada barang keluar',
              icon: Icons.outbox_outlined,
            ),
            Metric(
              'Critical Stocks',
              '${s.criticalCount}',
              s.criticalCount > 0 ? 'Perlu tindakan segera' : 'Semua stok aman',
              color: s.criticalCount > 0 ? Colors.red : olive,
              icon: Icons.error_outline,
            ),
            Metric(
              'Pending Tasks',
              '${s.alerts.length}',
              s.alerts.isNotEmpty
                  ? '${s.alerts.length} tugas aktif'
                  : 'Tidak ada tugas pending',
              icon: Icons.assignment_outlined,
            ),
          ],
        ),
        Panel(
          child: TaskChart(
            inflow: s.inflow,
            outflow: s.outflow,
            inflowSeries: s.weeklyInflow,
            outflowSeries: s.weeklyOutflow,
          ),
        ),
        Panel(
          child: Column(
            children: [
              SectionHeading(
                'AI Insight & Operational Alerts',
                'Predictive telemetry & proactive stock safety',
                Icons.psychology_outlined,
                trailing: Tag(
                  '${s.items.where((i) => i.status != StockStatus.safe).length} Active',
                  color: s.items.any((i) => i.status != StockStatus.safe)
                      ? Colors.red
                      : mint,
                ),
              ),
              if (s.items
                  .where(
                    (i) =>
                        i.status == StockStatus.critical ||
                        i.status == StockStatus.anomaly,
                  )
                  .isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: Text(
                      'Semua stok barang dalam kondisi aman.',
                      style: TextStyle(fontSize: 10, color: muted),
                    ),
                  ),
                )
              else
                ...s.items
                    .where(
                      (i) =>
                          i.status == StockStatus.critical ||
                          i.status == StockStatus.anomaly,
                    )
                    .map((i) => InsightCard(i, compact: true)),
            ],
          ),
        ),
        Panel(
          child: Column(
            children: [
              const SectionHeading(
                'Inventory Items (Database)',
                'Daftar stok produk dari MySQL',
                Icons.inventory_outlined,
              ),
              if (s.items.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: Text(
                      'Belum ada produk di database.',
                      style: TextStyle(fontSize: 10, color: muted),
                    ),
                  ),
                )
              else
                ...s.items.map((i) => StockCard(i, compact: true)),
            ],
          ),
        ),
        if (s.orders.isNotEmpty)
          Panel(
            child: Column(
              children: [
                const SectionHeading(
                  'Pending Purchase Orders',
                  'Requires Ops Lead Sign-off',
                  Icons.folder_outlined,
                ),
                ...s.orders.map((po) => OrderCard(po, s.bySku(po.sku))),
              ],
            ),
          ),
        Panel(
          child: Column(
            children: [
              const SectionHeading(
                'Warehouse Activity Audit Trail',
                'Shift & Live Scan Feed',
                Icons.history,
              ),
              AuditEntries(s.activities.take(3).toList()),
            ],
          ),
        ),
      ],
    );
  }
}
