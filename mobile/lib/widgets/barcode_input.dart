import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/app_theme.dart';

class BarcodeInput extends StatefulWidget {
  final String title, demoCode;
  final ValueChanged<String> onResult;
  final bool labelPreview;
  const BarcodeInput({
    super.key,
    required this.title,
    required this.demoCode,
    required this.onResult,
    this.labelPreview = false,
  });
  @override
  State<BarcodeInput> createState() => _BarcodeInputState();
}

class _BarcodeInputState extends State<BarcodeInput> {
  bool camera = false;
  String? last;
  int zoom = 1;
  final cameraKey = GlobalKey<_CameraState>();
  void accept(String code) {
    if (code.trim().isEmpty) {
      return;
    }
    setState(() {
      camera = false;
      last = code.trim();
    });
    widget.onResult(code.trim());
  }

  Future<void> manual() async {
    final field = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder:
          (c) => AlertDialog(
            title: const Text('Manual Barcode'),
            content: TextField(
              controller: field,
              decoration: const InputDecoration(
                hintText: 'Enter SKU or rack barcode',
              ),
              onSubmitted: (v) => Navigator.pop(c, v),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c, widget.demoCode),
                child: const Text('Demo Scan'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, field.text),
                child: const Text('Use Barcode'),
              ),
            ],
          ),
    );
    // Dialog route finishes its closing animation before the controller is disposed.
    await Future<void>.delayed(const Duration(milliseconds: 250));
    field.dispose();
    if (result != null && mounted) {
      accept(result);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        height: 256,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xff040817),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: const Color(0xff1e293b), width: 2),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (camera)
              Positioned.fill(child: _Camera(key: cameraKey, onResult: accept)),
            Positioned(
              top: 10,
              left: 10,
              right: 10,
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        color: const Color(0xff111827),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xff273246)),
                      ),
                      child: Text(
                        widget.title,
                        style: const TextStyle(
                          fontSize: 8,
                          color: Color(0xffd7e7b0),
                        ),
                        maxLines: 1,
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  const Text(
                    'FPS: 60 • 1080p',
                    style: TextStyle(fontSize: 8, color: Colors.white70),
                  ),
                ],
              ),
            ),
            if (!camera)
              GestureDetector(
                onTap: () => setState(() => camera = true),
                child:
                    widget.labelPreview
                        ? Container(
                          width: 153,
                          height: 96,
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: const Color(0xfff9fbfd),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Column(
                            children: [
                              Text(
                                widget.demoCode,
                                style: const TextStyle(
                                  fontSize: 9,
                                  letterSpacing: 1,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 9),
                              const Expanded(
                                child: SizedBox(
                                  width: double.infinity,
                                  child: CustomPaint(painter: _BarcodeGuide()),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                widget.demoCode,
                                style: const TextStyle(
                                  fontSize: 7,
                                  letterSpacing: .8,
                                ),
                              ),
                            ],
                          ),
                        )
                        : const Icon(
                          Icons.camera_alt_outlined,
                          size: 30,
                          color: Colors.white30,
                        ),
              ),
            IgnorePointer(
              child: SizedBox(
                width: 184,
                height: 127,
                child: CustomPaint(painter: _Reticle()),
              ),
            ),
            IgnorePointer(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 20),
                decoration: const BoxDecoration(
                  color: Color(0xff9cbb55),
                  boxShadow: [
                    BoxShadow(color: Color(0xff9cbb55), blurRadius: 8),
                  ],
                ),
              ),
            ),
            const Positioned(
              bottom: 61,
              child: Text(
                'ALIGN CODE WITHIN RETICLE',
                style: TextStyle(
                  fontSize: 8,
                  letterSpacing: 1.6,
                  color: Colors.white60,
                ),
              ),
            ),
            Positioned(
              bottom: 10,
              left: 10,
              right: 10,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _CameraButton('Torch ON', () {
                    if (camera) {
                      cameraKey.currentState?.toggleTorch();
                    } else {
                      setState(() => camera = true);
                    }
                  }, icon: Icons.flash_on),
                  Row(
                    children: [
                      for (int i = 1; i <= 3; i++)
                        _CameraButton('${i}x', () {
                          setState(() => zoom = i);
                          cameraKey.currentState?.setZoom(i);
                        }, selected: zoom == i),
                    ],
                  ),
                  _CameraButton(
                    'Manual',
                    manual,
                    icon: Icons.keyboard_outlined,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (last != null)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xffecfdf5),
            borderRadius: BorderRadius.circular(7),
            border: Border.all(color: const Color(0xffa7f3d0)),
          ),
          child: Text(
            '✓ Barcode Scan Verified   $last',
            style: const TextStyle(fontSize: 9, color: mint),
          ),
        ),
      const SizedBox(height: 10),
    ],
  );
}

