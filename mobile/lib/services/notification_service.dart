import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Service untuk menampilkan notifikasi asli sistem Android (Status Bar & Heads-Up Notification)
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;

  /// Inisialisasi service dan channel notifikasi Android
  Future<void> init() async {
    if (_isInitialized) return;

    // Inisialisasi ikon notifikasi Android (menggunakan icon aplikasi resmi Susuno)
    const androidInitSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    // Inisialisasi iOS / macOS
    const darwinInitSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidInitSettings,
      iOS: darwinInitSettings,
      macOS: darwinInitSettings,
    );

    try {
      await _notificationsPlugin.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('SUSUNO: Notifikasi diklik: ${response.payload}');
        },
      );

      // Meminta izin resmi POST_NOTIFICATIONS pada Android 13+
      if (!kIsWeb && Platform.isAndroid) {
        final androidImpl = _notificationsPlugin
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>();
        if (androidImpl != null) {
          await androidImpl.requestNotificationsPermission();
        }
      }

      _isInitialized = true;
      debugPrint('SUSUNO: NotificationService berhasil diinisialisasi.');
    } catch (e) {
      debugPrint('SUSUNO: NotificationService init error: $e');
    }
  }

  /// Menembakkan notifikasi asli ke Status Bar Android
  Future<void> showTaskNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (kIsWeb) return;

    try {
      if (!_isInitialized) {
        await init();
      }

      const androidDetails = AndroidNotificationDetails(
        'susuno_tasks_channel',
        'Tugas Gudang Susuno',
        channelDescription:
            'Notifikasi tugas dan instruksi baru dari manajer gudang',
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        enableVibration: true,
        playSound: true,
        icon: '@mipmap/ic_launcher',
      );

      const darwinDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: darwinDetails,
        macOS: darwinDetails,
      );

      await _notificationsPlugin.show(
        id: id,
        title: title,
        body: body,
        notificationDetails: notificationDetails,
        payload: payload,
      );
      debugPrint('SUSUNO: Notifikasi status bar Android terkirim: $title');
    } catch (e) {
      debugPrint('SUSUNO: Gagal menembakkan notifikasi Android: $e');
    }
  }
}
