import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/barcode_input.dart';
import '../widgets/qr_scanner.dart';
import '../widgets/staggered_slide_card.dart';
import '../core/app_theme.dart';

int _parseInt(dynamic val) {
  if (val == null) return 0;
  if (val is num) return val.toInt();
  return int.tryParse(val.toString()) ?? 0;
}

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  late ScanMode mode;
  String? sku, rack;
  int quantity = 0;
  int targetQuantity = 0;
  bool checked = false;
  int? taskId;
  dynamic inboundShipmentId;
  dynamic outboundShipmentId;

  // Laporan Kerusakan & Bukti Foto Kamera
  bool hasDamage = false;
  int damagedQuantity = 0;
  final TextEditingController _damageNotesController = TextEditingController();
  String? damagePhoto;

  // Mode Single vs Multi Scan
  bool isMultiScan = false;
  final List<String> multiBarcodes = [];
  bool itemConfirmed = false;

  // Putaway = barang masuk (stockIn), Dispatching = barang keluar (stockOut).
  MovementKind get kind =>
      mode == ScanMode.dispatch ? MovementKind.stockOut : MovementKind.stockIn;

  @override
  void initState() {
    super.initState();
    final s = context.read<WarehouseState>();
    mode = s.scanMode;
    // Bawa SKU, Rak, Kuantitas, Task ID, dan Inbound/Outbound Shipment ID dari tugas jika tersedia
    sku = (s.scanSku != null && s.scanSku!.isNotEmpty) ? s.scanSku : null;
    rack = (s.scanRack != null && s.scanRack!.isNotEmpty) ? s.scanRack : null;
    targetQuantity =
        (s.scanQuantity != null && s.scanQuantity! > 0) ? s.scanQuantity! : 0;
    // Kuantitas hitungan fisik aktual SELALU mulai dari 0 untuk Putaway dan Dispatching
    quantity = 0;
    taskId = s.scanTaskId;
    inboundShipmentId = s.scanInboundShipmentId;
    outboundShipmentId = s.scanOutboundShipmentId;
    itemConfirmed = false;
    isMultiScan = false;
    multiBarcodes.clear();
    hasDamage = false;
    damagedQuantity = 0;
    damagePhoto = null;
    _damageNotesController.clear();
  }

  @override
  void dispose() {
    _damageNotesController.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = context.read<WarehouseState>();
    final bool modeChanged = s.scanMode != mode;
    final bool skuChanged =
        (s.scanSku != null && s.scanSku!.isNotEmpty && s.scanSku != sku) ||
        (s.scanSku == null && sku != null && modeChanged);
    final bool rackChanged =
        (s.scanRack != null && s.scanRack!.isNotEmpty && s.scanRack != rack) ||
        (s.scanRack == null && rack != null && modeChanged);

    if (modeChanged || skuChanged || rackChanged) {
      setState(() {
        mode = s.scanMode;
        sku = (s.scanSku != null && s.scanSku!.isNotEmpty) ? s.scanSku : null;
        rack =
            (s.scanRack != null && s.scanRack!.isNotEmpty) ? s.scanRack : null;
        targetQuantity =
            (s.scanQuantity != null && s.scanQuantity! > 0)
                ? s.scanQuantity!
                : 0;
        // Hitungan fisik aktual mulai dari 0
        quantity = 0;
        taskId = s.scanTaskId;
        inboundShipmentId = s.scanInboundShipmentId;
        outboundShipmentId = s.scanOutboundShipmentId;
        itemConfirmed = false;
        multiBarcodes.clear();
        hasDamage = false;
        damagedQuantity = 0;
        damagePhoto = null;
        _damageNotesController.clear();
      });
    }
  }

  int _getRackStock(StockItem item, String rackCode) {
    final normalized = rackCode.trim().toUpperCase();
    int count = 0;
    for (final entry in item.rackCounts.entries) {
      if (entry.key.toUpperCase() == normalized) {
        count += entry.value;
      }
    }
    if (count == 0 && item.rack.toUpperCase() == normalized) {
      count = item.quantity;
    }
    return count;
  }

  void goToPreviousStep(int currentStep) {
    setState(() {
      checked = false;
      if (currentStep == 3) {
        // Kembali ke Langkah 2 (Barang)
        itemConfirmed = false;
      } else if (currentStep == 2) {
        // Kembali ke Langkah 1 (Rak)
        rack = null;
        itemConfirmed = false;
      }
    });
  }

  void goToStep(int targetStep) {
    setState(() {
      checked = false;
      if (targetStep == 1) {
        rack = null;
        itemConfirmed = false;
      } else if (targetStep == 2) {
        itemConfirmed = false;
      }
    });
  }

  void itemScanned(String code) {
    final item = context.read<WarehouseState>().resolve(code);
    if (item == null) {
      message(
        context,
        'Barcode barang tidak ditemukan. Gunakan SKU yang terdaftar.',
      );
      return;
    }
    final r = rack;
    if (mode == ScanMode.dispatch && r != null) {
      final availableInRack = _getRackStock(item, r);
      if (availableInRack == 0) {
        message(context, '${item.sku} tidak memiliki stok tercatat di rak $r.');
        return;
      }
    }
    setState(() {
      final cleanCode = code.trim().toUpperCase();
      if (isMultiScan) {
        sku = item.sku;
        multiBarcodes.add(cleanCode);
        quantity = multiBarcodes.length;
        checked = false;
      } else {
        sku = item.sku;
        final s = context.read<WarehouseState>();
        final taskQty =
            (s.scanQuantity != null && s.scanQuantity! > 0)
                ? s.scanQuantity!
                : 0;
        targetQuantity = taskQty;
        // Kuantitas hitungan fisik terverifikasi SELALU mulai dari 0 (Putaway & Dispatching)
        quantity = 0;
        itemConfirmed = true;
        checked = false;
      }
    });
  }

  void rackScanned(String code) {
    final s = context.read<WarehouseState>();
    if (!s.validRack(code)) {
      message(context, 'Format barcode rak tidak valid.');
      return;
    }
    setState(() {
      rack = code.toUpperCase();
      rack = s.normalizeRackCode(code);
      checked = false;
      // Jangan langsung loncat ke step 3 meskipun sku sudah ada dari tugas.
      // Berikan kesempatan staf melihat dan memindai fisik barang di langkah 2.
      itemConfirmed = false;
    });
  }

  // Single Scan: kode yang dipindai bisa berupa barang (SKU) atau rak.
  // Single Scan: kode yang dipindai bisa berupa barang (SKU/barcode/serial) atau rak.
  // Barang -> tampilkan data barang. Rak -> tampilkan isi rak. Tidak mengubah stok.
  // Di mode ini `sku` = barang yang sedang dilihat, `rack` = rak yang sedang dilihat.
  void lookupScanned(String code) {
    final s = context.read<WarehouseState>();
    // 1. Cek apakah barcode cocok dengan barang (SKU, barcode fisik, serial, atau batch)
    final item = s.resolve(code);
    if (item != null) {
      setState(() {
        sku = item.sku;
        rack = null;
      });
      return;
    }
    // 2. Cek apakah barcode cocok dengan rak gudang
    if (s.validRack(code)) {
      setState(() {
        rack = s.normalizeRackCode(code);
        sku = null;
      });
      return;
    }
    message(context, 'Barcode barang atau rak tidak dikenali.');
  }

  Future<void> save() async {
    // Single Scan hanya untuk melihat data, tidak mengubah stok.
    if (mode == ScanMode.single) {
      return;
    }
    final skuCode = sku;
    final rackCode = rack;
    if (skuCode == null) {
      message(context, 'Pindai barcode barang terlebih dahulu.');
      return;
    }
    if (rackCode == null) {
      message(context, 'Pindai barcode rak terlebih dahulu.');
      return;
    }
    final hasDamageReport = hasDamage && damagedQuantity > 0;
    if (quantity <= 0 && !hasDamageReport) {
      message(
        context,
        'Masukkan jumlah unit fisik (diterima/diambil atau rusak) terlebih dahulu.',
      );
      return;
    }
    if (!checked) {
      message(
        context,
        'Centang konfirmasi pemeriksaan fisik unit sebelum menyimpan.',
      );
      return;
    }
    final s = context.read<WarehouseState>();
    final item = s.bySku(skuCode);
    final rackStock = _getRackStock(item, rackCode);

    if (mode == ScanMode.dispatch && quantity > rackStock) {
      message(
        context,
        'Jumlah pengeluaran ($quantity) melebihi stok rak ($rackStock).',
      );
      return;
    }

    final savedSku = skuCode;
    final savedItemName = item.name;
    final savedRack = rackCode;
    final savedQty = quantity;
    final savedTargetQty = targetQuantity;
    final savedUnit = item.unit;
    final isPutaway = mode == ScanMode.putaway;
    final savedDamagedQty = hasDamage ? damagedQuantity : 0;
    final savedDamageNotes =
        hasDamage ? _damageNotesController.text.trim() : null;
    final savedDamagePhoto = hasDamage ? damagePhoto : null;

    // Auto-match inbound shipment fallback jika inboundShipmentId null (pada Putaway):
    dynamic currentInboundId = inboundShipmentId;
    if (isPutaway && currentInboundId == null) {
      final matchingShipment = s.arrivedShipments.firstWhere(
        (sh) => sh.items.any(
          (it) => it.sku.toUpperCase() == savedSku.toUpperCase(),
        ),
        orElse:
            () => InboundShipmentModel(
              id: null,
              inboundNumber: '',
              supplierName: '',
              scheduledDate: '',
              scheduledTime: '',
              dock: '',
              status: '',
              assignedStaff: '',
              units: 0,
              items: [],
            ),
      );
      if (matchingShipment.id != null) {
        currentInboundId = matchingShipment.id;
      }
    }

    // Auto-match outbound shipment fallback jika outboundShipmentId null (pada Dispatching):
    dynamic currentOutboundId = outboundShipmentId;
    if (!isPutaway && currentOutboundId == null) {
      final matchingOutbound = s.arrivedOutbounds.firstWhere(
        (sh) => sh.items.any(
          (it) => it.sku.toUpperCase() == savedSku.toUpperCase(),
        ),
        orElse:
            () => OutboundShipmentModel(
              id: null,
              outboundNumber: '',
              destination: '',
              scheduledDate: '',
              scheduledTime: '',
              dock: '',
              status: '',
              assignedStaff: '',
              units: 0,
              items: [],
            ),
      );
      if (matchingOutbound.id != null) {
        currentOutboundId = matchingOutbound.id;
      }
    }

    final isInboundInspection = currentInboundId != null;
    final isOutboundInspection = currentOutboundId != null;

    // Untuk alur normal non-inbound & non-outbound, eksekusi mutasi stok langsung.
    // Untuk inspeksi Inbound/Outbound, stok resmi disinkronkan via alur ACC Manager di Web.
    if (!isInboundInspection && !isOutboundInspection) {
      if (savedQty > 0) {
        final error = s.saveMovement(
          sku: skuCode,
          quantity: savedQty,
          kind: kind,
          rack: rackCode,
          label: mode == ScanMode.putaway ? 'Putaway' : 'Dispatching',
        );
        if (error != null) {
          message(context, error);
          return;
        }
      }
      if (savedDamagedQty > 0) {
        s.recordStaffActivity(
          'Laporan Kerusakan • $savedSku',
          '$savedDamagedQty unit rusak dilaporkan pada ${mode == ScanMode.putaway ? 'Putaway' : 'Dispatching'} di rak $savedRack. Catatan: ${savedDamageNotes?.isNotEmpty == true ? savedDamageNotes : '-'}${savedDamagePhoto != null ? ' (Foto: $savedDamagePhoto)' : ''}',
        );
      }
    }

    // Untuk Putaway barang, pastikan lokasi rak produk di backend database selalu diperbarui
    if (isPutaway && item.id != null && s.token != null) {
      try {
        await s.api.updateProductLocation(
          token: s.token!,
          productId: item.id!,
          location: savedRack,
        );
        item.rack = savedRack;
        item.zone = 'Zone ${savedRack.substring(0, 1).toUpperCase()}';
      } catch (_) {}
    }

    // Auto-match task fallback jika taskId null: cari tugas pending yang cocok dengan SKU ini
    int? currentTaskId = taskId;
    if (currentTaskId == null) {
      final matching = s.pendingTasks.firstWhere(
        (t) =>
            (t['sku'] ?? '').toString().toUpperCase() == savedSku.toUpperCase(),
        orElse: () => {},
      );
      if (matching.isNotEmpty && matching['id'] != null) {
        currentTaskId = _parseInt(matching['id']);
      }
    }

    // Jika dipicu dari tugas database, tandai tugas selesai di server & lokal
    if (currentTaskId != null && currentTaskId > 0) {
      await s.updateTaskStatus(currentTaskId, 'done');
    }

    // Jika dipicu dari tugas inspeksi dok (Inbound Shipment), catat laporan inspeksi dok ke Manager (stok belum bertambah)
    if (currentInboundId != null) {
      await s.completeInboundShipment(
        currentInboundId,
        sku: savedSku,
        quantity: savedQty,
        rack: savedRack,
        barcodes:
            isMultiScan && multiBarcodes.isNotEmpty
                ? List<String>.from(multiBarcodes)
                : [savedSku],
        damagedQty: savedDamagedQty,
        damageNotes: savedDamageNotes,
        photoEvidence: savedDamagePhoto,
      );
    }

    // Jika dipicu dari tugas picking dok (Outbound Shipment), catat laporan picking dok ke Manager
    if (currentOutboundId != null) {
      await s.completeOutboundShipment(
        currentOutboundId,
        sku: savedSku,
        quantity: savedQty,
        rack: savedRack,
        barcodes:
            isMultiScan && multiBarcodes.isNotEmpty
                ? List<String>.from(multiBarcodes)
                : [savedSku],
        damagedQty: savedDamagedQty,
        damageNotes: savedDamageNotes,
        photoEvidence: savedDamagePhoto,
      );
    }

    // Reset input state & bersihkan context scanner
    setState(() {
      sku = null;
      rack = null;
      quantity = 0;
      targetQuantity = 0;
      checked = false;
      taskId = null;
      inboundShipmentId = null;
      outboundShipmentId = null;
      isMultiScan = false;
      multiBarcodes.clear();
      itemConfirmed = false;
      hasDamage = false;
      damagedQuantity = 0;
      damagePhoto = null;
      _damageNotesController.clear();
    });
    s.clearScanContext();

    if (!mounted) return;

    // Tampilkan Dialog Konfirmasi Sukses Ergonomis
    _showSuccessConfirmationDialog(
      context: context,
      isPutaway: isPutaway,
      itemName: savedItemName,
      sku: savedSku,
      rack: savedRack,
      quantity: savedQty,
      unit: savedUnit,
      taskId: currentTaskId,
      inboundShipmentId: currentInboundId,
      outboundShipmentId: currentOutboundId,
      damagedQty: savedDamagedQty,
      damageNotes: savedDamageNotes,
      photoEvidence: savedDamagePhoto,
      targetQuantity: savedTargetQty,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = sku == null ? null : s.bySku(sku!);
    final r = rack;
    final putaway = mode == ScanMode.putaway;
    final multi = mode != ScanMode.single;
    // Langkah aktif untuk Putaway/Dispatching: 1 = rak, 2 = barang, 3 = konfirmasi.
    final step = r == null ? 1 : ((item == null || !itemConfirmed) ? 2 : 3);
    // Barang contoh untuk tombol Demo Scan di langkah 2: pilih yang tercatat di rak terpilih.
    final inRack =
        r == null
            ? <StockItem>[]
            : s.items
                .where(
                  (i) =>
                      _getRackStock(i, r) > 0 ||
                      i.rack.trim().toUpperCase() == r.trim().toUpperCase(),
                )
                .toList();
    final demoSku =
        inRack.isNotEmpty
            ? inRack.first.sku
            : (s.items.isNotEmpty ? s.items.first.sku : '');
    final rackNow = (item != null && r != null) ? _getRackStock(item, r) : 0;
    final after = putaway ? rackNow + quantity : rackNow - quantity;
    // Single Scan: isi rak yang sedang dilihat (barang dengan stok > 0 di rak itu).
    final rackItems =
        (!multi && r != null)
            ? s.items
                .where(
                  (i) =>
                      _getRackStock(i, r) > 0 ||
                      i.rack.trim().toUpperCase() == r.trim().toUpperCase(),
                )
                .toList()
            : <StockItem>[];
    final rackUnits = rackItems.fold<int>(
      0,
      (sum, i) => sum + _getRackStock(i, r!),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const StaggeredSlideCard(
          index: 0,
          child: Padding(
            padding: EdgeInsets.only(top: 8, bottom: 8),
            child: Text(
              'SUSUNO Floor Scan',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
                color: brandInk,
              ),
            ),
          ),
        ),
        if (!multi) ...[
          BarcodeInput(
            title: 'Scan item or rack barcode',
            demoCode: s.items.isNotEmpty ? s.items.first.sku : '',
            onResult: lookupScanned,
          ),
          if (item != null) ...[
            StockCard(item),
            _LookupPanel(
              title: 'Lokasi Rak',
              emptyText: 'Belum ada stok tercatat di rak mana pun.',
              rows: [
                for (final e in item.rackCounts.entries)
                  if (e.value > 0)
                    _LookupRow(
                      title: e.key,
                      trailing: '${e.value} ${item.unit}',
                      onTap:
                          () => setState(() {
                            rack = e.key;
                            sku = null;
                          }),
                    ),
              ],
            ),
          ] else if (r != null) ...[
            Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                      color: brandInk,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${r.length > 5 ? 'Zona ${r.substring(5, 6)} • ' : ''}'
                    '${rackItems.length} barang • ${formatNumber(rackUnits)} unit',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: muted,
                    ),
                  ),
                ],
              ),
            ),
            _LookupPanel(
              title: 'Barang di rak ini',
              emptyText: 'Belum ada barang yang tercatat di rak ini.',
              rows: [
                for (final i in rackItems)
                  _LookupRow(
                    title: i.name,
                    subtitle: i.sku,
                    trailing: '${_getRackStock(i, r)} ${i.unit}',
                    onTap:
                        () => setState(() {
                          sku = i.sku;
                          rack = null;
                        }),
                  ),
              ],
            ),
          ] else
            const Panel(
              child: Text(
                'Pindai barang untuk melihat datanya, atau pindai rak untuk melihat barang yang tersimpan di dalamnya.',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: muted,
                ),
              ),
            ),
        ] else ...[
          if (inboundShipmentId != null || taskId != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color:
                    putaway ? const Color(0xfff0fdf4) : const Color(0xfffffbeb),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color:
                      putaway
                          ? const Color(0xff86efac)
                          : const Color(0xfffde68a),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    putaway ? Icons.download_rounded : Icons.upload_rounded,
                    color:
                        putaway
                            ? const Color(0xff166534)
                            : const Color(0xffb45309),
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          putaway
                              ? 'ALUR TUGAS: PUTAWAY (PENATAAN MASUK)'
                              : 'ALUR TUGAS: DISPATCHING (PENGELUARAN)',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                            color:
                                putaway
                                    ? const Color(0xff166534)
                                    : const Color(0xffb45309),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          inboundShipmentId != null
                              ? 'Tugas Inbound #$inboundShipmentId • Dok ${r ?? 'Tujuan'}'
                              : 'Tugas Operasional #$taskId',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: brandInk,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          // Toggle Single Scan vs Multi Scan
          StaggeredSlideCard(
            index: 1,
            child: _ScanTypeToggle(
              isMulti: isMultiScan,
              onChanged: (val) {
                if (val != isMultiScan) {
                  setState(() {
                    isMultiScan = val;
                    if (!val) {
                      multiBarcodes.clear();
                    } else {
                      if (sku != null && multiBarcodes.isEmpty) {
                        multiBarcodes.add(sku!);
                        quantity = multiBarcodes.length;
                      }
                    }
                  });
                }
              },
            ),
          ),
          StaggeredSlideCard(
            index: 2,
            child: _StepHeader(
              current: step,
              labels: const ['Rak', 'Barang', 'Konfirmasi'],
              onStepTapped: goToStep,
            ),
          ),
          // Tombol Kembali ke Langkah Sebelumnya
          if (step > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () => goToPreviousStep(step),
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xfff8fafc),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.arrow_back_rounded,
                        size: 16,
                        color: brandSlate,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        step == 3
                            ? '‹ Kembali ke Langkah 2 (Pindai Barang)'
                            : '‹ Kembali ke Langkah 1 (Pindai Rak)',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: brandInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (r != null)
            _DoneChip(
              label: 'Rak',
              value: r,
              onChange:
                  () => setState(() {
                    rack = null;
                    itemConfirmed = false;
                    checked = false;
                  }),
            ),
          if (step == 3 && item != null)
            _DoneChip(
              label: 'Barang',
              value:
                  isMultiScan && multiBarcodes.length > 1
                      ? '${item.sku} • ${item.name} (${multiBarcodes.length} unit)'
                      : '${item.sku} • ${item.name}',
              onChange:
                  () => setState(() {
                    itemConfirmed = false;
                    checked = false;
                  }),
            ),
          if (step == 1)
            StaggeredSlideCard(
              index: 3,
              child: BarcodeInput(
                key: const ValueKey('rack-step'),
                title:
                    putaway
                        ? 'Pindai barcode rak tujuan'
                        : 'Pindai barcode rak asal',
                demoCode: 'RACK-A4-02-B',
                onResult: rackScanned,
              ),
            ),
          if (step == 2) ...[
            if (item != null)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: brandSoft,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: brandSoftBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.inventory_2_outlined,
                          size: 18,
                          color: brand,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: brandInk,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: brandSoftBorder),
                          ),
                          child: Text(
                            item.sku,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              fontFamily: 'monospace',
                              color: forest,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (targetQuantity > 0) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xff86efac)),
                        ),
                        child: Text(
                          'Target Pesanan: $targetQuantity ${item.unit} (Hitungan fisik mulai dari 0)',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xff166534),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      isMultiScan
                          ? 'Mode Multi Scan: Pindai barcode setiap unit fisik barang. Total terkumpul: ${multiBarcodes.length} unit.'
                          : 'Pindai barcode barang fisik untuk verifikasi sebelum konfirmasi.',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: brandSlate,
                      ),
                    ),
                    if (!isMultiScan) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: brand),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          onPressed: () => setState(() => itemConfirmed = true),
                          icon: const Icon(
                            Icons.check_circle_outline,
                            size: 16,
                          ),
                          label: const Text(
                            'Verifikasi SKU Sesuai & Lanjut ke Konfirmasi ›',
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            BarcodeInput(
              key: ValueKey('item-step-$isMultiScan-${multiBarcodes.length}'),
              title:
                  isMultiScan
                      ? 'Pindai barcode fisik unit (${multiBarcodes.length} unit tersimpan)'
                      : 'Pindai barcode barang fisik',
              demoCode: demoSku,
              onResult: itemScanned,
            ),
            if (isMultiScan && multiBarcodes.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Unit Fisik Terpindai (${multiBarcodes.length})',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: brandInk,
                          ),
                        ),
                        TextButton(
                          style: TextButton.styleFrom(
                            minimumSize: const Size(0, 24),
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                          ),
                          onPressed:
                              () => setState(() {
                                multiBarcodes.clear();
                                quantity = 1;
                              }),
                          child: const Text(
                            'Reset Scan',
                            style: TextStyle(fontSize: 11, color: danger),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (var i = 0; i < multiBarcodes.length; i++)
                          Chip(
                            label: Text('║▌║ ${multiBarcodes[i]}'),
                            labelStyle: const TextStyle(
                              fontSize: 11,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700,
                              color: brandInk,
                            ),
                            backgroundColor: brandSoft,
                            side: const BorderSide(color: brandSoftBorder),
                            padding: EdgeInsets.zero,
                            deleteIcon: const Icon(
                              Icons.close,
                              size: 14,
                              color: brandSlate,
                            ),
                            onDeleted:
                                () => setState(() {
                                  multiBarcodes.removeAt(i);
                                  quantity =
                                      multiBarcodes.isNotEmpty
                                          ? multiBarcodes.length
                                          : 1;
                                }),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => setState(() => itemConfirmed = true),
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        label: Text(
                          'Lanjut ke Konfirmasi (${multiBarcodes.length} Unit) ›',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
          if (step == 3 && item != null && r != null) ...[
            if (isMultiScan && multiBarcodes.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xfff0fdf4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xff86efac)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.fact_check_outlined,
                          size: 18,
                          color: Color(0xff166534),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Multi Scan: ${multiBarcodes.length} Unit Fisik Terverifikasi',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Color(0xff166534),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Barcode: ${multiBarcodes.join(', ')}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: brandSlate,
                      ),
                    ),
                  ],
                ),
              ),
            if (targetQuantity > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xfff8fafc),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xffe2e8f0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.assignment_outlined,
                      size: 18,
                      color: brandSlate,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        putaway
                            ? 'Target Pesanan Inbound:'
                            : 'Target Pesanan Outbound:',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: brandSlate,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: brandSoftBorder),
                      ),
                      child: Text(
                        '$targetQuantity ${item.unit}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: brandInk,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    putaway
                        ? 'Jumlah unit diterima / masuk ke rak ini'
                        : 'Jumlah unit diambil / keluar dari rak ini',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: muted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Hitungan fisik aktual dimulai dari 0:',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: putaway ? forest : brandSlate,
                    ),
                  ),
                  if (isMultiScan && multiBarcodes.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        '${multiBarcodes.length} ${item.unit}',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: brandInk,
                        ),
                      ),
                    )
                  else
                    CountControl(
                      value: quantity,
                      onChanged:
                          (n) => setState(() {
                            quantity = n;
                            checked = false;
                          }),
                    ),
                ],
              ),
            ),
            // Section Laporan Kerusakan & Ambil Foto Kamera
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: hasDamage ? const Color(0xfffdf2f2) : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color:
                      hasDamage
                          ? const Color(0xfffca5a5)
                          : const Color(0xffe2e8f0),
                  width: hasDamage ? 1.5 : 1,
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x06000000),
                    blurRadius: 4,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color:
                              hasDamage
                                  ? const Color(0xfffee2e2)
                                  : const Color(0xfff1f5f9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          Icons.report_problem_outlined,
                          size: 20,
                          color: hasDamage ? danger : brandSlate,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Laporan Kerusakan Barang',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color:
                                    hasDamage
                                        ? const Color(0xff991b1b)
                                        : brandInk,
                              ),
                            ),
                            Text(
                              hasDamage
                                  ? 'Unit rusak dicatat & tidak masuk ke stok aktif'
                                  : 'Centang jika ada unit cacat, rusak, atau segel terbuka',
                              style: TextStyle(
                                fontSize: 11,
                                color:
                                    hasDamage ? const Color(0xffb91c1c) : muted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: hasDamage,
                        activeThumbColor: danger,
                        onChanged: (val) {
                          setState(() {
                            hasDamage = val;
                            if (!val) {
                              damagedQuantity = 0;
                              damagePhoto = null;
                              _damageNotesController.clear();
                            } else {
                              if (damagedQuantity == 0) damagedQuantity = 1;
                            }
                            checked = false;
                          });
                        },
                      ),
                    ],
                  ),
                  if (hasDamage) ...[
                    const Divider(height: 20, color: Color(0xfffecaca)),
                    // 1. Jumlah Unit Rusak
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Jumlah Unit Rusak',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: brandInk,
                              ),
                            ),
                            Text(
                              'Unit (${item.unit})',
                              style: const TextStyle(
                                fontSize: 11,
                                color: muted,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(
                                Icons.remove_circle_outline,
                                color: danger,
                              ),
                              onPressed:
                                  damagedQuantity > 0
                                      ? () => setState(() {
                                        damagedQuantity--;
                                        checked = false;
                                      })
                                      : null,
                            ),
                            Container(
                              constraints: const BoxConstraints(minWidth: 44),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: const Color(0xfffca5a5),
                                ),
                              ),
                              child: Text(
                                '$damagedQuantity',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: danger,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.add_circle_outline,
                                color: danger,
                              ),
                              onPressed:
                                  () => setState(() {
                                    damagedQuantity++;
                                    checked = false;
                                  }),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // 2. Catatan / Alasan Kerusakan
                    const Text(
                      'Catatan / Alasan Kerusakan',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: brandInk,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final reason in [
                          'Kemasan Rusak / Robek',
                          'Segel Terbuka',
                          'Barang Pecah / Cacat',
                          'Basah / Bocor',
                        ])
                          InkWell(
                            borderRadius: BorderRadius.circular(6),
                            onTap: () {
                              setState(() {
                                if (_damageNotesController.text.isEmpty) {
                                  _damageNotesController.text = reason;
                                } else if (!_damageNotesController.text
                                    .contains(reason)) {
                                  _damageNotesController.text =
                                      '${_damageNotesController.text}, $reason';
                                }
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: const Color(0xfffecaca),
                                ),
                              ),
                              child: Text(
                                '+ $reason',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xff991b1b),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _damageNotesController,
                      maxLines: 2,
                      decoration: InputDecoration(
                        hintText: 'Tuliskan deskripsi kerusakan unit fisik...',
                        hintStyle: const TextStyle(fontSize: 11, color: muted),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.all(10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xfffca5a5),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xfffca5a5),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: danger,
                            width: 1.5,
                          ),
                        ),
                      ),
                      style: const TextStyle(fontSize: 12, color: brandInk),
                    ),
                    const SizedBox(height: 12),
                    // 3. Tombol Ambil Foto Bukti Kerusakan
                    const Text(
                      'Bukti Foto Fisik',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: brandInk,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (damagePhoto != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xff86efac),
                            width: 1.2,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xfff0fdf4),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(
                                Icons.photo_camera_rounded,
                                color: Color(0xff16a34a),
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Foto Bukti Berhasil Diambil',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xff166534),
                                    ),
                                  ),
                                  Text(
                                    damagePhoto!,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontFamily: 'monospace',
                                      color: brandSlate,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.refresh_rounded,
                                size: 18,
                                color: brandSlate,
                              ),
                              tooltip: 'Foto Ulang',
                              onPressed: () async {
                                final res = await QrScannerScreen.scan(
                                  context,
                                  title: 'Foto Bukti Kerusakan',
                                  hintText:
                                      'Arahkan kamera ke bagian fisik barang yang rusak / cacat lalu tekan tombol Ambil Foto',
                                  demoCode:
                                      'FOTO-RUSAK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
                                );
                                if (res != null && res.isNotEmpty) {
                                  setState(() => damagePhoto = res);
                                }
                              },
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                size: 18,
                                color: danger,
                              ),
                              tooltip: 'Hapus Foto',
                              onPressed:
                                  () => setState(() => damagePhoto = null),
                            ),
                          ],
                        ),
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(
                              color: Color(0xffe11d48),
                              width: 1.2,
                            ),
                            backgroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          onPressed: () async {
                            final res = await QrScannerScreen.scan(
                              context,
                              title: 'Foto Bukti Kerusakan',
                              hintText:
                                  'Arahkan kamera ke bagian fisik barang yang rusak / cacat lalu tekan tombol Ambil Foto',
                              demoCode:
                                  'FOTO-RUSAK-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
                            );
                            if (res != null && res.isNotEmpty) {
                              setState(() => damagePhoto = res);
                            }
                          },
                          icon: const Icon(
                            Icons.camera_alt_outlined,
                            color: Color(0xffe11d48),
                            size: 18,
                          ),
                          label: const Text(
                            '📷 Ambil Foto Bukti Kerusakan',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xffe11d48),
                            ),
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
            Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    putaway
                        ? 'Ringkasan Putaway (Masuk)'
                        : 'Ringkasan Dispatch (Keluar)',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                      color: brandInk,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _SummaryRow('Rak', r),
                  _SummaryRow('Barang', item.name),
                  _SummaryRow('SKU', item.sku),
                  if (targetQuantity > 0)
                    _SummaryRow(
                      'Target Pesanan',
                      '$targetQuantity ${item.unit}',
                    ),
                  _SummaryRow(
                    putaway ? 'Unit Diterima (Bagus)' : 'Unit Diambil (Bagus)',
                    '${putaway ? '+' : '-'}${formatNumber(quantity)} ${item.unit}',
                    color: const Color(0xff166534),
                  ),
                  if (hasDamage && damagedQuantity > 0)
                    _SummaryRow(
                      'Unit Rusak / Kendala',
                      '${formatNumber(damagedQuantity)} ${item.unit}',
                      color: danger,
                    ),
                  if (hasDamage && damagePhoto != null)
                    _SummaryRow(
                      'Foto Bukti',
                      'Terlampir ($damagePhoto)',
                      color: const Color(0xff0e7490),
                    ),
                  _SummaryRow(
                    'Stok di rak',
                    '${formatNumber(rackNow)} → ${formatNumber(after < 0 ? 0 : after)}',
                    color: after < 0 ? danger : brandInk,
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    activeColor: brand,
                    controlAffinity: ListTileControlAffinity.leading,
                    value: checked,
                    title: const Text(
                      'Saya telah menghitung dan memeriksa fisik unit ini',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: brandInk,
                      ),
                    ),
                    onChanged: (v) => setState(() => checked = v ?? false),
                  ),
                ],
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: save,
                icon: const Icon(Icons.check),
                label: Text(
                  putaway
                      ? 'Konfirmasi Putaway & Simpan'
                      : 'Konfirmasi Dispatch & Simpan',
                ),
              ),
            ),
          ],
        ],
      ],
    );
  }
}

