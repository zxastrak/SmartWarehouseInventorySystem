import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/warehouse_state.dart';
import 'core/app_theme.dart';
import 'screens/login_screen.dart';
import 'screens/app_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => WarehouseState(),
      child: const SusunoApp(),
    ),
  );
}

class SusunoApp extends StatelessWidget {
  const SusunoApp({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    return MaterialApp(
      title: 'SUSUNO Staff',
      debugShowCheckedModeBanner: false,
      theme: appTheme(s.staff.highContrast),
      home: s.loggedIn ? const AppShell() : const LoginScreen(),
    );
  }
}
