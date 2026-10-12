import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Modul QR Scanner Mandiri (Self-Contained QR Scanner Module)
///
/// Modul ini menyediakan:
/// 1. [QrScannerScreen] - Halaman penuh untuk memindai QR code via `QrScannerScreen.scan(context)`.
/// 2. [QrScannerView]   - Widget scanner yang dapat disematkan ke dalam container/dialog mana pun.
class QrScannerScreen extends StatefulWidget {
  final String title;
  final String hintText;
  final List<BarcodeFormat> formats;

  const QrScannerScreen({
    super.key,
    this.title = 'Scan QR Code',
    this.hintText = 'Arahkan kamera ke QR Code',
    this.formats = const [BarcodeFormat.qrCode],
  });

  /// Helper statis untuk membuka scanner dan langsung mendapatkan teks QR yang dipindai.
  ///
  /// Contoh pemanggilan:
  /// ```dart
  /// final qrData = await QrScannerScreen.scan(context);
  /// if (qrData != null) {
  ///   print('Hasil QR: $qrData');
  /// }
  /// ```
  static Future<String?> scan(
    BuildContext context, {
    String title = 'Scan QR Code',
    String hintText = 'Arahkan kamera ke QR Code',
    List<BarcodeFormat> formats = const [BarcodeFormat.qrCode],
  }) {
    return Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => QrScannerScreen(
          title: title,
          hintText: hintText,
          formats: formats,
        ),
      ),
    );
  }

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final GlobalKey<QrScannerViewState> _scannerKey = GlobalKey<QrScannerViewState>();
  bool _torchOn = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          widget.title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            tooltip: _torchOn ? 'Matikan Senter' : 'Nyalakan Senter',
            icon: Icon(
              _torchOn ? Icons.flash_on : Icons.flash_off,
              color: _torchOn ? const Color(0xffeab308) : Colors.white,
            ),
            onPressed: () async {
              await _scannerKey.currentState?.toggleTorch();
              setState(() {
                _torchOn = !_torchOn;
              });
            },
          ),
          IconButton(
            tooltip: 'Putar Kamera',
            icon: const Icon(Icons.flip_camera_ios, color: Colors.white),
            onPressed: () => _scannerKey.currentState?.switchCamera(),
          ),
        ],
      ),
      body: SafeArea(
        child: QrScannerView(
          key: _scannerKey,
          hintText: widget.hintText,
          formats: widget.formats,
          onScanned: (value) {
            Navigator.of(context).pop(value);
          },
        ),
      ),
    );
  }
}

/// Widget modular QR Scanner yang dapat disematkan di mana saja.
class QrScannerView extends StatefulWidget {
  final ValueChanged<String> onScanned;
  final String hintText;
  final List<BarcodeFormat> formats;
  final double scanWindowSize;
  final Color cornerColor;
  final Color scanLineColor;
  final bool showControls;

  const QrScannerView({
    super.key,
    required this.onScanned,
    this.hintText = 'Arahkan kamera ke QR Code',
    this.formats = const [BarcodeFormat.qrCode],
    this.scanWindowSize = 250.0,
    this.cornerColor = const Color(0xff22c55e),
    this.scanLineColor = const Color(0xff4ade80),
    this.showControls = true,
  });

  @override
  State<QrScannerView> createState() => QrScannerViewState();
}

