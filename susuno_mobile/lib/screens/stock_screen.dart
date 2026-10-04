import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../core/app_theme.dart';
import 'stock_flows.dart';

class StockScreen extends StatefulWidget {
  const StockScreen({super.key});
  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  late TextEditingController search;
  bool flaggedOnly = false, notifiedOnly = false;
  @override
  void initState() {
    super.initState();
    search = TextEditingController(text: context.read<WarehouseState>().search);
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final items =
        s.filteredItems
            .where(
              (i) =>
                  (!flaggedOnly ||
                      s.activities.any(
                        (a) =>
                            a.title == 'Stock discrepancy reported' &&
                            a.detail.contains(i.sku),
                      )) &&
                  (!notifiedOnly ||
                      s.alerts.any(
                        (a) =>
                            a.title == 'Discrepancy awaiting manager review' &&
                            a.message.contains(i.sku),
                      )),
            )
            .toList();
    final hasFilter = s.filter.active || flaggedOnly || notifiedOnly;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PageTitle(
          'Stock Monitoring',
          'Floor Staff View • Inventory',
          trailing: _AuditMode(),
        ),
        Row(
          children: [
            Expanded(
              child: _StockMetric(
                'Safe Stock',
                '${s.safePercent.toStringAsFixed(1)}%',
                '• Safe Limits',
                mint,
                Icons.inventory_2_outlined,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StockMetric(
                'Today Inflow',
                '+${s.inflow}',
                '• Units Received',
                mint,
                Icons.arrow_downward,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _StockMetric(
                'Today Outflow',
                '-${s.outflow}',
                '• Dispatched',
                danger,
                Icons.arrow_upward,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 35,
                child: TextField(
                  controller: search,
                  style: const TextStyle(fontSize: 10),
                  onChanged: s.setSearch,
                  decoration: InputDecoration(
                    fillColor: Colors.white,
                    hintText: 'Search SKU, Product, Rack...',
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: 8,
                      horizontal: 9,
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      size: 16,
                      color: Color(0xffa3b4ce),
                    ),
                    suffixIcon:
                        search.text.isEmpty
                            ? null
                            : IconButton(
                              icon: const Icon(Icons.close, size: 16),
                              onPressed: () {
                                search.clear();
                                s.setSearch('');
                              },
                            ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 35,
              height: 35,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  backgroundColor: const Color(0xff46662e),
                ),
                onPressed:
                    () => flowSheet(
                      context,
                      FilterFlow(
                        flaggedInitial: flaggedOnly,
                        notifiedInitial: notifiedOnly,
                        onExtraFilters:
                            (flags) => setState(() {
                              flaggedOnly = flags.$1;
                              notifiedOnly = flags.$2;
                            }),
                      ),
                    ),
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.filter_alt_outlined, size: 18),
                    if (hasFilter)
                      Positioned(
                        top: -4,
                        right: -4,
                        child: Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                            color: danger,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 7),
            SizedBox(
              width: 35,
              height: 35,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  backgroundColor: const Color(0xff1e293b),
                ),
                onPressed: () => openStockScan(context),
                child: const Icon(Icons.qr_code_scanner, size: 18),
              ),
            ),
          ],
        ),
        const SizedBox(height: 13),
        if (!hasFilter)
          Panel(
            tint: const Color(0xfffffbeb),
            border: const Color(0xfff4ce71),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  size: 20,
                  color: Color(0xffb69732),
                ),
                const SizedBox(width: 7),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'AI Priority Alert: ${s.criticalCount} SKUs require immediate floor intervention due to low threshold & sudden pick spikes.',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xff513a16),
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                      ),
                      const SizedBox(height: 7),
                      const Text(
                        '• Updated 3m ago',
                        style: TextStyle(fontSize: 8, color: muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (hasFilter)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${items.length} matching products',
                    style: const TextStyle(fontSize: 9, color: muted),
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() {
                      flaggedOnly = false;
                      notifiedOnly = false;
                    });
                    s.applyFilter(const StockFilter());
                  },
                  child: const Text('Clear Filters'),
                ),
              ],
            ),
          ),
        if (items.isEmpty)
          const Panel(
            child: Text('No products match your search and filters.'),
          ),
        ...items.map(
          (i) => StockCard(
            i,
            actions: switch (i.status) {
              StockStatus.critical => Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xff476829),
                        minimumSize: const Size(0, 30),
                      ),
                      onPressed: () => openRack(context, i.sku),
                      icon: const Icon(Icons.check, size: 13),
                      label: const Text(
                        'Verify Rack Count',
                        style: TextStyle(fontSize: 9),
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 30),
                      ),
                      onPressed: () => openDiscrepancy(context, i.sku),
                      icon: const Icon(Icons.notifications_none, size: 13),
                      label: const Text(
                        'Notify Manager',
                        style: TextStyle(fontSize: 9),
                      ),
                    ),
                  ),
                ],
              ),
              StockStatus.anomaly => SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: danger,
                    minimumSize: const Size(0, 30),
                  ),
                  onPressed: () => openDiscrepancy(context, i.sku),
                  icon: const Icon(Icons.trending_up, size: 13),
                  label: const Text(
                    'Flag Audit Scan',
                    style: TextStyle(fontSize: 9),
                  ),
                ),
              ),
              StockStatus.discrepancy => SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: amber,
                    minimumSize: const Size(0, 30),
                  ),
                  onPressed: () => openStockScan(context, demoCode: i.sku),
                  icon: const Icon(Icons.qr_code_scanner, size: 13),
                  label: const Text(
                    'Scan Barcode',
                    style: TextStyle(fontSize: 9),
                  ),
                ),
              ),
              StockStatus.safe => Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  style: TextButton.styleFrom(
                    backgroundColor: const Color(0xfff1f5f9),
                  ),
                  onPressed: () => flowSheet(context, _StockDetail(sku: i.sku)),
                  child: const Text('Details', style: TextStyle(fontSize: 9)),
                ),
              ),
            },
          ),
        ),
      ],
    );
  }
}

