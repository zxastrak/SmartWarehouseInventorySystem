import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../core/app_theme.dart';

// Warna seri grafik: hijau untuk masuk, koral untuk keluar.
const _inflowColor = Color(0xff9ab85c);
const _outflowColor = Color(0xffe98686);
const _axisText = Color(0xff94a3b8);

class TaskChart extends StatelessWidget {
  final bool bars;
  final int inflow, outflow;
  final List<double>? inflowSeries;
  final List<double>? outflowSeries;

  const TaskChart({
    super.key,
    this.bars = false,
    this.inflow = 0,
    this.outflow = 0,
    this.inflowSeries,
    this.outflowSeries,
  });

  @override
  Widget build(BuildContext context) {
    final a =
        inflowSeries ??
        List.generate(6, (i) => i == 5 ? inflow.toDouble() : 0.0);
    final b =
        outflowSeries ??
        List.generate(6, (i) => i == 5 ? outflow.toDouble() : 0.0);
    final hasData = a.any((v) => v > 0) || b.any((v) => v > 0);

    if (!hasData) {
      return Container(
        height: bars ? 240 : 200,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                color: brandSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.query_stats_outlined,
                size: 26,
                color: brand,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Belum Ada Aktivitas Telemetri',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: brandInk,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Grafik pergerakan stok harian akan tampil saat ada transaksi stok masuk/keluar di database.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: muted,
                height: 1.4,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        SizedBox(
          height: bars ? 278 : 225,
          width: double.infinity,
          child: CustomPaint(
            painter: _ChartPainter(bars, inflow, outflow, a, b),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 16,
          runSpacing: 6,
          children:
              bars
                  ? [
                    legend(_inflowColor, 'Stok Masuk'),
                    legend(_outflowColor, 'Stok Keluar'),
                    legend(brand, 'Rata-rata', stroke: true),
                  ]
                  : [
                    legend(_inflowColor, 'Inbound (Masuk)', stroke: true),
                    legend(_outflowColor, 'Outbound (Keluar)', stroke: true),
                  ],
        ),
      ],
    );
  }

  Widget legend(Color color, String label, {bool stroke = false}) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 10,
        height: stroke ? 3 : 10,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      const SizedBox(width: 5),
      Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: brandSlate,
        ),
      ),
    ],
  );
}

class _ChartPainter extends CustomPainter {
  final bool bars;
  final int inflow, outflow;
  final List<double> a;
  final List<double> b;
  _ChartPainter(this.bars, this.inflow, this.outflow, this.a, this.b);

  @override
  void paint(Canvas c, Size size) {
    final box = Rect.fromLTRB(30, 30, size.width - 30, size.height - 26);
    final maxVal = [...a, ...b].fold<double>(0.0, (m, v) => math.max(m, v));
    final maximum = math.max(10.0, maxVal * 1.15);

    // Teks di dalam CustomPaint tidak mewarisi font tema, jadi fontFamily
    // diisi manual supaya sama dengan seluruh aplikasi.
    void label(String text, Offset pos, {TextAlign align = TextAlign.left}) {
      final painter = TextPainter(
        text: TextSpan(
          text: text,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: _axisText,
            fontFamily: appFont,
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: align,
      )..layout();
      painter.paint(c, pos);
    }

    for (int n = 0; n < 6; n++) {
      final y = box.bottom - box.height * n / 5;
      c.drawLine(
        Offset(box.left, y),
        Offset(box.right, y),
        Paint()
          ..color = const Color(0xffeef2f6)
          ..strokeWidth = 1,
      );
      label('${(maximum * n / 5).round()}', Offset(0, y - 6));
      if (bars) {
        label('${(maximum * n / 5).round()}', Offset(box.right + 5, y - 6));
      }
    }
    final step = box.width / 6;
    final xs = List.generate(6, (n) => box.left + step * (n + .5));
    final now = DateTime.now();
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final labels = List.generate(6, (n) {
      final d = now.subtract(Duration(days: 5 - n));
      return dayNames[d.weekday - 1];
    });

    for (int n = 0; n < 6; n++) {
      if (bars) {
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(box.left + n * step, box.top, step * .58, box.height),
            const Radius.circular(8),
          ),
          Paint()..color = const Color(0xfff8fafc),
        );
      }
      label(labels[n], Offset(xs[n] - 10, box.bottom + 7));
    }
    void series(List<double> vals, Color color, double offset) {
      if (bars) {
        for (int i = 0; i < vals.length; i++) {
          final height = vals[i] / maximum * box.height;
          c.drawRRect(
            RRect.fromRectAndCorners(
              Rect.fromLTWH(
                xs[i] + offset,
                box.bottom - height,
                step * .25,
                height,
              ),
              topLeft: const Radius.circular(5),
              topRight: const Radius.circular(5),
            ),
            Paint()..color = color,
          );
        }
      } else {
        final points = List.generate(
          6,
          (n) => Offset(xs[n], box.bottom - vals[n] / maximum * box.height),
        );
        final path = Path()..moveTo(points.first.dx, points.first.dy);
        for (int i = 1; i < points.length; i++) {
          final prev = points[i - 1], next = points[i];
          final middle = (prev.dx + next.dx) / 2;
          path.cubicTo(middle, prev.dy, middle, next.dy, next.dx, next.dy);
        }
        final fill =
            Path.from(path)
              ..lineTo(points.last.dx, box.bottom)
              ..lineTo(points.first.dx, box.bottom)
              ..close();
        c.drawPath(
          fill,
          Paint()
            ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [color.withAlpha(80), color.withAlpha(2)],
            ).createShader(box),
        );
        c.drawPath(
          path,
          Paint()
            ..color = color
            ..strokeWidth = 2
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke,
        );
        for (final point in points) {
          c.drawCircle(point, 3, Paint()..color = Colors.white);
          c.drawCircle(
            point,
            3,
            Paint()
              ..color = color
              ..strokeWidth = 1.5
              ..style = PaintingStyle.stroke,
          );
        }
      }
    }

    series(a, _inflowColor, -step * .28);
    series(b, _outflowColor, step * .03);
    if (bars) {
      final average = List.generate(6, (i) => (a[i] + b[i]) / 2);
      final path = Path();
      for (int i = 0; i < 6; i++) {
        final p = Offset(xs[i], box.bottom - average[i] / maximum * box.height);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      c.drawPath(
        path,
        Paint()
          ..color = brand
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke,
      );
      for (int i = 0; i < 6; i++) {
        final p = Offset(xs[i], box.bottom - average[i] / maximum * box.height);
        c.drawCircle(p, 3.5, Paint()..color = Colors.white);
        c.drawCircle(
          p,
          3.5,
          Paint()
            ..color = brand
            ..strokeWidth = 1.5
            ..style = PaintingStyle.stroke,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ChartPainter old) =>
      old.bars != bars ||
      old.inflow != inflow ||
      old.outflow != outflow ||
      !listEquals(old.a, a) ||
      !listEquals(old.b, b);
}