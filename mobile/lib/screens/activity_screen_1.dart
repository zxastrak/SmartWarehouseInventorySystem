import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/task_chart.dart';
import '../widgets/warehouse_sections.dart';
import '../core/app_theme.dart';

class ActivityScreen extends StatelessWidget {
  final bool audit;
  const ActivityScreen({super.key, this.audit = false});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    if (audit) {
      return Column(
        children: [
          Panel(
            child: Column(
              children: [
                const SectionHeading(
                  'Warehouse Activity Audit Trail',
                  'Shift & Live Scan Feed',
                  Icons.history,
                  trailing: Text(
                    'View All',
                    style: TextStyle(
                      fontSize: 10,
                      color: olive,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                AuditEntries(s.activities),
              ],
            ),
          ),
          Panel(
            child: TaskChart(bars: true, inflow: s.inflow, outflow: s.outflow),
          ),
        ],
      );
    }
    return Column(
      children: [
        SizedBox(
          height: 145,
          child: Row(
            children: [
              Expanded(
                child: Metric(
                  'Total Inbound\nToday',
                  '${s.inboundTotal}',
                  '${s.inflow} units  •  On schedule',
                  icon: Icons.move_to_inbox_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Metric(
                  'Total Outbound\nToday',
                  '${s.outboundTotal}',
                  '${s.outflow} units  •  Surge',
                  icon: Icons.outbox_outlined,
                ),
              ),
            ],
          ),
        ),
        Panel(
          child: TaskChart(bars: true, inflow: s.inflow, outflow: s.outflow),
        ),
        Panel(
          child: Column(
            children: [
              SectionHeading(
                'Stock Activity Logs',
                '',
                Icons.format_list_bulleted,
                trailing: Tag(
                  '${s.movements.length} Active',
                  color: Colors.red,
                ),
              ),
              if (s.movements.isEmpty)
                const Text('No confirmed stock movements yet.'),
              ...s.movements.map((a) {
                final incoming = a.kind == MovementKind.stockIn;
                final color = incoming ? olive : const Color(0xffbb0022);
                return Panel(
                  border:
                      incoming
                          ? const Color(0xffc9d8c4)
                          : const Color(0xffffa4ae),
                  padding: const EdgeInsets.all(9),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            incoming
                                ? Icons.move_to_inbox_outlined
                                : Icons.outbox_outlined,
                            size: 22,
                            color: color,
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              incoming
                                  ? 'Receiving • Warehouse Floor'
                                  : 'Dispatch • Warehouse Floor',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xff858585),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          Tag(
                            incoming ? 'Inbound' : 'Outbound',
                            color: color,
                            solid: !incoming,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        a.title,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xfff8f9fe),
                          border: Border.all(color: line),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: Column(
                          children: [
                            const Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'QTY',
                                  style: TextStyle(fontSize: 9, color: muted),
                                ),
                                Text(
                                  'LOCATION',
                                  style: TextStyle(fontSize: 9, color: muted),
                                ),
                                Text(
                                  'STATUS',
                                  style: TextStyle(fontSize: 9, color: muted),
                                ),
                              ],
                            ),
                            const SizedBox(height: 9),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  '${a.quantity} Units',
                                  style: TextStyle(color: color, fontSize: 10),
                                ),
                                const Text(
                                  'Warehouse',
                                  style: TextStyle(fontSize: 10, color: muted),
                                ),
                                Text(
                                  'Confirmed (${clock(a.time)})',
                                  style: TextStyle(color: color, fontSize: 9),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }
}
