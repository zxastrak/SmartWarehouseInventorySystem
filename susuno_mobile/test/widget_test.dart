import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:susuno_mobile/main.dart';
import 'package:susuno_mobile/state/warehouse_state.dart';

void main() {
  testWidgets(
    'Application opens on login, then shows read-only dashboard after login',
    (tester) async {
      final state = WarehouseState();
      await tester.pumpWidget(
        ChangeNotifierProvider.value(value: state, child: const SusunoApp()),
      );
      expect(find.text('Welcome!'), findsOneWidget);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'tabinanaila@staff.co.id',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'Susuno123!');
      final signIn = find.widgetWithText(FilledButton, 'Sign In');
      await tester.ensureVisible(signIn);
      await tester.tap(signIn);
      await tester.pumpAndSettle();
      expect(find.text('Real-time Inventory Telemetry'), findsOneWidget);
      expect(find.text('Welcome!'), findsNothing);
      state.logout();
      await tester.pumpAndSettle();
      expect(find.text('Welcome!'), findsOneWidget);
    },
  );
}
