import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/task_chart.dart';
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

class SectionHeading extends StatelessWidget {
  final String title, subtitle;
  final IconData? icon;
  final Widget? trailing;
  const SectionHeading(
    this.title,
    this.subtitle,
    this.icon, {
    super.key,
    this.trailing,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(
      children: [
        if (icon != null) ...[
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: brandSoft,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: brandSoftBorder),
            ),
            child: Icon(icon!, size: 20, color: brand),
          ),
          const SizedBox(width: 10),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                  color: brandInk,
                ),
              ),
              if (subtitle.isNotEmpty)
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    ),
  );
}

class AuditEntries extends StatelessWidget {
  final List<Activity> entries;
  const AuditEntries(this.entries, {super.key});
  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return Padding(
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
                  Icons.history_toggle_off,
                  size: 28,
                  color: brand,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Belum ada riwayat aktivitas stok untuk akun ini.',
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
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          _AuditRow(entry: entries[i], isLast: i == entries.length - 1),
      ],
    );
  }
}

/// Satu entri audit dalam bentuk timeline: titik + garis penghubung di kiri.
class _AuditRow extends StatelessWidget {
  final Activity entry;
  final bool isLast;
  const _AuditRow({required this.entry, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final a = entry;
    final pending = a.kind == null;
    final color = pending ? danger : brand;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 16,
            child: Column(
              children: [
                const SizedBox(height: 3),
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: color, width: 3),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: line,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          a.title,
                          style: TextStyle(
                            fontSize: 13,
                            color: pending ? danger : brandInk,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        clock(a.time),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xff94a3b8),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Text(
                    a.detail,
                    style: const TextStyle(
                      fontSize: 12,
                      color: brandSlate,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: pending ? const Color(0xfffff1f2) : brandSoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Status: ',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: muted,
                          ),
                        ),
                        Flexible(
                          child: Text(
                            pending
                                ? 'Menunggu Verifikasi'
                                : 'Tercatat di Database',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: color,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
