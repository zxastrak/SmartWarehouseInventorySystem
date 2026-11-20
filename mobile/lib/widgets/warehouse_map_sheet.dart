import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';

/// Membuka Bottom Sheet Denah Visual Gudang SUSUNO (Warehouse Map)
Future<void> showWarehouseMapSheet(BuildContext context) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x660f172a),
    builder: (ctx) => const WarehouseMapSheet(),
  );
}

class WarehouseMapSheet extends StatefulWidget {
  const WarehouseMapSheet({super.key});

  @override
  State<WarehouseMapSheet> createState() => _WarehouseMapSheetState();
}

class _WarehouseMapSheetState extends State<WarehouseMapSheet> {
  String _selectedZone = 'All';
  String? _expandedRack;
  final TextEditingController _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  // Daftar default rak gudang SUSUNO untuk kelengkapan visual
  static const List<Map<String, String>> _defaultRacks = [
    {'code': 'RACK-A1-01-A', 'zone': 'Zona A', 'aisle': 'Lorong 1', 'type': 'Fast Moving'},
    {'code': 'RACK-A1-02-B', 'zone': 'Zona A', 'aisle': 'Lorong 1', 'type': 'Fast Moving'},
    {'code': 'RACK-A2-01-A', 'zone': 'Zona A', 'aisle': 'Lorong 2', 'type': 'Fast Moving'},
    {'code': 'RACK-A2-02-B', 'zone': 'Zona A', 'aisle': 'Lorong 2', 'type': 'Fast Moving'},
    {'code': 'RACK-B1-01-A', 'zone': 'Zona B', 'aisle': 'Lorong 3', 'type': 'Medium Moving'},
    {'code': 'RACK-B1-02-B', 'zone': 'Zona B', 'aisle': 'Lorong 3', 'type': 'Medium Moving'},
    {'code': 'RACK-B2-01-A', 'zone': 'Zona B', 'aisle': 'Lorong 4', 'type': 'Medium Moving'},
    {'code': 'RACK-B2-02-B', 'zone': 'Zona B', 'aisle': 'Lorong 4', 'type': 'Medium Moving'},
    {'code': 'RACK-C1-01-A', 'zone': 'Zona C', 'aisle': 'Lorong 5', 'type': 'Bulk Storage'},
    {'code': 'RACK-C1-02-B', 'zone': 'Zona C', 'aisle': 'Lorong 5', 'type': 'Bulk Storage'},
    {'code': 'RACK-C2-01-A', 'zone': 'Zona C', 'aisle': 'Lorong 6', 'type': 'Bulk Storage'},
    {'code': 'RACK-D1-01-A', 'zone': 'Zona D', 'aisle': 'Lorong 7', 'type': 'Spareparts & Safety'},
    {'code': 'RACK-D1-02-B', 'zone': 'Zona D', 'aisle': 'Lorong 7', 'type': 'Spareparts & Safety'},
    {'code': 'RACK-D2-01-A', 'zone': 'Zona D', 'aisle': 'Lorong 8', 'type': 'Karantina & Retur'},
  ];

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final double sheetHeight = MediaQuery.of(context).size.height * 0.88;

    // Himpun seluruh data rak unik dari database dan default layout
    final Map<String, Map<String, dynamic>> rackMap = {};

    for (final def in _defaultRacks) {
      final code = def['code']!;
      rackMap[code] = {
        'code': code,
        'zone': def['zone']!,
        'aisle': def['aisle']!,
        'type': def['type']!,
        'items': <StockItem>[],
        'totalUnits': 0,
      };
    }

    // Gabungkan dengan lokasi dari backend
    for (final loc in s.locations) {
      final code = (loc['location_code'] ?? '').toString().trim().toUpperCase();
      if (code.isEmpty) continue;
      final zoneRaw = (loc['zone'] ?? 'Zona A').toString();
      final zone = zoneRaw.startsWith('Zone') || zoneRaw.startsWith('Zona')
          ? zoneRaw
          : 'Zona $zoneRaw';
      if (!rackMap.containsKey(code)) {
        rackMap[code] = {
          'code': code,
          'zone': zone,
          'aisle': 'Lorong Utama',
          'type': 'General Storage',
          'items': <StockItem>[],
          'totalUnits': 0,
        };
      }
    }

