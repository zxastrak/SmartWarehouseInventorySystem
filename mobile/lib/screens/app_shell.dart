import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';
import 'shift_hub_screen.dart';
import 'stock_screen.dart';
import 'scanner_screen.dart';
import 'profile_screen.dart';
import 'activity_screen.dart';

int _parseInt(dynamic val) {
  if (val == null) return 0;
  if (val is num) return val.toInt();
  return int.tryParse(val.toString()) ?? 0;
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  bool _isScrolled = false;
  int _lastPage = 0;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();

    // Reset status scroll ketika berpindah tab halaman
    if (_lastPage != s.page) {
      _lastPage = s.page;
      _isScrolled = false;
    }

    // Route selector untuk 5 tab utama operasional
    final body = switch (s.page) {
      0 => const ShiftHubScreen(),
      1 => const StockScreen(),
      2 => const ScannerScreen(),
      3 => const ActivityScreen(),
      4 => const ProfileScreen(),
      _ => const ShiftHubScreen(),
    };

    final activeBottomTab = (s.page >= 0 && s.page <= 4) ? s.page : 0;
    final topPadding = MediaQuery.paddingOf(context).top + 72;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: canvas,
        extendBody: true,
        body: Stack(
          alignment: Alignment.topCenter,
          children: [
            // 1. Konten Halaman Aktif yang mengisi layar penuh sehingga terlihat di belakang navbar
            Positioned.fill(
              child: NotificationListener<ScrollNotification>(
                onNotification: (scrollInfo) {
                  if (scrollInfo is ScrollUpdateNotification) {
                    final scrolled = scrollInfo.metrics.pixels > 10;
                    if (scrolled != _isScrolled) {
                      setState(() {
                        _isScrolled = scrolled;
                      });
                    }
                  }
                  return false;
                },
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: s.page == 0 || s.page == 1
                        ? body
                        : SingleChildScrollView(
                            padding: EdgeInsets.fromLTRB(16, topPadding, 16, 100),
                            child: body,
                          ),
                  ),
                ),
              ),
            ),

            // 2. Top Navbar Dinamis Mengambang (Floating) tepat di atas konten
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                top: true,
                bottom: false,
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
                      child: _TopNavbar(
                        isScrolled: _isScrolled,
                        unreadCount: s.unreadNotificationCount,
                        onNotificationTap: () => _showNotificationSheet(context, s),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),

        // 3. Floating Bottom Navigation Bar
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
                      // Navbar Putih Mengambang
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
                      // Bulatan Hijau Besar di Tengah (Scanner Cepat)
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

  // Bottom Sheet Notifikasi Tugas dari Manajer
  void _showNotificationSheet(BuildContext context, WarehouseState s) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.85,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle Bar
                    Container(
                      margin: const EdgeInsets.only(top: 12, bottom: 8),
                      width: 42,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xffcbd5e1),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),

                    // Header Sheet
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xfffef3c7),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.notifications_active_rounded,
                              color: Color(0xfff59e0b),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Notifikasi Tugas',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: brandInk,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Instruksi penugasan dari manajer gudang',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (s.unreadNotificationCount > 0)
                            TextButton(
                              onPressed: () {
                                s.markNotificationsRead();
                                setModalState(() {});
                              },
                              child: const Text(
                                'Tandai Dibaca',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: brand,
                                ),
                              ),
                            ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: muted, size: 22),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                    ),

                    const Divider(height: 1, thickness: 1, color: Color(0xfff1f5f9)),

                    // Daftar Tugas Notifikasi
                    Flexible(
                      child: s.notifications.isEmpty
                          ? Container(
                              padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
                              alignment: Alignment.center,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: const BoxDecoration(
                                      color: brandSoft,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.notifications_none_rounded,
                                      size: 40,
                                      color: brand,
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  const Text(
                                    'Belum Ada Notifikasi Tugas',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: brandInk,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  const Text(
                                    'Tugas yang ditugaskan oleh manajer gudang akan muncul di sini secara real-time.',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: muted,
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                              itemCount: s.notifications.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final n = s.notifications[index];
                                final id = _parseInt(n['id']);
                                final isUnread = !s.readNotificationIds.contains(id);
                                final status = (n['status'] ?? 'pending').toString().toLowerCase();
                                final isCompleted = status == 'completed';
                                final isInProgress = status == 'in_progress';
                                final sku = (n['sku'] ?? '').toString();
                                final location = (n['location_code'] ?? '').toString();
                                final priority = (n['priority'] ?? '').toString().toUpperCase();

                                final statusText = isCompleted
                                    ? 'Selesai'
                                    : isInProgress
                                        ? 'Sedang Dikerjakan'
                                        : 'Belum Dikerjakan';
                                final statusColor = isCompleted
                                    ? mintLogo
                                    : isInProgress
                                        ? brand
                                        : const Color(0xffd97706);

                                return Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isUnread ? const Color(0xfffde68a) : const Color(0xffe2e8f0),
                                      width: isUnread ? 1.5 : 1,
                                    ),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x06000000),
                                        blurRadius: 10,
                                        offset: Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Baris Status & Badge Tugas Anda
                                      Row(
                                        children: [
                                          Container(
                                            width: 7,
                                            height: 7,
                                            decoration: BoxDecoration(
                                              color: statusColor,
                                              shape: BoxShape.circle,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            'TUGAS ANDA • $statusText',
                                            style: TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                              letterSpacing: 0.2,
                                              color: statusColor,
                                            ),
                                          ),
                                          if (priority.isNotEmpty && priority != 'NORMAL') ...[
                                            const SizedBox(width: 8),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: priority == 'URGENT' || priority == 'HIGH'
                                                    ? const Color(0xfffee2e2)
                                                    : const Color(0xfffef3c7),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                priority,
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w800,
                                                  color: priority == 'URGENT' || priority == 'HIGH'
                                                      ? danger
                                                      : const Color(0xffd97706),
                                                ),
                                              ),
                                            ),
                                          ],
                                          const Spacer(),
                                          if (isUnread)
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xfff59e0b),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Text(
                                                'BARU',
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.w900,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),

                                      const SizedBox(height: 8),

                                      // Judul Tugas
                                      Text(
                                        (n['title'] ?? 'Tugas Gudang').toString(),
                                        style: const TextStyle(
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.w800,
                                          color: brandInk,
                                          height: 1.3,
                                        ),
                                      ),

                                      const SizedBox(height: 6),

                                      // Deskripsi Instruksi
                                      Text(
                                        (n['description'] ?? '').toString(),
                                        style: const TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w500,
                                          color: brandSlate,
                                          height: 1.4,
                                        ),
                                      ),

                                      const SizedBox(height: 10),

                                      // Informasi Item Terkait / Lokasi Rak
                                      Wrap(
                                        spacing: 12,
                                        runSpacing: 4,
                                        children: [
                                          if (sku.isNotEmpty)
                                            Text(
                                              'Item Terkait: $sku',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w700,
                                                color: brand,
                                              ),
                                            ),
                                          if (location.isNotEmpty)
                                            Text(
                                              'Lokasi: $location',
                                              style: const TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: brandSlate,
                                              ),
                                            ),
                                        ],
                                      ),

                                      const SizedBox(height: 14),

                                      // Tombol Aksi Mulai Kerjakan / Selesaikan
                                      if (!isCompleted)
                                        FilledButton.icon(
                                          style: FilledButton.styleFrom(
                                            backgroundColor: isInProgress ? const Color(0xff0f766e) : brand,
                                            foregroundColor: Colors.white,
                                            minimumSize: const Size.fromHeight(42),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(21),
                                            ),
                                            elevation: 0,
                                          ),
                                          icon: Icon(
                                            isInProgress
                                                ? Icons.check_circle_outline_rounded
                                                : Icons.play_arrow_rounded,
                                            size: 20,
                                          ),
                                          label: Text(
                                            isInProgress ? 'Selesaikan Tugas' : 'Mulai Kerjakan',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                          onPressed: () async {
                                            s.markNotificationRead(id);
                                            Navigator.pop(ctx);

                                            if (!isInProgress) {
                                              await s.updateTaskStatus(id, 'in_progress');
                                            } else {
                                              await s.updateTaskStatus(id, 'completed');
                                            }

                                            if (sku.isNotEmpty) {
                                              s.openScanner(sku, mode: ScanMode.single);
                                            }

                                            if (context.mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(
                                                  content: Text(
                                                    isInProgress
                                                        ? 'Tugas #${n['id']} telah diselesaikan!'
                                                        : 'Mulai mengerjakan tugas #${n['id']} ($sku)',
                                                  ),
                                                  backgroundColor: brand,
                                                  behavior: SnackBarBehavior.floating,
                                                  shape: RoundedRectangleBorder(
                                                    borderRadius: BorderRadius.circular(12),
                                                  ),
                                                ),
                                              );
                                            }
                                          },
                                        ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// -----------------------------------------------------------------------------
