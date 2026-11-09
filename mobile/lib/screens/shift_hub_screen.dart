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

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(16, topPadding, 16, 100),
      children: [

        // 1. Hero: operator + shift + check-in
        _ShiftHeroCard(state: s),

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
        const _SectionTitle('Tugas Hari Ini'),
        const SizedBox(height: 14),

        // Data tugas murni dari database
        if (s.tasks.isNotEmpty)
          ...s.tasks.take(5).map((t) => _DbTaskCard(task: t))
        else if (s.alerts.isNotEmpty)
          ...s.alerts.take(4).map((a) => _AlertTaskCard(alert: a))
        else
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: brandCardShadow,
            ),
            child: const Text(
              'Belum ada tugas operasional di database',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: muted,
              ),
            ),
          ),
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
                case 'putaway':
                  s.openScanner(alert.sku, mode: ScanMode.putaway);
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
    final taskId =
        task['id'] is num
            ? (task['id'] as num).toInt()
            : int.tryParse(task['id'].toString()) ?? 0;
    final isMine = task['current_assignee_id'] == s.staff.id;
    final status = (task['status'] ?? 'pending').toString().toLowerCase();
    final title = (task['title'] ?? 'Tugas Operasional').toString();
    final description = (task['description'] ?? '').toString();
    final location = (task['location_code'] ?? '').toString();
    final sku = (task['sku'] ?? '').toString();
    final assigneeName = (task['assignee_name'] ?? 'Staf Lain').toString();

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
              Text(
                isMine ? 'TUGAS ANDA' : 'PIC: $assigneeName',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: isMine ? brand : Colors.black,
                  letterSpacing: 0.2,
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
              if (location.isNotEmpty)
                Text(
                  '• Lokasi: $location',
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
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
          if (isMine && status == 'pending') ...[
            const SizedBox(height: 14),
            _PillButton(
              label: 'Mulai Kerjakan',
              icon: Icons.play_arrow,
              onPressed: () async {
                final err = await s.updateTaskStatus(taskId, 'in_progress');
                showResult(err, 'Task dimulai (In Progress)');
              },
            ),
          ] else if (isMine && status == 'in_progress') ...[
            const SizedBox(height: 14),
            _PillButton(
              label: 'Selesaikan Tugas',
              icon: Icons.check_circle_outline,
              color: forest,
              onPressed: () async {
                final err = await s.updateTaskStatus(taskId, 'done');
                showResult(err, 'Task berhasil diselesaikan!');
              },
            ),
          ] else if (!isMine && status == 'pending') ...[
            const SizedBox(height: 14),
            _PillButton(
              label: 'Ambil Alih Tugas',
              icon: Icons.front_hand_outlined,
              outlined: true,
              onPressed: () async {
                final err = await s.takeOverTask(taskId);
                showResult(err, 'Task berhasil dialihkan ke Anda!');
              },
            ),
          ] else if (status == 'done') ...[
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
