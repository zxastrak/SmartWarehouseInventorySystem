import 'package:flutter/material.dart';
import '../core/app_theme.dart';
import '../models/models.dart';

class Panel extends StatelessWidget {
  final Widget child;
  final Color? tint;
  final EdgeInsets padding;
  final Color border;
  const Panel({
    super.key,
    required this.child,
    this.tint,
    this.padding = const EdgeInsets.all(14),
    this.border = Colors.transparent,
  });
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: padding,
    decoration: BoxDecoration(
      color: tint ?? Colors.white,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: border),
      boxShadow: brandCardShadow,
    ),
    child: child,
  );
}

class PageTitle extends StatelessWidget {
  final String title, subtitle;
  final Widget? trailing;
  final IconData? icon;
  const PageTitle(
    this.title,
    this.subtitle, {
    super.key,
    this.trailing,
    this.icon,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 23, color: olive),
          const SizedBox(width: 7),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                  color: brandInk,
                  height: 1.2,
                ),
              ),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: muted),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    ),
  );
}

class Tag extends StatelessWidget {
  final String text;
  final Color color;
  final bool solid;
  const Tag(this.text, {super.key, this.color = olive, this.solid = false});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: solid ? color : color.withAlpha(24),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 11,
        color: solid ? Colors.white : color,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class Metric extends StatelessWidget {
  final String title, value, foot;
  final Color color;
  final IconData? icon;
  const Metric(
    this.title,
    this.value,
    this.foot, {
    super.key,
    this.color = olive,
    this.icon,
  });
  @override
  Widget build(BuildContext context) {
    final isDefault = color == olive;
    final accent = isDefault ? brand : color;
    return Panel(
      tint: color == Colors.red ? const Color(0xffffedf0) : Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: accent.withAlpha(24),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: accent),
            ),
            const SizedBox(height: 10),
          ],
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              maxLines: 1,
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 26,
                letterSpacing: -0.4,
                color: isDefault ? brandInk : color,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: brandSlate,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            foot,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDefault ? muted : color,
            ),
          ),
        ],
      ),
    );
  }
}

class StockSummaryTable extends StatelessWidget {
  final StockItem item;
  const StockSummaryTable(this.item, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xfff8fafc),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xffeef2f6)),
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        for (final pair in [
          ('STOCK', '${item.quantity} Units'),
          ('MIN SAFE', '${item.minimum} Units'),
          ('DAYS LEFT', '${item.daysLeft.toStringAsFixed(1)} Days'),
        ])
          Column(
            children: [
              Text(
                pair.$1,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: muted,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                pair.$2,
                style: TextStyle(
                  fontSize: 13,
                  color:
                      pair.$1 == 'STOCK' ? statusColor(item.status) : brandInk,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
      ],
    ),
  );
}

class StockCard extends StatelessWidget {
  final StockItem item;
  final Widget? actions;
  final bool compact;
  const StockCard(this.item, {super.key, this.actions, this.compact = false});
  @override
  Widget build(BuildContext context) {
    final color = statusColor(item.status);
    final label = switch (item.status) {
      StockStatus.critical => 'CRITICAL STOCKOUT',
      StockStatus.anomaly => 'VELOCITY ANOMALY',
      StockStatus.discrepancy => 'STOCK DISCREPANCY',
      StockStatus.safe => 'SAFE STOCK',
    };
    return Panel(
      padding: const EdgeInsets.all(16),
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
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                ),
              ),
              if (!compact && item.status == StockStatus.critical)
                const Icon(Icons.flag, size: 16, color: Color(0xff94a3b8)),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            item.name,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 5),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 15, color: muted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  '${item.rack} • ${item.zone}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
              ),
            ],
          ),
          if (item.rackCounts.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                item.rackCounts.entries
                    .where((e) => e.value > 0)
                    .map((e) => '${e.key}: ${e.value}')
                    .join(' • '),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ),
          const SizedBox(height: 12),
          if (compact)
            StockSummaryTable(item)
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xfff8fafc),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xffeef2f6)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'CURRENT FLOOR COUNT',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: muted,
                              letterSpacing: .4,
                            ),
                          ),
                          const SizedBox(height: 5),
                          RichText(
                            text: TextSpan(
                              style: TextStyle(
                                color: color,
                                fontFamily: appFont,
                              ),
                              children: [
                                TextSpan(
                                  text: '${item.quantity}',
                                  style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const TextSpan(
                                  text: ' Units',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'SAFE MIN REQUIRED',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: muted,
                              letterSpacing: .4,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${item.minimum} Units',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: brandInk,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(
                      minHeight: 8,
                      value:
                          (item.quantity / item.minimum)
                              .clamp(0.0, 1.0)
                              .toDouble(),
                      color: color,
                      backgroundColor: line,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          switch (item.status) {
                            StockStatus.critical =>
                              '↓ -18.4 units/hr pick rate',
                            StockStatus.anomaly => '● +180% Outbound Spike',
                            StockStatus.discrepancy =>
                              'Log differs by -5 units',
                            StockStatus.safe => '✓ Buffer Maintained',
                          },
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: color,
                          ),
                        ),
                      ),
                      Text(
                        '${item.daysLeft.toStringAsFixed(1)} days buffer',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: muted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          if (item.verifiedAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: brandSoft,
                  border: Border.all(color: brandSoftBorder),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  '◎ Physical count verified at ${clock(item.verifiedAt!)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: forest,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          if (actions != null) ...[const SizedBox(height: 12), actions!],
        ],
      ),
    );
  }
}

