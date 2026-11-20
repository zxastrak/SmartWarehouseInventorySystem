import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/app_theme.dart';
import 'web_camera_helper.dart';

/// Komponen pemindai barcode / QR Code langsung aktif di tempat (realtime in-place).
/// Dilengkapi kontrol Flash/Light di pojok atas dan mekanisme anti-looping dengan tombol Pindai Ulang.
class BarcodeInput extends StatefulWidget {
  final String title;
  final String demoCode;
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
  final cameraKey = GlobalKey<_CameraState>();
  bool isLocked = false;
  bool torchEnabled = false;
  bool cameraError = false;
  String? last;

  @override
  void deactivate() {
    stopWebMediaTracks();
    super.deactivate();
  }

  void accept(String code) {
    if (code.trim().isEmpty || isLocked) {
      return;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      isLocked = true;
      last = code.trim().toUpperCase();
    });
    // Hentikan sementara sensor pemindaian agar tidak looping
    cameraKey.currentState?.pauseScan();
    widget.onResult(code.trim().toUpperCase());
  }

  /// Tombol Pindai Ulang untuk mengaktifkan kembali sensor kamera setelah scan sukses
  void retryScan() {
    setState(() {
      isLocked = false;
      last = null;
    });
    cameraKey.currentState?.resumeScan();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // Kotak Scanner Kamera Realtime
      Container(
        height: 300,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: const Color(0xff040817),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isLocked ? const Color(0xff22c55e) : const Color(0xff1e293b),
            width: 1.8,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Feed Kamera Langsung Aktif
            Positioned.fill(
              child: _Camera(
                key: cameraKey,
                onResult: accept,
                onError: (v) {
                  if (mounted) setState(() => cameraError = v);
                },
              ),
            ),

            // Header Bar di dalam Kamera: Judul di Kiri & Tombol Flash di Kanan
            Positioned(
              top: 10,
              left: 12,
              right: 12,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Label Status Mode Scan
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xff111827).withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xff273246)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: isLocked ? const Color(0xff22c55e) : const Color(0xffef4444),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
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
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Tombol Senter / Flashlight
                  GestureDetector(
                    onTap: () {
                      setState(() => torchEnabled = !torchEnabled);
                      cameraKey.currentState?.toggleTorch();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: torchEnabled ? brand : const Color(0xff111827).withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: torchEnabled ? brand : const Color(0xff273246)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            torchEnabled ? Icons.flash_on : Icons.flash_off,
                            size: 14,
                            color: torchEnabled ? Colors.white : const Color(0xffd7e7b0),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            torchEnabled ? 'Flash ON' : 'Flash',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: torchEnabled ? Colors.white : const Color(0xffd7e7b0),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Bingkai Laser Pemindaian (Hanya saat aktif memindai)
            if (!isLocked && !cameraError) ...[
              IgnorePointer(
                child: SizedBox(
                  width: 190,
                  height: 130,
                  child: CustomPaint(painter: _Reticle()),
                ),
              ),
              IgnorePointer(
                child: Container(
                  height: 2,
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  decoration: const BoxDecoration(
                    color: Color(0xff9cbb55),
                    boxShadow: [
                      BoxShadow(color: Color(0xff9cbb55), blurRadius: 8),
                    ],
                  ),
                ),
              ),
              const Positioned(
                bottom: 14,
                child: Text(
                  'Arahkan barcode ke dalam bingkai',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.2,
                    color: Colors.white70,
                  ),
                ),
              ),
            ],

            // Overlay Kunci Sukses (Mencegah Looping Scan)
            if (isLocked)
              Positioned.fill(
                child: Container(
                  color: Colors.black.withValues(alpha: 0.75),
                  padding: const EdgeInsets.all(20),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xff22c55e),
                          size: 48,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Barcode Berhasil Dipindai!',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          last ?? '',
                          style: const TextStyle(
                            color: Color(0xffd7e7b0),
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),

      // Tombol Pindai Ulang / Scan Lagi saat Barcode Terbaca
      if (isLocked) ...[
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: brand,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            onPressed: retryScan,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text(
              'Pindai Ulang (Scan Lagi)',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            ),
          ),
        ),
      ],
      const SizedBox(height: 10),
    ],
  );
}

class _Reticle extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p =
        Paint()
          ..color = const Color(0xffbdd775)
          ..strokeWidth = 2.0
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

  void toggleTorch() {
    unawaited(controller.toggleTorch());
  }

  void pauseScan() {
    delivered = true;
    unawaited(controller.stop());
  }

  void resumeScan() {
    delivered = false;
    unawaited(controller.start());
  }

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
    if (state == AppLifecycleState.resumed && !delivered) {
      unawaited(controller.start());
    }
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(controller.stop());
    }
  }

  @override
  void deactivate() {
    unawaited(controller.stop());
    stopWebMediaTracks();
    super.deactivate();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(onControllerChanged);
    unawaited(controller.stop());
    unawaited(controller.dispose());
    stopWebMediaTracks();
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
        padding: const EdgeInsets.fromLTRB(20, 40, 20, 40),
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
                      : 'Kamera tidak bisa dibuka di perangkat ini.',
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
