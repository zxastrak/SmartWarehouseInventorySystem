// ==============================================================================
// DEV QR BYPASS COMPONENT (MODUL PENGEMBANGAN / TESTING)
// ==============================================================================
// Catatan: File ini dirancang khusus untuk mempermudah testing alur Putaway &
// Dispatching tanpa harus memindai kamera fisik.
// Jika aplikasi sudah siap rilis (PRODUCTION), file ini cukup DIHAPUS dan
// hilangkan 1 baris pemanggilannya di `mobile/lib/screens/scanner_screen.dart`.
// ==============================================================================

import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../state/warehouse_state.dart';

class DevQrBypass {
  /// Helper global untuk generate kode barcode otomatis berdasarkan judul / demoCode
  static String generateBarcode({String? title, String? demoCode}) {
    if (demoCode != null && demoCode.trim().isNotEmpty) {
      return demoCode.trim().toUpperCase();
    }
    final t = (title ?? '').toLowerCase();
    if (t.contains('rak') || t.contains('rack') || t.contains('lokasi')) {
      return 'RACK-A4-02-B';
    }
    if (t.contains('foto') || t.contains('bukti')) {
      return 'FOTO-${DateTime.now().millisecondsSinceEpoch}';
    }
    return 'MD-BOX-01';
  }
}

class DevQrBypassBar extends StatelessWidget {
  final ScanMode mode;
  final int step;
  final String? currentRack;
  final String? currentSku;
  final ValueChanged<String> onBypassRack;
  final ValueChanged<String> onBypassItem;
  final void Function(String rack, String sku) onBypassAll;
  final VoidCallback onReset;

  const DevQrBypassBar({
    super.key,
    required this.mode,
    required this.step,
    required this.currentRack,
    required this.currentSku,
    required this.onBypassRack,
    required this.onBypassItem,
    required this.onBypassAll,
    required this.onReset,
  });

  // Helper untuk generate kode rak yang valid sesuai state gudang
  String _generateValidRack(WarehouseState state) {
    // Jika currentSku sudah ada (misal dari tugas), prioritaskan rak dari barang tersebut
    if (currentSku != null && currentSku!.isNotEmpty) {
      final curItem = state.resolve(currentSku!);
      if (curItem != null) {
        if (mode == ScanMode.dispatch) {
          for (final entry in curItem.rackCounts.entries) {
            if (entry.value > 0 && state.validRack(entry.key)) {
              return entry.key.toUpperCase();
            }
          }
          if (state.validRack(curItem.rack)) return curItem.rack.toUpperCase();
        } else {
          if (state.validRack(curItem.rack)) return curItem.rack.toUpperCase();
        }
      }
    }

    if (mode == ScanMode.dispatch) {
      // Untuk dispatching: cari rak yang benar-benar memiliki stok barang > 0
      for (final item in state.items) {
        for (final entry in item.rackCounts.entries) {
          if (entry.value > 0 && state.validRack(entry.key)) {
            return entry.key.toUpperCase();
          }
        }
      }
    }

    // Untuk putaway: ambil dari daftar master lokasi atau generate format standar valid
    if (state.locations.isNotEmpty) {
      final loc = state.locations.first['location_code']?.toString();
      if (loc != null && loc.isNotEmpty && state.validRack(loc)) {
        return loc.toUpperCase();
      }
    }

    // Fallback format standar regex valid RACK-[A-D][0-9]+-[0-9]+-[A-Z]
    const defaultRacks = ['RACK-A4-02-B', 'RACK-B1-05-A', 'RACK-C2-01-D'];
    return defaultRacks[Random().nextInt(defaultRacks.length)];
  }

  // Helper untuk generate SKU barang yang valid
  String _generateValidSku(WarehouseState state, String? targetRack) {
    if (state.items.isEmpty) return 'SKU-SAMPLE-01';

    if (mode == ScanMode.dispatch && targetRack != null) {
      // Untuk dispatching: wajib pilih barang yang ada stoknya di rak target
      final inRack = state.items.where((i) => (i.rackCounts[targetRack] ?? 0) > 0).toList();
      if (inRack.isNotEmpty) {
        return inRack.first.sku;
      }
    }

    // Default: pilih barang pertama atau barang yang memiliki stok
    final withStock = state.items.where((i) => i.quantity > 0).toList();
    if (withStock.isNotEmpty) {
      return withStock.first.sku;
    }
    return state.items.first.sku;
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<WarehouseState>();
    final isPutaway = mode == ScanMode.putaway;

    // Hitung preview kode yang akan di-generate jika di-bypass
    final rackToGen = currentRack ?? _generateValidRack(state);
    final skuToGen = _generateValidSku(state, currentRack ?? rackToGen);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xfffffbeb), // Warm amber background
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xfffde68a), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xffb45309).withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header info Dev Mode
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xffb45309),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'DEV MODE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Skip Barcode (${isPutaway ? 'Putaway' : 'Dispatching'})',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xff92400e),
                  ),
                ),
              ),
              if (currentRack != null || currentSku != null)
                InkWell(
                  onTap: onReset,
                  borderRadius: BorderRadius.circular(6),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.refresh, size: 14, color: Color(0xffb45309)),
                        SizedBox(width: 2),
                        Text(
                          'Reset',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xffb45309),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),

          // Barcode preview badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xfffef3c7)),
            ),
            child: Row(
              children: [
                const Text(
                  '║▌║',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xffb45309),
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    step == 1
                        ? 'Target Rak: $rackToGen'
                        : step == 2
                            ? 'Target SKU: $skuToGen'
                            : 'Siap: $currentRack • $currentSku',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xff78350f),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Tombol aksi bypass / skip barcode
          Row(
            children: [
              if (step == 1) ...[
                Expanded(
                  flex: 3,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xffd97706),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      final code = _generateValidRack(state);
                      onBypassRack(code);
                      _showNotice(context, 'Skip Barcode Berhasil: Rak $code');
                    },
                    icon: const Icon(Icons.bolt, size: 16),
                    label: Text(
                      'Skip Barcode Rak ($rackToGen)',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ] else if (step == 2) ...[
                Expanded(
                  flex: 3,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xff059669),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      final sku = _generateValidSku(state, currentRack);
                      onBypassItem(sku);
                      _showNotice(context, 'Skip Barcode Berhasil: SKU $sku');
                    },
                    icon: const Icon(Icons.bolt, size: 16),
                    label: Text(
                      'Skip Barcode Barang ($skuToGen)',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],

              // Tombol Bypass Lengkap (1-Tap: Rak + Barang)
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xff92400e),
                    side: const BorderSide(color: Color(0xfff59e0b)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    final rack = _generateValidRack(state);
                    // Pertahankan currentSku milik tugas aktif jika sudah ada
                    final sku = (currentSku != null && currentSku!.isNotEmpty)
                        ? currentSku!
                        : _generateValidSku(state, rack);
                    onBypassAll(rack, sku);
                    _showNotice(context, 'Skip Semua: Rak $rack & SKU $sku siap simpan');
                  },
                  icon: const Icon(Icons.fast_forward_rounded, size: 15),
                  label: const Text(
                    'Skip Semua',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showNotice(BuildContext context, String msg) {
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        duration: const Duration(seconds: 2),
        backgroundColor: const Color(0xff1e293b),
      ),
    );
  }
}
