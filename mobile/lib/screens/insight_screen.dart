import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/warehouse_sections.dart';

class InsightScreen extends StatelessWidget {
  const InsightScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    return Panel(
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
              .where((i) => i.status != StockStatus.safe)
              .map((i) => InsightCard(i)),
          ...s.items
              .where((i) => i.status == StockStatus.safe)
              .take(1)
              .map(
                (i) => Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              i.sku,
                              style: const TextStyle(
                                fontSize: 9,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                          const Tag('SAFE'),
                          const SizedBox(width: 8),
                          const Tag('Details', color: Color(0xff6c84ad)),
                        ],
                      ),
                      const SizedBox(height: 13),
                      Text(
                        i.name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Loc: ${i.rack}',
                        style: const TextStyle(fontSize: 9, color: Colors.grey),
                      ),
                      const SizedBox(height: 10),
                      StockSummaryTable(i),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
