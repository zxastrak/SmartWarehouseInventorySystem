import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';
import '../widgets/ui.dart';
import 'stock_flows.dart';

class ShiftHubScreen extends StatelessWidget {
  const ShiftHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final pendingCount = s.pendingCount;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        // 1. Hero: operator + shift + check-in
        _ShiftHeroCard(state: s),

        const SizedBox(height: 28),

        // 2. Aksi cepat
        const _SectionTitle('Aksi Cepat'),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.45,
          children: [
            _QuickActionCard(
              title: 'Barang Masuk',
              subtitle: 'Inbound Scan',
              icon: Icons.move_to_inbox_outlined,
              onTap: () {
                final target =
                    s.items.isNotEmpty ? s.items.first.sku : 'SKU-9249';
                s.openScanner(
                  target,
                  mode: ScanMode.single,
                  kind: MovementKind.stockIn,
                );
              },
            ),
            _QuickActionCard(
              title: 'Barang Keluar',
              subtitle: 'Picking / Outbound',
              icon: Icons.outbox_outlined,
              onTap: () {
                final target =
                    s.items.isNotEmpty ? s.items.first.sku : 'SKU-9249';
                s.openScanner(
                  target,
                  mode: ScanMode.single,
                  kind: MovementKind.stockOut,
                );
              },
            ),
            _QuickActionCard(
              title: 'Relokasi Rak',
              subtitle: 'Putaway',
              icon: Icons.swap_horiz_outlined,
              onTap: () {
                final target =
                    s.items.isNotEmpty ? s.items.first.sku : 'SKU-9249';
                s.openScanner(
                  target,
                  mode: ScanMode.putaway,
                  kind: MovementKind.putaway,
                );
              },
            ),
            _QuickActionCard(
              title: 'Audit Stok Rak',
              subtitle: 'Cycle Count',
              icon: Icons.fact_check_outlined,
              onTap: () {
                final target =
                    s.items.isNotEmpty ? s.items.first.sku : 'SKU-9249';
                openRack(context, target);
              },
            ),
          ],
        ),

        const SizedBox(height: 28),

        // 3. Tugas hari ini
        Row(
          children: [
            const _SectionTitle('Tugas Hari Ini'),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: pendingCount > 0 ? danger : brand,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                s.tasks.isNotEmpty
                    ? '${s.tasks.length} TUGAS'
                    : (pendingCount > 0 ? '$pendingCount PENDING' : '3 TUGAS'),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        // Dari DB, kalau kosong pakai alert, kalau kosong juga pakai contoh
        if (s.tasks.isNotEmpty)
          ...s.tasks.take(5).map((t) => _DbTaskCard(task: t))
        else if (s.alerts.isNotEmpty)
          ...s.alerts.take(4).map((a) => _AlertTaskCard(alert: a))
        else ...[
          _WorkTaskCard(
            badgeText: 'URGENT',
            badgeColor: danger,
            title: 'Verifikasi Rak A4-02',
            description: 'SKU-9249 (Bearings 45mm) terdeteksi selisih 8 unit.',
            actionLabel: 'Cek Rak Sekarang',
            actionIcon: Icons.checklist,
            onAction: () => openRack(context, 'SKU-9249'),
          ),
          _WorkTaskCard(
            badgeText: 'INBOUND',
            badgeColor: forest,
            title: 'Terima Truk PO-2026-004',
            description: 'Supplier Nippon Precision • Dock 02 (50 unit).',
            actionLabel: 'Mulai Scan Barang',
            actionIcon: Icons.qr_code_scanner,
            onAction: () {
              s.openScanner(
                'SKU-9249',
                mode: ScanMode.single,
                kind: MovementKind.stockIn,
              );
            },
          ),
          _WorkTaskCard(
            badgeText: 'PUTAWAY',
            badgeColor: const Color(0xff0284c7),
            title: 'Pindahkan 15 Box dari Staging',
            description: 'Tujuan Rak D2-02-A • SKU-911 (Battery Pack).',
            actionLabel: 'Arahkan Lokasi',
            actionIcon: Icons.directions_outlined,
            onAction: () {
              s.openScanner(
                'SKU-911',
                mode: ScanMode.putaway,
                kind: MovementKind.putaway,
              );
            },
          ),
        ],
      ],
    );
  }
}

// -----------------------------------------------------------------------------
// Komponen kecil yang dipakai ulang
// -----------------------------------------------------------------------------

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.3,
        color: brandInk,
      ),
    );
  }
}

/// Kartu putih membulat (radius 24) dengan bayangan lembut.
class _SoftCard extends StatelessWidget {
  final Widget child;
  const _SoftCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: brandCardShadow,
      ),
      child: child,
    );
  }
}

