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
    final topPadding = MediaQuery.paddingOf(context).top + 72;

    return RefreshIndicator(
      color: brand,
      onRefresh: () => s.loadFromApi(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(16, topPadding, 16, 100),
        children: [
          // 1. Hero: operator + shift + check-in
          _ShiftHeroCard(state: s),

          // 1.5 Tugas Inspeksi Dok Menunggu (Inbound Shipments Arrived)
          if (s.arrivedShipments.isNotEmpty) ...[
            const SizedBox(height: 24),
            _InboundArrivalSection(shipments: s.arrivedShipments),
          ],

          // 1.6 Tugas Pengeluaran Dok Menunggu (Outbound Shipments Arrived)
          if (s.arrivedOutbounds.isNotEmpty) ...[
            const SizedBox(height: 24),
            _OutboundArrivalSection(shipments: s.arrivedOutbounds),
          ],

        const SizedBox(height: 28),

        // 2. Aksi cepat
        const _SectionTitle('Aksi Cepat'),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                title: 'Putaway',
                imageAsset: 'assets/images/action_putaway.png',
                onTap: () {
                  final target =
                      s.items.isNotEmpty ? s.items.first.sku : '';
                  s.openScanner(target, mode: ScanMode.putaway);
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionCard(
                title: 'Dispatching',
                imageAsset: 'assets/images/action_dispatch.png',
                onTap: () {
                  final target =
                      s.items.isNotEmpty ? s.items.first.sku : '';
                  s.openScanner(target, mode: ScanMode.dispatch);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _QuickActionCard(
                title: 'Single Scan',
                imageAsset: 'assets/images/action_single_scan.png',
                onTap: () {
                  final target =
                      s.items.isNotEmpty ? s.items.first.sku : '';
                  s.openScanner(target, mode: ScanMode.single);
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionCard(
                title: 'Rack Stock Audit',
                imageAsset: 'assets/images/action_cycle_count.png',
                onTap: () {
                  final target =
                      s.items.isNotEmpty ? s.items.first.sku : '';
                  if (target.isNotEmpty) {
                    openRack(context, target);
                  }
                },
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),

        // 3. Tugas hari ini
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const _SectionTitle('Tugas Hari Ini'),
            if (s.pendingTasks.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xfffef3c7),
                  border: Border.all(color: const Color(0xfffde68a)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Color(0xffd97706),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${s.pendingTasks.length} Menunggu',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xff92400e),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),

        // Data tugas aktif murni dari database (tugas yang selesai otomatis hilang)
        if (s.pendingTasks.isNotEmpty)
          ...s.pendingTasks.take(5).map((t) => _DbTaskCard(task: t))
        else if (s.alerts.where((a) {
          if (a.read) return false;
          if (a.id.startsWith('T-')) {
            final tId = int.tryParse(a.id.substring(2)) ?? 0;
            return s.pendingTasks.any((t) => (t['id'] is num ? (t['id'] as num).toInt() : int.tryParse(t['id'].toString()) ?? 0) == tId);
          }
          return true;
        }).isNotEmpty)
          ...s.alerts.where((a) {
            if (a.read) return false;
            if (a.id.startsWith('T-')) {
              final tId = int.tryParse(a.id.substring(2)) ?? 0;
              return s.pendingTasks.any((t) => (t['id'] is num ? (t['id'] as num).toInt() : int.tryParse(t['id'].toString()) ?? 0) == tId);
            }
            return true;
          }).take(4).map((a) => _AlertTaskCard(alert: a))
        else
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xffbbf7d0)),
              boxShadow: brandCardShadow,
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xff16a34a), size: 20),
                SizedBox(width: 8),
                Text(
                  'Semua tugas hari ini telah selesai dikerjakan',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xff166534),
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
      child:
          outlined
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
    final hasShift =
        s.currentShift.isNotEmpty && s.currentShift != 'Belum ada jadwal shift';
    final shiftText =
        hasShift ? s.currentShift : 'Belum ada jadwal shift aktif';
    final canCheckIn = hasShift || s.isCheckedIn;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: mint,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baris atas: avatar, nama, status online
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Halo, $name',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                        color: Colors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'ID: ${s.staff.staffId.isNotEmpty ? s.staff.staffId : (s.staff.id != null ? "STF-${s.staff.id}" : "-")}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                        color: Colors.white,
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
                    const Icon(Icons.schedule, size: 16, color: mint),
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
                          Text(
                            s.isCheckedIn
                                ? 'SUDAH CHECK-IN'
                                : (!hasShift
                                    ? 'BELUM ADA SHIFT'
                                    : 'BELUM CHECK-IN'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                              color: s.isCheckedIn
                                  ? forest
                                  : (!hasShift
                                      ? const Color(0xff64748b)
                                      : const Color(0xffb45309)),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            s.isCheckedIn && s.lastAttendanceTime != null
                                ? 'Masuk: ${clock(s.lastAttendanceTime!)} WIB'
                                : (!hasShift
                                    ? 'Menunggu jadwal dari manager'
                                    : 'Absensi shift operasional staf'),
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
                            s.isCheckedIn ? const Color(0xfffee2e2) : mint,
                        foregroundColor: s.isCheckedIn ? danger : Colors.white,
                        disabledBackgroundColor: const Color(0xffe2e8f0),
                        disabledForegroundColor: const Color(0xff94a3b8),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        minimumSize: const Size(0, 40),
                        shape: const StadiumBorder(),
                      ),
                      onPressed: canCheckIn
                          ? () async {
                              // Simpan status SEBELUM aksi, karena setelah await
                              // state sudah berubah.
                              final wasCheckedIn = s.isCheckedIn;
                              final err =
                                  wasCheckedIn
                                      ? await s.checkOut()
                                      : await s.checkIn();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      err ??
                                          (wasCheckedIn
                                              ? 'Check-out berhasil dicatat'
                                              : 'Check-in berhasil dicatat'),
                                    ),
                                    backgroundColor:
                                        err != null ? danger : forest,
                                  ),
                                );
                              }
                            }
                          : null,
                      child: Text(
                        s.isCheckedIn ? 'Check-out' : 'Check-in',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        online ? 'Online' : 'Offline',
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: brandInk,
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Aksi cepat
// -----------------------------------------------------------------------------

class _QuickActionCard extends StatelessWidget {
  final String title;
  final String? imageAsset;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.title,
    this.imageAsset,
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
        onTap: () {
          FocusScope.of(context).unfocus();
          onTap();
        },
        focusColor: Colors.transparent,
        hoverColor: Colors.transparent,
        highlightColor: Colors.transparent,
        splashColor: brand.withAlpha(30),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (imageAsset != null)
                Image.asset(
                  imageAsset!,
                  width: 48,
                  height: 48,
                  fit: BoxFit.contain,
                )
              else
                const SizedBox.shrink(),
              const SizedBox(height: 10),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.2,
                    color: brandInk,
                    height: 1.15,
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
// Kartu tugas
// -----------------------------------------------------------------------------

class _AlertTaskCard extends StatelessWidget {
  final WarehouseAlert alert;

  const _AlertTaskCard({required this.alert});

  @override
  Widget build(BuildContext context) {
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
            label: 'Detail Tugas',
            icon: Icons.visibility_outlined,
            onPressed: () => _showAlertDetailSheet(context, alert),
          ),
        ],
      ),
    );
  }
}

