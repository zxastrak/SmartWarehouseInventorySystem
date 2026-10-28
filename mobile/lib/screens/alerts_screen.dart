import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../state/warehouse_state.dart';
import 'stock_flows.dart';
import '../core/app_theme.dart';
import '../widgets/ui.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});
  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  int filter = 0;

  bool urgent(WarehouseAlert a) => a.badge.toUpperCase().contains('URGENT');

  void primary(WarehouseAlert alert) {
    final state = context.read<WarehouseState>();
    state.readAlert(alert.id);
    switch (alert.action) {
      case 'receiving':
        state.openScanner(alert.sku, mode: ScanMode.single);
        break;
      case 'putaway':
        state.openScanner(alert.sku, mode: ScanMode.putaway);
        break;
      case 'rack':
        openRack(context, alert.sku);
        break;
      default:
        showDetails(alert);
    }
  }

  void showDetails(WarehouseAlert alert) {
    final state = context.read<WarehouseState>();
    state.readAlert(alert.id);
    showDialog<void>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: Text(
              alert.action == 'receiving'
                  ? 'Bay Manifest'
                  : alert.action == 'putaway'
                  ? 'Route Map'
                  : 'Notification Details',
            ),
            content: Text(
              '${alert.title}\n\n${alert.message}\n\nSKU: ${alert.sku}',
              style: const TextStyle(color: brandInk, fontSize: 13),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Close'),
              ),
            ],
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<WarehouseState>();
    final unread = state.alerts.where((a) => !a.read).length;
    final alerts =
        state.alerts
            .where((a) => filter == 0 || (filter == 1 ? !a.read : urgent(a)))
            .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PageTitle(
          'Operational Alerts',
          'Floor Task Feed and Notifications',
          trailing: Tag('$unread Unread', color: danger, solid: true),
        ),
        Row(
          children: List.generate(3, (index) {
            final active = filter == index;
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: index == 2 ? 0 : 6),
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: active ? brand : Colors.white,
                    foregroundColor: active ? Colors.white : brandSlate,
                    side: BorderSide(color: active ? brand : line),
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                  ),
                  onPressed: () => setState(() => filter = index),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(
                          ['All Alerts', 'Unread', 'Urgent Tasks'][index],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if (index == 1) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: danger,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '$unread',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 14),

        const SizedBox(height: 15),
        if (alerts.isEmpty)
          const Panel(
            padding: EdgeInsets.all(24),
            child: Center(
              child: Text(
                'No notifications in this category.',
                style: TextStyle(
                  color: muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        for (final alert in alerts)
          _AlertCard(
            alert: alert,
            state: state,
            onPrimary: () => primary(alert),
            onSecondary: () {
              if (alert.action == 'rack') {
                state.readAlert(alert.id);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Notification acknowledged.')),
                );
              } else {
                showDetails(alert);
              }
            },
          ),
      ],
    );
  }
}

class _AlertCard extends StatelessWidget {
  final WarehouseAlert alert;
  final WarehouseState state;
  final VoidCallback onPrimary, onSecondary;
  const _AlertCard({
    required this.alert,
    required this.state,
    required this.onPrimary,
    required this.onSecondary,
  });

  @override
  Widget build(BuildContext context) {
    final receiving = alert.action == 'receiving';
    final rack = alert.action == 'rack';
    final putaway = alert.action == 'putaway';
    final color =
        receiving
            ? brand
            : rack
            ? amber
            : putaway
            ? mint
            : brand;
    final badgeColor = receiving ? danger : color;
    final matching = state.items.where((item) => item.sku == alert.sku);
    final location = matching.isEmpty ? alert.sku : matching.first.rack;
    final badge =
        rack && alert.badge == 'ANOMALY'
            ? 'CYCLE AUDIT MISMATCH'
            : putaway && alert.badge == 'PUTAWAY'
            ? 'PUTAWAY ROUTE'
            : alert.badge;
    final primaryText =
        receiving
            ? 'Start Receiving Scan'
            : rack
            ? 'Verify Rack'
            : putaway
            ? 'Confirm Relocation'
            : 'View Notification';
    final secondaryText =
        receiving
            ? 'View Bay Manifest'
            : rack
            ? 'Acknowledge'
            : putaway
            ? 'View Route Map'
            : 'View Details';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: brandCardShadow,
      ),
      child: Stack(
        children: [
          Positioned(
            top: 0,
            bottom: 0,
            left: 0,
            width: 6,
            child: ColoredBox(color: alert.read ? line : color),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: _AlertBadge(
                          badge,
                          color: badgeColor,
                          icon:
                              receiving
                                  ? Icons.error
                                  : rack
                                  ? Icons.warning_amber_rounded
                                  : putaway
                                  ? Icons.local_shipping_outlined
                                  : Icons.notifications_none,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.schedule, size: 13, color: muted),
                    const SizedBox(width: 4),
                    Text(
                      alert.read ? 'Read' : 'New',
                      style: TextStyle(
                        color: alert.read ? muted : brand,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  alert.title,
                  style: const TextStyle(
                    color: brandInk,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.2,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  alert.message,
                  style: const TextStyle(
                    color: brandSlate,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 11,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xfff8fafc),
                    border: Border.all(color: const Color(0xffeef2f6)),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        receiving
                            ? Icons.local_shipping_outlined
                            : rack
                            ? Icons.inventory_2_outlined
                            : Icons.near_me_outlined,
                        size: 16,
                        color: color,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          receiving ? 'Bay Dock 02' : location,
                          style: const TextStyle(
                            color: brandInk,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                        ),
                      ),
                      if (rack)
                        const Text(
                          'Physical check',
                          style: TextStyle(
                            color: danger,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: color),
                  onPressed: onPrimary,
                  icon: Icon(
                    receiving
                        ? Icons.qr_code_scanner
                        : rack
                        ? Icons.assignment_turned_in_outlined
                        : putaway
                        ? Icons.local_shipping_outlined
                        : Icons.notifications_none,
                    size: 18,
                  ),
                  label: Text(primaryText),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: onSecondary,
                  icon: Icon(
                    receiving
                        ? Icons.assignment_outlined
                        : rack
                        ? Icons.check_circle_outline
                        : putaway
                        ? Icons.map_outlined
                        : Icons.info_outline,
                    size: 18,
                  ),
                  label: Text(secondaryText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertBadge extends StatelessWidget {
  final String text;
  final Color color;
  final IconData? icon;
  const _AlertBadge(this.text, {required this.color, this.icon});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color.withAlpha(24),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
        ],
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
        ),
      ],
    ),
  );
}