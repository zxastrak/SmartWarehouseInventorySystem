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
    this.padding = const EdgeInsets.all(12),
    this.border = line,
  });
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: padding,
    decoration: BoxDecoration(
      color: tint ?? Colors.white,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: border),
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
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                ),
              ),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 9, color: muted),
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
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
    decoration: BoxDecoration(
      color: solid ? color : color.withAlpha(24),
      borderRadius: BorderRadius.circular(5),
    ),
    child: Text(
      text,
      style: TextStyle(
        fontSize: 8,
        color: solid ? Colors.white : color,
        fontWeight: FontWeight.w700,
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
  Widget build(BuildContext context) => Panel(
    tint: color == Colors.red ? const Color(0xffffedf0) : Colors.white,
    padding: const EdgeInsets.all(11),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xffa1a1a1),
                  height: 1.2,
                ),
              ),
            ),
            if (icon != null) Icon(icon, size: 15, color: color),
          ],
        ),
        Text(
          value,
          maxLines: 1,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 26,
            color: color == olive ? const Color(0xff262626) : color,
          ),
        ),
        Text(foot, style: TextStyle(fontSize: 8, color: color)),
      ],
    ),
  );
}

class StockSummaryTable extends StatelessWidget {
  final StockItem item;
  const StockSummaryTable(this.item, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: const Color(0xfff8f9fe),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: line),
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
              Text(pair.$1, style: const TextStyle(fontSize: 8, color: muted)),
              const SizedBox(height: 7),
              Text(
                pair.$2,
                style: TextStyle(
                  fontSize: 10,
                  color: pair.$1 == 'STOCK' ? statusColor(item.status) : ink,
                  fontWeight: FontWeight.w600,
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
      padding: const EdgeInsets.fromLTRB(13, 14, 13, 12),
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
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  item.sku,
                  style: const TextStyle(fontSize: 8, color: muted),
                ),
              ),
              if (!compact && item.status == StockStatus.critical)
                const Icon(Icons.flag, size: 13, color: Color(0xff94a3b8)),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            item.name,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 12, color: muted),
              const SizedBox(width: 3),
              Expanded(
                child: Text(
                  '${item.rack} • ${item.zone}',
                  style: const TextStyle(fontSize: 9, color: muted),
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
                style: const TextStyle(fontSize: 8, color: muted),
              ),
            ),
          const SizedBox(height: 10),
          if (compact)
            StockSummaryTable(item)
          else
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xfff8faff),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: line),
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
                              fontSize: 7,
                              color: Color(0xff8095b5),
                              letterSpacing: .3,
                            ),
                          ),
                          const SizedBox(height: 5),
                          RichText(
                            text: TextSpan(
                              style: TextStyle(color: color),
                              children: [
                                TextSpan(
                                  text: '${item.quantity}',
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const TextSpan(
                                  text: ' Units',
                                  style: TextStyle(fontSize: 8, color: muted),
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
                              fontSize: 7,
                              color: Color(0xff8095b5),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${item.minimum} Units',
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(5),
                    child: LinearProgressIndicator(
                      minHeight: 6,
                      value:
                          (item.quantity / item.minimum)
                              .clamp(0.0, 1.0)
                              .toDouble(),
                      color: color,
                      backgroundColor: line,
                    ),
                  ),
                  const SizedBox(height: 9),
                  Row(
                    children: [
                      Expanded(
                        child: Text(switch (item.status) {
                          StockStatus.critical => '↓ -18.4 units/hr pick rate',
                          StockStatus.anomaly => '● +180% Outbound Spike',
                          StockStatus.discrepancy => 'Log differs by -5 units',
                          StockStatus.safe => '✓ Buffer Maintained',
                        }, style: TextStyle(fontSize: 8, color: color)),
                      ),
                      Text(
                        '${item.daysLeft.toStringAsFixed(1)} days buffer',
                        style: const TextStyle(fontSize: 8, color: muted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          if (item.verifiedAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xffecfdf5),
                  border: Border.all(color: const Color(0xffa7f3d0)),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  '◎ Physical count verified at ${clock(item.verifiedAt!)}',
                  style: const TextStyle(fontSize: 9, color: mint),
                ),
              ),
            ),
          if (actions != null) ...[const SizedBox(height: 10), actions!],
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
        style: TextStyle(fontSize: 8, color: muted, letterSpacing: 1),
      ),
      Row(
        children: [
          IconButton(
            onPressed: value > 0 ? () => onChanged(value - 1) : null,
            icon: const Icon(
              Icons.remove_circle_outline,
              size: 21,
              color: muted,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '$value',
                  style: const TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Text(
                  'UNITS',
                  style: TextStyle(fontSize: 8, color: muted),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => onChanged(value + 1),
            icon: const Icon(Icons.add_circle, size: 21, color: forest),
          ),
        ],
      ),
      const SizedBox(height: 6),
      Wrap(
        spacing: 7,
        children:
            [1, 5, 10]
                .map(
                  (n) => OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(38, 25),
                      padding: const EdgeInsets.all(4),
                    ),
                    onPressed: () => onChanged(value + n),
                    child: Text('+$n', style: const TextStyle(fontSize: 9)),
                  ),
                )
                .toList(),
      ),
      if (system != null)
        OutlinedButton(
          onPressed: () => onChanged(system!),
          child: Text(
            '↻ Match System ($system)',
            style: const TextStyle(fontSize: 9),
          ),
        ),
    ],
  );
}

void message(BuildContext context, String value) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));

class Brand extends StatelessWidget {
  final bool large;
  const Brand({super.key, this.large = false});
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Image.asset(
        'assets/images/susuno_logo.png',
        width: large ? 58 : 32,
        height: large ? 53 : 29,
      ),
      if (large) ...[
        const SizedBox(height: 11),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/images/susuno_wordmark.png',
              width: 86,
              height: 30,
            ),
            Image.asset('assets/images/susuno_logo.png', width: 28, height: 26),
          ],
        ),
      ],
    ],
  );
}

class CartonMenu extends StatelessWidget {
  final VoidCallback onTap;
  const CartonMenu({super.key, required this.onTap});
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Open sidebar',
    onPressed: onTap,
    padding: const EdgeInsets.all(5),
    icon: Image.asset('assets/images/carton_menu.png', width: 37, height: 34),
  );
}

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
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: const Color(0xfff8faff),
      border: Border.all(color: line),
      borderRadius: BorderRadius.circular(11),
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
                  style: TextStyle(fontSize: 8, color: Color(0xff8095b5)),
                ),
                const SizedBox(height: 6),
                Text(
                  '${item.quantity} Units',
                  style: TextStyle(
                    fontSize: 22,
                    color: statusColor(item.status),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text(
                  'SAFE MIN REQUIRED',
                  style: TextStyle(fontSize: 8, color: Color(0xff8095b5)),
                ),
                const SizedBox(height: 9),
                Text(
                  '${item.minimum} Units',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 9),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            minHeight: 6,
            value: (item.quantity / item.minimum).clamp(0.0, 1.0).toDouble(),
            color: statusColor(item.status),
            backgroundColor: line,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '↓ Physical floor telemetry',
              style: TextStyle(fontSize: 9, color: statusColor(item.status)),
            ),
            Text(
              '${item.daysLeft.toStringAsFixed(1)} days buffer',
              style: const TextStyle(fontSize: 9, color: muted),
            ),
          ],
        ),
      ],
    ),
  );
}
