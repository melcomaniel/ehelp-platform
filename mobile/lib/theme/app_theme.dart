import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tokens mirrored from the web design system (web/client globals.css).
class AppColors {
  static const primary = Color(0xFF0040E7);
  static const primaryDark = Color(0xFF0035C2);
  static const accent = Color(0xFFFCD116);
  static const danger = Color(0xFFCE1126);
  static const ink = Color(0xFF1A1A2E);
  static const muted = Color(0xFF64748B);
  static const surface = Color(0xFFFFFFFF);
  static const card = Color(0xFFFFFFFF);
  static const secondary = Color(0xFFF0F4FF);
  static const mutedBg = Color(0xFFF5F7FA);
  static const line = Color(0x1A0040E7);

  // Status palette for badges (not part of the web token set).
  static const forest = Color(0xFF0F6E56);
  static const forestDark = Color(0xFF04342C);
  static const clay = Color(0xFF993C1D);
  static const clayDark = Color(0xFF4A1B0C);
  static const ocean = Color(0xFF185FA5);
  static const oceanDark = Color(0xFF042C53);
  static const rose = Color(0xFF993556);
}

class AppTheme {
  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.surface,
        error: AppColors.danger,
      ),
      scaffoldBackgroundColor: AppColors.surface,
    );

    final lexend = GoogleFonts.lexendTextTheme(base.textTheme);

    return base.copyWith(
      textTheme: lexend.copyWith(
        displaySmall: GoogleFonts.lexend(
          fontWeight: FontWeight.w600,
          color: AppColors.ink,
          letterSpacing: -0.5,
        ),
        headlineMedium: GoogleFonts.lexend(
          fontWeight: FontWeight.w500,
          color: AppColors.ink,
        ),
        headlineSmall: GoogleFonts.lexend(
          fontWeight: FontWeight.w500,
          color: AppColors.ink,
        ),
        titleLarge: GoogleFonts.lexend(
          fontWeight: FontWeight.w600,
          color: AppColors.ink,
        ),
        bodyMedium: GoogleFonts.lexend(color: AppColors.ink),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.lexend(
          fontSize: 20,
          fontWeight: FontWeight.w500,
          color: AppColors.ink,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.secondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.lexend(
            fontWeight: FontWeight.w500,
            fontSize: 16,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: GoogleFonts.lexend(fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.lexend(fontWeight: FontWeight.w500),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.secondary,
        labelStyle: GoogleFonts.lexend(
          color: AppColors.primary,
          fontWeight: FontWeight.w500,
        ),
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
