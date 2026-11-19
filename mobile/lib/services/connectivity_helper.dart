import 'connectivity_stub.dart'
    if (dart.library.html) 'connectivity_web.dart';

/// Cross-platform browser online check.
/// On Web, reflects window.navigator.onLine.
/// On Native platforms, defaults to true and relies on socket / network ping.
bool checkBrowserOnline() => isBrowserOnline;

/// Real-time stream of connectivity state changes (supported on Web).
Stream<bool> get browserConnectivityStream => onBrowserConnectivityChanged;
