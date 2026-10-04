import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../widgets/ui.dart';
import '../core/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(), password = TextEditingController();
  bool hidden = true;
  String? error;
  void signIn() {
    if (!form.currentState!.validate()) {
      return;
    }
    final result = context.read<WarehouseState>().login(
      email.text,
      password.text,
    );
    if (result != null) {
      setState(() => error = result);
    }
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xfff8f9fa),
    appBar: AppBar(
      toolbarHeight: 56,
      title: const Text('SUSUNO'),
      leading: IconButton(
        onPressed:
            () => message(
              context,
              'Contact your manager for sign-in assistance.',
            ),
        icon: const Icon(Icons.help_outline, size: 21),
      ),
      actions: [
        IconButton(
          onPressed: () => message(context, 'Language: English'),
          icon: const Icon(Icons.language, size: 21),
        ),
      ],
    ),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 394),
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          children: [
            const SizedBox(height: 28),
            const Brand(large: true),
            const SizedBox(height: 34),
            const Text(
              'Welcome!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 28,
                color: Color(0xff202726),
              ),
            ),
            const SizedBox(height: 7),
            const Text(
              'Sign in to access your shift workspace',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xff808780), fontSize: 12),
            ),
            const SizedBox(height: 34),
            Container(
              padding: const EdgeInsets.fromLTRB(24, 25, 24, 24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'EMAIL',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xff4d554c),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: email,
                      style: const TextStyle(fontSize: 12),
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.username],
                      decoration: const InputDecoration(
                        hintText: 'Enter your staff email',
                        prefixIcon: Icon(
                          Icons.badge_outlined,
                          size: 18,
                          color: Color(0xff808780),
                        ),
                      ),
                      validator:
                          (s) =>
                              s == null || !s.contains('@')
                                  ? 'Enter a valid email.'
                                  : null,
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'PASSWORD',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xff4d554c),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: password,
                      style: const TextStyle(fontSize: 12),
                      obscureText: hidden,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        hintText: 'Enter your password',
                        prefixIcon: const Icon(
                          Icons.lock_outline,
                          size: 18,
                          color: Color(0xff808780),
                        ),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => hidden = !hidden),
                          icon: Icon(
                            hidden
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 19,
                            color: const Color(0xff808780),
                          ),
                        ),
                      ),
                      onFieldSubmitted: (_) => signIn(),
                      validator:
                          (s) =>
                              s == null || s.isEmpty
                                  ? 'Enter your password.'
                                  : null,
                    ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: Colors.red,
                              size: 13,
                            ),
                            const SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                error!,
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed:
                            () => showDialog<void>(
                              context: context,
                              builder:
                                  (c) => AlertDialog(
                                    title: const Text('Password assistance'),
                                    content: const Text(
                                      'Demo password: Susuno123!\nContact your manager for account recovery.',
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(c),
                                        child: const Text('Close'),
                                      ),
                                    ],
                                  ),
                            ),
                        child: const Text('Forgot Password?'),
                      ),
                    ),
                    const SizedBox(height: 17),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(11),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x305a7129),
                            blurRadius: 9,
                            offset: Offset(0, 5),
                          ),
                        ],
                      ),
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onPressed: signIn,
                        child: const Text(
                          'Sign In',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 23),
                    const Row(
                      children: [
                        Expanded(child: Divider(color: line)),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 13),
                          child: Text(
                            'OR',
                            style: TextStyle(fontSize: 10, color: muted),
                          ),
                        ),
                        Expanded(child: Divider(color: line)),
                      ],
                    ),
                    const SizedBox(height: 19),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 45),
                        ),
                        onPressed: () {
                          email.text =
                              context.read<WarehouseState>().staff.email;
                          message(
                            context,
                            'Staff email selected. Enter your password to sign in.',
                          );
                        },
                        icon: const Icon(Icons.qr_code_scanner, size: 18),
                        label: const Text(
                          'Quick Login with Staff Badge',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xff202726),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 37),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Need help signing in? ',
                  style: TextStyle(fontSize: 12, color: Color(0xff808780)),
                ),
                TextButton(
                  onPressed:
                      () => message(
                        context,
                        'Please contact your warehouse manager.',
                      ),
                  child: const Text(
                    'Contact Manager',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 25),
          ],
        ),
      ),
    ),
  );
}
