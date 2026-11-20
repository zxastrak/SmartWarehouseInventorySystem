// Stub implementation for platforms that do not have dart:html (e.g. Android/iOS)
bool get isBrowserOnline => true;

Stream<bool> get onBrowserConnectivityChanged => const Stream.empty();
