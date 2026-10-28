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
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Judul halaman sudah ada di top bar, jadi di sini cukup
                // keterangan singkat + badge mode.
                const Padding(
                  padding: EdgeInsets.only(bottom: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Floor Staff View • Inventory',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: brandSlate,
                          ),
                        ),
                      ),
                      _AuditMode(),
                    ],
                  ),
                ),

                // Ringkasan stok hari ini
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
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
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StockMetric(
                        'Today Inflow',
                        s.inflow == 0 ? '0' : '+${s.inflow}',
                        '• Units Received',
                        mint,
                        Icons.arrow_downward,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _StockMetric(
                        'Today Outflow',
                        s.outflow == 0 ? '0' : '-${s.outflow}',
                        '• Dispatched',
                        danger,
                        Icons.arrow_upward,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Search + filter + scan
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 48,
                        child: TextField(
                          controller: search,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: brandInk,
                          ),
                          onChanged: s.setSearch,
                          decoration: InputDecoration(
                            fillColor: Colors.white,
                            hintText: 'Search SKU, Product, Rack...',
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: 12,
                              horizontal: 16,
                            ),
                            prefixIcon: const Icon(
                              Icons.search,
                              size: 20,
                              color: muted,
                            ),
                            suffixIcon:
                                search.text.isEmpty
                                    ? null
                                    : IconButton(
                                      icon: const Icon(Icons.close, size: 18),
                                      onPressed: () {
                                        search.clear();
                                        s.setSearch('');
                                      },
                                    ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(28),
                              borderSide: const BorderSide(color: line),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(28),
                              borderSide: const BorderSide(color: line),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(28),
                              borderSide: const BorderSide(
                                color: brand,
                                width: 1.8,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Tombol filter: lingkaran putih, ikon hijau
                    SizedBox(
                      width: 48,
                      height: 48,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          backgroundColor: Colors.white,
                          foregroundColor: brand,
                          side: const BorderSide(
                            color: brandSoftBorder,
                            width: 1.5,
                          ),
                          shape: const CircleBorder(),
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
                            const Icon(Icons.filter_alt_outlined, size: 22),
                            if (hasFilter)
                              Positioned(
                                top: -3,
                                right: -3,
                                child: Container(
                                  width: 9,
                                  height: 9,
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
                    const SizedBox(width: 8),
                    // Tombol scan: lingkaran hijau (aksi utama)
                    SizedBox(
                      width: 48,
                      height: 48,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: Size.zero,
                          backgroundColor: brand,
                          foregroundColor: Colors.white,
                          shape: const CircleBorder(),
                        ),
                        onPressed: () => openStockScan(context),
                        child: const Icon(Icons.qr_code_scanner, size: 22),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                if (!hasFilter)
                  Panel(
                    tint: const Color(0xfffffbeb),
                    border: const Color(0xfffde68a),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: amber.withAlpha(30),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.warning_amber_rounded,
                            size: 20,
                            color: amber,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'AI Priority Alert: ${s.criticalCount} SKUs require immediate floor intervention due to low threshold & sudden pick spikes.',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xff513a16),
                                  fontWeight: FontWeight.w700,
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 5),
                              const Text(
                                '• Updated 3m ago',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: muted,
                                ),
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
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: muted,
                            ),
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
              ],
            ),
          ),
        ),
        if (items.isEmpty)
          const SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverToBoxAdapter(
              child: Panel(
                child: Text('No products match your search and filters.'),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            sliver: SliverList.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final i = items[index];
                return StockCard(
                  i,
                  actions: switch (i.status) {
                    StockStatus.critical => Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                ),
                              ),
                              onPressed: () => openRack(context, i.sku),
                              icon: const Icon(Icons.check, size: 16),
                              label: const Text(
                                'Verify Rack Count',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: SizedBox(
                            height: 48,
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                ),
                              ),
                              onPressed: () => openDiscrepancy(context, i.sku),
                              icon: const Icon(
                                Icons.notifications_none,
                                size: 16,
                              ),
                              label: const Text(
                                'Notify Manager',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    StockStatus.anomaly => SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: danger),
                        onPressed: () => openDiscrepancy(context, i.sku),
                        icon: const Icon(Icons.trending_up, size: 16),
                        label: const Text('Flag Audit Scan'),
                      ),
                    ),
                    StockStatus.discrepancy => SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: amber),
                        onPressed:
                            () => openStockScan(context, demoCode: i.sku),
                        icon: const Icon(Icons.qr_code_scanner, size: 16),
                        label: const Text('Scan Barcode'),
                      ),
                    ),
                    StockStatus.safe => Align(
                      alignment: Alignment.centerLeft,
                      child: SizedBox(
                        height: 44,
                        child: TextButton.icon(
                          style: TextButton.styleFrom(
                            backgroundColor: brandSoft,
                            foregroundColor: brand,
                            shape: const StadiumBorder(),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                          ),
                          icon: const Icon(Icons.info_outline, size: 16),
                          onPressed:
                              () => flowSheet(context, _StockDetail(sku: i.sku)),
                          label: const Text(
                            'Details',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                  },
                );
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
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: brandSoft,
      border: Border.all(color: brandSoftBorder),
      borderRadius: BorderRadius.circular(20),
    ),
    child: const Text(
      '◎ Audit Mode',
      style: TextStyle(fontSize: 11, color: brand, fontWeight: FontWeight.w800),
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
    padding: const EdgeInsets.all(12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: color.withAlpha(24),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(height: 10),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            maxLines: 1,
            style: TextStyle(
              fontSize: 20,
              letterSpacing: -0.3,
              color: label == 'Safe Stock' ? brandInk : color,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: brandSlate,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          foot,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
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
        childAspectRatio: 4.2,
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
                  minimumSize: Size.zero,
                  backgroundColor:
                      selected
                          ? statusColor(status).withAlpha(18)
                          : Colors.white,
                  side: BorderSide(
                    color: selected ? statusColor(status) : line,
                    width: 1.4,
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
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: selected ? statusColor(status) : muted,
                  ),
                ),
              );
            }).toList(),
      ),
      const SizedBox(height: 22),
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
                        minimumSize: const Size(0, 44),
                        backgroundColor: zone == z ? brand : Colors.white,
                        side: BorderSide(
                          color: zone == z ? brand : line,
                          width: 1.4,
                        ),
                      ),
                      onPressed: () => setState(() => zone = z),
                      child: Text(
                        z,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: zone == z ? Colors.white : ink,
                        ),
                      ),
                    ),
                  ),
                )
                .toList(),
      ),
      const SizedBox(height: 22),
      const _FilterLabel('ACTION REQUIRED', Icons.fact_check_outlined),
      Container(
        decoration: BoxDecoration(
          border: Border.all(color: line),
          borderRadius: BorderRadius.circular(14),
        ),
        child: CheckboxListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 6),
          dense: true,
          activeColor: brand,
          value: pending,
          controlAffinity: ListTileControlAffinity.leading,
          title: const Text(
            'Pending Physical Verification',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
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
            borderRadius: BorderRadius.circular(14),
          ),
          child: CheckboxListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 6),
            dense: true,
            activeColor: brand,
            value: entry.$1 ? notified : flagged,
            controlAffinity: ListTileControlAffinity.leading,
            title: Text(
              entry.$2,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
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
            border: Border.all(
              color: sort == v.$1 ? brand : line,
              width: sort == v.$1 ? 1.4 : 1,
            ),
            color: sort == v.$1 ? brandSoft : Colors.white,
            borderRadius: BorderRadius.circular(14),
          ),
          child: ListTile(
            dense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10),
            leading: Icon(
              sort == v.$1
                  ? Icons.radio_button_checked
                  : Icons.radio_button_off,
              color: sort == v.$1 ? brand : line,
              size: 18,
            ),
            title: Text(
              v.$2,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            onTap: () => setState(() => sort = v.$1),
          ),
        ),
      ),
      FilledButton.icon(
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
        child: const Text('Dismiss and Cancel', style: TextStyle(fontSize: 12)),
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
        Icon(icon, color: brand, size: 18),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            letterSpacing: .6,
            color: brandSlate,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    ),
  );
}