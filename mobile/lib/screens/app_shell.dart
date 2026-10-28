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
import 'insight_screen.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();

    // Route selector for pages
    final body = switch (s.page) {
      0 => const ShiftHubScreen(),
      1 => const StockScreen(),
      2 => const ScannerScreen(),
      3 => const ActivityScreen(audit: true),
      4 => const ActivityScreen(audit: true),
      5 => const ActivityScreen(),
      6 => const InsightScreen(),
      8 => const ProfileScreen(),
      _ => const ShiftHubScreen(),
    };

    // Calculate active bottom bar tab
    final activeBottomTab = switch (s.page) {
      0 => 0,
      1 => 1,
      2 => 2,
      3 || 4 || 5 => 3,
      _ => -1, // Sub-pages like Profile (8) do not highlight bottom tabs
    };

    final title = switch (s.page) {
      0 => 'SUSUNO',
      1 => 'Stok & Rak Gudang',
      2 => 'Quick Scanner Vision',
      3 || 4 || 5 => 'Aktivitas Shift',
      6 => 'AI Telemetry Insight',
      8 => 'Profil & Pengaturan',
      _ => 'SUSUNO',
    };

    final isHome = s.page == 0;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        toolbarHeight: 68,
        titleSpacing: 16,
        title: Row(
          children: [
            // Tombol back hanya di sub-halaman. Di Home tidak ada ikon di kiri.
            if (!isHome) ...[
              _RoundIconButton(
                icon: Icons.arrow_back,
                tooltip: 'Kembali ke Home',
                onTap: () => s.navigate(0),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      letterSpacing: isHome ? 0.6 : -0.3,
                      color: isHome ? brandHeroInk : brandInk,
                    ),
                  ),
                  if (isHome)
                    const Text(
                      'Warehouse & Inventory System',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: brandHeroSub,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          _ProfileButton(
            selected: s.page == 8,
            onTap: () => s.navigate(8),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 500),
            // Screens 0 and 1 manage their own scroll views (ListView / CustomScrollView with lazy loading)
            child: s.page == 0 || s.page == 1
                ? body
                : SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    child: body,
                  ),
          ),
        ),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Color(0x1a000000),
              blurRadius: 20,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 72,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                children: [
                  _NavTabItem(
                    label: 'Tugas',
                    icon: Icons.assignment_outlined,
                    activeIcon: Icons.assignment,
                    isSelected: activeBottomTab == 0,
                    badgeCount: s.pendingCount,
                    onTap: () => s.navigate(0),
                  ),
                  _NavTabItem(
                    label: 'Stok & Rak',
                    icon: Icons.inventory_2_outlined,
                    activeIcon: Icons.inventory_2,
                    isSelected: activeBottomTab == 1,
                    onTap: () => s.navigate(1),
                  ),
                  _ScanTabItem(
                    isSelected: activeBottomTab == 2,
                    onTap: () => s.navigate(2),
                  ),
                  _NavTabItem(
                    label: 'Aktivitas',
                    icon: Icons.history,
                    activeIcon: Icons.history_toggle_off,
                    isSelected: activeBottomTab == 3,
                    onTap: () => s.navigate(3),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Top bar
// -----------------------------------------------------------------------------

class _RoundIconButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white,
        elevation: 2,
        shadowColor: const Color(0x26000000),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 22, color: brandInk),
          ),
        ),
      ),
    );
  }
}

class _ProfileButton extends StatelessWidget {
  final bool selected;
  final VoidCallback onTap;

  const _ProfileButton({required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Profil Staf',
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: selected ? brand : brandSoft,
            border: Border.all(
              color: selected ? brand : brandSoftBorder,
              width: 1.5,
            ),
          ),
          child: Icon(
            Icons.person,
            size: 22,
            color: selected ? Colors.white : brand,
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Bottom nav
// -----------------------------------------------------------------------------

class _NavTabItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool isSelected;
  final int badgeCount;
  final VoidCallback onTap;

  const _NavTabItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.isSelected,
    this.badgeCount = 0,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = isSelected ? brand : muted;

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Pill latar untuk tab terpilih
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 56,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected ? brandSoft : Colors.transparent,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    isSelected ? activeIcon : icon,
                    size: 24,
                    color: color,
                  ),
                  if (badgeCount > 0)
                    Positioned(
                      right: -6,
                      top: -4,
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
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: color,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

/// Tombol Scan di tengah: lingkaran oranye, diberi cincin saat aktif.
class _ScanTabItem extends StatelessWidget {
  final bool isSelected;
  final VoidCallback onTap;

  const _ScanTabItem({required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: brand,
                border: Border.all(
                  color: isSelected ? brandSoftBorder : Colors.transparent,
                  width: 4,
                ),
                boxShadow: [
                  BoxShadow(
                    color: brand.withAlpha(isSelected ? 110 : 70),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.qr_code_scanner,
                size: 24,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              'Scan Cepat',
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                color: brand,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}