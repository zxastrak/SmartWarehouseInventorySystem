import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Splash Screen SUSUNO dengan animasi Sprite Sheet pelari 8-frame,
/// garis kecepatan dinamis, progress bar responsif dengan kurir berjalan,
/// dan teks status loading dinamis.
class SplashScreen extends StatefulWidget {
  final VoidCallback? onFinish;

  const SplashScreen({super.key, this.onFinish});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // Controller animasi siklus lari sprite (8 frame berulang)
  late AnimationController _runController;

  // Controller kemajuan progress bar (0.0 -> 1.0)
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;

  // Controller fade-in saat pertama kali muncul
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  // Cache gambar sprite sheet
  static ui.Image? _cachedSpriteImage;
  ui.Image? _spriteImage;
  bool _isSpriteLoaded = false;

  @override
  void initState() {
    super.initState();

    // 1. Controller untuk siklus lari 8 frame (~11 FPS = 720ms per putaran)
    _runController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 720),
    )..repeat();

    // 2. Controller fade-in tampilan awal (400ms)
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
    _fadeController.forward();

    // 3. Controller kemajuan loading bar (~2800ms)
    _progressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    );
    _progressAnimation = CurvedAnimation(
      parent: _progressController,
      curve: Curves.easeInOutCubic,
    );

    _progressController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _finishAndNavigate();
      }
    });

    _loadSpriteSheet();
    _progressController.forward();
  }

  Future<void> _loadSpriteSheet() async {
    if (_cachedSpriteImage != null) {
      if (mounted) {
        setState(() {
          _spriteImage = _cachedSpriteImage;
          _isSpriteLoaded = true;
        });
      }
      return;
    }

    try {
      final ByteData data =
          await rootBundle.load('assets/images/runner_spritesheet.png');
      final ui.Codec codec =
          await ui.instantiateImageCodec(data.buffer.asUint8List());
      final ui.FrameInfo frameInfo = await codec.getNextFrame();
      _cachedSpriteImage = frameInfo.image;
      if (mounted) {
        setState(() {
          _spriteImage = _cachedSpriteImage;
          _isSpriteLoaded = true;
        });
      }
    } catch (e) {
      debugPrint('Error loading runner sprite sheet: $e');
    }
  }

  void _finishAndNavigate() {
    Future.delayed(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      widget.onFinish?.call();
    });
  }

  @override
  void dispose() {
    _runController.dispose();
    _progressController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  String _getDynamicStatus(double val) {
    if (val < 0.35) {
      return 'Menghubungkan ke server...';
    } else if (val < 0.70) {
      return 'Memeriksa sesi inventaris...';
    } else {
      return 'Menyiapkan workspace...';
    }
  }

  @override
  Widget build(BuildContext context) {
    // Warna background solid mint SUSUNO sesuai mockup (#02997A)
    const splashMint = Color(0xff02997a);

    final size = MediaQuery.of(context).size;
    final isCompact = size.height < 680;

    return Scaffold(
      backgroundColor: splashMint,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light.copyWith(
          statusBarColor: Colors.transparent,
          systemNavigationBarColor: splashMint,
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  child: Column(
                    children: [
                      // Jarak atas fleksibel
                      const Spacer(flex: 3),

                      // -------------------------------------------------------------
                      // 1. HEADER BRANDING SUSUNO (Sejajar Horizontal & Diperbesar)
                      // -------------------------------------------------------------
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          // Logo SUSUNO putih diperbesar
                          Image.asset(
                            'assets/images/susuno_logo.png',
                            color: Colors.white,
                            width: isCompact ? 58 : 72,
                            height: isCompact ? 58 : 72,
                            fit: BoxFit.contain,
                          ),
                          SizedBox(width: isCompact ? 14 : 18),

                          // Teks SUSUNO & Subtitle (Diperbesar)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'SUSUNO',
                                style: TextStyle(
                                  fontSize: isCompact ? 32 : 38,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 2.2,
                                  color: Colors.white,
                                  height: 1.05,
                                ),
                              ),
                              const SizedBox(height: 5),
                              Text(
                                'SMART WAREHOUSE\nINVENTORY SYSTEM',
                                style: TextStyle(
                                  fontSize: isCompact ? 10.5 : 12.0,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 2.6,
                                  height: 1.28,
                                  color: Colors.white.withAlpha(235),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      // Jarak rapat antara header dengan karakter runner (sesuai contoh)
                      const Spacer(flex: 2),

                      // -------------------------------------------------------------
                      // 2. HERO ANIMASI: KARAKTER PELARI + SPEED LINES + SHADOW
                      // -------------------------------------------------------------
                      _buildRunnerHero(isCompact: isCompact),

                      // Jarak antara karakter runner dengan loading bar
                      const Spacer(flex: 3),

                      // -------------------------------------------------------------
                      // 3. BOTTOM: PROGRESS BAR DENGAN KURIR DINAMIS (OPSI B) + TEKS
                      // -------------------------------------------------------------
                      AnimatedBuilder(
                        animation: _progressAnimation,
                        builder: (context, _) {
                          final progress = _progressAnimation.value;
                          return Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _buildProgressBar(progress),
                              const SizedBox(height: 18),
                              _buildDynamicStatusText(progress),
                            ],
                          );
                        },
                      ),

                      // Spasi bawah
                      const Spacer(flex: 2),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Membangun hero karakter pelari dengan garis kecepatan (speed lines) & bayangan lantai
  Widget _buildRunnerHero({required bool isCompact}) {
    final runnerWidth = isCompact ? 172.0 : 202.0;
    final runnerHeight = isCompact ? 230.0 : 270.0;

    return SizedBox(
      height: runnerHeight + 30,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // Bayangan lembut di bawah kaki karakter
          Positioned(
            bottom: 4,
            child: AnimatedBuilder(
              animation: _runController,
              builder: (context, _) {
                // Skala bayangan berdenyut halus mengikuti irama lari
                final bounce = 1.0 + 0.08 * math.sin(_runController.value * 2 * math.pi);
                return Transform.scale(
                  scaleX: bounce,
                  scaleY: 1.0 / bounce,
                  child: Container(
                    width: runnerWidth * 0.65,
                    height: 14,
                    decoration: BoxDecoration(
                      color: const Color(0x3500291f),
                      borderRadius: BorderRadius.all(
                        Radius.elliptical(runnerWidth * 0.32, 7),
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x28001f17),
                          blurRadius: 16,
                          spreadRadius: 3,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Garis Kecepatan (Speed Lines) di sisi kiri karakter
          Positioned(
            left: -12,
            top: runnerHeight * 0.44,
            child: AnimatedBuilder(
              animation: _runController,
              builder: (context, _) {
                // Efek getar/bergerak horizontal halus mengikuti kecepatan
                final drift = -4.0 * math.sin(_runController.value * 2 * math.pi);
                return Transform.translate(
                  offset: Offset(drift, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildSpeedLine(length: 44, opacity: 0.82),
                      const SizedBox(height: 9),
                      _buildSpeedLine(length: 68, opacity: 0.95),
                      const SizedBox(height: 9),
                      _buildSpeedLine(length: 36, opacity: 0.72),
                    ],
                  ),
                );
              },
            ),
          ),

          // Karakter Sprite Sheet Pelari
          if (_isSpriteLoaded && _spriteImage != null)
            AnimatedBuilder(
              animation: _runController,
              builder: (context, _) {
                // 8 Frame siklus lari (4 kolom x 2 baris)
                final frameIndex = (_runController.value * 8).floor() % 8;
                return CustomPaint(
                  size: Size(runnerWidth, runnerHeight),
                  painter: _SpriteSheetPainter(
                    image: _spriteImage!,
                    frameIndex: frameIndex,
                  ),
                );
              },
            )
          else
            // Fallback animasi loading halus sebelum sprite siap dimuat (~10ms)
            SizedBox(
              width: runnerWidth,
              height: runnerHeight,
              child: const Center(
                child: SizedBox(
                  width: 32,
                  height: 32,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Garis kecepatan putih membulat (pill)
  Widget _buildSpeedLine({required double length, required double opacity}) {
    return Container(
      width: length,
      height: 4.5,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: opacity),
        borderRadius: BorderRadius.circular(2.25),
      ),
    );
  }

  /// Progress bar kapsul dengan kurir putih kecil bergerak di ujung garis loading
  Widget _buildProgressBar(double progress) {
    const trackWidth = 270.0;
    const trackHeight = 8.0;
    const courierWidth = 24.0;
    const courierHeight = 32.0;

    // Jarak lintasan yang dapat ditempuh kurir kecil dari ujung kiri ke kanan
    final maxTravel = trackWidth - courierWidth;
    final courierX = (progress * maxTravel).clamp(0.0, maxTravel);

    // Panjang bar putih mengikuti posisi kurir
    final fillWidth = (courierX + 8.0).clamp(0.0, trackWidth);

    return SizedBox(
      width: trackWidth,
      height: 42,
      child: Stack(
        alignment: Alignment.centerLeft,
        clipBehavior: Clip.none,
        children: [
          // 1. Jalur rel latar belakang (transparan putih lembut)
          Center(
            child: Container(
              width: trackWidth,
              height: trackHeight,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.24),
                borderRadius: BorderRadius.circular(trackHeight / 2),
              ),
            ),
          ),

          // 2. Bar progres putih aktif
          Positioned(
            left: 0,
            child: Container(
              width: fillWidth,
              height: trackHeight,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(trackHeight / 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.white.withValues(alpha: 0.35),
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
          ),

          // 3. Ikon Kurir Kecil Dinamis yang berlari di ujung progress bar
          Positioned(
            left: courierX,
            top: 2,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // 2 Garis kecepatan mini di belakang kurir kecil
                if (progress > 0.05) ...[
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        width: 8,
                        height: 2,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Container(
                        width: 5,
                        height: 2,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.75),
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 4),
                ],

                // Ikon Kurir Putih Animasi (menggunakan sprite sheet tersinkronisasi)
                if (_isSpriteLoaded && _spriteImage != null)
                  AnimatedBuilder(
                    animation: _runController,
                    builder: (context, _) {
                      final frameIndex =
                          (_runController.value * 8).floor() % 8;
                      return CustomPaint(
                        size: const Size(courierWidth, courierHeight),
                        painter: _SpriteSheetPainter(
                          image: _spriteImage!,
                          frameIndex: frameIndex,
                          colorFilter: Colors.white,
                        ),
                      );
                    },
                  )
                else
                  // Fallback icon jika gambar belum selesai decode
                  const Icon(
                    Icons.directions_run,
                    color: Colors.white,
                    size: 26,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Teks status dinamis yang berganti secara halus (fade murni di posisi yang sama)
  Widget _buildDynamicStatusText(double progress) {
    final statusText = _getDynamicStatus(progress);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      layoutBuilder: (currentChild, previousChildren) {
        return Stack(
          alignment: Alignment.center,
          children: <Widget>[
            ...previousChildren,
            if (currentChild != null) currentChild,
          ],
        );
      },
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: child,
        );
      },
      child: Text(
        statusText,
        key: ValueKey<String>(statusText),
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.4,
          color: Colors.white.withValues(alpha: 0.92),
        ),
      ),
    );
  }
}

/// CustomPainter untuk merender sub-persegi frame dari Sprite Sheet (4x2 = 8 frame)
class _SpriteSheetPainter extends CustomPainter {
  final ui.Image image;
  final int frameIndex;
  final Color? colorFilter;

  const _SpriteSheetPainter({
    required this.image,
    required this.frameIndex,
    this.colorFilter,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Dimensi gambar sprite sheet murni: 612 x 408
    // Terdiri dari 4 kolom x 2 baris (setiap frame tepat 153 x 204 px)
    const frameWidth = 153.0;
    const frameHeight = 204.0;

    final col = frameIndex % 4;
    final row = frameIndex ~/ 4;

    final srcRect = Rect.fromLTWH(
      col * frameWidth,
      row * frameHeight,
      frameWidth,
      frameHeight,
    );

    final dstRect = Rect.fromLTWH(0, 0, size.width, size.height);

    final paint = Paint()
      ..filterQuality = FilterQuality.medium
      ..isAntiAlias = true;

    if (colorFilter != null) {
      paint.colorFilter = ColorFilter.mode(colorFilter!, BlendMode.srcIn);
    }

    canvas.drawImageRect(image, srcRect, dstRect, paint);
  }

  @override
  bool shouldRepaint(covariant _SpriteSheetPainter oldDelegate) {
    return oldDelegate.frameIndex != frameIndex ||
        oldDelegate.colorFilter != colorFilter ||
        oldDelegate.image != image;
  }
}

