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

  static bool _privacyConsentGiven = false;

  Future<void> activateCamera() async {
    if (_privacyConsentGiven) {
      if (mounted) setState(() => camera = true);
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Izin Privasi Kamera',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Aplikasi SUSUNO memerlukan akses kamera hanya untuk memindai barcode barang atau kode rak gudang secara langsung.',
              style: TextStyle(fontSize: 13, height: 1.4, color: brandSlate),
            ),
            SizedBox(height: 14),
            _PrivacyCheckRow(
              icon: Icons.shield_outlined,
              text: 'Pemindaian barcode diproses lokal di perangkat.',
            ),
            SizedBox(height: 8),
            _PrivacyCheckRow(
              icon: Icons.no_photography_outlined,
              text: 'Tidak ada foto atau rekaman video yang disimpan.',
            ),
            SizedBox(height: 8),
            _PrivacyCheckRow(
              icon: Icons.cloud_off_outlined,
              text: 'Tidak ada rekaman visual yang diunggah ke server.',
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Batal', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(c, true),
            icon: const Icon(Icons.check, size: 18),
            label: const Text('Izinkan & Buka'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      _privacyConsentGiven = true;
      setState(() => camera = true);
    }
  }

  Future<void> manual() async {
    final field = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder:
          (c) => AlertDialog(
            title: const Text('Input Barcode Manual'),
            content: TextField(
              controller: field,
              decoration: const InputDecoration(
                hintText: 'Masukkan SKU barang atau kode rak',
              ),
              onSubmitted: (v) => Navigator.pop(c, v),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c, widget.demoCode),
                child: const Text('Isi Contoh'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, field.text),
                child: const Text('Gunakan Barcode'),
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
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xff1e293b), width: 1.5),
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
            if (!camera)
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: activateCamera,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.16),
                              width: 1.5,
                            ),
                          ),
                          child: const Icon(
                            Icons.camera_alt_outlined,
                            size: 30,
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Ketuk untuk mengaktifkan kamera',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Colors.white70,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (camera && !cameraError) ...[
              Positioned(
                top: 10,
                left: 10,
                right: 10,
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xff111827),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xff273246)),
                        ),
                        child: Text(
                          widget.title,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xffd7e7b0),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
                  'Arahkan barcode ke dalam bingkai',
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
                    _CameraButton('Flash', () {
                      if (camera) {
                        cameraKey.currentState?.toggleTorch();
                      } else {
                        activateCamera();
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
          ],
        ),
      ),
      if (last != null)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(top: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: brandSoft,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: brandSoftBorder),
          ),
          child: Text(
            'Barcode Terverifikasi: $last',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: forest,
            ),
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
    borderRadius: BorderRadius.circular(20),
    onTap: onTap,
    child: Container(
      margin: const EdgeInsets.only(right: 3),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      decoration: BoxDecoration(
        color: selected ? brand : const Color(0xff0f172a),
        border: Border.all(color: selected ? brand : const Color(0xff263040)),
        borderRadius: BorderRadius.circular(20),
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
              fontWeight: FontWeight.w700,
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

class _PrivacyCheckRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _PrivacyCheckRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: forest),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: brandInk,
            ),
          ),
        ),
      ],
    );
  }
}
