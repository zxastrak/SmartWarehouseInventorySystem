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
ThemeData appTheme(bool contrast) => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: olive, primary: olive),
  scaffoldBackgroundColor: canvas,
  visualDensity: VisualDensity.compact,
  textTheme: ThemeData.light().textTheme
      .apply(bodyColor: ink, displayColor: ink)
      .copyWith(
        bodyMedium: const TextStyle(fontSize: 12, color: ink),
        bodySmall: const TextStyle(fontSize: 10, color: muted),
      ),
  appBarTheme: const AppBarTheme(
    backgroundColor: olive,
    foregroundColor: Colors.white,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    centerTitle: true,
    titleTextStyle: TextStyle(
      fontSize: 20,
      color: Colors.white,
      fontWeight: FontWeight.w700,
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    isDense: true,
    filled: true,
    fillColor: const Color(0xfff8fafc),
    hintStyle: const TextStyle(fontSize: 11, color: Color(0xff94a3b8)),
    labelStyle: const TextStyle(fontSize: 11, color: muted),
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: line),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide(color: contrast ? ink : line),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: olive,
      foregroundColor: Colors.white,
      elevation: 0,
      minimumSize: const Size(0, 36),
      textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: forest,
      minimumSize: const Size(0, 34),
      side: const BorderSide(color: line),
      textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(
      foregroundColor: forest,
      textStyle: const TextStyle(fontSize: 10),
      minimumSize: const Size(0, 25),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
    ),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: const Color(0xfff7f9fd),
    selectedColor: const Color(0xffedf4e4),
    side: const BorderSide(color: line),
    labelStyle: const TextStyle(fontSize: 10, color: ink),
    padding: const EdgeInsets.symmetric(horizontal: 4),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
  ),
);