ScanMode _resolveTaskScanMode(Map<String, dynamic> task) {
  final type = (task['task_type'] ?? task['type'] ?? '').toString().toLowerCase();
  final title = (task['title'] ?? '').toString().toLowerCase();
  final desc = (task['description'] ?? '').toString().toLowerCase();
  final combined = '$type $title $desc';

  if (combined.contains('dispatch') ||
      combined.contains('outbound') ||
      combined.contains('pick') ||
      combined.contains('kirim') ||
      combined.contains('keluar') ||
      combined.contains('packing') ||
      combined.contains('shipping')) {
    return ScanMode.dispatch;
  }

  return ScanMode.putaway;
}

class _DbTaskCard extends StatelessWidget {
  final Map<String, dynamic> task;

  const _DbTaskCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final isMine = task['current_assignee_id'] == s.staff.id;
    final status = (task['status'] ?? 'pending').toString().toLowerCase();
    final title = (task['title'] ?? 'Tugas Operasional').toString();
    final description = (task['description'] ?? '').toString();
    final location = (task['location_code'] ?? '').toString();
    final sku = (task['sku'] ?? '').toString();
    final assigneeName = (task['assignee_name'] ?? 'Staf Lain').toString();
    final mode = _resolveTaskScanMode(task);
    final isPutaway = mode == ScanMode.putaway;

    final statusText = switch (status) {
      'done' => 'Selesai',
      'in_progress' => 'Sedang Dikerjakan',
      _ => 'Belum Dikerjakan',
    };

    final statusColor = switch (status) {
      'done' => forest,
      'in_progress' => const Color(0xff0284c7),
      _ => amber,
    };