/// Tombol pill setinggi 48, gaya sama seperti tombol Sign In.
class _PillButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color color;
  final bool outlined;

  const _PillButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.color = brand,
    this.outlined = false,
  });

  @override
  Widget build(BuildContext context) {
    final textStyle = const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w800,
      letterSpacing: 0.2,
    );
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: outlined
          ? OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: color,
                side: BorderSide(color: color, width: 1.4),
                shape: const StadiumBorder(),
              ),
              onPressed: onPressed,
              icon: Icon(icon, size: 18),
              label: Text(label, style: textStyle),
            )
          : FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: color,
                foregroundColor: Colors.white,
                shape: const StadiumBorder(),
              ),
              onPressed: onPressed,
              icon: Icon(icon, size: 18),
              label: Text(label, style: textStyle),
            ),
    );
  }
}

// -----------------------------------------------------------------------------
// Hero card
// -----------------------------------------------------------------------------

class _ShiftHeroCard extends StatelessWidget {
  final WarehouseState state;
  const _ShiftHeroCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final s = state;
    final name = s.staff.name.isNotEmpty ? s.staff.name : 'Staf Gudang';
    final shiftText =
        s.currentShift.isNotEmpty && s.currentShift != 'Belum ada jadwal shift'
            ? '${s.currentShift} • Dock 02 / Zona A'
            : 'Shift Aktif (08:00 - 16:00) • Dock 02 / Zona A';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [brandGradientStart, brandGradientEnd],
        ),
        boxShadow: [
          BoxShadow(
            color: brand.withAlpha(60),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baris atas: avatar, nama, status online
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(140),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.badge_outlined,
                  size: 22,
                  color: brandHeroInk,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Halo,',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: brandHeroSub,
                      ),
                    ),
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.3,
                        color: brandHeroInk,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      'ID: ${s.staff.staffId} • ${s.staff.badge}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: brandHeroSub,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _OnlinePill(online: s.isBackendConnected),
            ],
          ),

          const SizedBox(height: 16),

          // Panel putih: shift + absensi
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.schedule, size: 16, color: brand),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        shiftText,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: brandInk,
                        ),
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: line),
                ),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: s.isCheckedIn ? mint : amber,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                s.isCheckedIn
                                    ? 'SUDAH CHECK-IN'
                                    : 'BELUM CHECK-IN',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5,
                                  color: s.isCheckedIn
                                      ? forest
                                      : const Color(0xffb45309),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            s.isCheckedIn && s.lastAttendanceTime != null
                                ? 'Masuk: ${clock(s.lastAttendanceTime!)} WIB'
                                : 'Absensi shift operasional staf',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor:
                            s.isCheckedIn ? const Color(0xfffee2e2) : brand,
                        foregroundColor:
                            s.isCheckedIn ? danger : Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        minimumSize: const Size(0, 40),
                        shape: const StadiumBorder(),
                      ),
                      onPressed: () async {
                        // Simpan status SEBELUM aksi, karena setelah await
                        // state sudah berubah.
                        final wasCheckedIn = s.isCheckedIn;
                        final err =
                            wasCheckedIn ? await s.checkOut() : await s.checkIn();
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                err ??
                                    (wasCheckedIn
                                        ? 'Check-out berhasil dicatat'
                                        : 'Check-in berhasil dicatat'),
                              ),
                              backgroundColor: err != null ? danger : forest,
                            ),
                          );
                        }
                      },
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            s.isCheckedIn ? Icons.logout : Icons.login,
                            size: 16,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            s.isCheckedIn ? 'Check-out' : 'Check-in',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OnlinePill extends StatelessWidget {
  final bool online;
  const _OnlinePill({required this.online});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: online ? mint : amber,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            online ? 'Online' : 'Offline',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: brandInk,
            ),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Aksi cepat
// -----------------------------------------------------------------------------

class _QuickActionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 2,
      shadowColor: const Color(0x26000000),
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        splashColor: brand.withAlpha(30),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: brandSoft,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: brandSoftBorder),
                ),
                child: Icon(icon, color: brand, size: 22),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                      color: brandInk,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Kartu tugas
// -----------------------------------------------------------------------------

class _WorkTaskCard extends StatelessWidget {
  final String badgeText;
  final Color badgeColor;
  final String title;
  final String description;
  final String actionLabel;
  final IconData actionIcon;
  final VoidCallback onAction;

