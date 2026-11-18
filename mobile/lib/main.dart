import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'state/warehouse_state.dart';
import 'core/app_theme.dart';
import 'screens/login_screen.dart';
import 'screens/app_shell.dart';
import 'screens/splash_screen.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService().init();

  // Mode Immersive Sticky: Navigasi bawaan HP (Back, Home, Tab) otomatis tersembunyi,
  // hanya muncul melayang saat pengguna menggesek layar ke atas (swipe up).
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
  );
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  runApp(
    ChangeNotifierProvider(
      create: (_) => WarehouseState(),
      child: const SusunoApp(),
    ),
  );
}

class SusunoApp extends StatefulWidget {
  const SusunoApp({super.key});

  @override
  State<SusunoApp> createState() => _SusunoAppState();
}

class _SusunoAppState extends State<SusunoApp> {
  bool _splashFinished = false;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    return MaterialApp(
      title: 'SUSUNO',
      debugShowCheckedModeBanner: false,
      theme: appTheme(s.staff.highContrast),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 600),
        switchInCurve: Curves.easeInOut,
        switchOutCurve: Curves.easeInOut,
        child: !_splashFinished
            ? SplashScreen(
                key: const ValueKey('splash_screen'),
                onFinish: () {
                  setState(() {
                    _splashFinished = true;
                  });
                },
              )
            : (s.loggedIn
                ? const AppShell(key: ValueKey('app_shell'))
                : const LoginScreen(key: ValueKey('login_screen'))),
      ),
    );
  }
}
