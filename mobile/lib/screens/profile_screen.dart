import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../state/warehouse_state.dart';
import '../widgets/ui.dart';
import '../core/app_theme.dart';
import 'stock_flows.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final p = s.staff;
    final hasShift =
        s.currentShift.isNotEmpty && s.currentShift != 'Belum ada jadwal shift';

    Widget field(String label, String value, {bool editable = false}) =>
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: brandSlate,
                ),
              ),
              const SizedBox(height: 6),
              Material(
                color: const Color(0xfff8fafc),
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap:
                      editable
                          ? () => flowSheet(context, const EditProfile())
                          : null,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: line),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            value,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: brandInk,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          editable ? Icons.edit_outlined : Icons.lock_outline,
                          size: 16,
                          color: editable ? brand : muted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );

    final staffId =
        p.staffId.isNotEmpty
            ? p.staffId
            : (p.id != null ? 'STF-${p.id.toString().padLeft(3, '0')}' : '-');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Hero Card Profil
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: mint,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.white,
                    child: Text(
                      p.name
                          .split(RegExp(r'\s+'))
                          .where((n) => n.isNotEmpty)
                          .map((n) => n[0])
                          .take(2)
                          .join(),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: mint,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          p.role.toUpperCase() == 'STAF'
                              ? 'Staf Operasional Gudang'
                              : 'Warehouse ${p.role}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.5,
                            color: Colors.white.withAlpha(225),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _ShiftCard(
                      'Jadwal Shift',
                      s.currentShift,
                      Icons.schedule,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ShiftCard(
                      'ID Staf',
                      staffId,
                      Icons.badge_outlined,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Identitas Akun
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Identitas Akun',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                      color: brandInk,
                    ),
                  ),
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: () => flowSheet(context, const EditProfile()),
                    icon: const Icon(Icons.edit_outlined, size: 14),
                    label: const Text(
                      'Edit Profil',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              field('Nama Lengkap', p.name, editable: true),
              field('Email Staf', p.email),
              field('ID Staf', staffId),
              field('Peran / Role', p.role.toUpperCase()),
            ],
          ),
        ),

        // Absensi & Jam Kerja
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Absensi & Jam Kerja Staf',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                      color: brandInk,
                    ),
                  ),
                  Tag(
                    s.isCheckedIn
                        ? 'ACTIVE SHIFT'
                        : (!hasShift ? 'NO SHIFT' : 'OFF DUTY'),
                    color: s.isCheckedIn
                        ? forest
                        : (!hasShift ? muted : amber),
                    solid: true,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (s.attendances.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: Text(
                      'Belum ada catatan absensi untuk akun staf ini.',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: muted,
                      ),
                    ),
                  ),
                )
              else
                ...s.attendances.take(5).map((log) {
                  final isCheckIn = log['type'] == 'check_in';
                  DateTime? dt;
                  if (log['scan_time'] != null) {
                    dt =
                        DateTime.tryParse(
                          log['scan_time'].toString(),
                        )?.toLocal();
                  }
                  final timeStr =
                      dt != null
                          ? '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} ${clock(dt)}'
                          : 'Waktu tidak tersedia';
                  final c = isCheckIn ? forest : danger;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xfff8fafc),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xffeef2f6)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: c.withAlpha(25),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isCheckIn ? Icons.login : Icons.logout,
                            size: 16,
                            color: c,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isCheckIn
                                    ? 'Check-in Masuk'
                                    : 'Check-out Pulang',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: brandInk,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                timeStr,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              const SizedBox(height: 4),
              SizedBox(
                width: double.infinity,
                child:
                    s.isCheckedIn
                        ? OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: danger,
                            side: const BorderSide(color: danger, width: 1.5),
                          ),
                          onPressed: () async {
                            final err = await s.checkOut();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    err ?? 'Check-out berhasil dicatat',
                                  ),
                                  backgroundColor:
                                      err != null ? danger : forest,
                                ),
                              );
                            }
                          },
                          child: const Text('Check-out Sekarang'),
                        )
                        : FilledButton(
                          style: FilledButton.styleFrom(
                            disabledBackgroundColor: const Color(0xffe2e8f0),
                            disabledForegroundColor: const Color(0xff94a3b8),
                          ),
                          onPressed: hasShift
                              ? () async {
                                  final err = await s.checkIn();
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          err ?? 'Check-in berhasil dicatat',
                                        ),
                                        backgroundColor:
                                            err != null ? danger : forest,
                                      ),
                                    );
                                  }
                                }
                              : null,
                          child: Text(
                            hasShift
                                ? 'Check-in Sekarang'
                                : 'Belum Ada Jadwal Shift',
                          ),
                        ),
              ),
            ],
          ),
        ),

        // Keluar Akun
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Keluar dari Aplikasi',
                style: TextStyle(
                  color: brandInk,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Mengakhiri sesi akun staf pada perangkat ini.',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: brandSlate,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: danger),
                  onPressed: () async {
                    final yes = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      useRootNavigator: true,
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      barrierColor: const Color(0x88000000),
                      builder: (c) => const _LogoutConfirmSheet(),
                    );
                    if (yes == true) {
                      s.logout();
                    }
                  },
                  child: const Text('Keluar'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ShiftCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  const _ShiftCard(this.title, this.value, this.icon);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: mint),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: brandSlate,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: brandInk,
          ),
        ),
      ],
    ),
  );
}