  const _WorkTaskCard({
    required this.badgeText,
    required this.badgeColor,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.actionIcon,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return _SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Tag(badgeText, color: badgeColor, solid: true),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            description,
            style: const TextStyle(
              fontSize: 13,
              color: brandSlate,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 14),
          _PillButton(
            label: actionLabel,
            icon: actionIcon,
            onPressed: onAction,
          ),
        ],
      ),
    );
  }
}

class _AlertTaskCard extends StatelessWidget {
  final WarehouseAlert alert;

  const _AlertTaskCard({required this.alert});

  @override
  Widget build(BuildContext context) {
    final s = context.read<WarehouseState>();
    final isUrgent = alert.badge.toUpperCase().contains('URGENT');
    final color = isUrgent ? danger : forest;

    return _SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Tag(
            alert.badge.isNotEmpty ? alert.badge : 'TASK',
            color: color,
            solid: true,
          ),
          const SizedBox(height: 10),
          Text(
            alert.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            alert.message,
            style: const TextStyle(
              fontSize: 13,
              color: brandSlate,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 14),
          _PillButton(
            label: 'Kerjakan Tugas',
            icon: Icons.arrow_forward,
            onPressed: () {
              s.readAlert(alert.id);
              switch (alert.action) {
                case 'receiving':
                  s.openScanner(
                    alert.sku,
                    mode: ScanMode.single,
                    kind: MovementKind.stockIn,
                  );
                  break;
                case 'putaway':
                  s.openScanner(
                    alert.sku,
                    mode: ScanMode.putaway,
                    kind: MovementKind.putaway,
                  );
                  break;
                case 'rack':
                  openRack(context, alert.sku);
                  break;
                default:
                  openRack(context, alert.sku);
              }
            },
          ),
        ],
      ),
    );
  }
}

class _DbTaskCard extends StatelessWidget {
  final Map<String, dynamic> task;

  const _DbTaskCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final taskId = task['id'] is num
        ? (task['id'] as num).toInt()
        : int.tryParse(task['id'].toString()) ?? 0;
    final isMine = task['current_assignee_id'] == s.staff.id;
    final status = (task['status'] ?? 'pending').toString().toLowerCase();
    final title = (task['title'] ?? 'Tugas Operasional').toString();
    final description = (task['description'] ?? '').toString();
    final location = (task['location_code'] ?? '').toString();
    final sku = (task['sku'] ?? '').toString();
    final assigneeName = (task['assignee_name'] ?? 'Staf Lain').toString();

    final statusColor = switch (status) {
      'done' => forest,
      'in_progress' => const Color(0xff0284c7),
      _ => amber,
    };

    final statusLabel = switch (status) {
      'done' => 'SELESAI',
      'in_progress' => 'SEDANG DIKERJAKAN',
      _ => 'MENUNGGU PIC',
    };

    void showResult(String? err, String okMessage) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(err ?? okMessage),
          backgroundColor: err != null ? danger : forest,
        ),
      );
    }

    return _SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Tag(
                isMine ? 'TUGAS ANDA' : 'PIC: $assigneeName',
                color: isMine ? brand : muted,
                solid: true,
              ),
              Tag(statusLabel, color: statusColor),
              if (location.isNotEmpty)
                Text(
                  location,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: muted,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.2,
              color: brandInk,
            ),
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              description,
              style: const TextStyle(
                fontSize: 13,
                color: brandSlate,
                height: 1.35,
              ),
            ),
          ],
          if (sku.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Item Terkait: $sku',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: brand,
              ),
            ),
          ],
          const SizedBox(height: 14),
          if (isMine && status == 'pending')
            _PillButton(
              label: 'Mulai Kerjakan',
              icon: Icons.play_arrow,
              onPressed: () async {
                final err = await s.updateTaskStatus(taskId, 'in_progress');
                showResult(err, 'Task dimulai (In Progress)');
              },
            )
          else if (isMine && status == 'in_progress')
            _PillButton(
              label: 'Selesaikan Tugas',
              icon: Icons.check_circle_outline,
              color: forest,
              onPressed: () async {
                final err = await s.updateTaskStatus(taskId, 'done');
                showResult(err, 'Task berhasil diselesaikan!');
              },
            )
          else if (!isMine && status != 'done')
            _PillButton(
              label: 'Ambil Alih Tugas',
              icon: Icons.front_hand_outlined,
              outlined: true,
              onPressed: () async {
                final err = await s.takeOverTask(taskId);
                showResult(err, 'Task berhasil dialihkan ke Anda!');
              },
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              alignment: Alignment.center,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle, size: 16, color: forest),
                  SizedBox(width: 6),
                  Text(
                    'Tugas Selesai',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: forest,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}