class _CameraButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool selected;
  final IconData? icon;
  const _CameraButton(
    this.label,
    this.onTap, {
    this.selected = false,
    this.icon,
  });
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Container(
      margin: const EdgeInsets.only(right: 3),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? olive : const Color(0xff090f1c),
        border: Border.all(color: const Color(0xff263040)),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: const Color(0xffd7e7b0)),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 8,
              color: Colors.white,
              letterSpacing: .6,
            ),
          ),
        ],
      ),
    ),
  );
}

class _Reticle extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p =
        Paint()
          ..color = const Color(0xffbdd775)
          ..strokeWidth = 1.8
          ..style = PaintingStyle.stroke;
    for (final pt in [
      Offset.zero,
      Offset(s.width, 0),
      Offset(0, s.height),
      Offset(s.width, s.height),
    ]) {
      final dx = pt.dx == 0 ? 20.0 : -20.0, dy = pt.dy == 0 ? 20.0 : -20.0;
      c.drawPath(
        Path()
          ..moveTo(pt.dx + dx, pt.dy)
          ..lineTo(pt.dx, pt.dy)
          ..lineTo(pt.dx, pt.dy + dy),
        p,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _Reticle old) => false;
}

class _Camera extends StatefulWidget {
  final ValueChanged<String> onResult;
  const _Camera({super.key, required this.onResult});
  @override
  State<_Camera> createState() => _CameraState();
}

class _CameraState extends State<_Camera> with WidgetsBindingObserver {
  final controller = MobileScannerController();
  bool delivered = false;
  void setZoom(int value) {
    unawaited(controller.setZoomScale((value - 1) / 2));
  }

  void toggleTorch() {
    unawaited(controller.toggleTorch());
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!controller.value.hasCameraPermission) {
      return;
    }
    if (state == AppLifecycleState.resumed) {
      unawaited(controller.start());
    }
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(controller.stop());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MobileScanner(
    controller: controller,
    errorBuilder:
        (context, error) => Container(
          color: Colors.black,
          padding: const EdgeInsets.all(20),
          child: const Center(
            child: Text(
              'Camera unavailable or permission denied. Use Demo Scan or manual barcode.',
              style: TextStyle(color: Colors.white),
              textAlign: TextAlign.center,
            ),
          ),
        ),
    onDetect: (capture) {
      if (delivered) {
        return;
      }
      for (final barcode in capture.barcodes) {
        final value = barcode.rawValue;
        if (value != null && value.isNotEmpty) {
          delivered = true;
          widget.onResult(value);
          break;
        }
      }
    },
  );
}

class _BarcodeGuide extends CustomPainter {
  const _BarcodeGuide();
  @override
  void paint(Canvas c, Size s) {
    // Decorative scan guide; camera decoding uses real labels, not these bars.
    final p = Paint()..color = ink;
    final widths = [
      2,
      1,
      1,
      3,
      1,
      2,
      1,
      1,
      3,
      2,
      1,
      1,
      2,
      3,
      1,
      2,
      1,
      1,
      1,
      3,
      2,
      2,
      1,
      1,
      3,
      1,
      2,
      1,
      2,
      3,
      1,
      1,
      2,
      1,
      3,
      2,
      1,
      2,
      1,
      1,
    ];
    final unit = s.width / widths.fold<int>(0, (sum, n) => sum + n);
    double x = 0;
    for (int i = 0; i < widths.length; i++) {
      final w = widths[i] * unit;
      if (i.isEven) {
        c.drawRect(Rect.fromLTWH(x, 0, w, s.height), p);
      }
      x += w;
    }
  }

  @override
  bool shouldRepaint(covariant _BarcodeGuide old) => false;
}
