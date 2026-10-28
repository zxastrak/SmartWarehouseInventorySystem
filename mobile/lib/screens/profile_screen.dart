import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../state/warehouse_state.dart';
import '../widgets/ui.dart';
import '../widgets/warehouse_sections.dart';
import '../core/app_theme.dart';
import 'stock_flows.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool night = false;
  Future<void> changePin() async {
    final pin = TextEditingController();
    String? error;
    await showDialog<void>(
      context: context,
      builder:
          (c) => StatefulBuilder(
            builder:
                (c, update) => AlertDialog(
                  title: const Text('Fast-Sign PIN'),
                  content: TextField(
                    controller: pin,
                    obscureText: true,
                    maxLength: 4,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'New 4-digit PIN',
                      errorText: error,
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(c),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      onPressed: () {
                        if (!RegExp(r'^\d{4}$').hasMatch(pin.text)) {
                          update(() => error = 'Use exactly 4 digits.');
                          return;
                        }
                        Navigator.pop(c);
                        message(
                          context,
                          'PIN format accepted for the UI preview.',
                        );
                      },
                      child: const Text('Save'),
                    ),
                  ],
                ),
          ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 250));
    pin.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final p = s.staff;
    Widget toggle(
      String title,
      String subtitle,
      String key,
      bool value,
      IconData icon,
    ) => Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: brandSoft,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, size: 18, color: brand),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: brandInk,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                  color: muted,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Switch(value: value, onChanged: (v) => s.setting(key, v)),
      ],
    );
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [brandGradientStart, brandGradientEnd],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: brandCardShadow,
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
                        color: brand,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                            color: brandHeroInk,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          p.role.toUpperCase() == 'STAF'
                              ? 'Warehouse Operations Staff'
                              : 'Warehouse ${p.role}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: brandHeroSub,
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
                      'Current Shift',
                      s.currentShift,
                      Icons.schedule,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _ShiftCard(
                      'Hardware Link',
                      'Zebra TC57 RH #12',
                      Icons.phone_android_outlined,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeading(
                'Personal Identity',
                '',
                Icons.badge_outlined,
                trailing: TextButton(
                  onPressed: () => flowSheet(context, const EditProfile()),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.edit_outlined, size: 14),
                      SizedBox(width: 4),
                      Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              field('Full Name', p.name, editable: true),
              field('Internal Staff Email', p.email),
              field('Phone Number', p.phone, editable: true),
              field('Employee Master Badge ID', p.badge),
              field('Emergency On-Call Contact', p.emergency, editable: true),
              const Text(
                'Tap the pencil to edit. Staff email and badge are managed by your manager.',
                style: TextStyle(fontSize: 11, color: muted),
              ),
            ],
          ),
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeading(
                'Shift & Sector Profile',
                '',
                Icons.engineering_outlined,
                trailing: Tag('Tier-2 Certified'),
              ),
              const Text(
                'Assigned Primary Section',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: brandSlate,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xfff8fafc),
                  border: Border.all(color: line),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: brand,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Text(
                        'A',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Zone A: Mechanical & Heavy Bearings',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: brandInk,
                              height: 1.25,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'High Bay Rack 01 - 10 • Automated Shuttle Node',
                            style: TextStyle(
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
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: brandSoft,
                  border: Border.all(color: brandSoftBorder),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.fact_check_outlined, size: 28, color: brand),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Tag('ACTIVE'),
                          SizedBox(height: 6),
                          Text(
                            'Forklift & Telehandler (Class IV & V)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: brandInk,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'Certified • Valid through Nov 2027',
                            style: TextStyle(
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
              ),
            ],
          ),
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeading(
                'Absensi & Jam Kerja Staf',
                'Riwayat clock-in dan clock-out shift',
                Icons.access_time_outlined,
                trailing: Tag(
                  s.isCheckedIn ? 'ACTIVE SHIFT' : 'OFF DUTY',
                  color: s.isCheckedIn ? forest : amber,
                  solid: true,
                ),
              ),
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
                        Tag(isCheckIn ? 'IN' : 'OUT', color: c),
                      ],
                    ),
                  );
                }),
              const SizedBox(height: 4),
              SizedBox(
                width: double.infinity,
                child:
                    s.isCheckedIn
                        ? OutlinedButton.icon(
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
                          icon: const Icon(Icons.logout, size: 18),
                          label: const Text('Check-out Sekarang'),
                        )
                        : FilledButton.icon(
                          onPressed: () async {
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
                          },
                          icon: const Icon(Icons.login, size: 18),
                          label: const Text('Check-in Sekarang'),
                        ),
              ),
            ],
          ),
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeading(
                'Terminal Hardware Tuning',
                '',
                Icons.tune,
                trailing: Tag('RH - 12 Profile', color: muted),
              ),
              toggle(
                'Barcode Haptic Pulse',
                'Vibration feedback on successful SKU barcode read',
                'haptics',
                p.haptics,
                Icons.vibration,
              ),
              const SizedBox(height: 14),
              toggle(
                'Laser Acoustic Tone',
                'High-pitch tone for noisy industrial environments',
                'acoustic',
                p.localAcoustic,
                Icons.volume_up_outlined,
              ),
              const SizedBox(height: 18),
              const Text(
                'Display Ergonomics',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: brandSlate,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xfff1f5f9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    for (final option in [false, true])
                      Expanded(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => setState(() => night = option),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color:
                                  night == option
                                      ? Colors.white
                                      : Colors.transparent,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow:
                                  night == option ? brandCardShadow : null,
                            ),
                            child: Text(
                              option
                                  ? '☾ Night Shift (Dark)'
                                  : '☀ Day Shift (Light)',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: night == option ? brand : muted,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              toggle(
                'High-Contrast Avionics HUD',
                'Maximizes typography sharpness under direct halogen lighting',
                'contrast',
                p.highContrast,
                Icons.contrast,
              ),
            ],
          ),
        ),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionHeading(
                'Terminal Security',
                '',
                Icons.shield_outlined,
                trailing: Tag('TLS 1.3 Pass'),
              ),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: brandSoft,
                  border: Border.all(color: brandSoftBorder),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Fast-Sign PIN',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: brandInk,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '● ● ● ●',
                            style: TextStyle(
                              fontSize: 14,
                              color: brandSlate,
                              letterSpacing: 2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 40),
                        backgroundColor: Colors.white,
                      ),
                      onPressed: changePin,
                      child: const Text('Change PIN'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              toggle(
                'Biometric Unlock',
                'Permit optical scanner instant unlock',
                'biometric',
                p.biometric,
                Icons.fingerprint,
              ),
              const SizedBox(height: 12),
              const Tag(
                '◷ Last authenticated: Today • Handheld RH - 12',
                color: muted,
              ),
            ],
          ),
        ),
        Panel(
          tint: const Color(0xfffff1f2),
          border: const Color(0xfffecdd3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.logout, size: 22, color: danger),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Terminal Session Hand-Off',
                      style: TextStyle(
                        color: danger,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Logging out relinquishes the current terminal session before handing over this device.',
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
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: danger),
                  onPressed: () async {
                    final yes = await showDialog<bool>(
                      context: context,
                      builder:
                          (c) => AlertDialog(
                            title: const Text('Log out?'),
                            content: const Text(
                              'You will return to the login page.',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(c, false),
                                child: const Text('Cancel'),
                              ),
                              FilledButton(
                                onPressed: () => Navigator.pop(c, true),
                                child: const Text('Log Out'),
                              ),
                            ],
                          ),
                    );
                    if (yes == true) {
                      s.logout();
                    }
                  },
                  icon: const Icon(Icons.power_settings_new, size: 18),
                  label: const Text('Log Out'),
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
      color: Colors.white.withAlpha(190),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: brand),
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