// Top Navbar: Branding SUSUNO di kiri + Bell Kuning di kanan
// Tampilan dinamis: seamless/flat saat posisi atas (offset 0),
// berubah menjadi floating rounded card dengan shadow saat scroll bergerak.
// -----------------------------------------------------------------------------

class _TopNavbar extends StatelessWidget {
  final bool isScrolled;
  final int unreadCount;
  final VoidCallback onNotificationTap;

  const _TopNavbar({
    required this.isScrolled,
    required this.unreadCount,
    required this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: isScrolled ? Colors.white : Colors.transparent,
        borderRadius: BorderRadius.circular(32),
        boxShadow: isScrolled
            ? const [
                BoxShadow(
                  color: Color(0x1a000000),
                  blurRadius: 18,
                  offset: Offset(0, 4),
                ),
                BoxShadow(
                  color: Color(0x08000000),
                  blurRadius: 6,
                  offset: Offset(0, 1),
                ),
              ]
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // 1. Logo SUSUNO
          Image.asset(
            'assets/images/susuno_logo.png',
            width: 36,
            height: 36,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 10),

          // 2. Teks Branding SUSUNO
          const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SUSUNO',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                  color: brandInk,
                ),
              ),
              SizedBox(height: 1),
              Text(
                'Warehouse & Inventory System',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ],
          ),

          const Spacer(),

          // 3. Ikon Lonceng / Bell Warna Kuning
          _NotificationBellButton(
            unreadCount: unreadCount,
            onTap: onNotificationTap,
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Tombol Lonceng / Bell Warna Kuning dengan Indikator Notifikasi
// -----------------------------------------------------------------------------

class _NotificationBellButton extends StatelessWidget {
  final int unreadCount;
  final VoidCallback onTap;

  const _NotificationBellButton({
    required this.unreadCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xfffef3c7).withValues(alpha: 0.85),
            shape: BoxShape.circle,
            border: Border.all(
              color: const Color(0xfffde68a),
              width: 1,
            ),
          ),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Ikon Lonceng Kuning
              const Icon(
                Icons.notifications_rounded,
                color: Color(0xfff59e0b),
                size: 24,
              ),

              // Badge Indikator Belum Dibaca
              if (unreadCount > 0)
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: danger,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      unreadCount > 99 ? '99+' : '$unreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
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
