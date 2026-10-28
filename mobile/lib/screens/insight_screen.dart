import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';
import '../widgets/ui.dart';
import '../widgets/warehouse_sections.dart';

class InsightScreen extends StatelessWidget {
  const InsightScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final active = s.items.where((i) => i.status != StockStatus.safe).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeading(
          'AI Insight & Operational Alerts',
          'Predictive telemetry & proactive stock safety',
          Icons.psychology_outlined,
          trailing: Tag('${active.length} Active', color: danger, solid: true),
        ),
        ...active.map((i) => InsightCard(i)),
        ...s.items
            .where((i) => i.status == StockStatus.safe)
            .take(1)
            .map(
              (i) => Panel(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            i.sku,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: muted,
                            ),
                          ),
                        ),
                        Tag('SAFE', color: statusColor(i.status)),
                        const SizedBox(width: 8),
                        const Tag('Details', color: muted),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      i.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.2,
                        color: brandInk,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      'Loc: ${i.rack}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: muted,
                      ),
                    ),
                    const SizedBox(height: 12),
                    StockSummaryTable(i),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}