class _AuditMode extends StatelessWidget {
  const _AuditMode();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xffecfdf5),
      border: Border.all(color: const Color(0xff97e8ce)),
      borderRadius: BorderRadius.circular(18),
    ),
    child: const Text(
      '◎ Audit Mode',
      style: TextStyle(fontSize: 8, color: mint, fontWeight: FontWeight.w700),
    ),
  );
}

class _StockMetric extends StatelessWidget {
  final String label, value, foot;
  final Color color;
  final IconData icon;
  const _StockMetric(this.label, this.value, this.foot, this.color, this.icon);
  @override
  Widget build(BuildContext context) => Panel(
    tint: const Color(0xfff8faff),
    padding: const EdgeInsets.all(10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontSize: 9, color: muted),
              ),
            ),
            Icon(icon, size: 12, color: color),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: TextStyle(
            fontSize: 18,
            color: label == 'Safe Stock' ? ink : color,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          foot,
          style: TextStyle(
            fontSize: 7,
            color: label == 'Safe Stock' ? mint : muted,
          ),
        ),
      ],
    ),
  );
}

class _StockDetail extends StatelessWidget {
  final String sku;
  const _StockDetail({required this.sku});
  @override
  Widget build(BuildContext context) => StockDetailsFlow(sku: sku);
}

class FilterFlow extends StatefulWidget {
  final bool flaggedInitial, notifiedInitial;
  final ValueChanged<(bool, bool)>? onExtraFilters;
  const FilterFlow({
    super.key,
    this.flaggedInitial = false,
    this.notifiedInitial = false,
    this.onExtraFilters,
  });
  @override
  State<FilterFlow> createState() => _FilterFlowState();
}

class _FilterFlowState extends State<FilterFlow> {
  late Set<StockStatus> statuses;
  late String zone, sort;
  late bool pending;
  late bool flagged, notified;
  @override
  void initState() {
    super.initState();
    final f = context.read<WarehouseState>().filter;
    statuses = {...f.statuses};
    zone = f.zone;
    sort = f.sort;
    pending = f.pendingOnly;
    flagged = widget.flaggedInitial;
    notified = widget.notifiedInitial;
  }

