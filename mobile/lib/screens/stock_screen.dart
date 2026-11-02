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
    final items = s.filteredItems;
    final hasFilter = s.filter.active;
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 8, bottom: 16),
                  child: Text(
                    'Stok & Rak Gudang',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.3,
                      color: brandInk,
                    ),
                  ),
                ),

                // Ringkasan stok hari ini
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _StockMetric(
                          'Safe Stock',
                          '${s.safePercent.toStringAsFixed(1)}%',
                          mint,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StockMetric(
                          'Putaway',
                          '${s.inflow}',
                          mint,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StockMetric(
                          'Dispatching',
                          '${s.outflow}',
                          danger,
                        ),
                      ),
                    ],
                  ),
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
                        onPressed: () => flowSheet(context, const FilterFlow()),
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
                  ],
                ),
                const SizedBox(height: 10),
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
                          onPressed: () => s.applyFilter(const StockFilter()),
                          child: const Text('Hapus Filter'),
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
            padding: EdgeInsets.fromLTRB(16, 0, 16, 100),
            sliver: SliverToBoxAdapter(
              child: Panel(
                child: Text('No products match your search and filters.'),
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
            sliver: SliverList.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final i = items[index];
                return StockCard(
                  i,
                  onTap: () => flowSheet(context, _StockDetail(sku: i.sku)),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _StockMetric extends StatelessWidget {
  final String label, value;
  final Color color;
  const _StockMetric(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) => Panel(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            maxLines: 1,
            style: TextStyle(
              fontSize: 26,
              letterSpacing: -0.5,
              color: color,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 4),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            label,
            maxLines: 1,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: brandSlate,
            ),
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
  const FilterFlow({super.key});

  @override
  State<FilterFlow> createState() => _FilterFlowState();
}

class _FilterFlowState extends State<FilterFlow> {
  late Set<StockStatus> statuses;
  late String zone, sort;

  @override
  void initState() {
    super.initState();
    final f = context.read<WarehouseState>().filter;
    statuses = {...f.statuses};
    zone = f.zone;
    sort = f.sort;
  }

  @override
  Widget build(BuildContext context) => FlowBody(
    title: 'Filter Stok Barang',
    subtitle: 'Saring stok berdasarkan status dan lokasi rak',
    children: [
      const _FilterLabel(
        'STATUS KESEHATAN STOK',
        Icons.health_and_safety_outlined,
      ),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          StockStatus.critical,
          StockStatus.discrepancy,
          StockStatus.safe,
        ].map((status) {
          final selected = statuses.contains(status);
          final label = switch (status) {
            StockStatus.critical => 'Kritis / Menipis',
            StockStatus.discrepancy => 'Selisih Stok',
            StockStatus.safe => 'Stok Aman',
            _ => '',
          };
          return SizedBox(
            width: 157,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 42),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                backgroundColor:
                    selected ? statusColor(status).withAlpha(18) : Colors.white,
                side: BorderSide(
                  color: selected ? statusColor(status) : line,
                  width: 1.4,
                ),
              ),
              onPressed: () => setState(() {
                if (selected) {
                  statuses.remove(status);
                } else {
                  statuses.add(status);
                }
              }),
              child: Text(
                '${selected ? '✓ ' : ''}$label',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: selected ? statusColor(status) : muted,
                ),
              ),
            ),
          );
        }).toList(),
      ),
      const SizedBox(height: 20),
      const _FilterLabel(
        'ZONA / LOKASI RAK',
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
                        minimumSize: const Size(0, 42),
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
      const SizedBox(height: 20),
      const _FilterLabel('URUTKAN BERDASARKAN', Icons.sort),
      ...[
        ('Urgency', 'Paling Kritis / Mendesak'),
        ('SKU', 'Nama / SKU Barang (A - Z)'),
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
      const SizedBox(height: 14),
      Row(
        children: [
          Expanded(
            flex: 1,
            child: SizedBox(
              height: 48,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: const Color(0xfffff1f2),
                  foregroundColor: danger,
                  side: const BorderSide(color: danger, width: 1.4),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                onPressed: () => setState(() {
                  statuses.clear();
                  zone = 'All Zones';
                  sort = 'Urgency';
                }),
                icon: const Icon(Icons.restart_alt_rounded, size: 16),
                label: const Text(
                  'Reset',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: SizedBox(
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: brand,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                onPressed: () {
                  context.read<WarehouseState>().applyFilter(
                    StockFilter(
                      statuses: {...statuses},
                      zone: zone,
                      sort: sort,
                    ),
                  );
                  Navigator.pop(context);
                },
                child: const Text(
                  'Terapkan Filter',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ],
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