    return _SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Baris 1: Tag Alur (Putaway/Dispatch) & Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                decoration: BoxDecoration(
                  color: isPutaway ? const Color(0xfff0fdf4) : const Color(0xfffffbeb),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isPutaway ? const Color(0xff86efac) : const Color(0xfffde68a),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPutaway ? Icons.download_rounded : Icons.upload_rounded,
                      size: 13,
                      color: isPutaway ? forest : const Color(0xffd97706),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isPutaway ? 'PUTAWAY' : 'DISPATCH',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                        color: isPutaway ? forest : const Color(0xffb45309),
                        letterSpacing: 0.4,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    statusText,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Baris 2: Judul Tugas
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
          const SizedBox(height: 8),

          // Baris 3: Chip Barcode SKU & Lokasi
          Row(
            children: [
              if (sku.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xfff8fafc),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xffe2e8f0)),
                  ),
                  child: Text(
                    '║▌║ $sku',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: brandInk,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              if (location.isNotEmpty) ...[
                const Icon(Icons.location_on_outlined, size: 14, color: muted),
                const SizedBox(width: 2),
                Text(
                  location,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),

          // Baris 4: Penanda Penugasan (BENTUK SERAGAM ANTARA TUGAS SENDIRI & STAF LAIN)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isMine ? const Color(0xfff0fdf4) : const Color(0xfff8fafc),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isMine ? const Color(0xff86efac) : const Color(0xffcbd5e1),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isMine ? Icons.star_rounded : Icons.person_outline,
                  size: 15,
                  color: isMine ? const Color(0xff16a34a) : const Color(0xff475569),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    isMine
                        ? '⭐ Tugas Khusus Anda (${s.staff.name})'
                        : '👤 Ditugaskan ke: $assigneeName',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isMine ? const Color(0xff166534) : const Color(0xff334155),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Baris 5: Tombol Aksi Detail Tugas
          _PillButton(
            label: 'Detail Tugas',
            icon: Icons.visibility_outlined,
            onPressed: () => _showDbTaskDetailSheet(context, task),
          ),
          if (status == 'done') ...[
            const SizedBox(height: 12),
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
        ],
      ),
    );
  }
}


// -----------------------------------------------------------------------------
// Inbound Arrival Section & Inspection Dialog (Tugas Dok Menunggu)
// -----------------------------------------------------------------------------

class _InboundArrivalSection extends StatelessWidget {
  final List<InboundShipmentModel> shipments;
  const _InboundArrivalSection({required this.shipments});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: _SectionTitle('Tugas Inspeksi Dok Menunggu'),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xffecfeff),
                border: Border.all(color: const Color(0xffa5f3fc)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xff0891b2),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${shipments.length} Armada Tiba',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xff0e7490),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...shipments.map((shipment) => _InboundShipmentCard(shipment: shipment)),
      ],
    );
  }
}

class _InboundShipmentCard extends StatelessWidget {
  final InboundShipmentModel shipment;
  const _InboundShipmentCard({required this.shipment});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final myName = s.staff.name.trim();
    final assigned = shipment.assignedStaff.trim();
    final isAssignedToMe = assigned.isNotEmpty &&
        (assigned.toLowerCase() == myName.toLowerCase() ||
            myName.toLowerCase().contains(assigned.toLowerCase()) ||
            assigned.toLowerCase().contains(myName.toLowerCase()));
    final isAssignedToAll = assigned.isEmpty ||
        assigned.toLowerCase().contains('semua') ||
        assigned.toLowerCase() == 'staf dok' ||
        assigned.toLowerCase() == 'staf lapangan';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isAssignedToMe ? const Color(0xff86efac) : const Color(0xffbfe5dc),
          width: isAssignedToMe ? 1.5 : 1.2,
        ),
        boxShadow: brandCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: brandSoft,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: brandSoftBorder),
                ),
                child: Text(
                  'DOK ${shipment.dock}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: brand,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  shipment.inboundNumber,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xffecfeff),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'ARRIVED',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: Color(0xff0891b2),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            shipment.supplierName,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.description_outlined, size: 14, color: muted),
              const SizedBox(width: 4),
              Text(
                'PO: ${shipment.poNumber ?? '-'}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.inventory_2_outlined, size: 14, color: muted),
              const SizedBox(width: 4),
              Text(
                '${formatNumber(shipment.units)} unit total',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
              ),
            ],
          ),
          if (shipment.carrier != null && shipment.carrier!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.local_shipping_outlined, size: 14, color: muted),
                const SizedBox(width: 4),
                Text(
                  shipment.carrier!,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          // Penanda Penugasan Staf oleh Manager
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isAssignedToMe
                  ? const Color(0xfff0fdf4)
                  : isAssignedToAll
                      ? const Color(0xfff8fafc)
                      : const Color(0xfffffbeb),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isAssignedToMe
                    ? const Color(0xff86efac)
                    : isAssignedToAll
                        ? const Color(0xffcbd5e1)
                        : const Color(0xfffde68a),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isAssignedToMe
                      ? Icons.star_rounded
                      : isAssignedToAll
                          ? Icons.people_outline
                          : Icons.person_outline,
                  size: 15,
                  color: isAssignedToMe
                      ? const Color(0xff16a34a)
                      : isAssignedToAll
                          ? const Color(0xff475569)
                          : const Color(0xffb45309),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    isAssignedToMe
                        ? '⭐ Tugas Khusus Anda ($assigned)'
                        : isAssignedToAll
                            ? '👥 Terbuka untuk Semua Staf Dok'
                            : '👤 Ditugaskan ke: $assigned',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isAssignedToMe
                          ? const Color(0xff166534)
                          : isAssignedToAll
                              ? const Color(0xff334155)
                              : const Color(0xff92400e),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _PillButton(
            label: 'Detail Tugas',
            icon: Icons.visibility_outlined,
            onPressed: () => _showInboundTaskDetailSheet(context, shipment),
          ),
        ],
      ),
    );
  }
}

