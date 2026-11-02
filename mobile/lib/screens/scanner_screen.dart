import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/barcode_input.dart';
import '../core/app_theme.dart';

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

  // Putaway = barang masuk (stockIn), Dispatching = barang keluar (stockOut).
  MovementKind get kind =>
      mode == ScanMode.dispatch ? MovementKind.stockOut : MovementKind.stockIn;

  @override
  void initState() {
    super.initState();
    final s = context.read<WarehouseState>();
    mode = s.scanMode;
    // Putaway dan Dispatching wajib scan barang dulu. Hanya Single Scan yang
    // boleh membawa SKU dari Home (cuma untuk melihat data).
    sku = mode == ScanMode.single ? s.scanSku : null;
  }

  void itemScanned(String code) {
    final item = context.read<WarehouseState>().resolve(code);
    if (item == null || item.sku != code.toUpperCase()) {
      message(context, 'Item barcode not found. Use a known SKU.');
      return;
    }
    final r = rack;
    if (mode == ScanMode.dispatch &&
        r != null &&
        (item.rackCounts[r] ?? 0) == 0) {
      message(context, '${item.sku} is not recorded in $r.');
      return;
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
      message(context, 'Invalid rack barcode format.');
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
    message(context, 'Unknown item or rack barcode.');
  }

  void save() {
    // Single Scan hanya untuk melihat data, tidak mengubah stok.
    if (mode == ScanMode.single) {
      return;
    }
    final skuCode = sku;
    final rackCode = rack;
    if (skuCode == null) {
      message(context, 'Scan an item first.');
      return;
    }
    if (rackCode == null) {
      message(context, 'Scan the rack first.');
      return;
    }
    if (!checked) {
      message(context, 'Confirm the physical count before saving.');
      return;
    }
    final s = context.read<WarehouseState>();
    final item = s.bySku(skuCode);
    if (mode == ScanMode.dispatch && (item.rackCounts[rackCode] ?? 0) == 0) {
      message(context, '${item.sku} is not recorded in $rackCode.');
      return;
    }
    final error = s.saveMovement(
      sku: skuCode,
      quantity: quantity,
      kind: kind,
      rack: rackCode,
      label: mode == ScanMode.putaway ? 'Putaway' : 'Dispatching',
    );
    if (error != null) {
      message(context, error);
      return;
    }
    message(context, 'Saved. Stock, activity logs and dashboard updated.');
    // Rak sengaja TIDAK dikosongkan: staf biasanya menata beberapa barang ke
    // rak yang sama. Untuk ganti rak, ketuk "Change" pada chip rak.
    setState(() {
      sku = null;
      quantity = 1;
      checked = false;
    });
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
    final rackNow = (item != null && r != null) ? (item.rackCounts[r] ?? 0) : 0;
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
                    '${rackItems.length} barang • $rackUnits unit',
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
                    '${putaway ? '+' : '-'}$quantity ${item.unit}',
                  ),
                  _SummaryRow(
                    'Stok di rak',
                    '$rackNow → $after',
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