/// Toggle pilihan mode Single Scan vs Multi Scan (Batch)
class _ScanTypeToggle extends StatelessWidget {
  final bool isMulti;
  final ValueChanged<bool> onChanged;

  const _ScanTypeToggle({required this.isMulti, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xfff1f4ec),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: line),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => onChanged(false),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: !isMulti ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow:
                      !isMulti
                          ? const [
                            BoxShadow(
                              color: Color(0x0f000000),
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ]
                          : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.qr_code_rounded,
                      size: 16,
                      color: !isMulti ? brand : brandSlate,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Single Scan',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight:
                            !isMulti ? FontWeight.w800 : FontWeight.w600,
                        color: !isMulti ? brandInk : brandSlate,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: InkWell(
              onTap: () => onChanged(true),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isMulti ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow:
                      isMulti
                          ? const [
                            BoxShadow(
                              color: Color(0x0f000000),
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ]
                          : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.qr_code_scanner_rounded,
                      size: 16,
                      color: isMulti ? brand : brandSlate,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Multi Scan (Batch)',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isMulti ? FontWeight.w800 : FontWeight.w600,
                        color: isMulti ? brandInk : brandSlate,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Indikator tiga langkah: Rack -> Item -> Confirm.
class _StepHeader extends StatelessWidget {
  final int current;
  final List<String> labels;
  final ValueChanged<int>? onStepTapped;
  const _StepHeader({
    required this.current,
    required this.labels,
    this.onStepTapped,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Row(
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Container(
                height: 2,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                color: i < current ? brand : line,
              ),
            ),
          _StepDot(
            number: i + 1,
            label: labels[i],
            current: current,
            onTap: (i + 1 < current) ? () => onStepTapped?.call(i + 1) : null,
          ),
        ],
      ],
    ),
  );
}

class _StepDot extends StatelessWidget {
  final int number, current;
  final String label;
  final VoidCallback? onTap;
  const _StepDot({
    required this.number,
    required this.label,
    required this.current,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final done = number < current;
    final active = number == current;
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: done || active ? brand : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(
              color: done || active ? brand : line,
              width: 1.5,
            ),
          ),
          child:
              done
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : Text(
                    '$number',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: active ? Colors.white : muted,
                    ),
                  ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
            color: active ? brandInk : (done ? brand : muted),
          ),
        ),
      ],
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          child: content,
        ),
      );
    }
    return content;
  }
}

