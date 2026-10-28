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
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const SectionHeading(
                  'Warehouse Activity Audit Trail',
                  'Shift & Live Scan Feed',
                  Icons.history,
                  trailing: Text(
                    'View All',
                    style: TextStyle(
                      fontSize: 12,
                      color: brand,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                AuditEntries(s.activities),
              ],
            ),
          ),
          Panel(
            padding: const EdgeInsets.all(16),
            child: TaskChart(
              bars: true,
              inflow: s.inflow,
              outflow: s.outflow,
              inflowSeries: s.weeklyInflow,
              outflowSeries: s.weeklyOutflow,
            ),
          ),
        ],
      );
    }
    return Column(
      children: [
        // Tinggi mengikuti isi kartu (bukan angka tetap), supaya tidak terpotong
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
          padding: const EdgeInsets.all(16),
          child: TaskChart(
            bars: true,
            inflow: s.inflow,
            outflow: s.outflow,
            inflowSeries: s.weeklyInflow,
            outflowSeries: s.weeklyOutflow,
          ),
        ),
        Panel(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              SectionHeading(
                'Stock Activity Logs',
                '',
                Icons.format_list_bulleted,
                trailing: Tag('${s.movements.length} Active', color: brand),
              ),
              if (s.movements.isEmpty) const _EmptyMovements(),
              ...s.movements.map(
                (a) => _MovementCard(
                  incoming: a.kind == MovementKind.stockIn,
                  title: a.title,
                  quantity: '${a.quantity}',
                  timeLabel: clock(a.time),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EmptyMovements extends StatelessWidget {
  const _EmptyMovements();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 24),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: const BoxDecoration(
              color: brandSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.inventory_2_outlined,
              size: 28,
              color: brand,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Belum ada transaksi stok masuk atau keluar.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: muted,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Satu baris transaksi stok. Sebelumnya berupa Panel di dalam Panel
/// (kartu dalam kartu), sekarang berupa blok ringan dengan border berwarna.
class _MovementCard extends StatelessWidget {
  final bool incoming;
  final String title, quantity, timeLabel;
  const _MovementCard({
    required this.incoming,
    required this.title,
    required this.quantity,
    required this.timeLabel,
  });

  @override
  Widget build(BuildContext context) {
    final color = incoming ? brand : danger;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: incoming ? brandSoft : const Color(0xfffff1f2),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: incoming ? brandSoftBorder : const Color(0xfffecdd3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  incoming
                      ? Icons.move_to_inbox_outlined
                      : Icons.outbox_outlined,
                  size: 20,
                  color: color,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  incoming
                      ? 'Receiving • Warehouse Floor'
                      : 'Dispatch • Warehouse Floor',
                  style: const TextStyle(
                    fontSize: 12,
                    color: brandSlate,
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
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: _DetailCell(
                    label: 'QTY',
                    value: '$quantity Units',
                    color: color,
                  ),
                ),
                const Expanded(
                  flex: 3,
                  child: _DetailCell(
                    label: 'LOCATION',
                    value: 'Warehouse',
                    color: brandInk,
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: _DetailCell(
                    label: 'STATUS',
                    value: 'Confirmed',
                    sub: timeLabel,
                    color: color,
                    end: true,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailCell extends StatelessWidget {
  final String label, value;
  final String? sub;
  final Color color;
  final bool end;
  const _DetailCell({
    required this.label,
    required this.value,
    required this.color,
    this.sub,
    this.end = false,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: end ? CrossAxisAlignment.end : CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: .3,
          color: muted,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
      if (sub != null)
        Text(
          sub!,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: muted,
          ),
        ),
    ],
  );
}