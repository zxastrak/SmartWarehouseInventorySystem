import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../core/app_theme.dart';
import '../widgets/qr_scanner.dart';

/// Mode transportasi navigasi dalam gudang
enum NavigationTransportMode {
  walking('Jalan Kaki', Icons.directions_walk_rounded, 1.2),
  palletJack('Hand Pallet', Icons.shopping_cart_outlined, 1.0),
  forklift('Forklift', Icons.forklift, 2.5);

  final String label;
  final IconData icon;
  final double speedMps; // meter per detik
  const NavigationTransportMode(this.label, this.icon, this.speedMps);
}

/// Metadata lokasi spasial (Dock atau Rak)
class _SpatialNode {
  final String id;
  final String label;
  final String zone;
  final String aisle;
  final Offset position; // koordinat pusat di kanvas (x, y)
  final Offset accessPoint; // titik akses di lorong terdekat
  final Rect bounds; // area fisik di kanvas untuk hit-test dan rendering seleksi CAD
  final bool isDock;
  final int? rackId;
  final int? objectId;

  const _SpatialNode({
    required this.id,
    required this.label,
    required this.zone,
    required this.aisle,
    required this.position,
    required this.accessPoint,
    required this.bounds,
    this.isDock = false,
    this.rackId,
    this.objectId,
  });
}

/// Halaman Penuh Navigasi Denah Gudang Interaktif (Indoor Warehouse Navigation)
class WarehouseMapScreen extends StatefulWidget {
  final String? initialDestinationRack;
  final String? initialStartRack;
  final bool isEmbeddedInShell;
  final VoidCallback? onSwitchToScanner;

  const WarehouseMapScreen({
    super.key,
    this.initialDestinationRack,
    this.initialStartRack,
    this.isEmbeddedInShell = false,
    this.onSwitchToScanner,
  });

  @override
  State<WarehouseMapScreen> createState() => _WarehouseMapScreenState();
}

