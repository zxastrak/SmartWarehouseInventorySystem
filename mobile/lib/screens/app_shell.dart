import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../core/app_theme.dart';
import '../widgets/ui.dart';
import 'dashboard_screen.dart';
import 'stock_screen.dart';
import 'scanner_screen.dart';
import 'alerts_screen.dart';
import 'profile_screen.dart';
import 'activity_screen.dart';
import 'orders_screen.dart';
import 'insight_screen.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final body = switch (s.page) {
      0 => const DashboardScreen(),
      1 => const StockScreen(),
      2 => const ScannerScreen(),
      3 => const AlertsScreen(),
      4 => const ActivityScreen(audit: true),
      5 => const ActivityScreen(),
      6 => const InsightScreen(),
      7 => const OrdersScreen(),
      8 => const ProfileScreen(),
      _ => const DashboardScreen(),
    };
    final bottomIndex = s.page <= 4 ? s.page : 0;
    final screens = <(String, IconData, int)>[
      ('Dashboard', Icons.dashboard_outlined, 0),
      ('Inbound / Outbound', Icons.swap_vert, 5),
      ('AI Insight', Icons.auto_awesome_outlined, 6),
      ('Purchase Orders', Icons.shopping_cart_outlined, 7),
      ('Audit Trail', Icons.history, 4),
      ('Stock Monitoring', Icons.inventory_2_outlined, 1),
      ('Settings', Icons.settings_outlined, 8),
    ];
    return Scaffold(
      drawer: Drawer(
        backgroundColor: Colors.white,
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
                child: Row(
                  children: [
                    Image.asset('assets/images/susuno_wordmark.png', width: 98),
                    const Brand(),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  s.staff.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 3, 20, 20),
                child: Text(
                  'Warehouse Staff',
                  style: TextStyle(fontSize: 11, color: muted),
                ),
              ),
              Expanded(
                child: ListView(
                  children:
                      screens
                          .map(
                            (menu) => ListTile(
                              leading: Icon(menu.$2, size: 20),
                              title: Text(
                                menu.$1,
                                style: const TextStyle(fontSize: 13),
                              ),
                              selected: s.page == menu.$3,
                              selectedTileColor: const Color(0xffd3e8cc),
                              onTap: () {
                                Navigator.pop(context);
                                s.navigate(menu.$3);
                              },
                            ),
                          )
                          .toList(),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Staff Profile'),
                onTap: () {
                  Navigator.pop(context);
                  s.navigate(8);
                },
              ),
            ],
          ),
        ),
      ),
      body: CustomScrollView(
        key: ValueKey(s.page),
        slivers: [
          SliverAppBar(
            pinned: true,
            toolbarHeight: 48,
            automaticallyImplyLeading: false,
            leadingWidth: 56,
            leading: Builder(
              builder:
                  (headerContext) => CartonMenu(
                    onTap: () => Scaffold.of(headerContext).openDrawer(),
                  ),
            ),
            backgroundColor: const Color(0xff5c732b),
            foregroundColor: Colors.white,
            centerTitle: true,
            title: const Text(
              'SUSUNO',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            actions: [
              IconButton(
                onPressed: () => s.navigate(8),
                icon: const Icon(Icons.account_circle_outlined),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 24),
                  child: body,
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          height: 54,
          decoration: const BoxDecoration(
            color: Color(0xfff8f9fa),
            border: Border(top: BorderSide(color: Color(0xffe7e8e6), width: 5)),
          ),
          child: Row(
            children: List.generate(5, (index) {
              const labels = ['Dashboard', 'Stock', '', 'Alerts', 'Audit'];
              const icons = [
                Icons.dashboard_outlined,
                Icons.inventory_2_outlined,
                Icons.qr_code_scanner,
                Icons.notifications_none_outlined,
                Icons.history,
              ];
              final selected = s.page <= 4 && bottomIndex == index;
              return Expanded(
                child: InkWell(
                  onTap: () => s.navigate(index),
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      if (index == 2)
                        Positioned(
                          top: -17,
                          child: Container(
                            width: 51,
                            height: 51,
                            decoration: const BoxDecoration(
                              color: olive,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.qr_code_scanner,
                              size: 31,
                              color: Colors.white,
                            ),
                          ),
                        )
                      else
                        Container(
                          margin: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 5,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 3,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: selected ? olive : Colors.transparent,
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  if (index == 1)
                                    CubeIcon(
                                      size: 21,
                                      color: selected ? Colors.white : ink,
                                    )
                                  else
                                    Icon(
                                      icons[index],
                                      size: 22,
                                      color: selected ? Colors.white : ink,
                                    ),
                                  if (index == 3 &&
                                      s.alerts.any((a) => !a.read))
                                    Positioned(
                                      right: 1,
                                      top: 1,
                                      child: Container(
                                        width: 5,
                                        height: 5,
                                        decoration: const BoxDecoration(
                                          color: Color(0xffb88585),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              Text(
                                labels[index],
                                style: TextStyle(
                                  fontSize: 7,
                                  letterSpacing: .5,
                                  color: selected ? Colors.white : ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
