import 'package:flutter/material.dart';
import '../core/app_theme.dart';
import '../models/models.dart';
import 'ui.dart';

class SectionHeading extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
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
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: brandSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: brandSoftBorder),
          ),
          child: Icon(icon, size: 20, color: brand),
        ),
        const SizedBox(width: 10),
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

class InsightCard extends StatelessWidget {
  final StockItem item;
  final bool compact;
  const InsightCard(this.item, {super.key, this.compact = false});
  @override
  Widget build(BuildContext context) {
    final color = statusColor(item.status);
    final label = switch (item.status) {
      StockStatus.critical => 'CRITICAL STOCKOUT ALERT',
      StockStatus.anomaly => 'VELOCITY ANOMALY',
      StockStatus.discrepancy => 'STOCK DISCREPANCY',
      StockStatus.safe => 'SAFE',
    };
    return Panel(
      padding: const EdgeInsets.all(16),
      tint: switch (item.status) {
        StockStatus.critical => const Color(0xfffff1f2),
        StockStatus.anomaly => const Color(0xfff5f7ff),
        StockStatus.discrepancy => const Color(0xfffffbeb),
        StockStatus.safe => Colors.white,
      },
      border:
          item.status == StockStatus.critical
              ? const Color(0xfffecdd3)
              : Colors.transparent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Tag(
                label,
                color: color,
                solid: item.status == StockStatus.critical,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.sku,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: muted,
                  ),
                ),
              ),
              if (!compact)
                Text(
                  item.status == StockStatus.anomaly
                      ? '+180% Spike'
                      : '${item.daysLeft.toStringAsFixed(1)} Days',
                  style: TextStyle(
                    fontSize: 12,
                    color: color,
                    fontWeight: FontWeight.w800,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            item.name,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
              color: brandInk,
            ),
          ),
          if (item.status == StockStatus.critical) ...[
            const SizedBox(height: 6),
            const Text(
              'Suggested AI Order : +1,200 Units\nConfidence : 97%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: brandSlate,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: line),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              switch (item.status) {
                StockStatus.critical =>
                  'Stock running out rapidly. Verify physical count on ${item.rack} before lead time deadline.',
                StockStatus.anomaly =>
                  'Unusual barcode decrements detected in ${item.zone} without matching sales order manifest.',
                StockStatus.discrepancy =>
                  'System log differs by 5 units from recent scan. Requires physical recount at ${item.rack}.',
                StockStatus.safe =>
                  'Stock remains above the safe buffer. Continue routine monitoring.',
              },
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: brandSlate,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }
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
                          'Operator: ',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: muted,
                          ),
                        ),
                        Flexible(
                          child: Text(
                            pending
                                ? 'Pending Physical Rescan'
                                : 'QR Checksum Validated',
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