class _LogoutConfirmSheet extends StatelessWidget {
  const _LogoutConfirmSheet();

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.topCenter,
          children: [
            // 1. Karakter Staf 3D di belakang box putih, menyembul keluar ke atas
            Positioned(
              top: 0,
              child: IgnorePointer(
                child: SizedBox(
                  width: 270,
                  height: 270,
                  child: Image.asset(
                    'assets/images/logout_staff.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),

            // 2. Box Putih Konten Modal
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(top: 150),
              padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottomInset),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x1a000000),
                    blurRadius: 24,
                    offset: Offset(0, -6),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
                  Container(
                    width: 38,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: const Color(0xffcbd5e1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const Text(
                    'Yakin Ingin Keluar?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                      color: brandInk,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: brandSlate,
                              side: const BorderSide(
                                color: Color(0xffcbd5e1),
                                width: 1.3,
                              ),
                              shape: const StadiumBorder(),
                            ),
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text(
                              'Batal',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: danger,
                              foregroundColor: Colors.white,
                              shape: const StadiumBorder(),
                            ),
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text(
                              'Ya, Keluar',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
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
      ),
    );
  }
}

class EditProfile extends StatefulWidget {
  const EditProfile({super.key});
  @override
  State<EditProfile> createState() => _EditProfileState();
}

class _EditProfileState extends State<EditProfile> {
  final form = GlobalKey<FormState>();
  late TextEditingController name;
  String? saveError;

  @override
  void initState() {
    super.initState();
    final staff = context.read<WarehouseState>().staff;
    name = TextEditingController(text: staff.name);
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  void save() {
    if (!form.currentState!.validate()) {
      return;
    }
    final state = context.read<WarehouseState>();
    final error = state.updateStaff(name.text);
    if (error != null) {
      setState(() => saveError = error);
      return;
    }
    FocusScope.of(context).unfocus();
    final messenger = ScaffoldMessenger.of(context);
    Navigator.pop(context);
    messenger.showSnackBar(
      const SnackBar(content: Text('Profil berhasil diperbarui.')),
    );
  }

  @override
  Widget build(BuildContext context) => FlowBody(
    title: 'Edit Profil Staf',
    subtitle: 'Perbarui nama staf Anda',
    children: [
      Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                labelText: 'Nama Lengkap',
                prefixIcon: Icon(Icons.person_outline),
              ),
              validator:
                  (value) =>
                      value == null || value.trim().isEmpty
                          ? 'Masukkan nama lengkap.'
                          : null,
              onFieldSubmitted: (_) => save(),
            ),
            const SizedBox(height: 14),
            const Text(
              'Email staf, ID staf, dan jadwal shift dikelola langsung oleh manajer gudang.',
              style: TextStyle(fontSize: 12, color: muted, height: 1.4),
            ),
            if (saveError != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  saveError!,
                  style: const TextStyle(
                    color: danger,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            const SizedBox(height: 22),
            FilledButton(
              onPressed: save,
              child: const Text('Simpan Profil'),
            ),
            const SizedBox(height: 7),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Batal'),
            ),
          ],
        ),
      ),
    ],
  );
}