class _OutboundArrivalSection extends StatelessWidget {
  final List<OutboundShipmentModel> shipments;
  const _OutboundArrivalSection({required this.shipments});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: _SectionTitle('Tugas Pengeluaran Dok Menunggu'),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xfffef3c7),
                border: Border.all(color: const Color(0xfffde68a)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xffd97706),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${shipments.length} Siap Ambil / Muat',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xff92400e),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...shipments.map((shipment) => _OutboundShipmentCard(shipment: shipment)),
      ],
    );
  }
}

class _OutboundShipmentCard extends StatelessWidget {
  final OutboundShipmentModel shipment;
  const _OutboundShipmentCard({required this.shipment});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final myName = s.staff.name.trim();
    final assigned = shipment.assignedStaff.trim();
    final isAssignedToMe = assigned.isNotEmpty &&
        (assigned.toLowerCase() == myName.toLowerCase() ||
            myName.toLowerCase().contains(assigned.toLowerCase()) ||
            assigned.toLowerCase().contains(myName.toLowerCase()));
    final isAssignedToAll = assigned.isEmpty ||
        assigned.toLowerCase().contains('semua') ||
        assigned.toLowerCase() == 'staf dok' ||
        assigned.toLowerCase() == 'staf lapangan';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isAssignedToMe ? const Color(0xfff59e0b) : const Color(0xfffed7aa),
          width: isAssignedToMe ? 1.5 : 1.2,
        ),
        boxShadow: brandCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xfffef3c7),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xfffde68a)),
                ),
                child: Text(
                  'DOK ${shipment.dock}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: Color(0xffb45309),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  shipment.outboundNumber,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xfffff7ed),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'OUTBOUND',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                    color: Color(0xffc2410c),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            shipment.destination,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.description_outlined, size: 14, color: muted),
              const SizedBox(width: 4),
              Text(
                'DO/Ref: ${shipment.reference ?? '-'}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
              ),
              const SizedBox(width: 12),
              const Icon(Icons.inventory_2_outlined, size: 14, color: muted),
              const SizedBox(width: 4),
              Text(
                '${formatNumber(shipment.units)} unit',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
              ),
            ],
          ),
          if (shipment.carrier != null && shipment.carrier!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.local_shipping_outlined, size: 14, color: muted),
                const SizedBox(width: 4),
                Text(
                  shipment.carrier!,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: isAssignedToMe
                  ? const Color(0xfff0fdf4)
                  : isAssignedToAll
                      ? const Color(0xfff8fafc)
                      : const Color(0xfffffbeb),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: isAssignedToMe
                    ? const Color(0xff86efac)
                    : isAssignedToAll
                        ? const Color(0xffcbd5e1)
                        : const Color(0xfffde68a),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isAssignedToMe
                      ? Icons.star_rounded
                      : isAssignedToAll
                          ? Icons.people_outline
                          : Icons.person_outline,
                  size: 15,
                  color: isAssignedToMe
                      ? const Color(0xff16a34a)
                      : isAssignedToAll
                          ? const Color(0xff475569)
                          : const Color(0xffb45309),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    isAssignedToMe
                        ? '⭐ Tugas Khusus Anda ($assigned)'
                        : isAssignedToAll
                            ? '👥 Terbuka untuk Semua Staf Dok'
                            : '👤 Ditugaskan ke: $assigned',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isAssignedToMe
                          ? const Color(0xff166534)
                          : isAssignedToAll
                              ? const Color(0xff334155)
                              : const Color(0xff92400e),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _PillButton(
            label: 'Detail Tugas Outbound',
            icon: Icons.visibility_outlined,
            onPressed: () => _showOutboundTaskDetailSheet(context, shipment),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Helper Detail Bottom Sheets & Components (Tugas, Produk & Dokumen)
// -----------------------------------------------------------------------------

void _showInboundTaskDetailSheet(BuildContext context, InboundShipmentModel shipment) {
  final s = context.read<WarehouseState>();
  final assigned = shipment.assignedStaff.trim().isEmpty ? 'Semua Staf' : shipment.assignedStaff.trim();
  final isAssignedToMe = assigned.toLowerCase() == s.staff.name.trim().toLowerCase();
  final isAssignedToAll = assigned.toLowerCase() == 'semua staf' || assigned.toLowerCase() == 'staff' || assigned.isEmpty;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    barrierColor: const Color(0x770c170b),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.78,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xffecfeff),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.inventory_2_outlined, color: Color(0xff0891b2), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Detail Tugas: ${shipment.inboundNumber}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: brandInk,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Supplier: ${shipment.supplierName}',
                            style: const TextStyle(fontSize: 12, color: brandSlate),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: brandSlate),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: line),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xfff8fafc),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xffe2e8f0)),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _MetaCol(label: 'NO. PO', value: shipment.poNumber ?? '-'),
                              _MetaCol(label: 'DOK BONGKAR', value: shipment.dock),
                              _MetaCol(label: 'TOTAL UNIT', value: '${formatNumber(shipment.units)} Unit'),
                            ],
                          ),
                          const Divider(height: 18, color: Color(0xffe2e8f0)),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _MetaCol(label: 'ARMADA / CARRIER', value: shipment.carrier?.isNotEmpty == true ? shipment.carrier! : 'Reguler'),
                              _MetaCol(label: 'JADWAL', value: '${shipment.scheduledDate} ${shipment.scheduledTime}'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isAssignedToMe
                            ? const Color(0xfff0fdf4)
                            : isAssignedToAll
                                ? const Color(0xfff8fafc)
                                : const Color(0xfffffbeb),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isAssignedToMe
                              ? const Color(0xff86efac)
                              : isAssignedToAll
                                  ? const Color(0xffcbd5e1)
                                  : const Color(0xfffde68a),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isAssignedToMe
                                ? Icons.star_rounded
                                : isAssignedToAll
                                    ? Icons.people_outline
                                    : Icons.person_outline,
                            size: 16,
                            color: isAssignedToMe
                                ? const Color(0xff16a34a)
                                : isAssignedToAll
                                    ? const Color(0xff475569)
                                    : const Color(0xffb45309),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              isAssignedToMe
                                  ? '⭐ Tugas Khusus Anda ($assigned)'
                                  : isAssignedToAll
                                      ? '👥 Terbuka untuk Semua Staf Dok'
                                      : '👤 Ditugaskan ke: $assigned',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isAssignedToMe
                                    ? const Color(0xff166534)
                                    : isAssignedToAll
                                        ? const Color(0xff334155)
                                        : const Color(0xff92400e),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Icon(Icons.category_outlined, size: 16, color: brandInk),
                        const SizedBox(width: 6),
                        Text(
                          'Rincian Produk (${shipment.items.length} Item)',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: brandInk,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (shipment.items.isEmpty)
                      const Text('Belum ada item produk terdaftar.', style: TextStyle(color: muted, fontSize: 12))
                    else
                      for (final it in shipment.items) ...[
                        _InboundItemDetailCard(item: it, state: s),
                        const SizedBox(height: 10),
                      ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: line)),
                ),
                child: SafeArea(
                  top: false,
                  child: _PillButton(
                    label: 'Kerjakan Inspeksi Dok',
                    icon: Icons.qr_code_scanner,
                    onPressed: () {
                      Navigator.pop(ctx);
                      final firstSku = shipment.items.isNotEmpty ? shipment.items.first.sku : '';
                      final dockLocation = 'RACK-${shipment.dock}-01-A';
                      final firstQty = shipment.items.isNotEmpty ? shipment.items.first.orderedQty : 1;
                      s.openScanner(
                        firstSku,
                        mode: ScanMode.putaway,
                        taskTitle: 'Inspeksi Dok ${shipment.inboundNumber}',
                        inboundShipmentId: shipment.id,
                        rack: dockLocation,
                        quantity: firstQty > 0 ? firstQty : 1,
                      );
                    },
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

void _showOutboundTaskDetailSheet(BuildContext context, OutboundShipmentModel shipment) {
  final s = context.read<WarehouseState>();
  final assigned = shipment.assignedStaff.trim().isEmpty ? 'Semua Staf' : shipment.assignedStaff.trim();
  final isAssignedToMe = assigned.toLowerCase() == s.staff.name.trim().toLowerCase();
  final isAssignedToAll = assigned.toLowerCase() == 'semua staf' || assigned.toLowerCase() == 'staff' || assigned.isEmpty;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    barrierColor: const Color(0x770c170b),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.78,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xfffef3c7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.outbox_rounded, color: Color(0xffd97706), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Detail Outbound: ${shipment.outboundNumber}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: brandInk,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Tujuan: ${shipment.destination}',
                            style: const TextStyle(fontSize: 12, color: brandSlate),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: brandSlate),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: line),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xfff8fafc),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xffe2e8f0)),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _MetaCol(label: 'REF / DO', value: shipment.reference ?? '-'),
                              _MetaCol(label: 'DOK MUAT', value: 'Dok ${shipment.dock}'),
                              _MetaCol(label: 'TOTAL UNIT', value: '${formatNumber(shipment.units)} Unit'),
                            ],
                          ),
                          const Divider(height: 18, color: Color(0xffe2e8f0)),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              _MetaCol(label: 'ARMADA', value: shipment.carrier?.isNotEmpty == true ? shipment.carrier! : 'Logistik Internal'),
                              _MetaCol(label: 'JADWAL', value: '${shipment.scheduledDate} ${shipment.scheduledTime}'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isAssignedToMe
                            ? const Color(0xfff0fdf4)
                            : isAssignedToAll
                                ? const Color(0xfff8fafc)
                                : const Color(0xfffffbeb),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isAssignedToMe
                              ? const Color(0xff86efac)
                              : isAssignedToAll
                                  ? const Color(0xffcbd5e1)
                                  : const Color(0xfffde68a),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isAssignedToMe
                                ? Icons.star_rounded
                                : isAssignedToAll
                                    ? Icons.people_outline
                                    : Icons.person_outline,
                            size: 16,
                            color: isAssignedToMe
                                ? const Color(0xff16a34a)
                                : isAssignedToAll
                                    ? const Color(0xff475569)
                                    : const Color(0xffb45309),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              isAssignedToMe
                                  ? '⭐ Tugas Khusus Anda ($assigned)'
                                  : isAssignedToAll
                                      ? '👥 Terbuka untuk Semua Staf Dok'
                                      : '👤 Ditugaskan ke: $assigned',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isAssignedToMe
                                    ? const Color(0xff166534)
                                    : isAssignedToAll
                                        ? const Color(0xff334155)
                                        : const Color(0xff92400e),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Icon(Icons.category_outlined, size: 16, color: brandInk),
                        const SizedBox(width: 6),
                        Text(
                          'Barang yang Harus Diambil (${shipment.items.length} Item)',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: brandInk,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (shipment.items.isEmpty)
                      const Text('Belum ada item produk terdaftar.', style: TextStyle(color: muted, fontSize: 12))
                    else
                      for (final it in shipment.items) ...[
                        _OutboundItemDetailCard(item: it, state: s),
                        const SizedBox(height: 10),
                      ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: line)),
                ),
                child: SafeArea(
                  top: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _PillButton(
                        label: 'Kirim Laporan Picking ke Manager',
                        icon: Icons.check_circle_outline,
                        onPressed: () async {
                          Navigator.pop(ctx);
                          final itemsToSubmit = shipment.items.map((it) {
                            final ful = it.fulfilledQty > 0 ? it.fulfilledQty : it.orderedQty;
                            final bcs = it.barcodes.isNotEmpty
                                ? it.barcodes
                                : List.generate(ful, (i) => '${it.sku}-${(i + 1).toString().padLeft(3, '0')}');
                            return OutboundShipmentItemModel(
                              id: it.id,
                              productId: it.productId,
                              sku: it.sku,
                              name: it.name,
                              rack: it.rack,
                              orderedQty: it.orderedQty,
                              fulfilledQty: ful,
                              damagedQty: it.damagedQty,
                              barcodes: bcs,
                              notes: it.notes,
                            );
                          }).toList();

                          final res = await s.submitOutboundInspection(
                            shipmentId: shipment.id,
                            items: itemsToSubmit,
                            notes: 'Pengambilan barang selesai oleh ${s.staff.name}',
                          );

                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(res['message'] ?? 'Laporan picking berhasil dikirim'),
                                backgroundColor: res['success'] == true ? forest : danger,
                              ),
                            );
                          }
                        },
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          side: const BorderSide(color: brand, width: 1.5),
                        ),
                        icon: const Icon(Icons.qr_code_scanner, color: brand, size: 20),
                        label: const Text('Ambil Barang & Scan Barcode', style: TextStyle(color: brand, fontWeight: FontWeight.w700)),
                        onPressed: () {
                          Navigator.pop(ctx);
                          final firstSku = shipment.items.isNotEmpty ? shipment.items.first.sku : '';
                          final firstRack = shipment.items.isNotEmpty ? shipment.items.first.rack : 'A-01';
                          final firstQty = shipment.items.isNotEmpty ? shipment.items.first.orderedQty : 1;
                          s.openScanner(
                            firstSku,
                            mode: ScanMode.dispatch,
                            taskTitle: 'Picking Dok ${shipment.outboundNumber}',
                            rack: firstRack,
                            quantity: firstQty > 0 ? firstQty : 1,
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _OutboundItemDetailCard extends StatelessWidget {
  final OutboundShipmentItemModel item;
  final WarehouseState state;
  const _OutboundItemDetailCard({required this.item, required this.state});

  @override
  Widget build(BuildContext context) {
    StockItem? product;
    try {
      product = state.items.firstWhere(
        (p) => p.sku.toLowerCase() == item.sku.toLowerCase(),
      );
    } catch (_) {}

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffe2e8f0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xfffff7ed),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.inventory_2_outlined, color: Color(0xffc2410c), size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xfff8fafc),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xffe2e8f0)),
                      ),
                      child: Text(
                        '║▌║ ${item.sku}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: brandInk,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '• 📍 Rak: ${item.rack}',
                      style: const TextStyle(fontSize: 11, color: muted, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatNumber(item.orderedQty),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xffc2410c),
                ),
              ),
              Text(
                product?.unit ?? 'Unit',
                style: const TextStyle(fontSize: 10, color: muted, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

void _showDbTaskDetailSheet(BuildContext context, Map<String, dynamic> task) {
  final s = context.read<WarehouseState>();
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
  final targetMode = _resolveTaskScanMode(task);

  final stockItem = sku.isNotEmpty ? s.resolve(sku) : null;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    barrierColor: const Color(0x770c170b),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.72,
        minChildSize: 0.45,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xfff0fdf4),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.assignment_outlined, color: forest, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: brandInk,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isMine ? 'Tugas Anda' : 'PIC: $assigneeName',
                            style: const TextStyle(fontSize: 12, color: brandSlate),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: brandSlate),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: line),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    if (description.isNotEmpty) ...[
                      const Text(
                        'DESKRIPSI TUGAS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: muted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        description,
                        style: const TextStyle(fontSize: 14, color: brandInk, height: 1.4),
                      ),
                      const SizedBox(height: 16),
                    ],
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xfff8fafc),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xffe2e8f0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _MetaCol(label: 'STATUS', value: status == 'done' ? 'Selesai' : status == 'in_progress' ? 'Sedang Dikerjakan' : 'Belum Dikerjakan'),
                          if (location.isNotEmpty)
                            _MetaCol(label: 'LOKASI RAK', value: location),
                          _MetaCol(label: 'DITUGASKAN KE', value: isMine ? '${s.staff.name} (Anda)' : assigneeName),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'DETAIL PRODUK TERKAIT',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: muted,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (stockItem != null)
                      _ProductStockDetailCard(item: stockItem)
                    else if (sku.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: line),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.qr_code, size: 24, color: brand),
                            const SizedBox(width: 10),
                            Text('SKU Produk: $sku', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: brandInk)),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xfff8fafc),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Text('Tugas umum gudang (tidak terkait produk spesifik).', style: TextStyle(color: muted, fontSize: 12)),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: line)),
                ),
                child: SafeArea(
                  top: false,
                  child: status == 'done'
                      ? const Center(
                          child: Text(
                            '✓ Tugas ini telah selesai dikerjakan',
                            style: TextStyle(fontWeight: FontWeight.w800, color: forest),
                          ),
                        )
                      : isMine
                          ? _PillButton(
                              label: status == 'in_progress' ? 'Lanjut Kerjakan' : 'Kerjakan Sekarang',
                              icon: Icons.qr_code_scanner,
                              onPressed: () async {
                                Navigator.pop(ctx);
                                if (status == 'pending') {
                                  await s.updateTaskStatus(taskId, 'in_progress');
                                }
                                s.openScanner(
                                  sku,
                                  mode: targetMode,
                                  taskTitle: title,
                                  taskId: taskId,
                                  rack: location.isNotEmpty ? location : null,
                                );
                              },
                            )
                          : _PillButton(
                              label: 'Ambil Alih & Kerjakan',
                              icon: Icons.front_hand_outlined,
                              color: const Color(0xffb45309),
                              outlined: true,
                              onPressed: () async {
                                Navigator.pop(ctx);
                                final err = await s.takeOverTask(taskId);
                                if (err == null) {
                                  await s.updateTaskStatus(taskId, 'in_progress');
                                  s.openScanner(
                                    sku,
                                    mode: targetMode,
                                    taskTitle: title,
                                    taskId: taskId,
                                    rack: location.isNotEmpty ? location : null,
                                  );
                                }
                              },
                            ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

void _showAlertDetailSheet(BuildContext context, WarehouseAlert alert) {
  final s = context.read<WarehouseState>();
  final stockItem = alert.sku.isNotEmpty ? s.resolve(alert.sku) : null;

  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.white,
    barrierColor: const Color(0x770c170b),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (ctx) {
      return DraggableScrollableSheet(
        initialChildSize: 0.68,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.black12,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xfffef3c7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.warning_amber_rounded, color: amber, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            alert.title,
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: brandInk),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            alert.badge.isNotEmpty ? alert.badge : 'Sistem Alert',
                            style: const TextStyle(fontSize: 12, color: muted),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: brandSlate),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: line),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Text(
                      alert.message,
                      style: const TextStyle(fontSize: 14, color: brandInk, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    if (stockItem != null) ...[
                      const Text(
                        'DETAIL PRODUK TERKAIT',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: muted, letterSpacing: 0.5),
                      ),
                      const SizedBox(height: 10),
                      _ProductStockDetailCard(item: stockItem),
                    ],
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: line)),
                ),
                child: SafeArea(
                  top: false,
                  child: _PillButton(
                    label: 'Kerjakan Sekarang',
                    icon: Icons.arrow_forward,
                    onPressed: () {
                      Navigator.pop(ctx);
                      s.readAlert(alert.id);
                      final alertText = '${alert.action} ${alert.title} ${alert.message}'.toLowerCase();
                      final isDispatch = alertText.contains('dispatch') ||
                          alertText.contains('outbound') ||
                          alertText.contains('pick') ||
                          alertText.contains('kirim') ||
                          alertText.contains('keluar') ||
                          alertText.contains('shipping');
                      final mode = isDispatch ? ScanMode.dispatch : ScanMode.putaway;
                      s.openScanner(alert.sku, mode: mode, taskTitle: alert.title);
                    },
                  ),
                ),
              ),
            ],
          );
        },
      );
    },
  );
}

