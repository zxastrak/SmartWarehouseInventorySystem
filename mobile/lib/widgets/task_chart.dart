import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../core/app_theme.dart';

// Warna seri grafik: hijau untuk masuk, koral/merah untuk keluar.
const _inflowColor = mintLogo;
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
        List.generate(7, (i) => i == 6 ? inflow.toDouble() : 0.0);
    final b =
        outflowSeries ??
        List.generate(7, (i) => i == 6 ? outflow.toDouble() : 0.0);
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
    final count = a.length;
    // Beri ruang untuk teks sumbu Y di kiri (32px) dan margin rapi di kanan (16px)
    final box = Rect.fromLTRB(32, 24, size.width - 16, size.height - 26);
    final maxVal = [...a, ...b].fold<double>(0.0, (m, v) => math.max(m, v));
    final maximum = math.max(10.0, maxVal * 1.15);

    // Fungsi menggambar label teks dengan posisi teks presisi
    void drawLabel(String text, Offset pos, {bool center = false, bool rightAlign = false}) {
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
      )..layout();

      double dx = pos.dx;
      if (center) {
        dx = pos.dx - painter.width / 2;
      } else if (rightAlign) {
        dx = pos.dx - painter.width;
      }
      painter.paint(c, Offset(dx, pos.dy - painter.height / 2));
    }

    // Gridline horizontal & angka sumbu Y di sisi kiri (cukup 5 garis)
    for (int n = 0; n <= 4; n++) {
      final y = box.bottom - box.height * n / 4;
      c.drawLine(
        Offset(box.left, y),
        Offset(box.right, y),
        Paint()
          ..color = const Color(0xfff1f5f9)
          ..strokeWidth = 1,
      );
      final val = (maximum * n / 4).round();
      drawLabel('$val', Offset(box.left - 6, y), rightAlign: true);
    }

    final step = box.width / count;
    final xs = List.generate(count, (n) => box.left + step * (n + .5));
    final now = DateTime.now();
    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    final labels = List.generate(count, (n) {
      final d = now.subtract(Duration(days: count - 1 - n));
      return dayNames[d.weekday - 1];
    });

    // Dimensi batang dan wadah abu-abu agar simetris di tengah
    final bgWidth = step * 0.68;
    final barWidth = step * 0.25;
    final barGap = step * 0.04;

    for (int n = 0; n < count; n++) {
      if (bars) {
        // Wadah pilar abu-abu tepat di tengah kolom sumbu xs[n]
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(xs[n] - bgWidth / 2, box.top, bgWidth, box.height),
            const Radius.circular(8),
          ),
          Paint()..color = const Color(0xfff8fafc),
        );
      }
      // Label hari tepat di tengah kolom sumbu xs[n]
      drawLabel(labels[n], Offset(xs[n], box.bottom + 12), center: true);
    }

    void series(List<double> vals, Color color, double leftOffset) {
      if (bars) {
        for (int i = 0; i < vals.length; i++) {
          if (vals[i] <= 0) continue;
          final height = math.max(3.0, vals[i] / maximum * box.height);
          c.drawRRect(
            RRect.fromRectAndCorners(
              Rect.fromLTWH(
                xs[i] + leftOffset,
                box.bottom - height,
                barWidth,
                height,
              ),
              topLeft: const Radius.circular(4),
              topRight: const Radius.circular(4),
            ),
            Paint()..color = color,
          );
        }
      } else {
        final points = List.generate(
          count,
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

    // Menggambar batang Masuk (kiri) dan Keluar (kanan) tepat di dalam wadah
    series(a, _inflowColor, -barWidth - barGap / 2);
    series(b, _outflowColor, barGap / 2);

    if (bars) {
      final average = List.generate(count, (i) => (a[i] + b[i]) / 2);
      final hasAverage = average.any((v) => v > 0);
      if (hasAverage) {
        final path = Path();
        for (int i = 0; i < count; i++) {
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
            ..color = brand.withValues(alpha: 0.85)
            ..strokeWidth = 2
            ..strokeJoin = StrokeJoin.round
            ..style = PaintingStyle.stroke,
        );
        for (int i = 0; i < count; i++) {
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
  }

  @override
  bool shouldRepaint(covariant _ChartPainter old) =>
      old.bars != bars ||
      old.inflow != inflow ||
      old.outflow != outflow ||
      !listEquals(old.a, a) ||
      !listEquals(old.b, b);
}
