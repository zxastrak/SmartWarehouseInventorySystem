import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  bool cameraError = false;
  final cameraKey = GlobalKey<_CameraState>();
  void accept(String code) {
    if (code.trim().isEmpty) {
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      camera = false;
      cameraError = false;
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
        height: 310,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xff040817),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xff1e293b), width: 2),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (camera)
              Positioned.fill(
                child: _Camera(
                  key: cameraKey,
                  onResult: accept,
                  onError: (v) {
                    if (mounted) {
                      setState(() => cameraError = v);
                    }
                  },
                ),
              ),
            Positioned(
              top: 10,
              left: 10,
              right: 10,
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xff111827),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xff273246)),
                      ),
                      child: Text(
                        widget.title,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xffd7e7b0),
                        ),
                        maxLines: 1,
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  const Text(
                    'FPS: 60 • 1080p',
                    style: TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
            if (!camera)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => camera = true),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
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
                      const SizedBox(height: 12),
                      const Text(
                        'Ketuk untuk mengaktifkan kamera',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white54,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (!cameraError)
              IgnorePointer(
                child: SizedBox(
                  width: 184,
                  height: 127,
                  child: CustomPaint(painter: _Reticle()),
                ),
              ),
            if (!cameraError)
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
            if (!cameraError)
              const Positioned(
                bottom: 61,
                child: Text(
                  'ALIGN CODE WITHIN RETICLE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.6,
                    color: Colors.white70,
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xffecfdf5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xffa7f3d0)),
          ),
          child: Text(
            '✓ Barcode Scan Verified: $last',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: mint),
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
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: selected ? olive : const Color(0xff090f1c),
        border: Border.all(color: const Color(0xff263040)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: const Color(0xffd7e7b0)),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              letterSpacing: .5,
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
  final ValueChanged<bool> onError;
  const _Camera({super.key, required this.onResult, required this.onError});
  @override
  State<_Camera> createState() => _CameraState();
}

class _CameraState extends State<_Camera> with WidgetsBindingObserver {
  final controller = MobileScannerController();
  bool delivered = false;
  bool reportedError = false;

  void setZoom(int value) {
    unawaited(controller.setZoomScale((value - 1) / 2));
  }

  void toggleTorch() {
    unawaited(controller.toggleTorch());
  }

  // Memberi tahu BarcodeInput saat kamera masuk/keluar dari keadaan error,
  // supaya reticle dan laser bisa disembunyikan. Dijadwalkan setelah frame
  // agar tidak memanggil setState saat widget sedang di-build.
  void onControllerChanged() {
    final hasError = controller.value.error != null;
    if (hasError == reportedError) {
      return;
    }
    reportedError = hasError;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        widget.onError(hasError);
      }
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller.addListener(onControllerChanged);
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
    controller.removeListener(onControllerChanged);
    unawaited(controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MobileScanner(
    controller: controller,
    errorBuilder: (context, error) {
      final denied =
          error.errorCode == MobileScannerErrorCode.permissionDenied;
      return Container(
        color: const Color(0xff040817),
        padding: const EdgeInsets.fromLTRB(20, 52, 20, 56),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  denied
                      ? Icons.no_photography_outlined
                      : Icons.videocam_off_outlined,
                  size: 32,
                  color: Colors.white54,
                ),
                const SizedBox(height: 8),
                Text(
                  denied ? 'Izin Kamera Ditolak' : 'Kamera Tidak Tersedia',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  denied
                      ? (kIsWeb
                          ? 'Klik ikon gembok di sebelah alamat, ubah Kamera menjadi Izinkan, lalu tekan Coba Lagi.'
                          : 'Buka Pengaturan aplikasi, pilih Izin, aktifkan Kamera, lalu tekan Coba Lagi.')
                      : 'Kamera tidak bisa dibuka di perangkat ini. Gunakan tombol Manual untuk memasukkan barcode.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.white70,
                    height: 1.4,
                  ),
                ),
                if (denied) ...[
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 40),
                    ),
                    onPressed: () => unawaited(controller.start()),
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Coba Lagi'),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    },
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