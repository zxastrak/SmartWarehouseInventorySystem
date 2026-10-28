import 'package:flutter/material.dart';

const olive = Color(0xff5a7129);
const forest = Color(0xff2e5b32);
const ink = Color(0xff0f172a);
const muted = Color(0xff64748b);
const canvas = Color(0xfff9f9ff);
const line = Color(0xffe2e8f0);
const lavender = Color(0xffe8edff);
const danger = Color(0xffe11d48);
const amber = Color(0xffdf7f00);
const mint = Color(0xff008e68);

// Nama family font, harus sama persis dengan yang dideklarasikan di pubspec.yaml.
const appFont = 'PlusJakartaSans';

// -----------------------------------------------------------------------------
// BRAND TOKENS (design language baru, tema HIJAU).
// Semua halaman redesign memakai token ini. Mau ganti warna brand? Cukup ubah
// nilai di blok ini saja. Warna lama di atas (olive, forest, dst.) tidak diubah.
// -----------------------------------------------------------------------------
const brand = olive; // hijau aksi utama (tombol, tab aktif, ikon)
const brandSoft = Color(0xffeef4e4); // latar ikon / item terpilih
const brandSoftBorder = Color(0xffdbe7c4);
const brandGradientStart = Color(0xffe3efc9); // hijau sage muda
const brandGradientEnd = Color(0xff9ab85c); // hijau daun
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