class CountControl extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;
  final int? system;
  const CountControl({
    super.key,
    required this.value,
    required this.onChanged,
    this.system,
  });
  @override
  Widget build(BuildContext context) => Column(
    children: [
      const Text(
        'VERIFIED PHYSICAL COUNT',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: muted,
          letterSpacing: 1,
        ),
      ),
      Row(
        children: [
          IconButton(
            onPressed: value > 0 ? () => onChanged(value - 1) : null,
            icon: const Icon(
              Icons.remove_circle_outline,
              size: 28,
              color: muted,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '$value',
                  style: const TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Text(
                  'UNITS',
                  style: TextStyle(fontSize: 11, color: muted),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => onChanged(value + 1),
            icon: const Icon(Icons.add_circle, size: 28, color: forest),
          ),
        ],
      ),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        children:
            [1, 5, 10]
                .map(
                  (n) => OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(54, 42),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                    ),
                    onPressed: () => onChanged(value + n),
                    child: Text(
                      '+$n',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
                .toList(),
      ),
      if (system != null) ...[
        const SizedBox(height: 8),
        OutlinedButton(
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
          onPressed: () => onChanged(system!),
          child: Text(
            '↻ Match System ($system)',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ],
  );
}

void message(BuildContext context, String value) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));

class CubeIcon extends StatelessWidget {
  final Color color;
  final double size;
  const CubeIcon({super.key, this.color = ink, this.size = 23});
  @override
  Widget build(BuildContext context) => SizedBox(
    width: size,
    height: size,
    child: CustomPaint(painter: _CubePainter(color)),
  );
}

class _CubePainter extends CustomPainter {
  final Color color;
  _CubePainter(this.color);
  @override
  void paint(Canvas canvas, Size s) {
    final p =
        Paint()
          ..color = color
          ..strokeWidth = 1.5
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round;
    Offset o(double x, double y) => Offset(x * s.width, y * s.height);
    final path =
        Path()
          ..moveTo(s.width * .5, s.height * .05)
          ..lineTo(s.width * .94, s.height * .3)
          ..lineTo(s.width * .94, s.height * .73)
          ..lineTo(s.width * .5, s.height * .98)
          ..lineTo(s.width * .06, s.height * .73)
          ..lineTo(s.width * .06, s.height * .3)
          ..close();
    canvas.drawPath(path, p);
    canvas.drawLine(o(.06, .3), o(.5, .55), p);
    canvas.drawLine(o(.94, .3), o(.5, .55), p);
    canvas.drawLine(o(.5, .55), o(.5, .98), p);
  }

  @override
  bool shouldRepaint(covariant _CubePainter old) => color != old.color;
}

class StockCountBox extends StatelessWidget {
  final StockItem item;
  const StockCountBox(this.item, {super.key});
  @override
  Widget build(BuildContext context) {
    final color = statusColor(item.status);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xfff8fafc),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xffeef2f6)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CURRENT FLOOR COUNT',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: .4,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    '${item.quantity} Units',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: color,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    'SAFE MIN REQUIRED',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: muted,
                      letterSpacing: .4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item.minimum} Units',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: brandInk,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              minHeight: 8,
              value: (item.quantity / item.minimum).clamp(0.0, 1.0).toDouble(),
              color: color,
              backgroundColor: line,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '↓ Physical floor telemetry',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
              Text(
                '${item.daysLeft.toStringAsFixed(1)} days buffer',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}