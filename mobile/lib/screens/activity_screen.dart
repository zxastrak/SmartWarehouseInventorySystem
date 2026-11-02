import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/task_chart.dart';
import '../widgets/warehouse_sections.dart';
import '../core/app_theme.dart';

class ActivityScreen extends StatefulWidget {
  final bool audit;
  const ActivityScreen({super.key, this.audit = false});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  late bool _showAudit;

  @override
  void initState() {
    super.initState();
    _showAudit = widget.audit;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Tab Pengalih: Log Transaksi Stok & Riwayat Audit
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              _ActivityTab(
                label: 'Log Transaksi Stok',
                icon: Icons.format_list_bulleted,
                selected: !_showAudit,
                onTap: () => setState(() => _showAudit = false),
              ),
              const SizedBox(width: 8),
              _ActivityTab(
                label: 'Riwayat Audit',
                icon: Icons.history,
                selected: _showAudit,
                onTap: () => setState(() => _showAudit = true),
              ),
            ],
          ),
        ),

        if (_showAudit) ...[
          Panel(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                SectionHeading(
                  'Audit Trail Gudang',
                  'Riwayat Aktivitas & Perubahan Stok',
                  null,
                  trailing: Tag('${s.activities.length} Log', color: brand),
                ),
                AuditEntries(s.activities),
              ],
            ),
          ),
        ] else ...[
          // Kartu Metrik Ringkasan Hari Ini
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Metric(
                    'Inbound Hari Ini',
                    '${s.inflow} Unit',
                    '${s.inboundTxCount} transaksi masuk',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Metric(
                    'Outbound Hari Ini',
                    '${s.outflow} Unit',
                    '${s.outboundTxCount} transaksi keluar',
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
                  'Log Transaksi Stok',
                  'Aktivitas Inbound & Outbound Akun Anda',
                  null,
                  trailing: Tag('${s.movements.length} Tercatat', color: brand),
                ),
                if (s.movements.isEmpty) const _EmptyMovements(),
                ...s.movements.map(
                  (a) => _MovementCard(
                    incoming: a.kind == MovementKind.stockIn,
                    title: a.title,
                    quantity: '${a.quantity}',
                    timeLabel: clock(a.time),
                    detail: a.detail,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ActivityTab extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _ActivityTab({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      selected: selected,
      showCheckmark: false,
      avatar: Icon(
        icon,
        size: 16,
        color: selected ? brand : brandSlate,
      ),
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: selected ? brand : brandSlate,
        ),
      ),
      backgroundColor: Colors.white,
      selectedColor: brandSoft,
      side: BorderSide(
        color: selected ? brandSoftBorder : line,
        width: 1.2,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      onSelected: (_) => onTap(),
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

/// Satu baris transaksi stok riil dari tabel stock_transactions database.
class _MovementCard extends StatelessWidget {
  final bool incoming;
  final String title, quantity, timeLabel;
  final String? detail;

  const _MovementCard({
    required this.incoming,
    required this.title,
    required this.quantity,
    required this.timeLabel,
    this.detail,
  });

  @override
  Widget build(BuildContext context) {
    final color = incoming ? brand : danger;
    final rackMatch = RegExp(r'RACK-[A-Za-z0-9\-]+').firstMatch(detail ?? '');
    final location = rackMatch != null ? rackMatch.group(0)! : 'Gudang Utama';

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
              Expanded(
                child: Text(
                  incoming
                      ? 'Inbound • Masuk Stok'
                      : 'Outbound • Keluar Stok',
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
          if (detail != null && detail!.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              detail!.trim(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: brandSlate,
              ),
            ),
          ],
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
                    label: 'JUMLAH',
                    value: '$quantity Unit',
                    color: color,
                    align: TextAlign.start,
                  ),
                ),
                Expanded(
                  flex: 4,
                  child: _DetailCell(
                    label: 'LOKASI / RAK',
                    value: location,
                    color: brandInk,
                    align: TextAlign.center,
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: _DetailCell(
                    label: 'STATUS',
                    value: 'Tercatat',
                    sub: timeLabel,
                    color: color,
                    align: TextAlign.end,
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
  final TextAlign align;

  const _DetailCell({
    required this.label,
    required this.value,
    required this.color,
    this.sub,
    this.align = TextAlign.start,
  });

  @override
  Widget build(BuildContext context) {
    final cross = switch (align) {
      TextAlign.center => CrossAxisAlignment.center,
      TextAlign.end || TextAlign.right => CrossAxisAlignment.end,
      _ => CrossAxisAlignment.start,
    };
    final boxAlign = switch (align) {
      TextAlign.center => Alignment.center,
      TextAlign.end || TextAlign.right => Alignment.centerRight,
      _ => Alignment.centerLeft,
    };

    return Column(
      crossAxisAlignment: cross,
      children: [
        Text(
          label,
          textAlign: align,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: .3,
            color: muted,
          ),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: boxAlign,
          child: Text(
            value,
            textAlign: align,
            maxLines: 1,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
        if (sub != null) ...[
          const SizedBox(height: 2),
          Text(
            sub!,
            textAlign: align,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: muted,
            ),
          ),
        ],
      ],
    );
  }
}