class EditProfile extends StatefulWidget {
  const EditProfile({super.key});
  @override
  State<EditProfile> createState() => _EditProfileState();
}

class _EditProfileState extends State<EditProfile> {
  final form = GlobalKey<FormState>();
  late TextEditingController name, phone, emergency;
  String? saveError;

  @override
  void initState() {
    super.initState();
    final staff = context.read<WarehouseState>().staff;
    name = TextEditingController(text: staff.name);
    phone = TextEditingController(text: staff.phone);
    emergency = TextEditingController(text: staff.emergency);
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    emergency.dispose();
    super.dispose();
  }

  String? validatePhone(String? value, {bool optional = false}) {
    final input = (value ?? '').trim();
    if (optional && input.isEmpty) {
      return null;
    }
    if (!RegExp(r'^\+?[0-9]{8,15}$').hasMatch(input)) {
      return 'Use 8–15 digits, optionally starting with +.';
    }
    return null;
  }

  void save() {
    if (!form.currentState!.validate()) {
      return;
    }
    final state = context.read<WarehouseState>();
    final error = state.updateStaff(name.text, phone.text, emergency.text);
    if (error != null) {
      setState(() => saveError = error);
      return;
    }
    FocusScope.of(context).unfocus();
    final messenger = ScaffoldMessenger.of(context);
    Navigator.pop(context);
    messenger.showSnackBar(
      const SnackBar(content: Text('Profile updated successfully.')),
    );
  }

  @override
  Widget build(BuildContext context) => FlowBody(
    title: 'Edit Staff Profile',
    subtitle: 'Update your personal contact information',
    children: [
      Form(
        key: form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Full Name',
                prefixIcon: Icon(Icons.person_outline),
              ),
              validator:
                  (value) =>
                      value == null || value.trim().isEmpty
                          ? 'Enter your full name.'
                          : null,
            ),
            const SizedBox(height: 15),
            TextFormField(
              controller: phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Phone Number',
                hintText: '081234567890',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              validator: (value) => validatePhone(value),
            ),
            const SizedBox(height: 15),
            TextFormField(
              controller: emergency,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              decoration: const InputDecoration(
                labelText: 'Emergency Contact',
                hintText: 'Optional contact number',
                prefixIcon: Icon(Icons.emergency_outlined),
              ),
              validator: (value) => validatePhone(value, optional: true),
              onFieldSubmitted: (_) => save(),
            ),
            const SizedBox(height: 14),
            const Text(
              'Internal staff email, badge ID, shift and warehouse assignments are managed by your manager.',
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
            FilledButton.icon(
              onPressed: save,
              icon: const Icon(Icons.save_outlined, size: 18),
              label: const Text('Save Profile'),
            ),
            const SizedBox(height: 7),
            OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    ],
  );
}
