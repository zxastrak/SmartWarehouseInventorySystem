import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/barcode_input.dart';
import '../widgets/dev_qr_bypass.dart';
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
  int quantity = 1;
  bool checked = false;
  int? taskId;
  dynamic inboundShipmentId;
  bool isBypassed = false;

  // Putaway = barang masuk (stockIn), Dispatching = barang keluar (stockOut).
  MovementKind get kind =>
      mode == ScanMode.dispatch ? MovementKind.stockOut : MovementKind.stockIn;

  @override
  void initState() {
    super.initState();
    final s = context.read<WarehouseState>();
    mode = s.scanMode;
    // Bawa SKU, Rak, Kuantitas, Task ID, dan Inbound Shipment ID dari tugas jika tersedia
    sku = (s.scanSku != null && s.scanSku!.isNotEmpty) ? s.scanSku : null;
    rack = (s.scanRack != null && s.scanRack!.isNotEmpty) ? s.scanRack : null;
    quantity = (s.scanQuantity != null && s.scanQuantity! > 0) ? s.scanQuantity! : 1;
    taskId = s.scanTaskId;
    inboundShipmentId = s.scanInboundShipmentId;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = context.read<WarehouseState>();
    if (s.scanSku != null && s.scanSku!.isNotEmpty && s.scanSku != sku) {
      setState(() {
        sku = s.scanSku;
        mode = s.scanMode;
        if (s.scanRack != null && s.scanRack!.isNotEmpty) rack = s.scanRack;
        if (s.scanQuantity != null && s.scanQuantity! > 0) quantity = s.scanQuantity!;
        taskId = s.scanTaskId;
        inboundShipmentId = s.scanInboundShipmentId;
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

  void itemScanned(String code) {
    final item = context.read<WarehouseState>().resolve(code);
    if (item == null || item.sku != code.toUpperCase()) {
      message(context, 'Barcode barang tidak ditemukan. Gunakan SKU yang terdaftar.');
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
      sku = item.sku;
      quantity = 1;
      checked = false;
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
      checked = false;
    });
  }

  // Single Scan: kode yang dipindai bisa berupa barang (SKU) atau rak.
  // Barang -> tampilkan data barang. Rak -> tampilkan isi rak. Tidak mengubah stok.
  // Di mode ini `sku` = barang yang sedang dilihat, `rack` = rak yang sedang dilihat.
  void lookupScanned(String code) {
    final s = context.read<WarehouseState>();
    final normalized = code.trim().toUpperCase();
    final matches = s.items.where((i) => i.sku.toUpperCase() == normalized);
    if (matches.isNotEmpty) {
      setState(() {
        sku = matches.first.sku;
        rack = null;
      });
      return;
    }
    if (s.validRack(normalized)) {
      setState(() {
        rack = normalized;
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
    if (!checked) {
      message(context, 'Centang konfirmasi pemeriksaan fisik unit sebelum menyimpan.');
      return;
    }
    final s = context.read<WarehouseState>();
    final item = s.bySku(skuCode);
    final rackStock = _getRackStock(item, rackCode);

    // Jika dalam mode bypass / skip (atau jika stok rak belum ada), cukupi stok rak agar validasi tidak memblokir
    if (mode == ScanMode.dispatch && (rackStock == 0 || isBypassed)) {
      item.rackCounts[rackCode] = quantity + 10;
    } else if (mode == ScanMode.dispatch && quantity > rackStock) {
      if (!isBypassed) {
        message(context, 'Jumlah pengeluaran ($quantity) melebihi stok rak ($rackStock).');
        return;
      }
      item.rackCounts[rackCode] = quantity;
    }

    final error = s.saveMovement(
      sku: skuCode,
      quantity: quantity,
      kind: kind,
      rack: rackCode,
      label: mode == ScanMode.putaway ? 'Putaway' : 'Dispatching',
      bypassValidation: isBypassed,
    );
    if (error != null && !isBypassed) {
      message(context, error);
      return;
    }

    final savedSku = skuCode;
    final savedItemName = item.name;
    final savedRack = rackCode;
    final savedQty = quantity;
    final savedUnit = item.unit;
    final isPutaway = mode == ScanMode.putaway;

    // Auto-match task fallback jika taskId null: cari tugas pending yang cocok dengan SKU ini
    int? currentTaskId = taskId;
    if (currentTaskId == null) {
      final matching = s.pendingTasks.firstWhere(
        (t) => (t['sku'] ?? '').toString().toUpperCase() == savedSku.toUpperCase(),
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

    // Auto-match inbound shipment fallback jika inboundShipmentId null:
    dynamic currentInboundId = inboundShipmentId;
    if (currentInboundId == null) {
      final matchingShipment = s.arrivedShipments.firstWhere(
        (sh) => sh.items.any((it) => it.sku.toUpperCase() == savedSku.toUpperCase()),
        orElse: () => InboundShipmentModel(
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

    // Jika dipicu dari tugas inspeksi dok (Inbound Shipment), selesaikan inspeksi dok
    if (currentInboundId != null) {
      await s.completeInboundShipment(
        currentInboundId,
        sku: savedSku,
        quantity: savedQty,
        rack: savedRack,
      );
    }

    // Reset input state
    setState(() {
      sku = null;
      rack = null;
      quantity = 1;
      checked = false;
      taskId = null;
      inboundShipmentId = null;
      isBypassed = false;
    });

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
    );
  }

  Widget modeChip(String label, bool selected, VoidCallback onTap) =>
      ChoiceChip(
        label: Text(label),
        selected: selected,
        showCheckmark: false,
        selectedColor: brandSoft,
        side: BorderSide(
          color: selected ? brand : line,
          width: selected ? 1.5 : 1,
        ),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: selected ? brand : brandSlate,
        ),
        onSelected: (_) => onTap(),
      );

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = sku == null ? null : s.bySku(sku!);
    final r = rack;
    final putaway = mode == ScanMode.putaway;
    final multi = mode != ScanMode.single;
    // Langkah aktif untuk Putaway/Dispatching: 1 = rak, 2 = barang, 3 = konfirmasi.
    final step = r == null ? 1 : (item == null ? 2 : 3);
    // Barang contoh untuk tombol Demo Scan di langkah 2: pilih yang tercatat di rak terpilih.
    final inRack =
        r == null
            ? <StockItem>[]
            : s.items.where((i) => (i.rackCounts[r] ?? 0) > 0).toList();
    final demoSku = inRack.isNotEmpty
        ? inRack.first.sku
        : (s.items.isNotEmpty ? s.items.first.sku : '');
    final rackNow = (item != null && r != null) ? _getRackStock(item, r) : 0;
    final after = putaway ? rackNow + quantity : rackNow - quantity;
    // Single Scan: isi rak yang sedang dilihat (barang dengan stok > 0 di rak itu).
    final rackItems =
        (!multi && r != null)
            ? s.items.where((i) => (i.rackCounts[r] ?? 0) > 0).toList()
            : <StockItem>[];
    final rackUnits = rackItems.fold<int>(
      0,
      (sum, i) => sum + (i.rackCounts[r] ?? 0),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 8, bottom: 16),
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
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children:
              ScanMode.values
                  .map(
                    (m) => modeChip(
                      switch (m) {
                        ScanMode.single => 'Single Scan',
                        ScanMode.putaway => 'Putaway',
                        ScanMode.dispatch => 'Dispatching',
                      },
                      mode == m,
                      () => setState(() {
                        mode = m;
                        rack = null;
                        sku = null;
                        quantity = 1;
                        checked = false;
                        taskId = null;
                        inboundShipmentId = null;
                        isBypassed = false;
                      }),
                    ),
                  )
                  .toList(),
        ),
        const SizedBox(height: 14),
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
                    trailing: '${i.rackCounts[r] ?? 0} ${i.unit}',
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
          _StepHeader(current: step, labels: const ['Rak', 'Barang', 'Konfirmasi']),
          // === DEV BYPASS (HAPUS FILE dev_qr_bypass.dart & BLOK INI SAAT PRODUCTION) ===
          DevQrBypassBar(
            mode: mode,
            step: step,
            currentRack: r,
            currentSku: sku,
            onBypassRack: (code) {
              isBypassed = true;
              rackScanned(code);
            },
            onBypassItem: (code) {
              isBypassed = true;
              itemScanned(code);
            },
            onBypassAll: (rackCode, skuCode) {
              isBypassed = true;
              rackScanned(rackCode);
              itemScanned(skuCode);
            },
            onReset: () => setState(() {
              rack = null;
              sku = null;
              quantity = 1;
              checked = false;
              taskId = null;
              inboundShipmentId = null;
              isBypassed = false;
            }),
          ),
          // ==============================================================================
          if (r != null)
            _DoneChip(
              label: 'Rak',
              value: r,
              onChange:
                  () => setState(() {
                    rack = null;
                    checked = false;
                  }),
            ),
          if (item != null)
            _DoneChip(
              label: 'Barang',
              value: '${item.sku} • ${item.name}',
              onChange:
                  () => setState(() {
                    sku = null;
                    quantity = 1;
                    checked = false;
                  }),
            ),
          if (step == 1)
            BarcodeInput(
              key: const ValueKey('rack-step'),
              title:
                  putaway
                      ? 'Pindai barcode rak tujuan'
                      : 'Pindai barcode rak asal',
              demoCode: 'RACK-A4-02-B',
              onResult: rackScanned,
            ),
          if (step == 2)
            BarcodeInput(
              key: const ValueKey('item-step'),
              title: 'Pindai barcode barang',
              demoCode: demoSku,
              onResult: itemScanned,
            ),
          if (step == 3 && item != null && r != null) ...[
            Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    putaway
                        ? 'Jumlah unit masuk ke rak ini'
                        : 'Jumlah unit keluar dari rak ini',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: muted,
                    ),
                  ),
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
            Panel(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    putaway ? 'Ringkasan Putaway (Masuk)' : 'Ringkasan Dispatch (Keluar)',
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
                  _SummaryRow(
                    'Jumlah',
                    '${putaway ? '+' : '-'}${formatNumber(quantity)} ${item.unit}',
                  ),
                  _SummaryRow(
                    'Stok di rak',
                    '${formatNumber(rackNow)} → ${formatNumber(after < 0 && isBypassed ? 0 : after)}',
                    color: (after < 0 && !isBypassed) ? danger : brandInk,
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

/// Indikator tiga langkah: Rack -> Item -> Confirm.
class _StepHeader extends StatelessWidget {
  final int current;
  final List<String> labels;
  const _StepHeader({required this.current, required this.labels});

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
          _StepDot(number: i + 1, label: labels[i], current: current),
        ],
      ],
    ),
  );
}

class _StepDot extends StatelessWidget {
  final int number, current;
  final String label;
  const _StepDot({
    required this.number,
    required this.label,
    required this.current,
  });

  @override
  Widget build(BuildContext context) {
    final done = number < current;
    final active = number == current;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: done || active ? brand : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: done || active ? brand : line, width: 1.5),
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
            color: active ? brandInk : muted,
          ),
        ),
      ],
    );
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
}) {
  final s = context.read<WarehouseState>();
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
                isPutaway
                    ? 'Putaway Berhasil Disimpan!'
                    : 'Dispatching Berhasil Disimpan!',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: brandInk,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                isPutaway
                    ? 'Barang telah berhasil diletakkan pada rak tujuan dan tercatat di sistem.'
                    : 'Barang telah berhasil dikeluarkan dari rak asal dan tercatat di sistem.',
                style: const TextStyle(fontSize: 12, color: brandSlate, height: 1.4),
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
                    _DialogSummaryRow(
                      label: 'Barang',
                      value: itemName,
                    ),
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label: 'SKU',
                      value: '║▌║ $sku',
                      isBarcode: true,
                    ),
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label: isPutaway ? 'Rak Tujuan' : 'Rak Asal',
                      value: rack,
                    ),
                    const SizedBox(height: 8),
                    _DialogSummaryRow(
                      label: 'Jumlah Unit',
                      value: '${isPutaway ? '+' : '-'}${formatNumber(quantity)} $unit',
                      valueColor: isPutaway ? const Color(0xff16a34a) : const Color(0xffb45309),
                      isBold: true,
                    ),
                  ],
                ),
              ),
              if (taskId != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xfff0fdf4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xff86efac)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.task_alt, size: 16, color: Color(0xff16a34a)),
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
              ] else if (inboundShipmentId != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xfff0fdf4),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xff86efac)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.task_alt, size: 16, color: Color(0xff16a34a)),
                      SizedBox(width: 6),
                      Text(
                        'Inspeksi Dok Selesai & Dikirim ke Manager',
                        style: TextStyle(
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    s.navigate(0); // Kembali ke Beranda / Shift Hub
                  },
                  icon: const Icon(Icons.home_outlined, size: 18),
                  label: const Text(
                    'Selesai & Kembali ke Beranda',
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
                  icon: const Icon(Icons.qr_code_scanner, size: 18, color: brand),
                  label: const Text(
                    'Scan Transaksi Baru',
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
          style: const TextStyle(fontSize: 12, color: brandSlate, fontWeight: FontWeight.w600),
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

