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
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        Icon(icon, size: 23, color: olive),
        const SizedBox(width: 7),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (subtitle.isNotEmpty)
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 9, color: muted),
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
      tint:
          item.status == StockStatus.anomaly
              ? const Color(0xfff7f8ff)
              : const Color(0xfffff9f9),
      border:
          item.status == StockStatus.critical ? const Color(0xffffa6b9) : line,
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
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  item.sku,
                  style: const TextStyle(fontSize: 8, color: muted),
                ),
              ),
              if (!compact)
                Text(
                  item.status == StockStatus.anomaly
                      ? '+180% Spike'
                      : '${item.daysLeft.toStringAsFixed(1)} Days',
                  style: TextStyle(
                    fontSize: 9,
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 13),
          Text(
            item.name,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
          if (item.status == StockStatus.critical) ...[
            const SizedBox(height: 5),
            const Text(
              'Suggested AI Order : +1,200 Units\nConfidence : 97%',
              style: TextStyle(
                fontSize: 9,
                color: Color(0xff777777),
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xffd5d8dd)),
              borderRadius: BorderRadius.circular(7),
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
                fontSize: 11,
                color: Color(0xff777777),
                height: 1.4,
                letterSpacing: .3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OrderCard extends StatelessWidget {
  final PurchaseOrder order;
  final StockItem item;
  final VoidCallback? onDetails;
  const OrderCard(this.order, this.item, {super.key, this.onDetails});
  @override
  Widget build(BuildContext context) {
    final color = order.id == 'PO-8815' ? Colors.red : olive;
    return Panel(
      padding: const EdgeInsets.all(9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.description_outlined, size: 29, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: [
                    Text(
                      order.id,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Tag(
                      order.id == 'PO-8821'
                          ? 'AI Generated'
                          : order.id == 'PO-8819'
                          ? 'Manual Req'
                          : 'Urgent Buffer',
                      color:
                          order.id == 'PO-8819'
                              ? const Color(0xff506b9d)
                              : color,
                    ),
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  '${item.name} • ${order.quantity} units',
                  style: const TextStyle(fontSize: 9, color: muted),
                ),
                const SizedBox(height: 5),
                Text(
                  'IDR ${order.price.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 13, color: olive),
                ),
                if (onDetails != null)
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 24),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                      ),
                      onPressed: onDetails,
                      child: const Text(
                        'View Details',
                        style: TextStyle(fontSize: 9),
                      ),
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

class AuditEntries extends StatelessWidget {
  final List<Activity> entries;
  const AuditEntries(this.entries, {super.key});
  @override
  Widget build(BuildContext context) => Column(
    children:
        entries
            .map(
              (a) => Padding(
                padding: const EdgeInsets.only(bottom: 17),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: a.kind == null ? Colors.red : olive,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  a.title,
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: a.kind == null ? Colors.red : ink,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: .3,
                                  ),
                                ),
                              ),
                              Text(
                                clock(a.time),
                                style: const TextStyle(
                                  fontSize: 9,
                                  color: Color(0xff858975),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Text(
                            a.detail,
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xff666d5d),
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 7),
                          Row(
                            children: [
                              const Text(
                                'Operator: ',
                                style: TextStyle(fontSize: 9, color: muted),
                              ),
                              Expanded(
                                child: Text(
                                  a.kind == null
                                      ? 'Pending Physical Rescan'
                                      : 'QR Checksum Validated',
                                  style: TextStyle(
                                    fontSize: 9,
                                    color: a.kind == null ? Colors.red : olive,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
  );
}