class _MetaCol extends StatelessWidget {
  final String label, value;
  const _MetaCol({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: muted,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: brandInk,
          ),
        ),
      ],
    );
  }
}

class _InboundItemDetailCard extends StatelessWidget {
  final InboundShipmentItemModel item;
  final WarehouseState state;
  const _InboundItemDetailCard({required this.item, required this.state});

  @override
  Widget build(BuildContext context) {
    final product = state.resolve(item.sku);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffe2e8f0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xfff1f5f9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.inventory_2_outlined, color: brandSlate, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name.isNotEmpty ? item.name : (product?.name ?? item.sku),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xfff8fafc),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: const Color(0xffe2e8f0)),
                      ),
                      child: Text(
                        '║▌║ ${item.sku}',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: brandInk,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    if (product?.rack != null && product!.rack.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(
                        '• Rak: ${product.rack}',
                        style: const TextStyle(fontSize: 11, color: muted, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatNumber(item.orderedQty),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: brand,
                ),
              ),
              Text(
                product?.unit ?? 'Unit',
                style: const TextStyle(fontSize: 10, color: muted, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProductStockDetailCard extends StatelessWidget {
  final StockItem item;
  const _ProductStockDetailCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xffe2e8f0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xfff1f5f9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.inventory_2_outlined, color: brand, size: 26),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: brandInk,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xfff8fafc),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: const Color(0xffe2e8f0)),
                          ),
                          child: Text(
                            '║▌║ ${item.sku}',
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: brandInk,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                        if (item.category != null && item.category!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Text(
                            '• ${item.category}',
                            style: const TextStyle(fontSize: 11, color: muted, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xfff1f5f9)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _MetaCol(label: 'STOK GUDANG', value: '${formatNumber(item.quantity)} ${item.unit}'),
              _MetaCol(label: 'BATAS MINIMUM', value: '${formatNumber(item.minimum)} ${item.unit}'),
              _MetaCol(label: 'LOKASI RAK', value: item.rack.isNotEmpty ? item.rack : '-'),
            ],
          ),
        ],
      ),
    );
  }
}
