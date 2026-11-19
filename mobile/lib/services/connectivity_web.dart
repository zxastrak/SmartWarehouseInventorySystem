// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter
import 'dart:async';
import 'dart:html' as html;

/// Reads the native browser navigator.onLine property on Web.
/// Immediately detects Wi-Fi disconnected or DevTools Offline throttling.
bool get isBrowserOnline => html.window.navigator.onLine ?? true;

/// Stream that fires in real-time when the browser detects online/offline event.
Stream<bool> get onBrowserConnectivityChanged {
  late StreamController<bool> controller;
  StreamSubscription? onSub;
  StreamSubscription? offSub;

  controller = StreamController<bool>.broadcast(
    onListen: () {
      onSub = html.window.onOnline.listen((_) {
        if (!controller.isClosed) controller.add(true);
      });
      offSub = html.window.onOffline.listen((_) {
        if (!controller.isClosed) controller.add(false);
      });
    },
    onCancel: () {
      onSub?.cancel();
      offSub?.cancel();
    },
  );

  return controller.stream;
}
