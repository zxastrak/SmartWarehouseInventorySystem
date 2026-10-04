import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../state/warehouse_state.dart';
import 'stock_flows.dart';

const _olive = Color(0xff5a7129);
const _ink = Color(0xff191c1d);
const _muted = Color(0xff64748b);
const _border = Color(0xffe2e8f0);
const _red = Color(0xffd91c24);
const _orange = Color(0xffdf7f00);
const _blue = Color(0xff008ac4);

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
              style: const TextStyle(color: _ink, fontSize: 13),
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
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: _border),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Operational Alerts',
                      style: TextStyle(
                        color: _ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Floor Task Feed and Notifications',
                      style: TextStyle(
                        color: _muted,
                        fontSize: 9,
                        letterSpacing: .3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _AlertBadge('$unread Unread', color: _red, solid: true),
            ],
          ),
        ),
        const SizedBox(height: 11),
        Row(
          children: List.generate(
            3,
            (index) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: index == 2 ? 0 : 5),
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        filter == index ? _olive : const Color(0xffe8edff),
                    foregroundColor:
                        filter == index
                            ? Colors.white
                            : const Color(0xff424940),
                    minimumSize: const Size(0, 35),
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  onPressed: () => setState(() => filter = index),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        ['● All Alerts', 'Unread', 'Urgent Tasks'][index],
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (index == 1) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: _red,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '$unread',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 15),
        if (alerts.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: _border),
              borderRadius: BorderRadius.circular(9),
            ),
            child: const Text(
              'No notifications in this category.',
              style: TextStyle(color: _muted, fontSize: 12),
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
            ? _olive
            : rack
            ? _orange
            : putaway
            ? _blue
            : _olive;
    final badgeColor = receiving ? _red : color;
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
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xffe5e7e0)),
        borderRadius: BorderRadius.circular(9),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          const Positioned(
            top: 0,
            bottom: 0,
            left: 0,
            width: 7,
            child: ColoredBox(color: Color(0xffe7e9e1)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 11, 12),
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
                    const SizedBox(width: 5),
                    const Icon(Icons.schedule, size: 10, color: _muted),
                    const SizedBox(width: 4),
                    Text(
                      alert.read ? 'Read' : 'New',
                      style: const TextStyle(color: _muted, fontSize: 9),
                    ),
                  ],
                ),
                const SizedBox(height: 11),
                Text(
                  alert.title,
                  style: const TextStyle(
                    color: _ink,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  alert.message,
                  style: const TextStyle(
                    color: Color(0xff424940),
                    fontSize: 11,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 11),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xffe8edff),
                    border: Border.all(color: const Color(0xffd6d9dc)),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        receiving
                            ? Icons.local_shipping_outlined
                            : rack
                            ? Icons.inventory_2_outlined
                            : Icons.near_me_outlined,
                        size: 14,
                        color: color,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          receiving ? 'Bay Dock 02' : location,
                          style: const TextStyle(
                            color: Color(0xff334155),
                            fontSize: 9,
                            height: 1.3,
                          ),
                        ),
                      ),
                      if (rack)
                        const Text(
                          'Physical check',
                          style: TextStyle(color: _red, fontSize: 8),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: color,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 9,
                    ),
                  ),
                  onPressed: onPrimary,
                  icon: Icon(
                    receiving
                        ? Icons.qr_code_scanner
                        : rack
                        ? Icons.assignment_turned_in_outlined
                        : putaway
                        ? Icons.local_shipping_outlined
                        : Icons.notifications_none,
                    size: 21,
                  ),
                  label: Text(
                    primaryText,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(height: 5),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xff424940),
                    backgroundColor: Colors.white,
                    minimumSize: const Size(0, 39),
                    side: const BorderSide(color: Color(0xff939d8a)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 8,
                    ),
                  ),
                  onPressed: onSecondary,
                  icon: Icon(
                    receiving
                        ? Icons.assignment_outlined
                        : rack
                        ? Icons.check_circle_outline
                        : putaway
                        ? Icons.map_outlined
                        : Icons.info_outline,
                    size: 20,
                  ),
                  label: Text(
                    secondaryText,
                    style: const TextStyle(fontSize: 11),
                  ),
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
  final bool solid;
  final IconData? icon;
  const _AlertBadge(
    this.text, {
    required this.color,
    this.solid = false,
    this.icon,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: solid ? color : color.withAlpha(28),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 10, color: solid ? Colors.white : color),
          const SizedBox(width: 3),
        ],
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              color: solid ? Colors.white : color,
              fontSize: 8,
              fontWeight: FontWeight.w700,
              height: 1.2,
            ),
          ),
        ),
      ],
    ),
  );
}
