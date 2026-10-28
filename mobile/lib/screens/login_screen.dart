import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../core/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignIn() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await context.read<WarehouseState>().login(
      _emailController.text,
      _passwordController.text,
    );

    if (!mounted) return;
    setState(() {
      _isLoading = false;
      if (result != null) {
        _errorMessage = result;
      }
    });
  }

  Future<void> _showForgotPasswordDialog() async {
    final resetEmailCtrl = TextEditingController(text: _emailController.text);
    final resetPassCtrl = TextEditingController();
    bool isResetting = false;
    String? resetError;
    String? resetSuccess;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 24,
              bottom: MediaQuery.viewInsetsOf(ctx).bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xffcbd5e1),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: brandSoft,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: brandSoftBorder),
                        ),
                        child: const Icon(
                          Icons.lock_reset,
                          color: brand,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Reset Password Staf',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: brandInk,
                              ),
                            ),
                            Text(
                              'POST /api/auth/reset-password',
                              style: TextStyle(
                                fontSize: 11,
                                color: Color(0xff64748b),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Color(0xff94a3b8)),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Masukkan email staf Anda dan kata sandi baru (minimal 8 karakter).',
                    style: TextStyle(
                      fontSize: 12,
                      color: brandSlate,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: resetEmailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Email staf terdaftar',
                      prefixIcon: const Icon(Icons.mail_outline, size: 18),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xffcbd5e1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xffcbd5e1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(
                          color: brand,
                          width: 1.6,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: resetPassCtrl,
                    obscureText: true,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Password baru (min. 8 karakter)',
                      prefixIcon: const Icon(Icons.lock_outline, size: 18),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xffcbd5e1)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(color: Color(0xffcbd5e1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: const BorderSide(
                          color: brand,
                          width: 1.6,
                        ),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 14,
                      ),
                    ),
                  ),
                  if (resetError != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xfffef2f2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xfffecaca)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline,
                            color: danger,
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              resetError!,
                              style: const TextStyle(
                                color: danger,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (resetSuccess != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xfff0fdf4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xffbbf7d0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.check_circle_outline,
                            color: forest,
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              resetSuccess!,
                              style: const TextStyle(
                                color: forest,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: brand,
                        shape: const StadiumBorder(),
                      ),
                      onPressed: isResetting
                          ? null
                          : () async {
                              final emailVal = resetEmailCtrl.text.trim();
                              final passVal = resetPassCtrl.text;
                              if (!emailVal.contains('@')) {
                                setModalState(
                                  () => resetError =
                                      'Masukkan alamat email yang valid.',
                                );
                                return;
                              }
                              if (passVal.length < 8) {
                                setModalState(
                                  () => resetError =
                                      'Password baru minimal 8 karakter.',
                                );
                                return;
                              }
                              setModalState(() {
                                isResetting = true;
                                resetError = null;
                                resetSuccess = null;
                              });

                              final api = context.read<WarehouseState>().api;
                              final res = await api.resetPassword(
                                email: emailVal,
                                newPassword: passVal,
                              );

                              setModalState(() {
                                isResetting = false;
                                if (res['success'] == true) {
                                  resetSuccess =
                                      res['message'] ??
                                      'Password berhasil diperbarui!';
                                  _passwordController.text = passVal;
                                  _emailController.text = emailVal;
                                } else {
                                  resetError =
                                      res['message'] ??
                                      'Gagal memperbarui password.';
                                }
                              });
                            },
                      child: isResetting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Simpan Password Baru',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // FASE 1: layout berlapis (Stack)
  //   Layer 1: gradien hero (belakang)
  //   Layer 2: branding
  //   Layer 3: sheet putih, selalu sampai dasar layar
  //   Karakter: di antara branding dan sheet, bagian bawahnya tertutup sheet
  // ---------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final topPad = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    // Tinggi hero = 40% layar. Saat keyboard muncul, hero dikecilkan
    // supaya form punya ruang.
    final heroHeight = size.height * 0.40;
    final sheetTop = keyboardOpen ? topPad + 72.0 : heroHeight;
    // Gambar karakter persegi. visibleFraction = berapa bagian gambar (dari
    // atas) yang kelihatan di atas sheet. 0.60 = kepala sampai sekitar pinggang.
    final characterSize = heroHeight * 1.34;
    const visibleFraction = 0.60;

    return Scaffold(
      backgroundColor: brandGradientEnd,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // LAYER 1: gradien diagonal
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: heroHeight + 40,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [brandGradientStart, brandGradientEnd],
                ),
              ),
            ),
          ),

          // LAYER 2: branding kiri atas
          Positioned(
            top: topPad + 16,
            left: 20,
            right: 20,
            child: const _Branding(),
          ),

          // LAYER 2.5: karakter di BELAKANG sheet, jadi bagian bawah badan
          // tertutup sheet putih (efek "setengah badan" seperti mockup).
          Positioned(
            left: size.width * 0.74 - characterSize * 0.47,
            top: heroHeight - characterSize * visibleFraction,
            width: characterSize,
            height: characterSize,
            child: IgnorePointer(
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 200),
                opacity: keyboardOpen ? 0 : 1,
                child: Image.asset(
                  'assets/images/warehouse_staff.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
          ),

          // LAYER 3: sheet putih sampai dasar layar
          AnimatedPositioned(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            top: sheetTop,
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x14000000),
                    blurRadius: 18,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(24, 28, 24, 24 + bottomPad),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 500),
                    child: _buildForm(),
                  ),
                ),
              ),
            ),
          ),

        ],
      ),
    );
  }

  // Isi form: dipindah apa adanya dari build lama.
  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Greeting title from mockup
          const Text(
            'Selamat Datang, Staf',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.4,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 22),

          // Input 1: Email
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(
              fontSize: 14,
              color: brandInk,
              fontWeight: FontWeight.w500,
            ),
            autofillHints: const [AutofillHints.username],
            decoration: InputDecoration(
              hintText: 'Email',
              hintStyle: const TextStyle(
                color: Color(0xff64748b),
                fontSize: 14,
              ),
              prefixIcon: const Icon(
                Icons.mail_outline,
                size: 20,
                color: Color(0xff334155),
              ),
              filled: true,
              fillColor: const Color(0xfff8fafc),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 16,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: Color(0xff334155),
                  width: 1.2,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: Color(0xff334155),
                  width: 1.2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: brand,
                  width: 1.8,
                ),
              ),
            ),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'Email wajib diisi.';
              }
              if (!val.contains('@')) {
                return 'Format email tidak valid.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Input 2: Password
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: const TextStyle(
              fontSize: 14,
              color: brandInk,
              fontWeight: FontWeight.w500,
            ),
            autofillHints: const [AutofillHints.password],
            decoration: InputDecoration(
              hintText: 'Password',
              hintStyle: const TextStyle(
                color: Color(0xff64748b),
                fontSize: 14,
              ),
              prefixIcon: const Icon(
                Icons.lock_outline,
                size: 20,
                color: Color(0xff334155),
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: const Color(0xff64748b),
                ),
                onPressed: () => setState(
                  () => _obscurePassword = !_obscurePassword,
                ),
              ),
              filled: true,
              fillColor: const Color(0xfff8fafc),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 16,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: Color(0xff334155),
                  width: 1.2,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: Color(0xff334155),
                  width: 1.2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(28),
                borderSide: const BorderSide(
                  color: brand,
                  width: 1.8,
                ),
              ),
            ),
            onFieldSubmitted: (_) => _handleSignIn(),
            validator: (val) {
              if (val == null || val.isEmpty) {
                return 'Password wajib diisi.';
              }
              return null;
            },
          ),

          // Error message if any
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: const Color(0xfffef2f2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xfffecaca)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: danger, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Forgot Password Link
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _showForgotPasswordDialog,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  vertical: 8,
                  horizontal: 4,
                ),
              ),
              child: const Text(
                'Forgot Password?',
                style: TextStyle(
                  color: brandSlate,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Primary Action: Sign In Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: brand,
                shape: const StadiumBorder(),
                elevation: 2,
                shadowColor: brand.withAlpha(100),
              ),
              onPressed: _isLoading ? null : _handleSignIn,
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Sign In',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.3,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// Logo + nama aplikasi (dipindah dari build lama tanpa perubahan isi).
class _Branding extends StatelessWidget {
  const _Branding();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(90),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(
            Icons.warehouse_outlined,
            size: 28,
            color: brandHeroInk,
          ),
        ),
        const SizedBox(width: 10),
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'SUSUNO',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.6,
                color: brandHeroInk,
              ),
            ),
            Text(
              'Warehouse & Inventory System',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: brandHeroSub,
              ),
            ),
          ],
        ),
      ],
    );
  }
}