    // Alokasikan barang-barang yang tersimpan ke masing-masing rak
    for (final item in s.items) {
      for (final entry in item.rackCounts.entries) {
        final code = entry.key.trim().toUpperCase();
        if (code.isEmpty || entry.value <= 0) continue;
        if (!rackMap.containsKey(code)) {
          final zone = code.length > 5 ? 'Zona ${code.substring(5, 6)}' : 'Zona A';
          rackMap[code] = {
            'code': code,
            'zone': zone,
            'aisle': 'Lorong Rak',
            'type': 'Storage',
            'items': <StockItem>[],
            'totalUnits': 0,
          };
        }
        (rackMap[code]!['items'] as List<StockItem>).add(item);
        rackMap[code]!['totalUnits'] = (rackMap[code]!['totalUnits'] as int) + entry.value;
      }

      // Fallback jika rackCounts kosong namun item.rack terisi
      if (item.rackCounts.isEmpty && item.rack.isNotEmpty && item.quantity > 0) {
        final code = item.rack.trim().toUpperCase();
        if (!rackMap.containsKey(code)) {
          final zone = code.length > 5 ? 'Zona ${code.substring(5, 6)}' : 'Zona A';
          rackMap[code] = {
            'code': code,
            'zone': zone,
            'aisle': 'Lorong Rak',
            'type': 'Storage',
            'items': <StockItem>[],
            'totalUnits': 0,
          };
        }
        final list = (rackMap[code]!['items'] as List<StockItem>);
        if (!list.any((i) => i.sku == item.sku)) {
          list.add(item);
          rackMap[code]!['totalUnits'] = (rackMap[code]!['totalUnits'] as int) + item.quantity;
        }
      }
    }

    // Hitung metrik ringkasan denah gudang
    final totalRacks = rackMap.length;
    final occupiedRacks = rackMap.values.where((r) => (r['totalUnits'] as int) > 0).length;
    final availableRacks = totalRacks - occupiedRacks;

    // Filter daftar rak sesuai zona dan query pencarian
    final filteredRacks = rackMap.values.where((r) {
      final code = r['code'].toString().toLowerCase();
      final zone = r['zone'].toString().toLowerCase();
      final items = r['items'] as List<StockItem>;

      if (_selectedZone != 'All') {
        if (_selectedZone == 'Docks') {
          return false; // Dok ditampilkan pada section terpisah
        }
        if (!zone.contains(_selectedZone.toLowerCase())) {
          return false;
        }
      }

      if (_query.isNotEmpty) {
        final matchCode = code.contains(_query);
        final matchItem = items.any((i) =>
            i.name.toLowerCase().contains(_query) ||
            i.sku.toLowerCase().contains(_query));
        if (!matchCode && !matchItem) return false;
      }

      return true;
    }).toList();

