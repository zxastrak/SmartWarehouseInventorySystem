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
                  '${s.staff.name} • Shift 08:00–16:00',
                  style: const TextStyle(fontSize: 8, color: muted),
                ),
              ),
              const Tag('Zebra TC-57'),
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
          mainAxisExtent: 140,
          children: [
            Metric(
              'Total Active SKU',
              '${s.items.length}',
              '+2.5% vs last week',
              icon: Icons.inventory_2_outlined,
            ),
            const Metric(
              'Total Stock Units',
              '842,910',
              '↗ +1.8%',
              icon: Icons.layers_outlined,
            ),
            Metric(
              'Total Inbound\nToday',
              '${s.inboundTotal}',
              '${s.inflow} units • On schedule',
              icon: Icons.move_to_inbox_outlined,
            ),
            Metric(
              'Total Outbound\nToday',
              '${s.outboundTotal}',
              '${s.outflow} units • Surge',
              icon: Icons.outbox_outlined,
            ),
            Metric(
              'Critical Stocks',
              '${s.criticalCount}',
              'Actions Required Immediately',
              color: Colors.red,
              icon: Icons.error_outline,
            ),
            Metric(
              'Pending Restock',
              '${s.orders.length}',
              'Valuation  IDR 142,500',
              icon: Icons.inventory_outlined,
            ),
          ],
        ),
        Panel(child: TaskChart(inflow: s.inflow, outflow: s.outflow)),
        Panel(
          child: Column(
            children: [
              SectionHeading(
                'AI Insight & Operational Alerts',
                'Predictive telemetry & proactive stock safety',
                Icons.psychology_outlined,
                trailing: Tag(
                  '${s.items.where((i) => i.status != StockStatus.safe).length} Active',
                  color: Colors.red,
                ),
              ),
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
                'Critical Stock Monitoring',
                'Showing prioritized items requiring immediate lead intervention',
                Icons.inventory_outlined,
              ),
              ...s.items.map((i) => StockCard(i, compact: true)),
            ],
          ),
        ),
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
