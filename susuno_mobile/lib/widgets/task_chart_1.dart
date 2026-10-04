import 'dart:math' as math;
import 'package:flutter/material.dart';

class TaskChart extends StatelessWidget {
  final bool bars;
  final int inflow, outflow;
  const TaskChart({
    super.key,
    this.bars = false,
    this.inflow = 0,
    this.outflow = 0,
  });
  @override
  Widget build(BuildContext context) => Column(
    children: [
      SizedBox(
        height: bars ? 278 : 225,
        width: double.infinity,
        child: CustomPaint(painter: _ChartPainter(bars, inflow, outflow)),
      ),
      const SizedBox(height: 5),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: 15,
        children:
            bars
                ? [
                  legend(const Color(0xff83d3c3), 'Stock_in'),
                  legend(const Color(0xfff69a9a), 'Stock_out'),
                  legend(const Color(0xff5f7f61), 'Average', stroke: true),
                ]
                : [
                  legend(
                    const Color(0xff5cc5a9),
                    'Pending Putaway',
                    stroke: true,
                  ),
                  legend(
                    const Color(0xffff865f),
                    'Pending Outbound',
                    stroke: true,
                  ),
                ],
      ),
    ],
  );
  Widget legend(Color color, String label, {bool stroke = false}) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(width: 9, height: stroke ? 2 : 9, color: color),
      const SizedBox(width: 4),
      Text(
        label,
        style: const TextStyle(fontSize: 9, color: Color(0xff777777)),
      ),
    ],
  );
}

class _ChartPainter extends CustomPainter {
  final bool bars;
  final int inflow, outflow;
  _ChartPainter(this.bars, this.inflow, this.outflow);
  @override
  void paint(Canvas c, Size size) {
    final box = Rect.fromLTRB(27, 30, size.width - 25, size.height - 23);
    final a =
        bars
            ? <double>[51, 52, 62, 24, 61, 45 + inflow / 100]
            : <double>[42, 76, 45, 30, 51, 8 + inflow / 100];
    final b =
        bars
            ? <double>[34, 35, 56, 19, 8, 8 + outflow / 100]
            : <double>[30, 60, 86, 60, 49, 81 + outflow / 100];
    final maximum = math.max(
      100.0,
      [...a, ...b].reduce((x, y) => math.max(x, y)) * 1.05,
    );
    void label(String text, Offset pos, {TextAlign align = TextAlign.left}) {
      final painter = TextPainter(
        text: TextSpan(
          text: text,
          style: const TextStyle(fontSize: 9, color: Color(0xff999999)),
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
          ..color = const Color(0xffeeeeee)
          ..strokeWidth = .6,
      );
      label('${(maximum * n / 5).round()}', Offset(0, y - 5));
      if (bars) {
        label('${n * 20}', Offset(box.right + 5, y - 5));
      }
    }
    final step = box.width / 6;
    final xs = List.generate(6, (n) => box.left + step * (n + .5));
    final labels =
        bars
            ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (int n = 0; n < 6; n++) {
      if (bars) {
        c.drawRect(
          Rect.fromLTWH(box.left + n * step, box.top, step * .58, box.height),
          Paint()..color = const Color(0xfff4f4f4),
        );
      }
      label(labels[n], Offset(xs[n] - 9, box.bottom + 6));
    }
    void series(List<double> vals, Color color, double offset) {
      if (bars) {
        for (int i = 0; i < vals.length; i++) {
          final height = vals[i] / maximum * box.height;
          c.drawRect(
            Rect.fromLTWH(
              xs[i] + offset,
              box.bottom - height,
              step * .25,
              height,
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
            ..strokeWidth = 1.3
            ..style = PaintingStyle.stroke,
        );
        for (final point in points) {
          c.drawCircle(point, 2.2, Paint()..color = Colors.white);
          c.drawCircle(
            point,
            2.2,
            Paint()
              ..color = color
              ..strokeWidth = .8
              ..style = PaintingStyle.stroke,
          );
        }
      }
    }

    series(
      a,
      bars ? const Color(0xff83d3c3) : const Color(0xff5cc5a9),
      -step * .28,
    );
    series(
      b,
      bars ? const Color(0xfff69a9a) : const Color(0xffff865f),
      step * .03,
    );
    if (bars) {
      final average = <double>[
        44,
        43,
        57,
        20,
        34,
        39 + (inflow + outflow) / 200,
      ];
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
          ..color = const Color(0xff5f7f61)
          ..strokeWidth = 1.4
          ..style = PaintingStyle.stroke,
      );
      for (int i = 0; i < 6; i++) {
        final p = Offset(xs[i], box.bottom - average[i] / maximum * box.height);
        c.drawCircle(p, 3, Paint()..color = Colors.white);
        c.drawCircle(
          p,
          3,
          Paint()
            ..color = const Color(0xff5f7f61)
            ..strokeWidth = 1
            ..style = PaintingStyle.stroke,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ChartPainter old) =>
      old.bars != bars || old.inflow != inflow || old.outflow != outflow;
}
