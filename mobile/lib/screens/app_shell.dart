import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';
import '../core/api_config.dart';
import 'shift_hub_screen.dart';
import 'stock_screen.dart';
import 'scanner_screen.dart';
import 'profile_screen.dart';
import 'activity_screen.dart';
import 'warehouse_map_screen.dart';

int _parseInt(dynamic val) {
  if (val == null) return 0;
  if (val is num) return val.toInt();
  return int.tryParse(val.toString()) ?? 0;
}

enum _Page2Mode {
  map('Peta'),
  singleScan('Single Scan'),
  dispatch('Dispatching'),
  putaway('Putaway');

  final String label;
  const _Page2Mode(this.label);
}

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  bool _isScrolled = false;
  int _lastPage = 0;
  int _lastRenderedPage = -1;
  bool _isStalledOffline = false;
  _Page2Mode _page2Mode = _Page2Mode.singleScan;

  void _onPage2ModeChanged(_Page2Mode newMode, WarehouseState s) {
    HapticFeedback.selectionClick().ignore();
    setState(() {
      _page2Mode = newMode;
      switch (newMode) {
        case _Page2Mode.map:
          break;
        case _Page2Mode.singleScan:
          s.setScanMode(ScanMode.single);
          break;
        case _Page2Mode.dispatch:
          s.setScanMode(ScanMode.dispatch);
          break;
        case _Page2Mode.putaway:
          s.setScanMode(ScanMode.putaway);
          break;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();

    // Sinkronisasi mode scanner aktif jika berubah dari dalam form scanner
    if (s.page == 2 && _page2Mode != _Page2Mode.map) {
      final expectedMode = switch (s.scanMode) {
        ScanMode.single => _Page2Mode.singleScan,
        ScanMode.dispatch => _Page2Mode.dispatch,
        ScanMode.putaway => _Page2Mode.putaway,
      };
      if (_page2Mode != expectedMode) {
        _page2Mode = expectedMode;
      }
    }

    // Reset status scroll ketika berpindah tab halaman
    if (_lastPage != s.page) {
      _lastPage = s.page;
      _isScrolled = false;
    }

    final isOnline = s.connectionStatus == ConnectionStatus.online ||
        s.connectionStatus == ConnectionStatus.localOnly;
    if (isOnline) {
      _isStalledOffline = false;
      _lastRenderedPage = s.page;
    } else if (s.page != _lastRenderedPage) {
      // Staf mencoba navigasi ke halaman/navbar lain saat koneksi bermasalah (kuning, biru, merah)
      _isStalledOffline = true;
      _lastRenderedPage = -1;
    }

    final activeBottomTab = (s.page >= 0 && s.page <= 4) ? s.page : 0;
    final topPadding = MediaQuery.paddingOf(context).top + 72;

    final Widget tabBody = IndexedStack(
      index: (s.page >= 0 && s.page <= 4) ? s.page : 0,
      children: [
        const ShiftHubScreen(),
        const StockScreen(),
        s.page != 2
            ? const SizedBox.shrink()
            : (_page2Mode == _Page2Mode.map
                ? SizedBox.expand(
                    child: WarehouseMapScreen(
                      isEmbeddedInShell: true,
                      onSwitchToScanner: () {
                        setState(() {
                          _page2Mode = _Page2Mode.singleScan;
                        });
                      },
                    ),
                  )
                : SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(16, topPadding, 16, 140),
                    child: const ScannerScreen(),
                  )),
        SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(16, topPadding, 16, 140),
          child: const ActivityScreen(),
        ),
        SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(16, topPadding, 16, 140),
          child: const ProfileScreen(),
        ),
      ],
    );

    final Widget activeContent =
        _isStalledOffline
            ? Padding(
                padding: EdgeInsets.only(top: topPadding, bottom: 100),
                child: const _ConnectionLoadingView(),
              )
            : tabBody;

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
                    child: activeContent,
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
                      padding: const EdgeInsets.fromLTRB(14, 8, 14, 6),
                      child: _TopNavbar(
                        isScrolled: _isScrolled,
                        unreadCount: s.unreadNotificationCount,
                        connectionStatus: s.connectionStatus,
                        onConnectionTap:
                            () => _showConnectionDetailSheet(context, s),
                        onNotificationTap: () {
                          if (s.unreadNotificationCount > 0) {
                            s.markNotificationsRead();
                          }
                          _showNotificationSheet(context, s);
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // 3. Floating Bottom Mode Slider Bar (4 Mode: Peta, Single Scan, Dispatching, Putaway)
            if (s.page == 2)
              Positioned(
                left: 14,
                right: 14,
                bottom: 84,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: _BottomModeSliderBar(
                      currentMode: _page2Mode,
                      onModeChanged: (mode) => _onPage2ModeChanged(mode, s),
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
                                color: Color(0x12000000),
                                blurRadius: 6,
                                offset: Offset(0, 2),
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
                      // Bulatan Hijau Besar di Tengah (Scanner Cepat Otomatis Alur Tugas)
                      Positioned(
                        top: 0,
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _page2Mode = _Page2Mode.singleScan;
                            });
                            s.launchActiveTaskScanner();
                          },
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

  // Modal Detail Status Koneksi Server (Smart Hybrid 4-State) - Responsif & Anti-Overflow
  void _showConnectionDetailSheet(BuildContext context, WarehouseState s) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final st = s.connectionStatus;
            final isOnline = st == ConnectionStatus.online;
            final isServerOffline = st == ConnectionStatus.serverOffline;
            final isLocalOnly = st == ConnectionStatus.localOnly;

            // Warna & Aset Icon Semantik 4-State
            final Color iconColor =
                isOnline
                    ? const Color(0xff16a34a)
                    : (isServerOffline
                        ? const Color(0xffd97706)
                        : (isLocalOnly
                            ? const Color(0xff0284c7)
                            : const Color(0xffdc2626)));

            final IconData statusIcon =
                isOnline
                    ? Icons.cloud_done_rounded
                    : (isServerOffline
                        ? Icons.cloud_queue_rounded
                        : (isLocalOnly
                            ? Icons.lan_rounded
                            : Icons.wifi_off_rounded));

            final String title =
                isOnline
                    ? 'Terhubung Dalam Jaringan'
                    : (isServerOffline
                        ? 'Server SUSUNO Down / Off Sementara'
                        : (isLocalOnly
                            ? 'Menunggu Jaringan...'
                            : 'Terputus Dalam Jaringan'));

            final String description =
                isOnline
                    ? 'Aplikasi terhubung lancar ke internet dan server SUSUNO. Seluruh transaksi pemindaian, absensi, dan sinkronisasi berjalan normal.'
                    : (isServerOffline
                        ? 'Perangkat Anda terhubung ke internet, namun server SUSUNO (${ApiConfig.baseUrl}) sedang down atau tidak aktif sementara. Hubungi tim IT.'
                        : (isLocalOnly
                            ? 'Perangkat terhubung ke server lokal (${ApiConfig.baseUrl}), namun sedang menunggu koneksi internet luar stabil.'
                            : 'Perangkat tidak mendeteksi koneksi jaringan internet maupun server. Seluruh transaksi inventaris dikunci sementara.'));

            return ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.88,
              ),
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                child: SafeArea(
                  top: false,
                  child: SingleChildScrollView(
                    physics: const ClampingScrollPhysics(),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Handle Bar
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xffcbd5e1),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),

                        // Status Icon (Hanya ikon tanpa lingkaran latar belakang)
                        Padding(
                          padding: const EdgeInsets.only(top: 2, bottom: 6),
                          child: Icon(statusIcon, color: iconColor, size: 40),
                        ),
                        const SizedBox(height: 6),

                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: brandInk,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 5),

                        Text(
                          description,
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: brandSlate,
                            height: 1.35,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 14),

                        // Kotak Status Rinci: Jaringan Internet
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xfff8fafc),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xffe2e8f0)),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                s.hasInternetConnection
                                    ? Icons.wifi_rounded
                                    : Icons.wifi_off_rounded,
                                size: 16,
                                color:
                                    s.hasInternetConnection
                                        ? const Color(0xff16a34a)
                                        : const Color(0xffdc2626),
                              ),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  'Jaringan Internet',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: brandInk,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color:
                                      s.hasInternetConnection
                                          ? const Color(0xff16a34a)
                                          : const Color(0xffdc2626),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  s.hasInternetConnection
                                      ? Icons.check_rounded
                                      : Icons.close_rounded,
                                  size: 15,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Kotak Status Rinci: Server SUSUNO
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xfff8fafc),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xffe2e8f0)),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.dns_rounded,
                                size: 16,
                                color: brandSlate,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Server: ${ApiConfig.baseUrl}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    color: brandInk,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  color:
                                      s.isBackendConnected
                                          ? const Color(0xff16a34a)
                                          : (s.hasInternetConnection
                                              ? const Color(0xffeab308)
                                              : const Color(0xffdc2626)),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  s.isBackendConnected
                                      ? Icons.check_rounded
                                      : (s.hasInternetConnection
                                          ? Icons.build_rounded
                                          : Icons.close_rounded),
                                  size: 13,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
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
            final activeNotifications =
                s.notifications.where((n) {
                  final st =
                      (n['status'] ?? 'pending').toString().toLowerCase();
                  return st != 'done' && st != 'completed' && st != 'cancelled';
                }).toList();

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
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 10,
                      ),
                      child: Row(
                        children: [
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
                            icon: const Icon(
                              Icons.close_rounded,
                              color: muted,
                              size: 22,
                            ),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                    ),

                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: Color(0xfff1f5f9),
                    ),

                    // Daftar Tugas Notifikasi (hanya tugas aktif yang belum selesai)
                    Flexible(
                      child:
                          activeNotifications.isEmpty
                              ? Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 48,
                                  horizontal: 24,
                                ),
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
                                        Icons.check_circle_outline_rounded,
                                        size: 40,
                                        color: brand,
                                      ),
                                    ),
                                    const SizedBox(height: 14),
                                    const Text(
                                      'Semua Tugas Selesai',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        color: brandInk,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    const Text(
                                      'Tidak ada tugas operasional yang menunggu dikerjakan saat ini.',
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
                                padding: const EdgeInsets.fromLTRB(
                                  16,
                                  14,
                                  16,
                                  24,
                                ),
                                itemCount: activeNotifications.length,
                                separatorBuilder:
                                    (_, __) => const SizedBox(height: 12),
                                itemBuilder: (context, index) {
                                  final n = activeNotifications[index];
                                  final id = _parseInt(n['id']);
                                  final isUnread =
                                      !s.readNotificationIds.contains(id);
                                  final status =
                                      (n['status'] ?? 'pending')
                                          .toString()
                                          .toLowerCase();
                                  final isCompleted =
                                      status == 'done' || status == 'completed';
                                  final isInProgress = status == 'in_progress';
                                  final sku = (n['sku'] ?? '').toString();
                                  final location =
                                      (n['location_code'] ?? '').toString();
                                  final priority =
                                      (n['priority'] ?? '')
                                          .toString()
                                          .toUpperCase();

                                  final statusText =
                                      isCompleted
                                          ? 'Selesai'
                                          : isInProgress
                                          ? 'Sedang Dikerjakan'
                                          : 'Belum Dikerjakan';
                                  final statusColor =
                                      isCompleted
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
                                        color:
                                            isUnread
                                                ? const Color(0xfffde68a)
                                                : const Color(0xffe2e8f0),
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
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
                                            if (priority.isNotEmpty &&
                                                priority != 'NORMAL') ...[
                                              const SizedBox(width: 8),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 6,
                                                      vertical: 2,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color:
                                                      priority == 'URGENT' ||
                                                              priority == 'HIGH'
                                                          ? const Color(
                                                            0xfffee2e2,
                                                          )
                                                          : const Color(
                                                            0xfffef3c7,
                                                          ),
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  priority,
                                                  style: TextStyle(
                                                    fontSize: 9,
                                                    fontWeight: FontWeight.w800,
                                                    color:
                                                        priority == 'URGENT' ||
                                                                priority ==
                                                                    'HIGH'
                                                            ? danger
                                                            : const Color(
                                                              0xffd97706,
                                                            ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                            const Spacer(),
                                            if (isUnread)
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 6,
                                                      vertical: 2,
                                                    ),
                                                decoration: BoxDecoration(
                                                  color: const Color(
                                                    0xfff59e0b,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(8),
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
                                          (n['title'] ?? 'Tugas Gudang')
                                              .toString(),
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
                                              backgroundColor:
                                                  isInProgress
                                                      ? const Color(0xff0f766e)
                                                      : brand,
                                              foregroundColor: Colors.white,
                                              minimumSize:
                                                  const Size.fromHeight(42),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(21),
                                              ),
                                              elevation: 0,
                                            ),
                                            icon: Icon(
                                              isInProgress
                                                  ? Icons
                                                      .check_circle_outline_rounded
                                                  : Icons.play_arrow_rounded,
                                              size: 20,
                                            ),
                                            label: Text(
                                              isInProgress
                                                  ? 'Selesaikan Tugas'
                                                  : 'Kerjakan',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            onPressed: () async {
                                              s.markNotificationRead(id);
                                              Navigator.pop(ctx);

                                              if (!isInProgress) {
                                                await s.updateTaskStatus(
                                                  id,
                                                  'in_progress',
                                                );
                                                final taskTitle =
                                                    (n['title'] ??
                                                            'Tugas Lapangan')
                                                        .toString();
                                                s.openScanner(
                                                  sku,
                                                  mode: ScanMode.single,
                                                  taskTitle: taskTitle,
                                                  taskId: id,
                                                  rack:
                                                      location.isNotEmpty
                                                          ? location
                                                          : null,
                                                );
                                              } else {
                                                await s.updateTaskStatus(
                                                  id,
                                                  'done',
                                                );
                                              }

                                              if (context.mounted) {
                                                ScaffoldMessenger.of(
                                                  context,
                                                ).showSnackBar(
                                                  SnackBar(
                                                    content: Text(
                                                      isInProgress
                                                          ? 'Tugas #${n['id']} telah diselesaikan!'
                                                          : 'Mulai mengerjakan tugas #${n['id']}${sku.isNotEmpty ? ' ($sku)' : ''}',
                                                    ),
                                                    backgroundColor: brand,
                                                    behavior:
                                                        SnackBarBehavior
                                                            .floating,
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            12,
                                                          ),
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
  final ConnectionStatus connectionStatus;
  final VoidCallback onConnectionTap;
  final VoidCallback onNotificationTap;

  const _TopNavbar({
    required this.isScrolled,
    required this.unreadCount,
    required this.connectionStatus,
    required this.onConnectionTap,
    required this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: isScrolled ? Colors.white : Colors.transparent,
        borderRadius: BorderRadius.circular(32),
        boxShadow:
            isScrolled
                ? const [
                  BoxShadow(
                    color: Color(0x0f000000),
                    blurRadius: 6,
                    offset: Offset(0, 2),
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
            width: 34,
            height: 34,
            cacheWidth: 102,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 9),

          // 2. Teks Branding SUSUNO (Fleksibel & Anti-Overflow)
          const Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SUSUNO',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                    color: brandInk,
                  ),
                ),
                SizedBox(height: 1),
                Text(
                  'Warehouse & Inventory System',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // 3. Kotak Status Koneksi Menyala (3-State Hybrid)
          _ConnectionStatusBadge(
            connectionStatus: connectionStatus,
            onTap: onConnectionTap,
          ),
          const SizedBox(width: 8),

          // 4. Ikon Lonceng / Bell Warna Kuning
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
// Kotak Indikator Koneksi 4-State Smart Hybrid:
// 🟢 Hijau = Online Penuh (Internet & Server Backend Terhubung)
// 🟡 Kuning = Server Standby (Internet Ada, Server Backend SUSUNO Offline)
// 🔵 Biru = Mode Intranet (Server SUSUNO Lokal Terhubung, Internet Luar Terputus)
// 🔴 Merah = Offline (Tidak Ada Internet maupun Server)
// -----------------------------------------------------------------------------

class _ConnectionStatusBadge extends StatelessWidget {
  final ConnectionStatus connectionStatus;
  final VoidCallback onTap;

  const _ConnectionStatusBadge({
    required this.connectionStatus,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isOnline = connectionStatus == ConnectionStatus.online;
    final bool isServerOffline =
        connectionStatus == ConnectionStatus.serverOffline;
    final bool isLocalOnly = connectionStatus == ConnectionStatus.localOnly;

    final Color badgeColor =
        isOnline
            ? const Color(0xff16a34a)
            : (isServerOffline
                ? const Color(0xffd97706)
                : (isLocalOnly
                    ? const Color(0xff0284c7)
                    : const Color(0xffdc2626)));

    final Color glowColor =
        isOnline
            ? const Color(0xff22c55e)
            : (isServerOffline
                ? const Color(0xfff59e0b)
                : (isLocalOnly
                    ? const Color(0xff38bdf8)
                    : const Color(0xffef4444)));

    final bool isOffline = connectionStatus == ConnectionStatus.offline;
    final IconData badgeIcon =
        isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded;

    final String tooltipMessage =
        isOnline
            ? 'Semua Aman (Terhubung Penuh)'
            : (isServerOffline
                ? 'Server SUSUNO Down / Off Sementara'
                : (isLocalOnly
                    ? 'Menunggu Jaringan...'
                    : 'Tidak Ada Jaringan'));

    return Material(
      color: Colors.transparent,
      child: Tooltip(
        message: tooltipMessage,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: badgeColor,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: glowColor.withValues(alpha: 0.55),
                  blurRadius: 8,
                  spreadRadius: 1,
                ),
              ],
            ),
            child: Center(
              child: Icon(badgeIcon, color: Colors.white, size: 17),
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Tombol Lonceng / Bell Kotak Kuning Menyala dengan Indikator Notifikasi
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
      child: Tooltip(
        message:
            unreadCount > 0 ? '$unreadCount notifikasi baru' : 'Notifikasi',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xffeab308),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                // Ikon Lonceng Putih (Flat tanpa shadow)
                const Icon(
                  Icons.notifications_rounded,
                  color: Colors.white,
                  size: 17,
                ),

                // Badge Indikator Belum Dibaca (Titik / Angka Merah)
                if (unreadCount > 0)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: danger,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 15,
                        minHeight: 15,
                      ),
                      child: Text(
                        unreadCount > 99 ? '99+' : '$unreadCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8.5,
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
          duration: const Duration(milliseconds: 280),
          curve: Curves.fastOutSlowIn,
          transform: Matrix4.translationValues(0, isSelected ? -2 : 0, 0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 44,
                height: 28,
                child: Stack(
                  alignment: Alignment.center,
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
                duration: const Duration(milliseconds: 240),
                firstCurve: Curves.easeOut,
                secondCurve: Curves.easeIn,
                sizeCurve: Curves.fastOutSlowIn,
                crossFadeState:
                    isSelected
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

/// Tampilan loading bersih bertema SUSUNO saat staf berpindah halaman/tab
/// ketika status koneksi sedang offline, menunggu jaringan, atau server down.
class _ConnectionLoadingView extends StatelessWidget {
  const _ConnectionLoadingView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: const [
          SizedBox(
            width: 36,
            height: 36,
            child: CircularProgressIndicator(
              strokeWidth: 3.2,
              valueColor: AlwaysStoppedAnimation<Color>(brand),
            ),
          ),
          SizedBox(height: 16),
          Text(
            'Memuat data...',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: muted,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Slider Bar Navigasi 4 Mode di Atas Bottom Bar:
/// 1. Peta (Google Maps Spasial)
/// 2. Single Scan (Audit/Cek Barcode SKU)
/// 3. Dispatching (Pengeluaran Barang)
/// 4. Putaway (Penyimpanan Barang Masuk)
class _BottomModeSliderBar extends StatefulWidget {
  final _Page2Mode currentMode;
  final ValueChanged<_Page2Mode> onModeChanged;

  const _BottomModeSliderBar({
    required this.currentMode,
    required this.onModeChanged,
  });

  @override
  State<_BottomModeSliderBar> createState() => _BottomModeSliderBarState();
}

class _BottomModeSliderBarState extends State<_BottomModeSliderBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _curveAnimation;
  int _prevIndex = 0;
  int _targetIndex = 0;
  double _dragAccumulator = 0;

  @override
  void initState() {
    super.initState();
    _targetIndex = _Page2Mode.values.indexOf(widget.currentMode);
    _prevIndex = _targetIndex;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _curveAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.fastOutSlowIn,
    );
    _animController.value = 1.0;
  }

  @override
  void didUpdateWidget(covariant _BottomModeSliderBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final newIndex = _Page2Mode.values.indexOf(widget.currentMode);
    if (newIndex != _targetIndex) {
      setState(() {
        _prevIndex = _targetIndex;
        _targetIndex = newIndex;
        _animController.forward(from: 0.0);
      });
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _selectMode(int index) {
    if (index < 0 || index >= _Page2Mode.values.length) return;
    if (index == _targetIndex) return;
    HapticFeedback.selectionClick().ignore();
    setState(() {
      _prevIndex = _targetIndex;
      _targetIndex = index;
      _animController.forward(from: 0.0);
    });
    widget.onModeChanged(_Page2Mode.values[index]);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xffe2e8f0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1e000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragStart: (_) {
          _dragAccumulator = 0;
        },
        onHorizontalDragUpdate: (details) {
          _dragAccumulator += details.delta.dx;
        },
        onHorizontalDragEnd: (details) {
          final velocity = details.primaryVelocity ?? 0;
          if (velocity < -80 || _dragAccumulator < -36) {
            // Drag ke kiri -> maju ke mode berikutnya
            if (_targetIndex < _Page2Mode.values.length - 1) {
              _selectMode(_targetIndex + 1);
            }
          } else if (velocity > 80 || _dragAccumulator > 36) {
            // Drag ke kanan -> mundur ke mode sebelumnya
            if (_targetIndex > 0) {
              _selectMode(_targetIndex - 1);
            }
          }
          _dragAccumulator = 0;
        },
        child: Stack(
          children: [
            // Animated sliding thumb hijau independen dengan kurva pegas super halus
            AnimatedBuilder(
              animation: _curveAnimation,
              builder: (context, _) {
                final t = _curveAnimation.value;
                final currentPos = _prevIndex + (_targetIndex - _prevIndex) * t;
                // Alignment X: -1.0 s/d +1.0
                final alignX = -1.0 + (currentPos * (2.0 / 3.0));

                // Dynamic subtle stretch effect saat bergerak
                final stretchDelta = (_targetIndex - _prevIndex).abs();
                final stretch =
                    stretchDelta > 0
                        ? 1.0 +
                            (0.10 *
                                (1.0 - (2 * (t - 0.5)).abs().clamp(0.0, 1.0)))
                        : 1.0;

                return Align(
                  alignment: Alignment(alignX.clamp(-1.0, 1.0), 0),
                  child: FractionallySizedBox(
                    widthFactor: (0.25 * stretch).clamp(0.25, 0.30),
                    heightFactor: 1.0,
                    child: Container(
                      decoration: BoxDecoration(
                        color: brand,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x32000000),
                            blurRadius: 6,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),

            // 4 Segmen Tombol Murni Teks (Tanpa Logo)
            Row(
              children:
                  _Page2Mode.values.map((mode) {
                    final index = _Page2Mode.values.indexOf(mode);
                    final isSelected = mode == widget.currentMode;
                    return Expanded(
                      child: InkWell(
                        onTap: () => _selectMode(index),
                        borderRadius: BorderRadius.circular(20),
                        child: Center(
                          child: AnimatedDefaultTextStyle(
                            duration: const Duration(milliseconds: 260),
                            curve: Curves.fastOutSlowIn,
                            style: TextStyle(
                              fontSize: isSelected ? 12.0 : 11.0,
                              fontWeight:
                                  isSelected
                                      ? FontWeight.w900
                                      : FontWeight.w700,
                              color:
                                  isSelected
                                      ? Colors.white
                                      : const Color(0xff475569),
                              fontFamily: 'Roboto',
                              letterSpacing: -0.2,
                            ),
                            child: Text(
                              mode.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