class QrScannerViewState extends State<QrScannerView>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final MobileScannerController _controller;
  late final AnimationController _animController;
  late final Animation<double> _animPosition;
  bool _isDispatched = false;
  bool _torchEnabled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _controller = MobileScannerController(
      formats: widget.formats,
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
    );

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _animPosition = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  Future<void> toggleTorch() async {
    await _controller.toggleTorch();
    if (mounted) {
      setState(() {
        _torchEnabled = !_torchEnabled;
      });
    }
  }

  Future<void> switchCamera() async {
    await _controller.switchCamera();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_controller.value.hasCameraPermission) {
      return;
    }
    if (state == AppLifecycleState.resumed) {
      unawaited(_controller.start());
    } else if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(_controller.stop());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _animController.dispose();
    unawaited(_controller.dispose());
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_isDispatched) return;

    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.trim().isNotEmpty) {
        _isDispatched = true;
        HapticFeedback.mediumImpact().ignore();
        widget.onScanned(value.trim());
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final boxSize = widget.scanWindowSize.clamp(
          160.0,
          constraints.maxWidth * 0.75,
        );

        return Stack(
          alignment: Alignment.center,
          children: [
            // Kamera Feed
            Positioned.fill(
              child: MobileScanner(
                controller: _controller,
                fit: BoxFit.cover,
                onDetect: _handleDetect,
                errorBuilder: (context, error) {
                  return Container(
                    color: const Color(0xff090d16),
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.videocam_off_outlined,
                            color: Colors.white54,
                            size: 48,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Kamera Tidak Tersedia',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            error.errorDetails?.message ??
                                'Pastikan izin kamera telah diberikan pada perangkat Anda.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: widget.cornerColor,
                              foregroundColor: Colors.black,
                            ),
                            onPressed: () => _controller.start(),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('Coba Lagi'),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            // Semi-transparan cutout overlay di luar kotak pemindaian
            Positioned.fill(
              child: CustomPaint(
                painter: _CutoutOverlayPainter(
                  cutoutSize: boxSize,
                  overlayColor: Colors.black.withValues(alpha: 0.55),
                ),
              ),
            ),

            // Bingkai & Laser Pemindaian
            SizedBox(
              width: boxSize,
              height: boxSize,
              child: Stack(
                children: [
                  // Sudut bingkai QR (Corner Reticles)
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _QrCornerPainter(
                        color: widget.cornerColor,
                        cornerLength: 26,
                        strokeWidth: 4,
                      ),
                    ),
                  ),

                  // Garis Laser Animasi
                  AnimatedBuilder(
                    animation: _animPosition,
                    builder: (context, child) {
                      return Positioned(
                        top: _animPosition.value * (boxSize - 16) + 8,
                        left: 12,
                        right: 12,
                        child: Container(
                          height: 2.5,
                          decoration: BoxDecoration(
                            color: widget.scanLineColor,
                            borderRadius: BorderRadius.circular(2),
                            boxShadow: [
                              BoxShadow(
                                color: widget.scanLineColor.withValues(alpha: 0.8),
                                blurRadius: 10,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            // Petunjuk Teks di Bawah Kotak Scanner
            Positioned(
              top: (constraints.maxHeight / 2) + (boxSize / 2) + 24,
              left: 24,
              right: 24,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white12),
                ),
                child: Text(
                  widget.hintText,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),

            // Kontrol Cepat di Bawah (Flashlight & Switch Camera)
            if (widget.showControls)
              Positioned(
                bottom: 30,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _RoundControlButton(
                      icon: _torchEnabled ? Icons.flash_on : Icons.flash_off,
                      isActive: _torchEnabled,
                      label: 'Flash',
                      onTap: toggleTorch,
                    ),
                    const SizedBox(width: 24),
                    _RoundControlButton(
                      icon: Icons.flip_camera_ios,
                      isActive: false,
                      label: 'Putar',
                      onTap: switchCamera,
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Tombol bulat untuk kontrol senter dan kamera
class _RoundControlButton extends StatelessWidget {
  final IconData icon;
  final bool isActive;
  final String label;
  final VoidCallback onTap;

  const _RoundControlButton({
    required this.icon,
    required this.isActive,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(30),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: isActive ? Colors.white : Colors.black.withValues(alpha: 0.6),
              shape: BoxShape.circle,
              border: Border.all(
                color: isActive ? Colors.white : Colors.white30,
                width: 1.5,
              ),
            ),
            child: Icon(
              icon,
              color: isActive ? Colors.black : Colors.white,
              size: 24,
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

/// Painter untuk menggambar area gelap di luar kotak fokus scanner
class _CutoutOverlayPainter extends CustomPainter {
  final double cutoutSize;
  final Color overlayColor;

  _CutoutOverlayPainter({
    required this.cutoutSize,
    required this.overlayColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = overlayColor;
    final center = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCenter(
      center: center,
      width: cutoutSize,
      height: cutoutSize,
    );

    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(16)))
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _CutoutOverlayPainter oldDelegate) =>
      oldDelegate.cutoutSize != cutoutSize ||
      oldDelegate.overlayColor != overlayColor;
}

/// Painter untuk menggambar sudut-sudut L pada kotak target pemindaian QR
class _QrCornerPainter extends CustomPainter {
  final Color color;
  final double cornerLength;
  final double strokeWidth;

  _QrCornerPainter({
    required this.color,
    required this.cornerLength,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final w = size.width;
    final h = size.height;
    final r = cornerLength;

    // Kiri Atas
    canvas.drawPath(
      Path()
        ..moveTo(0, r)
        ..lineTo(0, 0)
        ..lineTo(r, 0),
      paint,
    );

    // Kanan Atas
    canvas.drawPath(
      Path()
        ..moveTo(w - r, 0)
        ..lineTo(w, 0)
        ..lineTo(w, r),
      paint,
    );

    // Kanan Bawah
    canvas.drawPath(
      Path()
        ..moveTo(w, h - r)
        ..lineTo(w, h)
        ..lineTo(w - r, h),
      paint,
    );

    // Kiri Bawah
    canvas.drawPath(
      Path()
        ..moveTo(r, h)
        ..lineTo(0, h)
        ..lineTo(0, h - r),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _QrCornerPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.cornerLength != cornerLength ||
      oldDelegate.strokeWidth != strokeWidth;
}
