import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../core/app_theme.dart';

// Warna seri bar chart: hijau untuk masuk, koral/merah untuk keluar, teal untuk rata-rata.
const _inflowColor = mintLogo;
const _outflowColor = Color(0xffe98686);
const _avgColor = brand;
const _axisText = Color(0xff94a3b8);

enum ChartFilter { all, inflow, outflow, average }

class TaskChart extends StatefulWidget {
  final bool bars;
  final int inflow, outflow;
  final List<double>? inflowSeries;
  final List<double>? outflowSeries;

  const TaskChart({
    super.key,
    this.bars = true,
    this.inflow = 0,
    this.outflow = 0,
    this.inflowSeries,
    this.outflowSeries,
  });

  @override
  State<TaskChart> createState() => _TaskChartState();
}

class _TaskChartState extends State<TaskChart> {
  ChartFilter _filter = ChartFilter.all;

  @override
  Widget build(BuildContext context) {
    final a =
        widget.inflowSeries ??
        List.generate(7, (i) => i == 6 ? widget.inflow.toDouble() : 0.0);
    final b =
        widget.outflowSeries ??
        List.generate(7, (i) => i == 6 ? widget.outflow.toDouble() : 0.0);
    final hasData = a.any((v) => v > 0) || b.any((v) => v > 0);

    if (!hasData) {
      return Container(
        height: 240,
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
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Filter Bar Chart Chips
        Row(
          children: [
            _ChartFilterChip(
              label: 'Semua',
              isSelected: _filter == ChartFilter.all,
              activeColor: brand,
              onTap: () => setState(() => _filter = ChartFilter.all),
            ),
            const SizedBox(width: 6),
            _ChartFilterChip(
              label: 'Stok Masuk',
              isSelected: _filter == ChartFilter.inflow,
              activeColor: _inflowColor,
              onTap: () => setState(() => _filter = ChartFilter.inflow),
            ),
            const SizedBox(width: 6),
            _ChartFilterChip(
              label: 'Stok Keluar',
              isSelected: _filter == ChartFilter.outflow,
              activeColor: _outflowColor,
              onTap: () => setState(() => _filter = ChartFilter.outflow),
            ),
            const SizedBox(width: 6),
            _ChartFilterChip(
              label: 'Rata-rata',
              isSelected: _filter == ChartFilter.average,
              activeColor: _avgColor,
              onTap: () => setState(() => _filter = ChartFilter.average),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // Bar Chart Canvas (Murni Bar Chart tanpa Line Chart)
        SizedBox(
          height: 250,
          width: double.infinity,
          child: CustomPaint(
            painter: _BarChartPainter(a, b, _filter),
          ),
        ),
        const SizedBox(height: 12),
        // Legenda Seri Dinamis
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 16,
          runSpacing: 6,
          children: _buildLegends(),
        ),
      ],
    );
  }

  List<Widget> _buildLegends() {
    switch (_filter) {
      case ChartFilter.all:
        return [
          _legendItem(_inflowColor, 'Stok Masuk'),
          _legendItem(_outflowColor, 'Stok Keluar'),
          _legendItem(_avgColor, 'Rata-rata'),
        ];
      case ChartFilter.inflow:
        return [_legendItem(_inflowColor, 'Stok Masuk')];
      case ChartFilter.outflow:
        return [_legendItem(_outflowColor, 'Stok Keluar')];
      case ChartFilter.average:
        return [_legendItem(_avgColor, 'Rata-rata')];
    }
  }

  Widget _legendItem(Color color, String label) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
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

class _ChartFilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color activeColor;
  final VoidCallback onTap;

  const _ChartFilterChip({
    required this.label,
    required this.isSelected,
    required this.activeColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 6),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? activeColor : const Color(0xfff1f5f9),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected ? activeColor : const Color(0xffe2e8f0),
              width: 1,
            ),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color: isSelected ? Colors.white : brandSlate,
            ),
          ),
        ),
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<double> a;
  final List<double> b;
  final ChartFilter filter;

  _BarChartPainter(this.a, this.b, this.filter);

  @override
  void paint(Canvas c, Size size) {
    final count = a.length;
    final box = Rect.fromLTRB(32, 16, size.width - 16, size.height - 26);

    // Hitung seri rata-rata
    final avg = List.generate(count, (i) => (a[i] + b[i]) / 2);

    // Tentukan nilai maksimum untuk skala sumbu Y berdasarkan filter aktif
    double maxVal = 0.0;
    switch (filter) {
      case ChartFilter.all:
        maxVal = [...a, ...b, ...avg].fold(0.0, math.max);
        break;
      case ChartFilter.inflow:
        maxVal = a.fold(0.0, math.max);
        break;
      case ChartFilter.outflow:
        maxVal = b.fold(0.0, math.max);
        break;
      case ChartFilter.average:
        maxVal = avg.fold(0.0, math.max);
        break;
    }
    final maximum = math.max(10.0, maxVal * 1.15);

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

    // Gridline horizontal & angka sumbu Y di sisi kiri (5 garis)
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

    // Dimensi pilar latar belakang abu-abu
    final bgWidth = step * 0.72;

    for (int n = 0; n < count; n++) {
      // Wadah pilar abu-abu tepat di tengah kolom hari
      c.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(xs[n] - bgWidth / 2, box.top, bgWidth, box.height),
          const Radius.circular(8),
        ),
        Paint()..color = const Color(0xfff8fafc),
      );

      // Label teks nama hari
      drawLabel(labels[n], Offset(xs[n], box.bottom + 12), center: true);
    }

    void drawSingleBar(double val, Color color, double left, double width) {
      if (val <= 0) return;
      final height = math.max(3.0, val / maximum * box.height);
      c.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(left, box.bottom - height, width, height),
          topLeft: const Radius.circular(4),
          topRight: const Radius.circular(4),
        ),
        Paint()..color = color,
      );
    }

    if (filter == ChartFilter.all) {
      // Jika mode Semua: gambar 3 batang berdampingan (Masuk, Keluar, Rata-rata)
      final barWidth = step * 0.18;
      final barGap = step * 0.03;

      for (int i = 0; i < count; i++) {
        // Batang 1: Stok Masuk (kiri)
        drawBar(a[i], _inflowColor, xs[i] - 1.5 * barWidth - barGap, barWidth, maximum, box, c);
        // Batang 2: Stok Keluar (tengah)
        drawBar(b[i], _outflowColor, xs[i] - 0.5 * barWidth, barWidth, maximum, box, c);
        // Batang 3: Rata-rata (kanan)
        drawBar(avg[i], _avgColor, xs[i] + 0.5 * barWidth + barGap, barWidth, maximum, box, c);
      }
    } else {
      // Jika filter dipilih satu jenis: gambar 1 batang lebar di tengah pilar
      final barWidth = step * 0.36;
      for (int i = 0; i < count; i++) {
        switch (filter) {
          case ChartFilter.inflow:
            drawSingleBar(a[i], _inflowColor, xs[i] - barWidth / 2, barWidth);
            break;
          case ChartFilter.outflow:
            drawSingleBar(b[i], _outflowColor, xs[i] - barWidth / 2, barWidth);
            break;
          case ChartFilter.average:
            drawSingleBar(avg[i], _avgColor, xs[i] - barWidth / 2, barWidth);
            break;
          case ChartFilter.all:
            break;
        }
      }
    }
  }

  void drawBar(
    double val,
    Color color,
    double left,
    double width,
    double maximum,
    Rect box,
    Canvas c,
  ) {
    if (val <= 0) return;
    final height = math.max(3.0, val / maximum * box.height);
    c.drawRRect(
      RRect.fromRectAndCorners(
        Rect.fromLTWH(left, box.bottom - height, width, height),
        topLeft: const Radius.circular(4),
        topRight: const Radius.circular(4),
      ),
      Paint()..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter old) =>
      old.filter != filter ||
      !listEquals(old.a, a) ||
      !listEquals(old.b, b);
}
