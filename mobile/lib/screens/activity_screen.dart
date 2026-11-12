import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/task_chart.dart';
import '../core/app_theme.dart';

enum ActivityFilter {
  all('Semua', Icons.all_inclusive),
  inbound('Inspeksi Dok', Icons.fact_check_outlined),
  movement('Mutasi Stok', Icons.swap_horiz),
  rack('Rak & Opname', Icons.inventory_2_outlined),
  attendanceTasks('Absensi & Tugas', Icons.badge_outlined);

  final String label;
  final IconData icon;
  const ActivityFilter(this.label, this.icon);
}

class ActivityScreen extends StatefulWidget {
  final bool audit;
  const ActivityScreen({super.key, this.audit = false});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  ActivityFilter _filter = ActivityFilter.all;
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    if (widget.audit) {
      _filter = ActivityFilter.all;
    }
  }

  Future<void> _refreshData() async {
    setState(() => _isRefreshing = true);
    final s = context.read<WarehouseState>();
    await s.loadFromApi();
    if (mounted) {
      setState(() => _isRefreshing = false);
    }
  }

  bool _matchesFilter(Activity a, ActivityFilter filter) {
    final t = a.title.toLowerCase();
    final d = a.detail.toLowerCase();

    switch (filter) {
      case ActivityFilter.all:
        return true;
      case ActivityFilter.inbound:
        return t.contains('inbound') ||
            t.contains('inspeksi') ||
            t.contains('dok') ||
            d.contains('inb-') ||
            a.barcodes.isNotEmpty;
      case ActivityFilter.movement:
        return a.kind == MovementKind.stockIn ||
            a.kind == MovementKind.stockOut ||
            t.contains('stok masuk') ||
            t.contains('stok keluar') ||
            t.contains('mutasi');
      case ActivityFilter.rack:
        return a.kind == MovementKind.putaway ||
            a.kind == MovementKind.rackCount ||
            t.contains('putaway') ||
            t.contains('rak') ||
            t.contains('opname') ||
            t.contains('discrepancy') ||
            t.contains('selisih') ||
            d.contains('rack-');
      case ActivityFilter.attendanceTasks:
        return t.contains('check-in') ||
            t.contains('check-out') ||
            t.contains('absensi') ||
            t.contains('tugas') ||
            t.contains('task') ||
            t.contains('profil');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final allActivities = s.activities;

    final inboundCount = allActivities.where((a) => _matchesFilter(a, ActivityFilter.inbound)).length;
    final movementCount = allActivities.where((a) => _matchesFilter(a, ActivityFilter.movement)).length;
    final rackCount = allActivities.where((a) => _matchesFilter(a, ActivityFilter.rack)).length;
    final attendanceCount = allActivities.where((a) => _matchesFilter(a, ActivityFilter.attendanceTasks)).length;

    final filtered = allActivities.where((a) => _matchesFilter(a, _filter)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Kartu Metrik Ringkasan Hari Ini
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Metric(
                  'Inbound Hari Ini',
                  '${s.inflow} Unit',
                  '${s.inboundTxCount} transaksi masuk',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Metric(
                  'Outbound Hari Ini',
                  '${s.outflow} Unit',
                  '${s.outboundTxCount} transaksi keluar',
                ),
              ),
            ],
          ),
        ),

        // Grafik Tren Aktivitas Gudang
        Panel(
          padding: const EdgeInsets.all(16),
          child: TaskChart(
            bars: true,
            inflow: s.inflow,
            outflow: s.outflow,
            inflowSeries: s.weeklyInflow,
            outflowSeries: s.weeklyOutflow,
          ),
        ),

        // Panel Utama Feed Aktivitas
        Panel(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Bagian
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: brandSoft,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: brandSoftBorder),
                    ),
                    child: const Icon(Icons.history, size: 20, color: brand),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Aktivitas Staf Lapangan',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.2,
                            color: brandInk,
                          ),
                        ),
                        Text(
                          'Semua riwayat inspeksi dok, mutasi, opname & tugas',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: _isRefreshing ? null : _refreshData,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xfff1f5f9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: line),
                      ),
                      child: _isRefreshing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: brand),
                            )
                          : const Icon(Icons.refresh, size: 16, color: brandInk),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'Semua',
                      count: allActivities.length,
                      icon: Icons.all_inclusive,
                      selected: _filter == ActivityFilter.all,
                      onTap: () => setState(() => _filter = ActivityFilter.all),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Inspeksi Dok',
                      count: inboundCount,
                      icon: Icons.fact_check_outlined,
                      selected: _filter == ActivityFilter.inbound,
                      onTap: () => setState(() => _filter = ActivityFilter.inbound),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Mutasi Stok',
                      count: movementCount,
                      icon: Icons.swap_horiz,
                      selected: _filter == ActivityFilter.movement,
                      onTap: () => setState(() => _filter = ActivityFilter.movement),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Rak & Opname',
                      count: rackCount,
                      icon: Icons.inventory_2_outlined,
                      selected: _filter == ActivityFilter.rack,
                      onTap: () => setState(() => _filter = ActivityFilter.rack),
                    ),
                    const SizedBox(width: 6),
                    _FilterChip(
                      label: 'Absensi & Tugas',
                      count: attendanceCount,
                      icon: Icons.badge_outlined,
                      selected: _filter == ActivityFilter.attendanceTasks,
                      onTap: () => setState(() => _filter = ActivityFilter.attendanceTasks),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Konten Daftar Aktivitas
              if (filtered.isEmpty)
                _EmptyActivities(
                  filter: _filter,
                  onRefresh: _refreshData,
                )
              else
                Column(
                  children: [
                    for (int i = 0; i < filtered.length; i++)
                      _ActivityCard(
                        activity: filtered[i],
                        isLast: i == filtered.length - 1,
                      ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? brand : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? brand : line,
            width: selected ? 1.4 : 1.0,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: brand.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: selected ? Colors.white : brandSlate,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: selected ? Colors.white : brandInk,
              ),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withValues(alpha: 0.25)
                    : const Color(0xfff1f5f9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white : brandSlate,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyActivities extends StatelessWidget {
  final ActivityFilter filter;
  final VoidCallback onRefresh;

  const _EmptyActivities({
    required this.filter,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final catName = switch (filter) {
      ActivityFilter.all => 'aktivitas',
      ActivityFilter.inbound => 'inspeksi dok',
      ActivityFilter.movement => 'mutasi stok',
      ActivityFilter.rack => 'penataan rak & opname',
      ActivityFilter.attendanceTasks => 'absensi & tugas',
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: brandSoft,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.history_toggle_off,
                size: 28,
                color: brand,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Belum ada $catName tercatat.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: brandInk,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Aktivitas operasional Anda akan otomatis muncul di sini.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: muted,
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: brand,
                side: const BorderSide(color: brandSoftBorder),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh, size: 14),
              label: const Text('Muat Ulang', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivityMeta {
  final String categoryTag;
  final IconData icon;
  final Color primaryColor;
  final Color bgColor;
  final Color borderColor;

  const _ActivityMeta({
    required this.categoryTag,
    required this.icon,
    required this.primaryColor,
    required this.bgColor,
    required this.borderColor,
  });
}

_ActivityMeta _getActivityMeta(Activity a) {
  final t = a.title.toLowerCase();
  if (t.contains('inspeksi') || t.contains('inbound') || a.barcodes.isNotEmpty) {
    return const _ActivityMeta(
      categoryTag: 'INSPEKSI DOK',
      icon: Icons.fact_check_outlined,
      primaryColor: forest,
      bgColor: Color(0xfff0fdf4),
      borderColor: Color(0xffbbf7d0),
    );
  }
  if (a.kind == MovementKind.stockIn || t.contains('stok masuk')) {
    return const _ActivityMeta(
      categoryTag: 'STOK MASUK',
      icon: Icons.arrow_downward,
      primaryColor: Color(0xff16a34a),
      bgColor: Color(0xfff0fdf4),
      borderColor: Color(0xffbbf7d0),
    );
  }
  if (a.kind == MovementKind.stockOut || t.contains('stok keluar')) {
    return const _ActivityMeta(
      categoryTag: 'STOK KELUAR',
      icon: Icons.arrow_upward,
      primaryColor: Color(0xffdc2626),
      bgColor: Color(0xfffff1f2),
      borderColor: Color(0xfffecdd3),
    );
  }
  if (a.kind == MovementKind.putaway || t.contains('putaway')) {
    return const _ActivityMeta(
      categoryTag: 'PUTAWAY RAK',
      icon: Icons.move_to_inbox_outlined,
      primaryColor: brand,
      bgColor: brandSoft,
      borderColor: brandSoftBorder,
    );
  }
  if (a.kind == MovementKind.rackCount || t.contains('opname') || t.contains('verifikasi')) {
    return const _ActivityMeta(
      categoryTag: 'OPNAME RAK',
      icon: Icons.inventory_2_outlined,
      primaryColor: Color(0xff0284c7),
      bgColor: Color(0xfff0f9ff),
      borderColor: Color(0xffbae6fd),
    );
  }
  if (t.contains('discrepancy') || t.contains('selisih')) {
    return const _ActivityMeta(
      categoryTag: 'SELISIH STOK',
      icon: Icons.warning_amber_rounded,
      primaryColor: Color(0xffd97706),
      bgColor: Color(0xfffffbeb),
      borderColor: Color(0xfffde68a),
    );
  }
  if (t.contains('check-in') || t.contains('check-out') || t.contains('absensi')) {
    return const _ActivityMeta(
      categoryTag: 'ABSENSI STAF',
      icon: Icons.access_time_rounded,
      primaryColor: Color(0xff4f46e5),
      bgColor: Color(0xffeef2ff),
      borderColor: Color(0xffc7d2fe),
    );
  }
  if (t.contains('tugas') || t.contains('task')) {
    return const _ActivityMeta(
      categoryTag: 'TUGAS GUDANG',
      icon: Icons.task_alt_rounded,
      primaryColor: Color(0xff0d9488),
      bgColor: Color(0xfff0fdfa),
      borderColor: Color(0xff99f6e4),
    );
  }
  return const _ActivityMeta(
    categoryTag: 'AKTIVITAS',
    icon: Icons.history,
    primaryColor: brandSlate,
    bgColor: Color(0xfff8fafc),
    borderColor: line,
  );
}

class _ActivityCard extends StatelessWidget {
  final Activity activity;
  final bool isLast;

  const _ActivityCard({
    required this.activity,
    required this.isLast,
  });

  String _formatTimestamp(DateTime dt) {
    final now = DateTime.now();
    final isToday = dt.year == now.year && dt.month == now.month && dt.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = dt.year == yesterday.year && dt.month == yesterday.month && dt.day == yesterday.day;

    final timeStr = clock(dt);
    if (isToday) return timeStr;
    if (isYesterday) return 'Kemarin • $timeStr';
    return '${dt.day}/${dt.month} • $timeStr';
  }

  Widget _buildStatusBadge(Activity a) {
    final t = a.title.toLowerCase();
    if (t.contains('inspeksi')) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xfffef3c7),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xfffde68a)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.schedule, size: 12, color: Color(0xffd97706)),
            SizedBox(width: 4),
            Text(
              'Menunggu Review & ACC Manager',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: Color(0xffd97706),
              ),
            ),
          ],
        ),
      );
    }
    if (t.contains('discrepancy') || t.contains('selisih')) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: const Color(0xfffff1f2),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xfffecdd3)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 12, color: Color(0xffdc2626)),
            SizedBox(width: 4),
            Text(
              'Menunggu Tindak Lanjut Manager',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: Color(0xffdc2626),
              ),
            ),
          ],
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: brandSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: brandSoftBorder),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_outline, size: 12, color: brand),
          SizedBox(width: 4),
          Text(
            'Tercatat di Database',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: brand,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = activity;
    final meta = _getActivityMeta(a);

    return Container(
      margin: EdgeInsets.only(bottom: isLast ? 0 : 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: line),
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
          // Header Bar: Tag Kategori + Waktu
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: meta.bgColor,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: meta.borderColor),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(meta.icon, size: 12, color: meta.primaryColor),
                    const SizedBox(width: 4),
                    Text(
                      meta.categoryTag,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: meta.primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                _formatTimestamp(a.time),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xff94a3b8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Judul Aksi
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  a.title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                    height: 1.25,
                  ),
                ),
              ),
              if (a.quantity > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: a.kind == MovementKind.stockOut
                        ? const Color(0xfffff1f2)
                        : brandSoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${a.kind == MovementKind.stockOut ? "-" : "+"}${formatNumber(a.quantity)} Unit',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: a.kind == MovementKind.stockOut ? danger : brand,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 5),

          // Detail Deskripsi
          Text(
            a.detail,
            style: const TextStyle(
              fontSize: 12,
              color: brandSlate,
              height: 1.4,
            ),
          ),

          // Barcode Fisik Chips (bila ada)
          if (a.barcodes.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.qr_code_scanner, size: 14, color: forest),
                const SizedBox(width: 4),
                Text(
                  '${a.barcodes.length} Barcode Unit Fisik Discan:',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: a.barcodes.map((bc) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xfff1f5f9),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: line),
                ),
                child: Text(
                  '║▌║ $bc',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                    color: brandInk,
                  ),
                ),
              )).toList(),
            ),
          ],
          const SizedBox(height: 10),

          // Status Badge Footer
          _buildStatusBadge(a),
        ],
      ),
    );
  }
}

// ==========================================
// LEGACY COMPATIBILITY HELPERS
// (Preserved for compatibility with existing tests/references)
// ==========================================

class SectionHeading extends StatelessWidget {
  final String title, subtitle;
  final IconData? icon;
  final Widget? trailing;
  const SectionHeading(
    this.title,
    this.subtitle,
    this.icon, {
    super.key,
    this.trailing,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(
      children: [
        if (icon != null) ...[
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: brandSoft,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: brandSoftBorder),
            ),
            child: Icon(icon!, size: 20, color: brand),
          ),
          const SizedBox(width: 10),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                  color: brandInk,
                ),
              ),
              if (subtitle.isNotEmpty)
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
            ],
          ),
        ),
        if (trailing != null) trailing!,
      ],
    ),
  );
}

class AuditEntries extends StatelessWidget {
  final List<Activity> entries;
  const AuditEntries(this.entries, {super.key});
  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: Text(
            'Belum ada riwayat aktivitas stok untuk akun ini.',
            style: TextStyle(fontSize: 12, color: muted),
          ),
        ),
      );
    }
    return Column(
      children: [
        for (var i = 0; i < entries.length; i++)
          _ActivityCard(activity: entries[i], isLast: i == entries.length - 1),
      ],
    );
  }
}
