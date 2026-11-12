import 'package:flutter/material.dart';

// Warna Brand Mint SUSUNO (sesuai logo #60B39F)
const mintLogo = Color(0xff60b39f); // Warna murni logo SUSUNO #60B39F
const mint = Color(0xff439e8a); // Mint solid kontras tinggi untuk tombol, aksi, dan indikator
const forest = Color(0xff25705e); // Deep mint forest (untuk status sukses / selesai)
const olive = mint; // Kompatibilitas mundur mengarah ke mint
const ink = Color(0xff0f172a);
const muted = Color(0xff64748b);
const canvas = Color(0xfff9f9ff);
const line = Color(0xffe2e8f0);
const lavender = Color(0xffe8edff);
const danger = Color(0xffe11d48);
const amber = Color(0xffdf7f00);

// Nama family font, harus sama persis dengan yang dideklarasikan di pubspec.yaml.
const appFont = 'PlusJakartaSans';

// -----------------------------------------------------------------------------
// BRAND TOKENS (design language tema HIJAU MINT SUSUNO).
// -----------------------------------------------------------------------------
const brand = mint; // hijau mint aksi utama (tombol, tab aktif, ikon)
const brandSoft = Color(0xffe8f6f2); // latar ikon / item terpilih (mint pastel muda)
const brandSoftBorder = Color(0xffbfe5dc); // border mint lembut
const brandGradientStart = Color(0xffdaf1ea); // mint lembut
const brandGradientEnd = mintLogo; // hijau mint logo SUSUNO (#60B39F)
const brandInk = Color(0xff111827); // judul
const brandSlate = Color(0xff475569); // teks isi
const brandHeroInk = Color(0xff18181b); // teks di atas gradien
const brandHeroSub = Color(0xff3f3f46);
const brandCardShadow = [
  BoxShadow(color: Color(0x14000000), blurRadius: 16, offset: Offset(0, 4)),
];

// -----------------------------------------------------------------------------
// ThemeData global. Halaman yang belum di-redesign ikut mewarisi bentuk dan
// warna baru dari sini (tombol pill, input membulat, chip pill).
// -----------------------------------------------------------------------------
ThemeData appTheme(bool contrast) => ThemeData(
  useMaterial3: true,
  fontFamily: appFont,
  colorScheme: ColorScheme.fromSeed(seedColor: brand, primary: brand),
  scaffoldBackgroundColor: canvas,
  focusColor: Colors.transparent,
  hoverColor: Colors.transparent,
  visualDensity: VisualDensity.standard,
  textTheme: ThemeData.light().textTheme
      .apply(fontFamily: appFont, bodyColor: ink, displayColor: ink)
      .copyWith(
        bodyLarge: const TextStyle(fontSize: 16, color: ink),
        bodyMedium: const TextStyle(fontSize: 14, color: ink),
        bodySmall: const TextStyle(fontSize: 12, color: muted),
      ),
  appBarTheme: const AppBarTheme(
    backgroundColor: canvas,
    foregroundColor: brandInk,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
    centerTitle: false,
    titleTextStyle: TextStyle(
      fontSize: 18,
      color: brandInk,
      fontWeight: FontWeight.w900,
      letterSpacing: -0.3,
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    isDense: false,
    filled: true,
    fillColor: const Color(0xfff8fafc),
    hintStyle: const TextStyle(fontSize: 13, color: Color(0xff94a3b8)),
    labelStyle: const TextStyle(fontSize: 13, color: muted),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: line),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide(color: contrast ? ink : line),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(16),
      borderSide: const BorderSide(color: brand, width: 1.8),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: brand,
      foregroundColor: Colors.white,
      elevation: 0,
      minimumSize: const Size(0, 48),
      textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: brand,
      minimumSize: const Size(0, 48),
      side: const BorderSide(color: line, width: 1.5),
      textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
      shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: brand,
      textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
      minimumSize: const Size(0, 44),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    ),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: const Color(0xfff7f9fd),
    selectedColor: brandSoft,
    side: const BorderSide(color: line),
    labelStyle: const TextStyle(
      fontSize: 12,
      color: ink,
      fontWeight: FontWeight.w600,
    ),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    shape: const StadiumBorder(),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),
  dialogTheme: DialogThemeData(
    backgroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    titleTextStyle: const TextStyle(
      fontFamily: appFont,
      fontSize: 18,
      fontWeight: FontWeight.w900,
      letterSpacing: -0.3,
      color: brandInk,
    ),
    contentTextStyle: const TextStyle(
      fontFamily: appFont,
      fontSize: 13,
      fontWeight: FontWeight.w500,
      color: brandSlate,
      height: 1.45,
    ),
  ),
  snackBarTheme: SnackBarThemeData(
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
);

String formatNumber(num number) {
  final str = number.toStringAsFixed(0);
  final regex = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
  return str.replaceAllMapped(regex, (m) => '${m[1]}.');
}

String formatRupiah(num number) {
  return 'Rp ${formatNumber(number)}';
}