/// Chip untuk langkah yang sudah selesai (rak / barang), dengan tombol Change.
class _DoneChip extends StatelessWidget {
  final String label, value;
  final VoidCallback onChange;
  const _DoneChip({
    required this.label,
    required this.value,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
    decoration: BoxDecoration(
      color: brandSoft,
      border: Border.all(color: brandSoftBorder),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Row(
      children: [
        const Icon(Icons.check_circle, size: 16, color: brand),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '$label: $value',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: forest,
            ),
          ),
        ),
        TextButton(
          style: TextButton.styleFrom(
            minimumSize: const Size(0, 32),
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          onPressed: onChange,
          child: const Text('Change'),
        ),
      ],
    ),
  );
}

class _SummaryRow extends StatelessWidget {
  final String label, value;
  final Color color;
  const _SummaryRow(this.label, this.value, {this.color = brandInk});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 90,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: muted,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    ),
  );
}

/// Kartu daftar untuk hasil Single Scan (lokasi barang / isi rak).
class _LookupPanel extends StatelessWidget {
  final String title, emptyText;
  final List<Widget> rows;
  const _LookupPanel({
    required this.title,
    required this.emptyText,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) => Panel(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.2,
            color: brandInk,
          ),
        ),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              emptyText,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: muted,
              ),
            ),
          )
        else
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 1, thickness: 1, color: line),
            rows[i],
          ],
      ],
    ),
  );
}

