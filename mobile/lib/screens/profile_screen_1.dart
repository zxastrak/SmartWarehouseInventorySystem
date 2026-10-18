import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
        Icon(icon, size: 22, color: const Color(0xff546b46)),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 10,
                  color: Color(0xff7e8574),
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
        Transform.scale(
          scale: .75,
          child: Switch(value: value, onChanged: (v) => s.setting(key, v)),
        ),
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
                style: const TextStyle(fontSize: 11, color: Color(0xff637057)),
              ),
              const SizedBox(height: 5),
              Material(
                color: lavender,
                borderRadius: BorderRadius.circular(6),
                child: InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap:
                      editable
                          ? () => flowSheet(context, const EditProfile())
                          : null,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xffd7ddd7)),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            value,
                            style: const TextStyle(fontSize: 11, color: ink),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(
                          editable ? Icons.edit_outlined : Icons.lock_outline,
                          size: 14,
                          color: editable ? olive : muted,
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
        const PageTitle(
          'Staff Profile and Settings',
          'Staff Handheld • Austin - 01',
        ),
        Panel(
          tint: const Color(0xfff1f8ef),
          child: Column(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 25,
                    backgroundColor: olive,
                    child: Text(
                      p.name
                          .split(RegExp(r'\s+'))
                          .where((n) => n.isNotEmpty)
                          .map((n) => n[0])
                          .take(2)
                          .join(),
                      style: const TextStyle(fontSize: 16, color: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: const TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const Text(
                          'Warehouse Operations Specialist',
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0xff7e8574),
                            letterSpacing: .4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 17),
              Row(
                children: [
                  Expanded(
                    child: _ShiftCard(
                      'Current Shift',
                      'Alpha 07:00 - 18:00',
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
                style: TextStyle(fontSize: 9, color: muted),
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
                trailing: Text(
                  'Tier-2 Certified',
                  style: TextStyle(fontSize: 8, color: muted),
                ),
              ),
              const Text(
                'Assigned Primary Section',
                style: TextStyle(fontSize: 11, color: Color(0xff637057)),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: lavender,
                  border: Border.all(color: line),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 33,
                      height: 43,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: olive,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'A',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Zone A: Mechanical & Heavy\nBearings',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'High Bay Rack 01 - 10 • Automated Shuttle Node',
                            style: TextStyle(fontSize: 9, color: muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: const Color(0xfff1f8ef),
                  border: Border.all(color: line),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.fact_check_outlined, size: 30, color: olive),
                    SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Align(
                            alignment: Alignment.centerRight,
                            child: Tag('ACTIVE'),
                          ),
                          Text(
                            'Forklift & Telehandler (Class IV & V)',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Certified • Valid through Nov 2027',
                            style: TextStyle(fontSize: 10, color: muted),
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
              const SectionHeading(
                'Terminal Hardware Tuning',
                '',
                Icons.tune,
                trailing: Text(
                  'RH - 12 Profile',
                  style: TextStyle(fontSize: 8, color: muted),
                ),
              ),
              toggle(
                'Barcode Haptic Pulse',
                'Vibration feedback on successful SKU barcode read',
                'haptics',
                p.haptics,
                Icons.vibration,
              ),
              const SizedBox(height: 10),
              toggle(
                'Laser Acoustic Tone',
                'High-pitch tone for noisy industrial environments',
                'acoustic',
                p.localAcoustic,
                Icons.volume_up_outlined,
              ),
              const SizedBox(height: 17),
              const Text(
                'Display Ergonomics',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 7),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: lavender,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    for (final option in [false, true])
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => night = option),
                          child: Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color:
                                  night == option
                                      ? Colors.white
                                      : Colors.transparent,
                              borderRadius: BorderRadius.circular(5),
                            ),
                            child: Text(
                              option
                                  ? '☾ Night Shift (Dark)'
                                  : '☀ Day Shift (Light)',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 9, color: olive),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
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
                trailing: Text(
                  'TLS 1.3 Pass',
                  style: TextStyle(fontSize: 8, color: muted),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: lavender,
                  border: Border.all(color: const Color(0xff93b7ed)),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Fast-Sign PIN\n● ● ● ●',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    OutlinedButton(
                      onPressed: changePin,
                      child: const Text(
                        'Change\nPIN',
                        style: TextStyle(fontSize: 10),
                      ),
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
              const SizedBox(height: 10),
              const Tag(
                '◷ Last authenticated: Today • Handheld RH - 12',
                color: Color(0xff6b82b0),
              ),
            ],
          ),
        ),
        Panel(
          tint: const Color(0xfffff3f5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.logout, size: 24, color: Colors.red),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Terminal Session Hand-Off',
                      style: TextStyle(
                        color: Colors.red,
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Logging out relinquishes the current terminal session before handing over this device.',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xff67705f),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: Colors.red),
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
                  icon: const Icon(Icons.power_settings_new),
                  label: const Text('Log Out', style: TextStyle(fontSize: 15)),
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
    padding: const EdgeInsets.all(9),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xffbada92)),
      borderRadius: BorderRadius.circular(7),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 17, color: olive),
            const SizedBox(width: 3),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 11, color: muted),
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        Text('• $value', style: const TextStyle(fontSize: 9, color: olive)),
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
              style: TextStyle(fontSize: 10, color: muted, height: 1.4),
            ),
            if (saveError != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  saveError!,
                  style: const TextStyle(color: danger, fontSize: 11),
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
