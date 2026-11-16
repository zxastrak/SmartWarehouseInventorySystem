import 'dart:js_interop';

@JS('eval')
external JSAny? _eval(String code);

void stopWebMediaTracks() {
  try {
    _eval(r'''
      (function() {
        document.querySelectorAll('video').forEach(function(v) {
          if (v && v.srcObject && v.srcObject.getTracks) {
            v.srcObject.getTracks().forEach(function(t) {
              try { t.stop(); } catch(e) {}
            });
            v.srcObject = null;
          }
        });
      })();
    ''');
  } catch (_) {}
}