class _LookupRow extends StatelessWidget {
  final String title, trailing;
  final String? subtitle;
  final VoidCallback onTap;
  const _LookupRow({
    required this.title,
    required this.trailing,
    required this.onTap,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) => InkWell(
    borderRadius: BorderRadius.circular(12),
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: muted,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            trailing,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: brandInk,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.chevron_right, size: 18, color: muted),
        ],
      ),
    ),
  );
}

// -----------------------------------------------------------------------------
// Dialog Sukses Konfirmasi Transaksi (Putaway & Dispatching)
// -----------------------------------------------------------------------------

void _showSuccessConfirmationDialog({
  required BuildContext context,
  required bool isPutaway,
  required String itemName,
  required String sku,
  required String rack,
  required int quantity,
  required String unit,
  int? taskId,
  dynamic inboundShipmentId,
  dynamic outboundShipmentId,
  int damagedQty = 0,
  String? damageNotes,
  String? photoEvidence,
  int targetQuantity = 0,
}) {
  final s = context.read<WarehouseState>();
  final isShipmentInspection =
      inboundShipmentId != null || outboundShipmentId != null;

  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) {
      return Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xfff0fdf4),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xff86efac), width: 2),
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xff16a34a),
                  size: 38,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                inboundShipmentId != null
                    ? 'Inspeksi Dok Berhasil Dilaporkan!'
                    : (outboundShipmentId != null
                        ? 'Laporan Picking Dok Berhasil Dikirim!'
                        : (isPutaway
                            ? 'Putaway Berhasil Disimpan!'
                            : 'Dispatching Berhasil Disimpan!')),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: brandInk,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                isShipmentInspection
                    ? 'Laporan fisik & barcode telah dikirim ke Manager untuk ACC. Riwayat otomatis tercatat di halaman Aktivitas.'
                    : (isPutaway
                        ? 'Barang telah berhasil diletakkan pada rak tujuan dan tercatat di riwayat Aktivitas.'
                        : 'Barang telah berhasil dikeluarkan dari rak asal dan tercatat di riwayat Aktivitas.'),
                style: const TextStyle(
                  fontSize: 12,
                  color: brandSlate,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xfff8fafc),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xffe2e8f0)),
                ),
                child: Column(
                  children: [
                    _DialogSummaryRow(label: 'Barang', value: itemName),
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label: 'SKU',
                      value: '║▌║ $sku',
                      isBarcode: true,
                    ),
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label:
                          isShipmentInspection
                              ? 'Lokasi Dok'
                              : (isPutaway ? 'Rak Tujuan' : 'Rak Asal'),
                      value: rack,
                    ),
                    if (targetQuantity > 0) ...[
                      const SizedBox(height: 8),
                      _DialogSummaryRow(
                        label: 'Target Pesanan',
                        value: '$targetQuantity $unit',
                      ),
                    ],
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label:
                          isPutaway
                              ? 'Unit Diterima (Bagus)'
                              : 'Unit Diambil (Bagus)',
                      value:
                          '${isShipmentInspection ? '' : (isPutaway ? '+' : '-')}${formatNumber(quantity)} $unit',
                      valueColor: const Color(0xff16a34a),
                      isBold: true,
                    ),
                    if (damagedQty > 0) ...[
                      const SizedBox(height: 8),
                      _DialogSummaryRow(
                        label: 'Unit Rusak / Kendala',
                        value: '$damagedQty $unit',
                        valueColor: danger,
                        isBold: true,
                      ),
                    ],
                    if (damageNotes != null && damageNotes.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _DialogSummaryRow(
                        label: 'Catatan Kerusakan',
                        value: damageNotes,
                      ),
                    ],
                    if (photoEvidence != null) ...[
                      const SizedBox(height: 8),
                      _DialogSummaryRow(
                        label: 'Bukti Foto Fisik',
                        value: '📷 $photoEvidence',
                        valueColor: const Color(0xff0e7490),
                      ),
                    ],
                  ],
                ),
              ),
              if (taskId != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xfff0fdf4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xff86efac)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.task_alt,
                        size: 16,
                        color: Color(0xff16a34a),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Tugas #$taskId otomatis ditandai Selesai',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xff166534),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else if (isShipmentInspection) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xfff0fdf4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xff86efac)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.task_alt,
                        size: 16,
                        color: Color(0xff16a34a),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        inboundShipmentId != null
                            ? 'Inspeksi Dok Selesai & Dikirim ke Manager'
                            : 'Picking Dok Selesai & Dikirim ke Manager',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xff166534),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: brand,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    s.navigate(3); // Langsung kirim / buka menu Aktivitas
                  },
                  icon: const Icon(Icons.history_rounded, size: 18),
                  label: const Text(
                    'Buka Halaman Aktivitas',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                  },
                  icon: const Icon(
                    Icons.qr_code_scanner,
                    size: 18,
                    color: brand,
                  ),
                  label: const Text(
                    'Lanjut Scan di Sini',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: brand,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _DialogSummaryRow extends StatelessWidget {
  final String label, value;
  final bool isBarcode;
  final bool isBold;
  final Color? valueColor;

  const _DialogSummaryRow({
    required this.label,
    required this.value,
    this.isBarcode = false,
    this.isBold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: brandSlate,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: isBarcode ? 11 : 12,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: valueColor ?? brandInk,
              letterSpacing: isBarcode ? 0.3 : 0,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