  @override
  Widget build(BuildContext context) => FlowBody(
    title: 'Filter Stock and\nAssets',
    subtitle: '',
    children: [
      Align(
        alignment: Alignment.centerRight,
        child: TextButton(
          onPressed:
              () => setState(() {
                statuses.clear();
                zone = 'All Zones';
                sort = 'Urgency';
                pending = false;
                flagged = false;
                notified = false;
              }),
          child: const Tag('RESET FILTERS', color: danger),
        ),
      ),
      const _FilterLabel(
        'STOCK HEALTH STATUS',
        Icons.health_and_safety_outlined,
      ),
      GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 9,
        childAspectRatio: 4.6,
        children:
            [
              StockStatus.critical,
              StockStatus.anomaly,
              StockStatus.discrepancy,
              StockStatus.safe,
            ].map((status) {
              final selected = statuses.contains(status);
              final label = switch (status) {
                StockStatus.critical => 'Critical Stockout',
                StockStatus.anomaly => 'Velocity Anomaly',
                StockStatus.discrepancy => 'Stock Discrepancy',
                StockStatus.safe => 'Safe Stock',
              };
              return OutlinedButton(
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.zero,
                  backgroundColor:
                      selected
                          ? statusColor(status).withAlpha(10)
                          : const Color(0xfff7f9fc),
                  side: BorderSide(
                    color: selected ? statusColor(status).withAlpha(100) : line,
                  ),
                ),
                onPressed:
                    () => setState(() {
                      if (selected) {
                        statuses.remove(status);
                      } else {
                        statuses.add(status);
                      }
                    }),
                child: Text(
                  '${selected ? '✓ ' : ''}$label',
                  style: TextStyle(
                    fontSize: 10,
                    color: selected ? statusColor(status) : muted,
                  ),
                ),
              );
            }).toList(),
      ),
      const SizedBox(height: 21),
      const _FilterLabel(
        'WAREHOUSE ZONE / LOCATION',
        Icons.location_on_outlined,
      ),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children:
            ['All Zones', 'Zone A', 'Zone B', 'Zone C', 'Zone D']
                .map(
                  (z) => SizedBox(
                    width: 157,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor:
                            zone == z
                                ? const Color(0xff48643a)
                                : const Color(0xfff7f9fc),
                      ),
                      onPressed: () => setState(() => zone = z),
                      child: Text(
                        z,
                        style: TextStyle(
                          fontSize: 9,
                          color: zone == z ? Colors.white : ink,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
      ),
      const SizedBox(height: 20),
      const _FilterLabel('ACTION REQUIRED', Icons.fact_check_outlined),
      Container(
        decoration: BoxDecoration(
          border: Border.all(color: line),
          borderRadius: BorderRadius.circular(7),
        ),
        child: CheckboxListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 3),
          dense: true,
          value: pending,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'Pending Physical Verification',
            style: TextStyle(fontSize: 11),
          ),
          onChanged: (v) => setState(() => pending = v ?? false),
        ),
      ),
      const SizedBox(height: 9),
      ...[(false, 'Flagged for Audit Scan'), (true, 'Notified Floor Lead')].map(
        (entry) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            border: Border.all(color: line),
            borderRadius: BorderRadius.circular(7),
          ),
          child: CheckboxListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 3),
            dense: true,
            value: entry.$1 ? notified : flagged,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(entry.$2, style: const TextStyle(fontSize: 11)),
            onChanged:
                (value) => setState(() {
                  if (entry.$1) {
                    notified = value ?? false;
                  } else {
                    flagged = value ?? false;
                  }
                }),
          ),
        ),
      ),
      const SizedBox(height: 20),
      const _FilterLabel('SORT STOCK PRIORITY', Icons.sort),
      ...[
        ('Urgency', 'Highest AI Urgency'),
        ('Days Left', 'Lowest Buffer Days Remaining'),
        ('SKU', 'SKU / Item Name (A - Z)'),
      ].map(
        (v) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            border: Border.all(color: sort == v.$1 ? forest : line),
            color: sort == v.$1 ? const Color(0xfff7f9f7) : Colors.white,
            borderRadius: BorderRadius.circular(6),
          ),
          child: ListTile(
            dense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 8),
            leading: Icon(
              sort == v.$1
                  ? Icons.radio_button_checked
                  : Icons.radio_button_off,
              color: sort == v.$1 ? forest : line,
              size: 17,
            ),
            title: Text(v.$2, style: const TextStyle(fontSize: 11)),
            onTap: () => setState(() => sort = v.$1),
          ),
        ),
      ),
      FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: const Color(0xff48643a)),
        onPressed: () {
          widget.onExtraFilters?.call((flagged, notified));
          context.read<WarehouseState>().applyFilter(
            StockFilter(
              statuses: {...statuses},
              zone: zone,
              pendingOnly: pending,
              sort: sort,
            ),
          );
          Navigator.pop(context);
        },
        icon: const Icon(Icons.check, size: 16),
        label: const Text('Apply Filters'),
      ),
      OutlinedButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Dismiss and Cancel', style: TextStyle(fontSize: 10)),
      ),
    ],
  );
}

class _FilterLabel extends StatelessWidget {
  final String label;
  final IconData icon;
  const _FilterLabel(this.label, this.icon);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(
      children: [
        Icon(icon, color: olive, size: 17),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 9,
            letterSpacing: .5,
            color: muted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}
