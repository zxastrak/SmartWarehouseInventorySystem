import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../core/app_theme.dart';
import 'shift_hub_screen.dart';
import 'stock_screen.dart';
import 'scanner_screen.dart';
import 'profile_screen.dart';
import 'activity_screen.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();

    // Route selector for pages (5 core operational tabs)
    final body = switch (s.page) {
      0 => const ShiftHubScreen(),
      1 => const StockScreen(),
      2 => const ScannerScreen(),
      3 => const ActivityScreen(),
      4 => const ProfileScreen(),
      _ => const ShiftHubScreen(),
    };

    // Calculate active bottom bar tab:
    // 0: Tugas, 1: Stok & Rak, 2: Scan Cepat, 3: Aktivitas, 4: Profil
    final activeBottomTab = (s.page >= 0 && s.page <= 4) ? s.page : 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: canvas,
        extendBody: true,
        body: SafeArea(
          top: true,
          bottom: false,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: s.page == 0 || s.page == 1
                  ? body
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                      child: body,
                    ),
            ),
          ),
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: Align(
            alignment: Alignment.bottomCenter,
            heightFactor: 1.0,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: SizedBox(
                  height: 68,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.bottomCenter,
                    children: [
                      // 1. Navbar Putih Mengambang
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 56,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(32),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x1f000000),
                                blurRadius: 20,
                                offset: Offset(0, 4),
                              ),
                              BoxShadow(
                                color: Color(0x0a000000),
                                blurRadius: 6,
                                offset: Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              _InteractiveNavTabItem(
                                label: 'Tugas',
                                icon: Icons.assignment_outlined,
                                activeIcon: Icons.assignment,
                                isSelected: activeBottomTab == 0,
                                badgeCount: s.pendingCount,
                                onTap: () => s.navigate(0),
                              ),
                              _InteractiveNavTabItem(
                                label: 'Stok & Rak',
                                icon: Icons.inventory_2_outlined,
                                activeIcon: Icons.inventory_2,
                                isSelected: activeBottomTab == 1,
                                onTap: () => s.navigate(1),
                              ),
                              // Spacer untuk bulatan scan di tengah
                              const Expanded(child: SizedBox()),
                              _InteractiveNavTabItem(
                                label: 'Aktivitas',
                                icon: Icons.history,
                                activeIcon: Icons.history_toggle_off,
                                isSelected: activeBottomTab == 3,
                                onTap: () => s.navigate(3),
                              ),
                              _InteractiveNavTabItem(
                                label: 'Profil',
                                icon: Icons.person_outline,
                                activeIcon: Icons.person,
                                isSelected: activeBottomTab == 4,
                                onTap: () => s.navigate(4),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // 2. Bulatan Hijau Besar di Tengah (Memotong Navbar)
                      Positioned(
                        top: 0,
                        child: GestureDetector(
                          onTap: () => s.navigate(2),
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            width: 56,
                            height: 56,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: brand,
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.qr_code_scanner_rounded,
                                size: 28,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
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
}

// -----------------------------------------------------------------------------
// Interactive Model A (Lift-Up) Nav Tab Item
// -----------------------------------------------------------------------------

class _InteractiveNavTabItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool isSelected;
  final int badgeCount;
  final VoidCallback onTap;

  const _InteractiveNavTabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.isSelected,
    this.badgeCount = 0,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOutCubic,
          transform: Matrix4.translationValues(0, isSelected ? -5 : 0, 0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 240),
                width: 44,
                height: 28,
                alignment: Alignment.center,
                decoration: null,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(
                      isSelected ? activeIcon : icon,
                      size: 22,
                      color: isSelected ? brand : muted,
                    ),
                    if (badgeCount > 0)
                      Positioned(
                        right: -5,
                        top: -3,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: danger,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(
                            minWidth: 14,
                            minHeight: 14,
                          ),
                          child: Text(
                            '$badgeCount',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 3),
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 200),
                crossFadeState: isSelected
                    ? CrossFadeState.showFirst
                    : CrossFadeState.showSecond,
                firstChild: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.2,
                    color: brand,
                  ),
                ),
                secondChild: const SizedBox(height: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}