class _WarehouseMapScreenState extends State<WarehouseMapScreen>
    with SingleTickerProviderStateMixin {
  final TransformationController _transformCtrl = TransformationController();
  late final AnimationController _pulseAnimCtrl;

  // State Rute
  String? _startLocationId;
  String? _destLocationId;
  NavigationTransportMode _transportMode = NavigationTransportMode.walking;
  bool _isRouteMode = false;
  List<Offset>? _backendRouteWaypoints;
  double? _backendDistanceMeters;

  // State Pemilihan & Detail
  String? _inspectedNodeId;
  bool _isListView = false;
  final TextEditingController _listSearchCtrl = TextEditingController();
  String _listQuery = '';

  // Dimensi Kanvas Denah Gudang yang Proporsional untuk Layar Mobile
  static const double _canvasWidth = 560.0;
  static const double _canvasHeight = 680.0;
  static const double _rulerThickness = 24.0;

  @override
  void initState() {
    super.initState();
    _pulseAnimCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
      value: 0.5,
    );

    if (widget.initialStartRack != null && widget.initialStartRack!.isNotEmpty) {
      _startLocationId = widget.initialStartRack!.trim().toUpperCase();
    }
    if (widget.initialDestinationRack != null &&
        widget.initialDestinationRack!.isNotEmpty) {
      _destLocationId = widget.initialDestinationRack!.trim().toUpperCase();
    }

    if (_destLocationId != null) {
      _startLocationId ??= 'DOK-1';
      _isRouteMode = true;
      _inspectedNodeId = _destLocationId;
    } else {
      _inspectedNodeId = widget.initialDestinationRack;
      _isRouteMode = false;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fitMapToScreen();
      final state = context.read<WarehouseState>();
      if (state.activeWarehouseLayout == null && !state.isLoadingLayout) {
        state.refreshWarehouseLayout();
      }
    });
  }

  @override
  void dispose() {
    _transformCtrl.dispose();
    _pulseAnimCtrl.dispose();
    _listSearchCtrl.dispose();
    super.dispose();
  }

  void _fitMapToScreen() {
    if (!mounted) return;
    final screenSize = MediaQuery.sizeOf(context);
    final scale = (screenSize.width / _canvasWidth).clamp(0.68, 1.0);
    final dx = (screenSize.width - (_canvasWidth * scale)) / 2;
    const dy = 6.0;

    _transformCtrl.value = Matrix4.identity()
      ..setEntry(0, 0, scale)
      ..setEntry(1, 1, scale)
      ..setEntry(2, 2, 1.0)
      ..setEntry(0, 3, dx)
      ..setEntry(1, 3, dy);
  }

  void _zoomIn() {
    final matrix = _transformCtrl.value.clone();
    matrix.setEntry(0, 0, matrix.entry(0, 0) * 1.25);
    matrix.setEntry(1, 1, matrix.entry(1, 1) * 1.25);
    _transformCtrl.value = matrix;
  }

  void _zoomOut() {
    final matrix = _transformCtrl.value.clone();
    matrix.setEntry(0, 0, matrix.entry(0, 0) * 0.80);
    matrix.setEntry(1, 1, matrix.entry(1, 1) * 0.80);
    _transformCtrl.value = matrix;
  }

  void _swapStartAndDestination() {
    HapticFeedback.selectionClick().ignore();
    setState(() {
      final temp = _startLocationId;
      _startLocationId = _destLocationId;
      _destLocationId = temp;
    });
  }

  Future<void> _scanQrForLocation({required bool isStart}) async {
    HapticFeedback.lightImpact().ignore();
    final scanned = await QrScannerScreen.scan(
      context,
      title: isStart ? 'Scan QR Titik Awal' : 'Scan QR Rak Tujuan',
      hintText: isStart
          ? 'Arahkan kamera ke QR/Barcode Rak atau Dok saat ini'
          : 'Arahkan kamera ke QR/Barcode Rak tujuan',
    );

    if (!mounted || scanned == null || scanned.trim().isEmpty) return;

    final normalized = scanned.trim().toUpperCase();
    setState(() {
      if (isStart) {
        _startLocationId = normalized;
      } else {
        _destLocationId = normalized;
      }
      _inspectedNodeId = normalized;
    });

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '${isStart ? 'Titik Awal' : 'Tujuan'}: $normalized berhasil dipilih',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        backgroundColor: brand,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _showLocationPicker({
    required bool isStart,
    required Map<String, _SpatialNode> allNodes,
  }) async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return _LocationPickerSheet(
          title: isStart ? 'Pilih Titik Awal (Start)' : 'Pilih Rak Tujuan (Destination)',
          currentSelectedId: isStart ? _startLocationId : _destLocationId,
          nodes: allNodes.values.toList(),
          onScanTap: () => Navigator.pop(ctx, '__SCAN__'),
        );
      },
    );

    if (!mounted || selected == null) return;

    if (selected == '__SCAN__') {
      await _scanQrForLocation(isStart: isStart);
    } else {
      setState(() {
        if (isStart) {
          _startLocationId = selected;
        } else {
          _destLocationId = selected;
        }
        _inspectedNodeId = selected;
      });
    }
  }

  Offset _mmToCanvas(double xMm, double yMm, WarehouseState s) {
    final layout = s.activeWarehouseLayout;
    final warehouse = layout?['warehouse'] as Map<String, dynamic>? ?? {};
    final whW = (warehouse['width_mm'] as num?)?.toDouble() ?? 15000.0;
    final whL = (warehouse['length_mm'] as num?)?.toDouble() ?? 10000.0;

    const margin = 28.0;
    final drawW = _canvasWidth - _rulerThickness - (margin * 2);
    final drawH = _canvasHeight - _rulerThickness - (margin * 2);
    final scale = math.min(drawW / whW, drawH / whL);
    final offsetX = _rulerThickness + margin + (drawW - (whW * scale)) / 2;
    final offsetY = _rulerThickness + margin + (drawH - (whL * scale)) / 2;

    return Offset(offsetX + (xMm * scale), offsetY + (yMm * scale));
  }

  Future<void> _fetchBackendPath(WarehouseState s, _SpatialNode start, _SpatialNode dest) async {
    if (s.token == null) return;
    final layout = s.activeWarehouseLayout;
    final whId = (layout?['warehouse']?['id'] as num?)?.toInt() ?? 1;

    String fromParam = start.id;
    if (start.isDock && start.objectId != null) {
      fromParam = 'dock_${start.objectId}';
    } else if (!start.isDock && start.rackId != null) {
      fromParam = 'rack_${start.rackId}';
    }

    String toParam = dest.id;
    if (dest.isDock && dest.objectId != null) {
      toParam = 'dock_${dest.objectId}';
    } else if (!dest.isDock && dest.rackId != null) {
      toParam = 'rack_${dest.rackId}';
    }

    try {
      final res = await s.api.getWarehousePath(
        s.token!,
        from: fromParam,
        to: toParam,
        warehouseId: whId,
      );
      if (res != null && res['path'] is List && mounted) {
        final pathList = res['path'] as List;
        final List<Offset> points = [];
        for (final item in pathList) {
          if (item is Map) {
            final x = (item['xMm'] as num?)?.toDouble() ?? 0.0;
            final y = (item['yMm'] as num?)?.toDouble() ?? 0.0;
            points.add(_mmToCanvas(x, y, s));
          }
        }
        if (points.length >= 2) {
          setState(() {
            _backendRouteWaypoints = points;
            final distanceMm = (res['total_distance_mm'] as num?)?.toDouble() ?? 0.0;
            _backendDistanceMeters = distanceMm > 0 ? distanceMm / 1000.0 : null;
          });
        }
      }
    } catch (_) {}
  }

  Map<String, _SpatialNode> _buildSpatialNodes(WarehouseState s) {
    final Map<String, _SpatialNode> nodes = {};
    final layout = s.activeWarehouseLayout;

    if (layout != null) {
      final warehouse = layout['warehouse'] as Map<String, dynamic>? ?? {};
      final whW = (warehouse['width_mm'] as num?)?.toDouble() ?? 15000.0;
      final whL = (warehouse['length_mm'] as num?)?.toDouble() ?? 10000.0;
      const margin = 28.0;
      final drawW = _canvasWidth - _rulerThickness - (margin * 2);
      final drawH = _canvasHeight - _rulerThickness - (margin * 2);
      final scale = math.min(drawW / whW, drawH / whL);
      final offsetX = _rulerThickness + margin + (drawW - (whW * scale)) / 2;
      final offsetY = _rulerThickness + margin + (drawH - (whL * scale)) / 2;

      // 1. Dok Bongkar Muat dari Layout Objects
      final layoutObjects = (layout['layoutObjects'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final docks = layoutObjects.where((o) => (o['object_type'] ?? '').toString().toLowerCase() == 'dock').toList();

      if (docks.isNotEmpty) {
        for (int i = 0; i < docks.length; i++) {
          final d = docks[i];
          final objId = (d['id'] as num?)?.toInt() ?? (i + 1);
          final code = 'DOK-$objId';
          final name = (d['name'] ?? 'Dok $objId').toString();
          final xMm = (d['x_mm'] as num?)?.toDouble() ?? 0.0;
          final yMm = (d['y_mm'] as num?)?.toDouble() ?? 0.0;
          final wMm = (d['width_mm'] as num?)?.toDouble() ?? 3000.0;
          final lMm = (d['length_mm'] as num?)?.toDouble() ?? 3000.0;

          final dx = offsetX + (xMm * scale);
          final dy = offsetY + (yMm * scale);
          final dw = wMm * scale;
          final dl = lMm * scale;
          final bounds = Rect.fromLTWH(dx, dy, dw, dl);

          nodes[code] = _SpatialNode(
            id: code,
            label: name,
            zone: 'Staging Dok',
            aisle: 'Jalur Dok $objId',
            position: bounds.center,
            accessPoint: Offset(bounds.center.dx, bounds.bottom + 16),
            bounds: bounds,
            isDock: true,
            objectId: objId,
          );
        }
      } else {
        const bounds = Rect.fromLTWH(65, 45, 90, 48);
        nodes['DOK-1'] = const _SpatialNode(
          id: 'DOK-1',
          label: 'Dok 1 (Inbound Utama)',
          zone: 'Docking Bay',
          aisle: 'Jalur Masuk Dok 1',
          position: Offset(110, 69),
          accessPoint: Offset(110, 135),
          bounds: bounds,
          isDock: true,
        );
      }

      // 2. Rak Penyimpanan Aktual dari Racks
      final racks = (layout['racks'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      for (final r in racks) {
        final rackId = (r['id'] as num?)?.toInt();
        final rawCode = (r['rack_code'] ?? '').toString().trim().toUpperCase();
        final code = rawCode.isNotEmpty ? rawCode : 'RACK-$rackId';
        final xMm = (r['x_mm'] as num?)?.toDouble() ?? 0.0;
        final yMm = (r['y_mm'] as num?)?.toDouble() ?? 0.0;
        final lenMm = (r['length_mm'] as num?)?.toDouble() ?? 2000.0;
        final depthMm = (r['depth_mm'] as num?)?.toDouble() ?? 600.0;
        final rot = (r['rotation'] as num?)?.toInt() ?? 0;

        final isRotated = rot == 90 || rot == 270;
        final wMm = isRotated ? depthMm : lenMm;
        final hMm = isRotated ? lenMm : depthMm;

        final rx = offsetX + (xMm * scale);
        final ry = offsetY + (yMm * scale);
        final rw = wMm * scale;
        final rh = hMm * scale;
        final bounds = Rect.fromLTWH(rx, ry, rw, rh);

        final zoneRaw = (r['zone_name'] ?? r['zone_code'] ?? 'Utama').toString();
        final zoneName = zoneRaw.contains('Zona') || zoneRaw.contains('Zone') ? zoneRaw : 'Zona $zoneRaw';

        final aisleList = (r['aisle_access'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        String aisleName = 'Lorong Utama';
        if (aisleList.isNotEmpty) {
          final firstAisle = aisleList.first;
          aisleName = (firstAisle['aisle_code'] ?? firstAisle['name'] ?? 'Lorong').toString();
        }

        nodes[code] = _SpatialNode(
          id: code,
          label: 'Rak $code',
          zone: zoneName,
          aisle: aisleName,
          position: bounds.center,
          accessPoint: Offset(bounds.center.dx, bounds.bottom + 20),
          bounds: bounds,
          isDock: false,
          rackId: rackId,
        );
      }

      // 3. Tambahkan Rak dari Master Locations yang belum terdaftar di layout jika ada
      for (final loc in s.locations) {
        final code = (loc['location_code'] ?? '').toString().trim().toUpperCase();
        if (code.isEmpty || nodes.containsKey(code)) continue;

        final zoneRaw = (loc['zone'] ?? 'A').toString().toUpperCase();
        final zoneName = zoneRaw.contains('ZONA') ? zoneRaw : 'Zona $zoneRaw';

        final double cx = offsetX + (whW * scale * 0.5);
        final double cy = offsetY + (whL * scale * 0.5);
        final bounds = Rect.fromLTWH(cx - 30, cy - 15, 60, 30);

        nodes[code] = _SpatialNode(
          id: code,
          label: code,
          zone: zoneName,
          aisle: 'Lorong Bebas',
          position: Offset(cx, cy),
          accessPoint: Offset(cx, cy + 20),
          bounds: bounds,
          isDock: false,
        );
      }

      if (nodes.isNotEmpty) {
        return nodes;
      }
    }

    // Default Fallback Layout jika layout dari backend belum siap / offline
    nodes['DOK-1'] = const _SpatialNode(
      id: 'DOK-1',
      label: 'Dok 1 (Inbound Utama)',
      zone: 'Docking Bay',
      aisle: 'Jalur Masuk Dok 1',
      position: Offset(65, 55),
      accessPoint: Offset(65, 135),
      bounds: Rect.fromLTWH(30, 35, 70, 40),
      isDock: true,
    );
    nodes['DOK-2'] = const _SpatialNode(
      id: 'DOK-2',
      label: 'Dok 2 (Inbound Fast)',
      zone: 'Docking Bay',
      aisle: 'Jalur Masuk Dok 2',
      position: Offset(175, 55),
      accessPoint: Offset(175, 135),
      bounds: Rect.fromLTWH(140, 35, 70, 40),
      isDock: true,
    );
    nodes['DOK-3'] = const _SpatialNode(
      id: 'DOK-3',
      label: 'Dok 3 (Outbound Dispatch)',
      zone: 'Docking Bay',
      aisle: 'Jalur Keluar Dok 3',
      position: Offset(285, 55),
      accessPoint: Offset(285, 135),
      bounds: Rect.fromLTWH(250, 35, 70, 40),
      isDock: true,
    );
    nodes['DOK-4'] = const _SpatialNode(
      id: 'DOK-4',
      label: 'Dok 4 (Outbound Ready)',
      zone: 'Docking Bay',
      aisle: 'Jalur Keluar Dok 4',
      position: Offset(395, 55),
      accessPoint: Offset(395, 135),
      bounds: Rect.fromLTWH(360, 35, 70, 40),
      isDock: true,
    );

    final defaultRackCoords = <String, Map<String, dynamic>>{
      'RACK-A1-01-A': {'pos': const Offset(55, 185), 'acc': const Offset(75, 185), 'z': 'Zona A', 'a': 'Lorong 1'},
      'RACK-A1-02-B': {'pos': const Offset(55, 255), 'acc': const Offset(75, 255), 'z': 'Zona A', 'a': 'Lorong 1'},
      'RACK-A2-01-A': {'pos': const Offset(165, 185), 'acc': const Offset(185, 185), 'z': 'Zona A', 'a': 'Lorong 2'},
      'RACK-A2-02-B': {'pos': const Offset(165, 255), 'acc': const Offset(185, 255), 'z': 'Zona A', 'a': 'Lorong 2'},
      'RACK-B1-01-A': {'pos': const Offset(275, 185), 'acc': const Offset(295, 185), 'z': 'Zona B', 'a': 'Lorong 3'},
      'RACK-B1-02-B': {'pos': const Offset(275, 255), 'acc': const Offset(295, 255), 'z': 'Zona B', 'a': 'Lorong 3'},
      'RACK-B2-01-A': {'pos': const Offset(385, 185), 'acc': const Offset(405, 185), 'z': 'Zona B', 'a': 'Lorong 4'},
      'RACK-B2-02-B': {'pos': const Offset(385, 255), 'acc': const Offset(405, 255), 'z': 'Zona B', 'a': 'Lorong 4'},
      'RACK-C1-01-A': {'pos': const Offset(55, 385), 'acc': const Offset(75, 385), 'z': 'Zona C', 'a': 'Lorong 5'},
      'RACK-C1-02-B': {'pos': const Offset(55, 455), 'acc': const Offset(75, 455), 'z': 'Zona C', 'a': 'Lorong 5'},
      'RACK-C2-01-A': {'pos': const Offset(165, 385), 'acc': const Offset(185, 385), 'z': 'Zona C', 'a': 'Lorong 6'},
      'RACK-D1-01-A': {'pos': const Offset(275, 385), 'acc': const Offset(295, 385), 'z': 'Zona D', 'a': 'Lorong 7'},
      'RACK-D1-02-B': {'pos': const Offset(275, 455), 'acc': const Offset(295, 455), 'z': 'Zona D', 'a': 'Lorong 7'},
      'RACK-D2-01-A': {'pos': const Offset(385, 385), 'acc': const Offset(405, 385), 'z': 'Zona D', 'a': 'Lorong 8'},
    };

    defaultRackCoords.forEach((id, val) {
      final pos = val['pos'] as Offset;
      nodes[id] = _SpatialNode(
        id: id,
        label: id,
        zone: val['z'] as String,
        aisle: val['a'] as String,
        position: pos,
        accessPoint: val['acc'] as Offset,
        bounds: Rect.fromLTWH(pos.dx - 30, pos.dy - 15, 60, 30),
        isDock: false,
      );
    });

    return nodes;
  }

  Map<String, Map<String, dynamic>> _aggregateRackItems(
    WarehouseState s,
    Map<String, _SpatialNode> nodes,
  ) {
    final Map<String, Map<String, dynamic>> result = {};

    for (final entry in nodes.entries) {
      result[entry.key] = {
        'node': entry.value,
        'items': <StockItem>[],
        'totalUnits': 0,
      };
    }

    for (final item in s.items) {
      for (final rc in item.rackCounts.entries) {
        final code = rc.key.trim().toUpperCase();
        if (code.isEmpty || rc.value <= 0) continue;
        if (result.containsKey(code)) {
          (result[code]!['items'] as List<StockItem>).add(item);
          result[code]!['totalUnits'] = (result[code]!['totalUnits'] as int) + rc.value;
        }
      }

      if (item.rackCounts.isEmpty && item.rack.isNotEmpty && item.quantity > 0) {
        final code = item.rack.trim().toUpperCase();
        if (result.containsKey(code)) {
          final list = result[code]!['items'] as List<StockItem>;
          if (!list.any((i) => i.sku == item.sku)) {
            list.add(item);
            result[code]!['totalUnits'] = (result[code]!['totalUnits'] as int) + item.quantity;
          }
        }
      }
    }

    return result;
  }

  List<Offset> _calculateRoutePath(_SpatialNode start, _SpatialNode dest) {
    final List<Offset> waypoints = [];
    waypoints.add(start.position);
    waypoints.add(start.accessPoint);

    if ((start.accessPoint.dx - dest.accessPoint.dx).abs() < 10) {
      waypoints.add(dest.accessPoint);
      waypoints.add(dest.position);
      return waypoints;
    }

    double corridorY;
    if (start.isDock || dest.isDock) {
      corridorY = 135.0;
    } else {
      final avgY = (start.accessPoint.dy + dest.accessPoint.dy) / 2;
      if (avgY < 260) {
        corridorY = 135.0;
      } else if (avgY > 440) {
        corridorY = 535.0;
      } else {
        corridorY = 335.0;
      }
    }

    waypoints.add(Offset(start.accessPoint.dx, corridorY));
    waypoints.add(Offset(dest.accessPoint.dx, corridorY));
    waypoints.add(dest.accessPoint);
    waypoints.add(dest.position);

    return waypoints;
  }

  double _calculateDistanceMeters(List<Offset> path) {
    if (path.length < 2) return 0.0;
    double totalPx = 0.0;
    for (int i = 0; i < path.length - 1; i++) {
      totalPx += (path[i] - path[i + 1]).distance;
    }
    return totalPx / 10.0;
  }

  List<String> _generateDirections(_SpatialNode start, _SpatialNode dest, double distance) {
    final List<String> steps = [];
    steps.add('Mulai dari ${start.label} (${start.zone})');

    if (start.isDock) {
      steps.add('Keluar dari gerbang ${start.id} menuju Staging Area');
      steps.add('Masuk ke Koridor Utama Utara');
    } else {
      steps.add('Keluar ke ${start.aisle}');
    }

    if ((start.accessPoint.dx - dest.accessPoint.dx).abs() < 10) {
      steps.add('Lurus terus di ${start.aisle} sejauh ${(distance * 0.8).round()} m');
    } else {
      final headingEast = dest.accessPoint.dx > start.accessPoint.dx;
      steps.add('Belok ${headingEast ? 'Kanan' : 'Kiri'} ke Koridor Penghubung Utama');
      steps.add('Belok menuju ${dest.aisle}');
    }

    steps.add('Tiba di ${dest.label} (${dest.zone})');
    return steps;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final allNodes = _buildSpatialNodes(s);
    final rackData = _aggregateRackItems(s, allNodes);

    if (_inspectedNodeId == null || !allNodes.containsKey(_inspectedNodeId)) {
      if (allNodes.isNotEmpty) {
        _inspectedNodeId = allNodes.keys.firstWhere(
          (k) => !allNodes[k]!.isDock,
          orElse: () => allNodes.keys.first,
        );
      }
    }

    _SpatialNode? startNode;
    _SpatialNode? destNode;

    if (_startLocationId != null) {
      startNode = allNodes[_startLocationId] ??
          _SpatialNode(
            id: _startLocationId!,
            label: _startLocationId!,
            zone: 'Lokasi Bebas',
            aisle: 'Lorong Utama',
            position: const Offset(75, 185),
            accessPoint: const Offset(75, 185),
            bounds: const Rect.fromLTWH(60, 175, 30, 20),
          );
    }

    if (_destLocationId != null) {
      destNode = allNodes[_destLocationId] ??
          _SpatialNode(
            id: _destLocationId!,
            label: _destLocationId!,
            zone: 'Lokasi Bebas',
            aisle: 'Lorong Utama',
            position: const Offset(295, 255),
            accessPoint: const Offset(295, 255),
            bounds: const Rect.fromLTWH(280, 245, 30, 20),
          );
    }

    List<Offset> routePath = [];
    double distanceMeters = 0.0;
    int estimatedSeconds = 0;
    List<String> steps = [];

    if (startNode != null && destNode != null) {
      if (_backendRouteWaypoints != null && _backendRouteWaypoints!.length >= 2) {
        routePath = _backendRouteWaypoints!;
        distanceMeters = _backendDistanceMeters ?? _calculateDistanceMeters(routePath);
      } else {
        routePath = _calculateRoutePath(startNode, destNode);
        distanceMeters = _calculateDistanceMeters(routePath);
      }
      estimatedSeconds = (distanceMeters / _transportMode.speedMps).round();
      steps = _generateDirections(startNode, destNode, distanceMeters);
    }

    final inspectedNode =
        _inspectedNodeId != null ? allNodes[_inspectedNodeId] : null;
    final inspectedRackDetails =
        _inspectedNodeId != null ? rackData[_inspectedNodeId] : null;

    final topOffset = widget.isEmbeddedInShell ? (MediaQuery.paddingOf(context).top + 68.0) : 0.0;
    final bottomOffset = widget.isEmbeddedInShell ? 136.0 : 0.0;
    final isRouteActive = _isRouteMode && (startNode != null || destNode != null);

    final content = Container(
      color: canvas,
      padding: EdgeInsets.only(top: topOffset, bottom: bottomOffset),
      child: _isListView
          ? Column(
              children: [
                _buildListViewHeader(),
                Expanded(child: _buildListViewLayout(s, allNodes, rackData)),
              ],
            )
          : Stack(
              children: [
                // 1. KANVAS PETA 2D LENGKAP (FULLSCREEN BACKGROUND)
                Positioned.fill(
                  child: InteractiveViewer(
                    transformationController: _transformCtrl,
                    minScale: 0.5,
                    maxScale: 2.5,
                    boundaryMargin: const EdgeInsets.all(250),
                    child: Center(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapUp: (details) {
                          final tapPos = details.localPosition;
                          for (final node in allNodes.values) {
                            if (node.bounds.inflate(6.0).contains(tapPos)) {
                              HapticFeedback.selectionClick().ignore();
                              setState(() {
                                _inspectedNodeId = node.id;
                              });
                              final start = allNodes[_startLocationId];
                              if (start != null && _isRouteMode) {
                                _fetchBackendPath(s, start, node);
                              }
                              return;
                            }
                          }
                        },
                        child: Container(
                          width: _canvasWidth,
                          height: _canvasHeight,
                          color: const Color(0xfff8f9f5), // PALETTE.canvasBg dari web layout
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              CustomPaint(
                                size: const Size(_canvasWidth, _canvasHeight),
                                painter: _WarehouseFloorPlanPainter(
                                  layout: s.activeWarehouseLayout,
                                  allNodes: allNodes,
                                  inspectedNodeId: _inspectedNodeId,
                                  isRouteActive: isRouteActive,
                                  startLocationId: _startLocationId,
                                  destLocationId: _destLocationId,
                                  pulseProgress: _pulseAnimCtrl.value,
                                ),
                              ),
                              if (routePath.length >= 2 && isRouteActive)
                                CustomPaint(
                                  size: const Size(_canvasWidth, _canvasHeight),
                                  painter: _RouteNavigationPainter(
                                    waypoints: routePath,
                                    pulseProgress: _pulseAnimCtrl.value,
                                    routeColor: brand,
                                  ),
                                ),

                              // PIN MERAH ALA GOOGLE MAPS TEPAT DI ATAS RAK/DOK YANG DIPILIH
                              if (inspectedNode != null && !isRouteActive)
                                Positioned(
                                  left: inspectedNode.position.dx - 19,
                                  top: inspectedNode.bounds.top - 38,
                                  child: IgnorePointer(
                                    child: _GoogleMapsRedPin(
                                      pulseProgress: _pulseAnimCtrl.value,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                // 2. FLOATING BAR DI ATAS (Google Maps Search Bar atau Route Card)
                Positioned(
                  top: 10,
                  left: 14,
                  right: 14,
                  child: isRouteActive
                      ? _buildGoogleMapsRouteHeader(allNodes, startNode, destNode)
                      : _buildGoogleMapsSearchBar(allNodes, inspectedNode),
                ),

                // 3. FLOATING KONTROL RECENTER & ZOOM (ALA GOOGLE MAPS)
                Positioned(
                  right: 14,
                  bottom: (inspectedNode != null || isRouteActive) ? 172 : 24,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Tombol Recenter / My Location bulat putih dengan target biru
                      _buildRoundMapButton(
                        icon: Icons.my_location_rounded,
                        iconColor: const Color(0xff2563eb),
                        tooltip: 'Pusatkan Denah Peta',
                        onTap: _fitMapToScreen,
                      ),
                      const SizedBox(height: 10),
                      // Tombol Zoom In & Out
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: line),
                          boxShadow: const [
                            BoxShadow(color: Color(0x18000000), blurRadius: 6, offset: Offset(0, 2)),
                          ],
                        ),
                        child: Column(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.add_rounded, size: 20, color: brandInk),
                              onPressed: _zoomIn,
                              tooltip: 'Perbesar',
                              visualDensity: VisualDensity.compact,
                            ),
                            Container(width: 20, height: 1, color: line),
                            IconButton(
                              icon: const Icon(Icons.remove_rounded, size: 20, color: brandInk),
                              onPressed: _zoomOut,
                              tooltip: 'Perkecil',
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // 4. FLOATING BOTTOM SHEET (Place Sheet atau Route Sheet ala Google Maps)
                if (isRouteActive)
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 8,
                    child: _buildGoogleMapsRouteSheet(
                      startNode: startNode,
                      destNode: destNode,
                      distanceMeters: distanceMeters,
                      estimatedSeconds: estimatedSeconds,
                      steps: steps,
                    ),
                  )
                else if (inspectedNode != null)
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 8,
                    child: _buildGoogleMapsPlaceSheet(
                      s: s,
                      inspectedNode: inspectedNode,
                      inspectedRackDetails: inspectedRackDetails,
                      allNodes: allNodes,
                    ),
                  ),
              ],
            ),
    );

    if (widget.isEmbeddedInShell) {
      return SizedBox.expand(child: content);
    }

    return Scaffold(
      backgroundColor: const Color(0xfff1f5f9),
      body: SafeArea(child: content),
    );
  }

  // Header Mode List View
  Widget _buildListViewHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Daftar Semua Rak & Dok Gudang',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: brandInk),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: brandSoft,
              foregroundColor: brand,
              visualDensity: VisualDensity.compact,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.map_rounded, size: 16),
            label: const Text('Buka Peta 2D', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
            onPressed: () => setState(() => _isListView = false),
          ),
        ],
      ),
    );
  }

  // Tombol Bulat Mengambang (Recenter)
  Widget _buildRoundMapButton({
    required IconData icon,
    required Color iconColor,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: Color(0x18000000), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: iconColor, size: 20),
        tooltip: tooltip,
        visualDensity: VisualDensity.compact,
        onPressed: onTap,
      ),
    );
  }

  // 1. Floating Google Maps Search Bar (Mode Eksplorasi)
  Widget _buildGoogleMapsSearchBar(
    Map<String, _SpatialNode> allNodes,
    _SpatialNode? inspectedNode,
  ) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: line),
        boxShadow: const [
          BoxShadow(color: Color(0x18000000), blurRadius: 10, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          const Icon(Icons.search_rounded, color: brandSlate, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: InkWell(
              onTap: () => _showLocationPicker(isStart: false, allNodes: allNodes),
              child: Text(
                inspectedNode != null ? inspectedNode.label : 'Cari kode rak, dok, atau SKU...',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: inspectedNode != null ? FontWeight.w800 : FontWeight.w500,
                  color: inspectedNode != null ? brandInk : muted,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          if (inspectedNode != null)
            IconButton(
              icon: const Icon(Icons.close_rounded, size: 18, color: brandSlate),
              visualDensity: VisualDensity.compact,
              tooltip: 'Hapus Pilihan',
              onPressed: () => setState(() => _inspectedNodeId = null),
            ),
          InkWell(
            onTap: () => _scanQrForLocation(isStart: false),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(6),
              child: const Icon(Icons.qr_code_scanner_rounded, size: 20, color: brand),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            tooltip: _isListView ? 'Tampilkan Denah Peta' : 'Tampilkan Daftar Rak',
            icon: Icon(
              _isListView ? Icons.map_rounded : Icons.view_list_rounded,
              color: brandInk,
              size: 20,
            ),
            visualDensity: VisualDensity.compact,
            onPressed: () => setState(() => _isListView = !_isListView),
          ),
        ],
      ),
    );
  }

  // 2. Floating Google Maps Route Header (Mode Rute Navigasi)
  Widget _buildGoogleMapsRouteHeader(
    Map<String, _SpatialNode> allNodes,
    _SpatialNode? startNode,
    _SpatialNode? destNode,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: line),
        boxShadow: const [
          BoxShadow(color: Color(0x18000000), blurRadius: 10, offset: Offset(0, 3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Tombol Kembali ke Mode Eksplorasi
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded, size: 20, color: brandInk),
                visualDensity: VisualDensity.compact,
                tooltip: 'Tutup Rute Navigasi',
                onPressed: () {
                  setState(() {
                    _isRouteMode = false;
                    _startLocationId = null;
                  });
                },
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Column(
                  children: [
                    // Input Titik Awal
                    InkWell(
                      onTap: () => _showLocationPicker(isStart: true, allNodes: allNodes),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xfff8fafc),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xffe2e8f0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                color: Color(0xff16a34a),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                startNode != null ? startNode.label : 'Pilih titik awal...',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: startNode != null ? FontWeight.w800 : FontWeight.w500,
                                  color: startNode != null ? brandInk : muted,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            InkWell(
                              onTap: () => _scanQrForLocation(isStart: true),
                              child: const Icon(Icons.qr_code_scanner_rounded, size: 14, color: brand),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    // Input Titik Tujuan
                    InkWell(
                      onTap: () => _showLocationPicker(isStart: false, allNodes: allNodes),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xfff8fafc),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xffe2e8f0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_on_rounded, size: 12, color: Color(0xffe11d48)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                destNode != null ? destNode.label : 'Pilih tujuan...',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: destNode != null ? FontWeight.w800 : FontWeight.w500,
                                  color: destNode != null ? brandInk : muted,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            InkWell(
                              onTap: () => _scanQrForLocation(isStart: false),
                              child: const Icon(Icons.qr_code_scanner_rounded, size: 14, color: Color(0xffe11d48)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                tooltip: 'Tukar Posisi',
                icon: const Icon(Icons.swap_vert_rounded, color: brand, size: 22),
                visualDensity: VisualDensity.compact,
                onPressed: _swapStartAndDestination,
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Baris Pilihan Mode Transportasi
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: NavigationTransportMode.values.map((mode) {
              final isSel = _transportMode == mode;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick().ignore();
                    setState(() => _transportMode = mode);
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isSel ? brand : const Color(0xfff8fafc),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isSel ? brand : line),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(mode.icon, size: 13, color: isSel ? Colors.white : brandSlate),
                        const SizedBox(width: 4),
                        Text(
                          mode.label,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                            color: isSel ? Colors.white : brandInk,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // 3. Floating Google Maps Place Sheet (Sesuai Persis Tangkapan Layar Pengguna)
  Widget _buildGoogleMapsPlaceSheet({
    required WarehouseState s,
    required _SpatialNode inspectedNode,
    required Map<String, dynamic>? inspectedRackDetails,
    required Map<String, _SpatialNode> allNodes,
  }) {
    final totalUnits = (inspectedRackDetails?['totalUnits'] as int?) ?? 0;
    final items = (inspectedRackDetails?['items'] as List<StockItem>?) ?? [];

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: line),
        boxShadow: const [
          BoxShadow(color: Color(0x1a000000), blurRadius: 14, offset: Offset(0, 3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle tengah
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: const Color(0xffcbd5e1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header Informasi Tempat / Rak
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inspectedNode.id,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.2,
                        color: brandInk,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            '${inspectedNode.zone} • ${inspectedNode.aisle}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: brandSlate,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: totalUnits > 0 ? const Color(0xfff0fdf4) : const Color(0xfff1f5f9),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            totalUnits > 0 ? '● $totalUnits Unit' : '● Kosong',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: totalUnits > 0 ? const Color(0xff166534) : brandSlate,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.bookmark_border_rounded, size: 20, color: brandSlate),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Simpan Rak',
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Rak ${inspectedNode.id} disimpan di bookmark'),
                          duration: const Duration(seconds: 1),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: brandSlate),
                    visualDensity: VisualDensity.compact,
                    tooltip: 'Tutup Detail',
                    onPressed: () => setState(() => _inspectedNodeId = null),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Deretan Tombol Kapsul Aksi (Persis Desain Google Maps di Screenshot Pengguna)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                // 1. [ ↱ Rute ] (Primary Teal/Olive Filled Pill)
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xff0e7490),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.directions_rounded, size: 16),
                  label: const Text(
                    'Rute',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact().ignore();
                    final defaultDockId = allNodes.values
                        .firstWhere((n) => n.isDock, orElse: () => allNodes.values.first)
                        .id;
                    setState(() {
                      _destLocationId = inspectedNode.id;
                      _startLocationId ??= defaultDockId;
                      _isRouteMode = true;
                    });
                    final start = allNodes[_startLocationId];
                    if (start != null) {
                      _fetchBackendPath(s, start, inspectedNode);
                    }
                  },
                ),
                const SizedBox(width: 8),

                // 2. [ ▲ Mulai ] (Light Cyan Pill)
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xffcffafe),
                    foregroundColor: const Color(0xff0e7490),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.navigation_rounded, size: 15),
                  label: const Text(
                    'Mulai',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                  onPressed: () {
                    HapticFeedback.mediumImpact().ignore();
                    final defaultDockId = allNodes.values
                        .firstWhere((n) => n.isDock, orElse: () => allNodes.values.first)
                        .id;
                    setState(() {
                      _destLocationId = inspectedNode.id;
                      _startLocationId ??= defaultDockId;
                      _isRouteMode = true;
                    });
                    final start = allNodes[_startLocationId];
                    if (start != null) {
                      _fetchBackendPath(s, start, inspectedNode);
                    }
                  },
                ),
                const SizedBox(width: 8),

                // 3. [ 📷 Scan QR ] (Outlined Pill)
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: brandInk,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    side: const BorderSide(color: Color(0xffcbd5e1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.qr_code_scanner_rounded, size: 15, color: brand),
                  label: const Text(
                    'Scan QR',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  onPressed: () => _scanQrForLocation(isStart: false),
                ),
                const SizedBox(width: 8),

                // 4. [ 📦 Isi Stok ] (Outlined Pill)
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: brandInk,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    side: const BorderSide(color: Color(0xffcbd5e1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  icon: const Icon(Icons.inventory_2_outlined, size: 15, color: brandSlate),
                  label: Text(
                    totalUnits > 0 ? 'Stok ($totalUnits)' : 'Stok Kosong',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  onPressed: () => _showRackItemsModal(context, inspectedNode.id, items),
                ),
              ],
            ),
          ),

          // Preview Ringkas Produk di Rak jika ada
          if (items.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xfff8fafc),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xffe2e8f0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shelves, size: 14, color: brand),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      items.take(3).map((i) => '${i.sku} (${i.quantity})').join(', '),
                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: brandInk),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // 4. Floating Google Maps Route Sheet (Mode Navigasi)
  Widget _buildGoogleMapsRouteSheet({
    required _SpatialNode? startNode,
    required _SpatialNode? destNode,
    required double distanceMeters,
    required int estimatedSeconds,
    required List<String> steps,
  }) {
    final s = context.read<WarehouseState>();

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: line),
        boxShadow: const [
          BoxShadow(color: Color(0x1a000000), blurRadius: 14, offset: Offset(0, 3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: const Color(0xffcbd5e1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(_transportMode.icon, color: brand, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    '${distanceMeters.toStringAsFixed(0)} m • ~$estimatedSeconds dtk',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: brandInk),
                  ),
                ],
              ),
              TextButton(
                onPressed: () => _showTurnByTurnModal(steps, distanceMeters, estimatedSeconds),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: const Text('Detail Belokan ›', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: brand)),
              ),
            ],
          ),
          if (destNode != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: brand,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  HapticFeedback.mediumImpact().ignore();
                  s.selectRackFromMap(destNode.id);
                  if (widget.isEmbeddedInShell) {
                    widget.onSwitchToScanner?.call();
                  } else {
                    Navigator.pop(context);
                  }
                  ScaffoldMessenger.of(context).hideCurrentSnackBar();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Menuju ke rak ${destNode.id}. Siap dipindai di Scanner.',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ),
                      backgroundColor: brand,
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
                icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
                label: Text(
                  'Tiba di Rak ${destNode.id} (Buka Scanner) ›',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // Modal Daftar Stok Produk di Rak
  void _showRackItemsModal(BuildContext context, String rackCode, List<StockItem> items) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xffcbd5e1), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 12),
              Text('Daftar Stok di $rackCode', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: brandInk)),
              const SizedBox(height: 10),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text('Tidak ada produk tersimpan di rak ini.', style: TextStyle(color: brandSlate, fontSize: 12)),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: line),
                    itemBuilder: (ctx, i) {
                      final item = items[i];
                      return ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.inventory_2_outlined, color: brand, size: 20),
                        title: Text(item.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                        subtitle: Text(item.sku, style: const TextStyle(fontSize: 10, color: brandSlate)),
                        trailing: Text('${item.quantity} unit', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: brandInk)),
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showTurnByTurnModal(List<String> steps, double distanceMeters, int estimatedSeconds) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xffcbd5e1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Panduan Arah Langkah demi Langkah',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: brandInk),
                  ),
                  Text(
                    '${distanceMeters.toStringAsFixed(0)} m • $estimatedSeconds dtk',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: brand),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: steps.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, color: line),
                  itemBuilder: (ctx, i) {
                    final isFirst = i == 0;
                    final isLast = i == steps.length - 1;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: isFirst
                                  ? const Color(0xfff0fdf4)
                                  : isLast
                                      ? const Color(0xfffff1f2)
                                      : const Color(0xfff8fafc),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isFirst
                                    ? const Color(0xff86efac)
                                    : isLast
                                        ? const Color(0xfffecdd3)
                                        : const Color(0xffcbd5e1),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '${i + 1}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: isFirst
                                      ? const Color(0xff166534)
                                      : isLast
                                          ? const Color(0xffe11d48)
                                          : brandInk,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              steps[i],
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isLast || isFirst ? FontWeight.w800 : FontWeight.w600,
                                color: brandInk,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildListViewLayout(
    WarehouseState s,
    Map<String, _SpatialNode> allNodes,
    Map<String, Map<String, dynamic>> rackData,
  ) {
    final filtered = allNodes.values.where((node) {
      if (_listQuery.isEmpty) return true;
      final matchId = node.id.toLowerCase().contains(_listQuery);
      final matchZone = node.zone.toLowerCase().contains(_listQuery);
      final matchAisle = node.aisle.toLowerCase().contains(_listQuery);
      return matchId || matchZone || matchAisle;
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
          child: TextField(
            controller: _listSearchCtrl,
            onChanged: (v) => setState(() => _listQuery = v.trim().toLowerCase()),
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: brandInk),
            decoration: InputDecoration(
              hintText: 'Cari kode rak (cth: RACK-A1, DOK-1)...',
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: brandSlate),
              suffixIcon: _listQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 16),
                      onPressed: () {
                        _listSearchCtrl.clear();
                        setState(() => _listQuery = '');
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: line)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: brand, width: 1.5)),
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            itemCount: filtered.length,
            itemBuilder: (ctx, i) {
              final node = filtered[i];
              final data = rackData[node.id];
              final totalUnits = (data?['totalUnits'] as int?) ?? 0;
              final isStart = node.id == _startLocationId;
              final isDest = node.id == _destLocationId;

              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isStart
                        ? const Color(0xff16a34a)
                        : isDest
                            ? const Color(0xffe11d48)
                            : line,
                    width: (isStart || isDest) ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: node.isDock ? const Color(0xfffef3c7) : brandSoft,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Center(
                        child: Icon(
                          node.isDock ? Icons.local_shipping_rounded : Icons.grid_view_rounded,
                          color: node.isDock ? const Color(0xffb45309) : brand,
                          size: 15,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            node.id,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, fontFamily: 'monospace', color: brandInk),
                          ),
                          Text(
                            '${node.zone} • ${node.aisle} • ${totalUnits > 0 ? '$totalUnits Unit' : 'Kosong'}',
                            style: const TextStyle(fontSize: 10, color: brandSlate),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        IconButton(
                          tooltip: 'Set Awal',
                          icon: Icon(Icons.trip_origin_rounded, color: isStart ? const Color(0xff16a34a) : brandSlate, size: 18),
                          visualDensity: VisualDensity.compact,
                          onPressed: () {
                            setState(() {
                              _startLocationId = node.id;
                              _isListView = false;
                            });
                          },
                        ),
                        IconButton(
                          tooltip: 'Set Tujuan',
                          icon: Icon(Icons.flag_rounded, color: isDest ? const Color(0xffe11d48) : brandSlate, size: 18),
                          visualDensity: VisualDensity.compact,
                          onPressed: () {
                            setState(() {
                              _destLocationId = node.id;
                              _isListView = false;
                            });
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Pin Merah Khas Google Maps untuk Menandai Lokasi/Rak yang Dipilih di Peta
class _GoogleMapsRedPin extends StatelessWidget {
  final double pulseProgress;

  const _GoogleMapsRedPin({required this.pulseProgress});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.translate(
          offset: Offset(0, -pulseProgress * 4),
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(
                Icons.location_on_rounded,
                color: Color(0xffea4335), // Warna Merah Google Maps
                size: 38,
                shadows: [
                  Shadow(color: Color(0x3a000000), blurRadius: 6, offset: Offset(0, 3)),
                ],
              ),
              Positioned(
                top: 8,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 8,
          height: 3,
          decoration: BoxDecoration(
            color: Colors.black26,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ],
    );
  }
}

Color _parseColor(String? hexString, {Color defaultColor = const Color(0xff5c732b)}) {
  if (hexString == null || hexString.isEmpty) return defaultColor;
  try {
    String hex = hexString.replaceAll('#', '');
    if (hex.length == 6) {
      hex = 'FF$hex';
    }
    return Color(int.parse(hex, radix: 16));
  } catch (_) {
    return defaultColor;
  }
}

/// CustomPainter untuk Denah Arsitektur CAD Gudang 2D (100% Sesuai Web Layout Engine)
class _WarehouseFloorPlanPainter extends CustomPainter {
  final Map<String, dynamic>? layout;
  final Map<String, _SpatialNode> allNodes;
  final String? inspectedNodeId;
  final bool isRouteActive;
  final String? startLocationId;
  final String? destLocationId;
  final double pulseProgress;

  _WarehouseFloorPlanPainter({
    this.layout,
    required this.allNodes,
    this.inspectedNodeId,
    this.isRouteActive = false,
    this.startLocationId,
    this.destLocationId,
    this.pulseProgress = 0.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final warehouse = layout?['warehouse'] as Map<String, dynamic>? ?? {};
    final whW = (warehouse['width_mm'] as num?)?.toDouble() ?? 15000.0;
    final whL = (warehouse['length_mm'] as num?)?.toDouble() ?? 10000.0;
    const margin = 28.0;
    const rulerThickness = 24.0;
    final drawW = size.width - rulerThickness - (margin * 2);
    final drawH = size.height - rulerThickness - (margin * 2);
    final scale = math.min(drawW / whW, drawH / whL);
    final offsetX = rulerThickness + margin + (drawW - (whW * scale)) / 2;
    final offsetY = rulerThickness + margin + (drawH - (whL * scale)) / 2;

    final outerRect = Rect.fromLTWH(offsetX, offsetY, whW * scale, whL * scale);

    // 1. Canvas Background
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xfff8f9f5));

    // 2. Lantai Gudang & Grid Arsitektur (1m minor & 5m major)
    canvas.drawRect(outerRect, Paint()..color = Colors.white);

    canvas.save();
    canvas.clipRect(outerRect);
    final minorGridPaint = Paint()
      ..color = const Color(0xffe2e7dc)
      ..strokeWidth = 0.75;
    final majorGridPaint = Paint()
      ..color = const Color(0xffb5c4a5)
      ..strokeWidth = 1.2;

    for (double x = 1000; x < whW; x += 1000) {
      final isMajor = (x % 5000) == 0;
      final cx = offsetX + (x * scale);
      canvas.drawLine(
        Offset(cx, offsetY),
        Offset(cx, offsetY + (whL * scale)),
        isMajor ? majorGridPaint : minorGridPaint,
      );
    }
    for (double y = 1000; y < whL; y += 1000) {
      final isMajor = (y % 5000) == 0;
      final cy = offsetY + (y * scale);
      canvas.drawLine(
        Offset(offsetX, cy),
        Offset(offsetX + (whW * scale), cy),
        isMajor ? majorGridPaint : minorGridPaint,
      );
    }
    canvas.restore();

    // Dinding Perimeter Gudang (2.5px Ink Charcoal)
    final wallPaint = Paint()
      ..color = const Color(0xff191d17)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    canvas.drawRect(outerRect, wallPaint);

    // 3. Zona Gudang (Translucent Fill & Border)
    final zones = (layout?['zones'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final z in zones) {
      final zx = offsetX + (((z['x_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final zy = offsetY + (((z['y_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final zw = ((z['width_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final zl = ((z['length_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final colorHex = (z['color_hex'] ?? '#5c732b').toString();
      final zoneColor = _parseColor(colorHex);
      final zoneRect = Rect.fromLTWH(zx, zy, zw, zl);

      canvas.drawRect(zoneRect, Paint()..color = zoneColor.withValues(alpha: 0.10));
      canvas.drawRect(
        zoneRect,
        Paint()
          ..color = zoneColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );

      final zoneName = (z['name'] ?? z['zone_code'] ?? 'ZONA').toString().toUpperCase();
      if (zw > 24) {
        _drawText(
          canvas,
          zoneName,
          Offset(zx + 6, zy + 6),
          TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w900,
            color: zoneColor,
            letterSpacing: 0.3,
          ),
        );
        _drawOrientationBadge(canvas, zoneRect, zw >= zl);
      }
    }

    // 4. Lorong & Jalur Lintasan (Aisles - Two Pass Rendering)
    final aisles = (layout?['aisles'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    // Pass 1: Floor Bed Fills (Menyatukan persimpangan)
    for (final a in aisles) {
      final ax = offsetX + (((a['x_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final ay = offsetY + (((a['y_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final aw = ((a['width_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final al = ((a['length_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final aisleRect = Rect.fromLTWH(ax, ay, aw, al);

      final isBoth = a['type'] == 'both' ||
          a['direction'] == 'both' ||
          (a['is_both'] == true) ||
          (a['name'] ?? '').toString().toLowerCase().contains('bersama');
      final isForklift = !isBoth &&
          ((a['name'] ?? '').toString().toLowerCase().contains('forklift') ||
              (a['aisle_code'] ?? '').toString().toLowerCase().contains('forklift') ||
              a['direction'] == 'forklift');

      if (isBoth) {
        // Base fill kuning + diagonal stripes hijau 45 derajat
        canvas.drawRect(aisleRect, Paint()..color = const Color(0xfffef08a));
        canvas.save();
        canvas.clipRect(aisleRect);
        final stripePaint = Paint()
          ..color = const Color(0xff16a34a)
          ..strokeWidth = 2.0;
        final span = aw + al;
        for (double s = -span; s <= span * 2; s += 10.0) {
          canvas.drawLine(Offset(ax + s, ay - 10), Offset(ax + s + al + 20, ay + al + 10), stripePaint);
        }
        canvas.restore();
      } else if (isForklift) {
        canvas.drawRect(aisleRect, Paint()..color = const Color(0xfffef08a));
      } else {
        canvas.drawRect(aisleRect, Paint()..color = const Color(0xff86efac));
      }
    }

    // Pass 2: Borders, Centerlines, Badges & Labels
    for (final a in aisles) {
      final ax = offsetX + (((a['x_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final ay = offsetY + (((a['y_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final aw = ((a['width_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final al = ((a['length_mm'] as num?)?.toDouble() ?? 2000.0) * scale;
      final aisleRect = Rect.fromLTWH(ax, ay, aw, al);
      final isHoriz = aw >= al;

      final isBoth = a['type'] == 'both' ||
          a['direction'] == 'both' ||
          (a['is_both'] == true) ||
          (a['name'] ?? '').toString().toLowerCase().contains('bersama');
      final isForklift = !isBoth &&
          ((a['name'] ?? '').toString().toLowerCase().contains('forklift') ||
              (a['aisle_code'] ?? '').toString().toLowerCase().contains('forklift') ||
              a['direction'] == 'forklift');

      final borderColor = isBoth || isForklift ? const Color(0xffca8a04) : const Color(0xff16a34a);
      canvas.drawRect(
        aisleRect,
        Paint()
          ..color = borderColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = isBoth ? 1.5 : 1.2,
      );

      // Centerline dash
      final centerDashPaint = Paint()
        ..color = isBoth
            ? const Color(0x8c16a34a)
            : (isForklift ? const Color(0x73d97706) : const Color(0x6664748b))
        ..strokeWidth = 1.0;
      if (isHoriz) {
        final midY = ay + al / 2;
        for (double x = ax + 8; x < ax + aw - 8; x += 12) {
          canvas.drawLine(Offset(x, midY), Offset(math.min(x + 7, ax + aw - 8), midY), centerDashPaint);
        }
      } else {
        final midX = ax + aw / 2;
        for (double y = ay + 8; y < ay + al - 8; y += 12) {
          canvas.drawLine(Offset(midX, y), Offset(midX, math.min(y + 7, ay + al - 8)), centerDashPaint);
        }
      }

      // Label teks
      final prefix = isBoth ? '🚜🚶 ' : (isForklift ? '🚜 ' : '🚶 ');
      final code = (a['aisle_code'] ?? '').toString();
      final baseName = (a['name'] ?? (isBoth ? 'Jalur Bersama' : (isForklift ? 'Jalur Forklift' : 'Lorong'))).toString();
      final label = '$prefix$code • $baseName';
      final textColor = isBoth ? const Color(0xff14532d) : (isForklift ? const Color(0xff854d0e) : const Color(0xff14532d));

      if (aw > 24 && al > 12) {
        _drawText(
          canvas,
          label,
          Offset(ax + 4, ay + 3),
          TextStyle(fontSize: 7.0, fontWeight: FontWeight.w800, color: textColor),
        );
        _drawOrientationBadge(canvas, aisleRect, isHoriz);
      }
    }

    // 5. Objek Tata Letak: Dok Bongkar Muat & Pintu
    final layoutObjects = (layout?['layoutObjects'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final o in layoutObjects) {
      final type = (o['object_type'] ?? '').toString().toLowerCase();
      final ox = offsetX + (((o['x_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final oy = offsetY + (((o['y_mm'] as num?)?.toDouble() ?? 0.0) * scale);
      final ow = ((o['width_mm'] as num?)?.toDouble() ?? 3000.0) * scale;
      final ol = ((o['length_mm'] as num?)?.toDouble() ?? 3000.0) * scale;
      final objRect = Rect.fromLTWH(ox, oy, ow, ol);

      if (type == 'dock') {
        canvas.drawRRect(RRect.fromRectAndRadius(objRect, const Radius.circular(6)), Paint()..color = const Color(0xfffffbeb));
        canvas.drawRRect(
          RRect.fromRectAndRadius(objRect, const Radius.circular(6)),
          Paint()
            ..color = const Color(0xfff59e0b)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
        _drawText(
          canvas,
          (o['name'] ?? 'Dok Bongkar Muat').toString().toUpperCase(),
          Offset(ox + 6, oy + 5),
          const TextStyle(fontSize: 7.5, fontWeight: FontWeight.w900, color: Color(0xffb45309)),
        );

        final hazardPaint = Paint()
          ..color = const Color(0xfffde68a).withValues(alpha: 0.6)
          ..strokeWidth = 2;
        for (double x = ox + 4; x < ox + ow - 4; x += 12) {
          canvas.drawLine(Offset(x, oy + ol - 12), Offset(x + 6, oy + ol - 4), hazardPaint);
        }
      } else if (type.startsWith('door')) {
        canvas.drawRRect(RRect.fromRectAndRadius(objRect, const Radius.circular(4)), Paint()..color = const Color(0xffeff6ff));
        canvas.drawRRect(
          RRect.fromRectAndRadius(objRect, const Radius.circular(4)),
          Paint()
            ..color = const Color(0xff2563eb)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
        _drawText(
          canvas,
          (o['name'] ?? 'Pintu').toString(),
          Offset(ox + 3, oy + 3),
          const TextStyle(fontSize: 6.5, fontWeight: FontWeight.w700, color: Color(0xff1d4ed8)),
        );
      } else if (type == 'pillar') {
        canvas.drawRect(objRect, Paint()..color = const Color(0xff64748b));
      }
    }

    // 6. Rak Penyimpanan (CAD Racks dengan Divider Slot & Titik Akses)
    final racks = (layout?['racks'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    for (final r in racks) {
      final rawCode = (r['rack_code'] ?? '').toString().trim().toUpperCase();
      final code = rawCode.isNotEmpty ? rawCode : 'RACK-${r['id']}';
      final xMm = (r['x_mm'] as num?)?.toDouble() ?? 0.0;
      final yMm = (r['y_mm'] as num?)?.toDouble() ?? 0.0;
      final lenMm = (r['length_mm'] as num?)?.toDouble() ?? 2000.0;
      final depthMm = (r['depth_mm'] as num?)?.toDouble() ?? 600.0;
      final rot = (r['rotation'] as num?)?.toInt() ?? 0;

      final isRotated = rot == 90 || rot == 270;
      final wMm = isRotated ? depthMm : lenMm;
      final hMm = isRotated ? lenMm : depthMm;

      final rx = offsetX + (xMm * scale);
      final ry = offsetY + (yMm * scale);
      final rw = wMm * scale;
      final rh = hMm * scale;
      final rackRect = Rect.fromLTWH(rx, ry, rw, rh);

      final colorHex = (r['color_hex'] as String?);
      final customColor = colorHex != null && colorHex.isNotEmpty ? _parseColor(colorHex) : null;
      final fillColor = customColor != null ? customColor.withValues(alpha: 0.15) : const Color(0xffeef3e2);
      final strokeColor = customColor ?? const Color(0xff3e5510);

      // Fill & Border
      canvas.drawRect(rackRect, Paint()..color = fillColor);
      canvas.drawRect(
        rackRect,
        Paint()
          ..color = strokeColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4,
      );

      // Garis-garis tipis pembagi slot / kompartemen rak (#a78bfa violet)
      final slotPaint = Paint()
        ..color = const Color(0xffa78bfa)
        ..strokeWidth = 0.8;

      final bayCount = (r['bay_count'] as num?)?.toInt() ?? 0;
      final baseW = (r['slot_width_mm'] as num?)?.toDouble() ?? 1000.0;
      final baseD = (r['slot_depth_mm'] as num?)?.toDouble() ?? 500.0;
      final stepXMm = isRotated ? baseD : (bayCount > 1 ? lenMm / bayCount : baseW);
      final stepYMm = isRotated ? (bayCount > 1 ? lenMm / bayCount : baseW) : baseD;
      final stepX = stepXMm * scale;
      final stepY = stepYMm * scale;

      canvas.save();
      canvas.clipRect(rackRect);
      if (stepX > 4 && stepX < rw - 2) {
        for (double sx = rx + stepX; sx <= rx + rw - 2; sx += stepX) {
          canvas.drawLine(Offset(sx, ry), Offset(sx, ry + rh), slotPaint);
        }
      }
      if (stepY > 4 && stepY < rh - 2) {
        for (double sy = ry + stepY; sy <= ry + rh - 2; sy += stepY) {
          canvas.drawLine(Offset(rx, sy), Offset(rx + rw, sy), slotPaint);
        }
      }
      canvas.restore();

      // Bold centered rack code
      final isRackVert = isRotated || rh > rw;
      final fontSize = math.min(10.0, math.max(6.0, rw * 0.22));
      final span = TextSpan(
        text: code,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          fontFamily: 'monospace',
          color: const Color(0xff191d17),
        ),
      );
      final tp = TextPainter(text: span, textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(rx + (rw - tp.width) / 2, ry + (rh - tp.height) / 2));

      // Orientation badge [H] / [V]
      _drawOrientationBadge(canvas, rackRect, !isRackVert);

      // Green access dot on aisle access side
      final aisleAccess = (r['aisle_access'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final primary = aisleAccess.isNotEmpty ? aisleAccess.first : null;
      final side = primary?['access_side']?.toString() ?? 'bottom';
      final dotPaint = Paint()..color = const Color(0xff5c732b);
      const dotRadius = 2.5;

      if (side == 'left') {
        canvas.drawCircle(Offset(rx + 4, ry + rh / 2), dotRadius, dotPaint);
      } else if (side == 'right') {
        canvas.drawCircle(Offset(rx + rw - 4, ry + rh / 2), dotRadius, dotPaint);
      } else if (side == 'top') {
        canvas.drawCircle(Offset(rx + rw / 2, ry + 4), dotRadius, dotPaint);
      } else {
        canvas.drawCircle(Offset(rx + rw / 2, ry + rh - 4), dotRadius, dotPaint);
      }
    }

    // 7. Sorotan Mode Rute Navigasi (Start = Hijau, Dest = Merah)
    if (isRouteActive) {
      if (startLocationId != null && allNodes.containsKey(startLocationId)) {
        final startNode = allNodes[startLocationId]!;
        final pulseRect = startNode.bounds.inflate(3.0 + (pulseProgress * 3.0));
        canvas.drawRect(
          pulseRect,
          Paint()
            ..color = const Color(0xff16a34a).withValues(alpha: 0.4 + (pulseProgress * 0.4))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5,
        );
      }
      if (destLocationId != null && allNodes.containsKey(destLocationId)) {
        final destNode = allNodes[destLocationId]!;
        final pulseRect = destNode.bounds.inflate(3.0 + (pulseProgress * 3.0));
        canvas.drawRect(
          pulseRect,
          Paint()
            ..color = const Color(0xffe11d48).withValues(alpha: 0.4 + (pulseProgress * 0.4))
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5,
        );
      }
    }

    // 8. CAD Selection Box & 4 Corner Handles (#0284c7)
    if (inspectedNodeId != null && allNodes.containsKey(inspectedNodeId)) {
      final selBounds = allNodes[inspectedNodeId]!.bounds;
      // Blue selection fill
      canvas.drawRect(selBounds, Paint()..color = const Color(0x260284c7));
      // Blue selection border
      final selBorderPaint = Paint()
        ..color = const Color(0xff0284c7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;
      canvas.drawRect(selBounds, selBorderPaint);

      // 4 Corner handles (kotak putih dengan border biru)
      const handleSize = 6.0;
      final handleFillPaint = Paint()..color = Colors.white;
      final handleBorderPaint = Paint()
        ..color = const Color(0xff0284c7)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2;

      final handlePoints = [
        Offset(selBounds.left, selBounds.top),
        Offset(selBounds.right, selBounds.top),
        Offset(selBounds.left, selBounds.bottom),
        Offset(selBounds.right, selBounds.bottom),
      ];

      for (final p in handlePoints) {
        final hRect = Rect.fromCenter(center: p, width: handleSize, height: handleSize);
        canvas.drawRect(hRect, handleFillPaint);
        canvas.drawRect(hRect, handleBorderPaint);
      }
    }

    // 9. CAD Rulers di Sisi Atas dan Kiri (24px, 100% Persis Web Renderer)
    _drawScreenRulers(
      canvas: canvas,
      size: size,
      rulerThickness: rulerThickness,
      whW: whW,
      whL: whL,
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY,
    );
  }

  void _drawScreenRulers({
    required Canvas canvas,
    required Size size,
    required double rulerThickness,
    required double whW,
    required double whL,
    required double scale,
    required double offsetX,
    required double offsetY,
  }) {
    final w = size.width;
    final h = size.height;

    // 1. Top Horizontal Ruler Background
    final topRulerRect = Rect.fromLTWH(rulerThickness, 0, w - rulerThickness, rulerThickness);
    canvas.drawRect(topRulerRect, Paint()..color = const Color(0xfff8f9f5));
    canvas.drawLine(
      Offset(rulerThickness, rulerThickness),
      Offset(w, rulerThickness),
      Paint()..color = const Color(0xffd4dacb)..strokeWidth = 1.0,
    );

    // 2. Left Vertical Ruler Background
    final leftRulerRect = Rect.fromLTWH(0, rulerThickness, rulerThickness, h - rulerThickness);
    canvas.drawRect(leftRulerRect, Paint()..color = const Color(0xfff8f9f5));
    canvas.drawLine(
      Offset(rulerThickness, rulerThickness),
      Offset(rulerThickness, h),
      Paint()..color = const Color(0xffd4dacb)..strokeWidth = 1.0,
    );

    // Highlight active warehouse bounds on rulers (rgba(92, 115, 43, 0.12))
    final whHighlightPaint = Paint()..color = const Color(0x1f5c732b);
    final whStartSx = math.max(rulerThickness, offsetX);
    final whEndSx = math.min(w, offsetX + (whW * scale));
    if (whEndSx > whStartSx) {
      canvas.drawRect(Rect.fromLTWH(whStartSx, 0, whEndSx - whStartSx, rulerThickness), whHighlightPaint);
    }
    final whStartSy = math.max(rulerThickness, offsetY);
    final whEndSy = math.min(h, offsetY + (whL * scale));
    if (whEndSy > whStartSy) {
      canvas.drawRect(Rect.fromLTWH(0, whStartSy, rulerThickness, whEndSy - whStartSy), whHighlightPaint);
    }

    // Tick paints
    final tickPaint = Paint()..color = const Color(0xff737b6c)..strokeWidth = 0.8;
    const tickTextStyle = TextStyle(
      fontSize: 8.5,
      fontWeight: FontWeight.w600,
      color: Color(0xff3e5510),
    );

    // Clip & Draw Top Ruler Ticks & Labels
    canvas.save();
    canvas.clipRect(topRulerRect);
    for (double wx = 0; wx <= whW; wx += 1000) {
      final sx = offsetX + (wx * scale);
      if (sx < rulerThickness - 1) continue;

      final isMajor = (wx % 5000) == 0;
      final tHeight = isMajor ? 10.0 : 5.0;
      canvas.drawLine(Offset(sx, rulerThickness), Offset(sx, rulerThickness - tHeight), tickPaint);

      if (isMajor) {
        final tp = TextPainter(
          text: TextSpan(text: '${(wx / 1000).toInt()}m', style: tickTextStyle),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(sx - (tp.width / 2), 2));
      }
    }
    canvas.restore();

    // Clip & Draw Left Ruler Ticks & Labels
    canvas.save();
    canvas.clipRect(leftRulerRect);
    for (double wy = 0; wy <= whL; wy += 1000) {
      final sy = offsetY + (wy * scale);
      if (sy < rulerThickness - 1) continue;

      final isMajor = (wy % 5000) == 0;
      final tWidth = isMajor ? 10.0 : 5.0;
      canvas.drawLine(Offset(rulerThickness, sy), Offset(rulerThickness - tWidth, sy), tickPaint);

      if (isMajor) {
        final tp = TextPainter(
          text: TextSpan(text: '${(wy / 1000).toInt()}m', style: tickTextStyle),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(rulerThickness - tWidth - tp.width - 2, sy - (tp.height / 2)));
      }
    }
    canvas.restore();

    // 3. Top-Left Corner Box ('m' indicator)
    final cornerRect = Rect.fromLTWH(0, 0, rulerThickness, rulerThickness);
    canvas.drawRect(cornerRect, Paint()..color = const Color(0xffeef3e2));
    canvas.drawRect(
      cornerRect,
      Paint()
        ..color = const Color(0xffc4cca9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );
    final mPainter = TextPainter(
      text: const TextSpan(
        text: 'm',
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xff3e5510)),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    mPainter.paint(
      canvas,
      Offset((rulerThickness - mPainter.width) / 2, (rulerThickness - mPainter.height) / 2),
    );
  }

  void _drawOrientationBadge(Canvas canvas, Rect bounds, bool isHoriz) {
    final orient = isHoriz ? 'H' : 'V';
    final badgeW = math.min(13.0, bounds.width * 0.42);
    final badgeH = math.min(10.0, bounds.height * 0.42);
    if (badgeW < 6 || badgeH < 6) return;

    final rect = Rect.fromLTWH(bounds.left + 2, bounds.top + 2, badgeW, badgeH);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(2)),
      Paint()..color = const Color(0xfff1f5f9).withValues(alpha: 0.9),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(2)),
      Paint()
        ..color = const Color(0xff94a3b8)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.6,
    );
    final span = TextSpan(
      text: orient,
      style: const TextStyle(fontSize: 6.5, fontWeight: FontWeight.w900, color: Color(0xff475569)),
    );
    final tp = TextPainter(text: span, textDirection: TextDirection.ltr)..layout();
    tp.paint(canvas, Offset(rect.left + (badgeW - tp.width) / 2, rect.top + (badgeH - tp.height) / 2));
  }

  void _drawText(Canvas canvas, String text, Offset offset, TextStyle style) {
    final span = TextSpan(text: text, style: style);
    final painter = TextPainter(text: span, textDirection: TextDirection.ltr)..layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _WarehouseFloorPlanPainter oldDelegate) =>
      oldDelegate.layout != layout ||
      oldDelegate.allNodes != allNodes ||
      oldDelegate.inspectedNodeId != inspectedNodeId ||
      oldDelegate.isRouteActive != isRouteActive ||
      oldDelegate.startLocationId != startLocationId ||
      oldDelegate.destLocationId != destLocationId ||
      oldDelegate.pulseProgress != pulseProgress;
}

/// CustomPainter untuk Garis Rute Navigasi Aktif (Glowing Animated Polyline)
class _RouteNavigationPainter extends CustomPainter {
  final List<Offset> waypoints;
  final double pulseProgress;
  final Color routeColor;

  _RouteNavigationPainter({
    required this.waypoints,
    required this.pulseProgress,
    required this.routeColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (waypoints.length < 2) return;

    final path = Path();
    path.moveTo(waypoints.first.dx, waypoints.first.dy);
    for (int i = 1; i < waypoints.length; i++) {
      path.lineTo(waypoints[i].dx, waypoints[i].dy);
    }

    final glowPaint = Paint()
      ..color = routeColor.withValues(alpha: 0.35 + (pulseProgress * 0.25))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 9.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, glowPaint);

    final borderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, borderPaint);

    final linePaint = Paint()
      ..color = routeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, linePaint);

    final turnPaint = Paint()..color = Colors.white;
    final turnBorderPaint = Paint()
      ..color = routeColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8;

    for (int i = 1; i < waypoints.length - 1; i++) {
      canvas.drawCircle(waypoints[i], 3.5, turnPaint);
      canvas.drawCircle(waypoints[i], 3.5, turnBorderPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _RouteNavigationPainter oldDelegate) {
    return oldDelegate.pulseProgress != pulseProgress ||
        oldDelegate.waypoints != waypoints ||
        oldDelegate.routeColor != routeColor;
  }
}

/// Sheet Pemilih Lokasi (Search Modal untuk Titik Awal & Tujuan)
class _LocationPickerSheet extends StatefulWidget {
  final String title;
  final String? currentSelectedId;
  final List<_SpatialNode> nodes;
  final VoidCallback onScanTap;

  const _LocationPickerSheet({
    required this.title,
    required this.currentSelectedId,
    required this.nodes,
    required this.onScanTap,
  });

  @override
  State<_LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<_LocationPickerSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.nodes.where((n) {
      if (_query.isEmpty) return true;
      return n.id.toLowerCase().contains(_query) ||
          n.zone.toLowerCase().contains(_query) ||
          n.aisle.toLowerCase().contains(_query);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.70,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xffcbd5e1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.title,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: brandInk),
              ),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: brand,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  visualDensity: VisualDensity.compact,
                ),
                onPressed: widget.onScanTap,
                icon: const Icon(Icons.qr_code_scanner_rounded, size: 15),
                label: const Text('Scan QR', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: brandInk),
            decoration: InputDecoration(
              hintText: 'Ketik kode rak (cth: RACK-A1, DOK-1)...',
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: brandSlate),
              filled: true,
              fillColor: const Color(0xfff8fafc),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: line)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: line)),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: brand, width: 1.5)),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: ListView.separated(
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: line),
              itemBuilder: (ctx, i) {
                final node = filtered[i];
                final isSelected = node.id == widget.currentSelectedId;

                return ListTile(
                  dense: true,
                  leading: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: node.isDock ? const Color(0xfffef3c7) : brandSoft,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Center(
                      child: Icon(
                        node.isDock ? Icons.local_shipping_rounded : Icons.grid_view_rounded,
                        color: node.isDock ? const Color(0xffb45309) : brand,
                        size: 15,
                      ),
                    ),
                  ),
                  title: Text(
                    node.id,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w900,
                      fontFamily: 'monospace',
                      color: isSelected ? brand : brandInk,
                    ),
                  ),
                  subtitle: Text(
                    '${node.zone} • ${node.aisle}',
                    style: const TextStyle(fontSize: 10.5, color: brandSlate),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded, color: brand, size: 18)
                      : const Icon(Icons.chevron_right_rounded, color: muted, size: 16),
                  onTap: () {
                    HapticFeedback.selectionClick().ignore();
                    Navigator.pop(ctx, node.id);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