    return Container(
      height: sheetHeight,
      decoration: const BoxDecoration(
        color: canvas,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Handle Bar & Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 10, 16, 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              border: Border(bottom: BorderSide(color: line)),
            ),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xffcbd5e1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xff8b5cf6), Color(0xff6d28d9)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x337c3aed),
                            blurRadius: 8,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Icon(Icons.warehouse_rounded, color: Colors.white, size: 20),
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Denah & Peta Rak Gudang',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: brandInk,
                              letterSpacing: -0.2,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'SUSUNO Spatial Floor & Rack Layout',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: brandSlate,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: brandSlate),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Konten Scrollable
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                // Metrik Kapasitas Gudang
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: line),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x06000000),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      _buildMetricTile('Total Rak', '$totalRacks Rak', const Color(0xff0f172a)),
                      _buildDivider(),
                      _buildMetricTile('Terisi', '$occupiedRacks Rak', const Color(0xff16a34a)),
                      _buildDivider(),
                      _buildMetricTile('Tersedia', '$availableRacks Rak', const Color(0xff64748b)),
                      _buildDivider(),
                      _buildMetricTile('Dok Armada', '4 Dok', const Color(0xff7c3aed)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Search Bar Rak / SKU
                TextField(
                  controller: _searchCtrl,
                  onChanged: (val) => setState(() => _query = val.trim().toLowerCase()),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: brandInk),
                  decoration: InputDecoration(
                    hintText: 'Cari kode rak (misal RACK-A1) atau nama produk...',
                    hintStyle: const TextStyle(fontSize: 12, color: muted),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: brandSlate),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _query = '');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xff7c3aed), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Selector Filter Zona
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildZoneChip('Semua', 'All'),
                      _buildZoneChip('Dok Bongkar Muat', 'Docks'),
                      _buildZoneChip('Zona A (Fast)', 'Zona A'),
                      _buildZoneChip('Zona B (Medium)', 'Zona B'),
                      _buildZoneChip('Zona C (Bulk)', 'Zona C'),
                      _buildZoneChip('Zona D (Special)', 'Zona D'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // 1. Visual Mini Floor Plan Denah Dok & Pintu Masuk
                if (_selectedZone == 'All' || _selectedZone == 'Docks') ...[
                  _buildSectionHeader('DOK BONGKAR MUAT & STAGING AREA', Icons.local_shipping_outlined),
                  const SizedBox(height: 8),
                  _buildDockSection(s),
                  const SizedBox(height: 16),
                ],

                // 2. Daftar Rak Gudang
                if (_selectedZone != 'Docks') ...[
                  _buildSectionHeader('RAK PENYIMPANAN INVENTARIS (${filteredRacks.length})', Icons.grid_view_rounded),
                  const SizedBox(height: 8),
                  if (filteredRacks.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: line),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.inventory_2_outlined, color: muted, size: 36),
                          SizedBox(height: 8),
                          Text(
                            'Tidak ada rak yang sesuai dengan filter atau kata kunci.',
                            style: TextStyle(fontSize: 12, color: brandSlate, fontWeight: FontWeight.w600),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  else
                    ...filteredRacks.map((rack) => _buildRackCard(context, s, rack)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: brandSlate),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: 24,
      color: line,
      margin: const EdgeInsets.symmetric(horizontal: 2),
    );
  }

  Widget _buildZoneChip(String label, String key) {
    final bool isSelected = _selectedZone == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        showCheckmark: false,
        selectedColor: const Color(0xfff3e8ff),
        backgroundColor: Colors.white,
        side: BorderSide(
          color: isSelected ? const Color(0xff7c3aed) : line,
          width: isSelected ? 1.4 : 1,
        ),
        labelStyle: TextStyle(
          fontSize: 11.5,
          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          color: isSelected ? const Color(0xff6d28d9) : brandSlate,
        ),
        onSelected: (_) => setState(() => _selectedZone = key),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xff7c3aed)),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
            color: brandInk,
          ),
        ),
      ],
    );
  }

  Widget _buildDockSection(WarehouseState s) {
    // 4 Dok standar penerimaan / pengeluaran
    final docks = [
      {'dock': 'Dok 1', 'status': 'Aktif Inbound', 'isOccupied': s.arrivedShipments.isNotEmpty},
      {'dock': 'Dok 2', 'status': 'Standby', 'isOccupied': false},
      {'dock': 'Dok 3', 'status': 'Aktif Outbound', 'isOccupied': s.arrivedOutbounds.isNotEmpty},
      {'dock': 'Dok 4', 'status': 'Standby', 'isOccupied': false},
    ];

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xffe2e8f0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'GERBANG DOK & UNLOADING BAY',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: muted),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xfff0fdf4),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xff86efac)),
                ),
                child: const Text(
                  '4 Pintu Masuk / Keluar',
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: Color(0xff166534)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: docks.map((d) {
              final isOcc = d['isOccupied'] as bool;
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                  decoration: BoxDecoration(
                    color: isOcc ? const Color(0xfffef3c7) : const Color(0xfff8fafc),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isOcc ? const Color(0xfffde68a) : const Color(0xffe2e8f0),
                    ),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        Icons.door_sliding_rounded,
                        size: 20,
                        color: isOcc ? const Color(0xffb45309) : brandSlate,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        d['dock'] as String,
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: brandInk),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isOcc ? 'Truk Ada' : 'Kosong',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: isOcc ? const Color(0xffb45309) : const Color(0xff16a34a),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildRackCard(BuildContext context, WarehouseState s, Map<String, dynamic> rack) {
    final code = rack['code'] as String;
    final zone = rack['zone'] as String;
    final aisle = rack['aisle'] as String;
    final totalUnits = rack['totalUnits'] as int;
    final items = rack['items'] as List<StockItem>;
    final isOccupied = totalUnits > 0;
    final isExpanded = _expandedRack == code;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isExpanded ? const Color(0xff7c3aed) : line,
          width: isExpanded ? 1.5 : 1,
        ),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () {
              setState(() {
                _expandedRack = isExpanded ? null : code;
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  // Icon Rak
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: isOccupied ? const Color(0xfff0fdf4) : const Color(0xfff8fafc),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isOccupied ? const Color(0xff86efac) : const Color(0xffcbd5e1),
                      ),
                    ),
                    child: Center(
                      child: Icon(
                        Icons.grid_on_rounded,
                        size: 20,
                        color: isOccupied ? const Color(0xff166534) : brandSlate,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Info Rak
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              code,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                fontFamily: 'monospace',
                                color: brandInk,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: const Color(0xfff3e8ff),
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: const Color(0xffd8b4fe)),
                              ),
                              child: Text(
                                zone,
                                style: const TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xff6d28d9),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '$aisle • ${isOccupied ? '$totalUnits unit (${items.length} SKU)' : 'Rak Kosong / Siap Putaway'}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isOccupied ? const Color(0xff166534) : muted,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Aksi Cepat: Pilih Rak ke Scanner
                  IconButton(
                    icon: Icon(
                      isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: brandSlate,
                    ),
                    onPressed: () {
                      setState(() {
                        _expandedRack = isExpanded ? null : code;
                      });
                    },
                  ),
                ],
              ),
            ),
          ),

          // Detail Produk dalam Rak jika diekspansi
          if (isExpanded)
            Container(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(color: line, height: 1),
                  const SizedBox(height: 10),
                  const Text(
                    'DAFTAR BARANG DI RAK INI:',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: muted),
                  ),
                  const SizedBox(height: 6),
                  if (items.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        'Belum ada barang fisik yang tercatat di rak ini.',
                        style: TextStyle(fontSize: 11, color: brandSlate),
                      ),
                    )
                  else
                    ...items.map((item) {
                      final itemQty = item.rackCounts[code] ??
                          (item.rack.trim().toUpperCase() == code ? item.quantity : 0);
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                        decoration: BoxDecoration(
                          color: const Color(0xfff8fafc),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: line),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: brandInk,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    'SKU: ${item.sku}',
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontFamily: 'monospace',
                                      color: brandSlate,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: brandSoftBorder),
                              ),
                              child: Text(
                                '$itemQty ${item.unit}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: brandInk,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  const SizedBox(height: 10),
                  // Tombol Pilih Rak untuk Scanner
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xff7c3aed),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        s.selectRackFromMap(code);
                        ScaffoldMessenger.of(context).hideCurrentSnackBar();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Rak $code dipilih. Menampilkan data di Scanner.',
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                ),
                              ],
                            ),
                            backgroundColor: const Color(0xff7c3aed),
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                      icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                      label: Text(
                        'Pilih & Pindai Rak $code di Scanner ›',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                      ),
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
