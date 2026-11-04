import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/warehouse_state.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import '../widgets/barcode_input.dart';
import '../core/app_theme.dart';

Future<void> flowSheet(BuildContext context, Widget child) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      barrierColor: const Color(0x770c170b),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder:
          (c) => Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(c).bottom),
            child: SizedBox(
              height: MediaQuery.sizeOf(c).height * .82,
              child: child,
            ),
          ),
    );

class FlowBody extends StatelessWidget {
  final String title, subtitle;
  final List<Widget> children;
  const FlowBody({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
  });
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.only(top: 12, bottom: 6),
        decoration: BoxDecoration(
          color: const Color(0xffcbd5e1),
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title.isNotEmpty)
                        Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                            letterSpacing: -0.3,
                            height: 1.25,
                            color: brandInk,
                          ),
                        ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            color: muted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                SizedBox(
                  width: 40,
                  height: 40,
                  child: IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xfff1f5f9),
                      shape: const CircleBorder(),
                    ),
                    padding: EdgeInsets.zero,
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(
                      Icons.close,
                      color: Color(0xff64748b),
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    ],
  );
}

Future<void> openStockScan(
  BuildContext context, {
  String demoCode = '',
}) => flowSheet(context, StockScanFlow(demoCode: demoCode));
Future<void> openRack(BuildContext context, String sku) =>
    flowSheet(context, RackCountFlow(sku: sku));
Future<void> openDiscrepancy(BuildContext context, String sku) =>
    flowSheet(context, DiscrepancyFlow(sku: sku));

class StockScanFlow extends StatefulWidget {
  final String demoCode;
  const StockScanFlow({super.key, this.demoCode = ''});
  @override
  State<StockScanFlow> createState() => _StockScanFlowState();
}

class _StockScanFlowState extends State<StockScanFlow> {
  String? sku;
  bool details = false;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = sku == null ? null : s.bySku(sku!);
    if (details && item != null) {
      return StockDetailsFlow(sku: item.sku);
    }
    return FlowBody(
      title: 'Quick Search Scan',
      subtitle: 'SUSUNO Vision Optical Core',
      children: [
        BarcodeInput(
          labelPreview: true,
          title: 'AF: Locked (50mm Macro)',
          demoCode: widget.demoCode,
          onResult: (code) {
            final i = s.resolve(code);
            if (i == null) {
              message(context, 'Unknown SKU or rack barcode.');
              return;
            }
            setState(() => sku = i.sku);
          },
        ),
        if (item != null) ...[
          Panel(
            tint: brandSoft,
            border: brandSoftBorder,
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SKU DETECTED & VERIFIED',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: .5,
                    color: mint,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '✓ ${item.sku} • ${item.name}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: brandInk,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '◎ ${item.rack} • ${item.zone}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
                const SizedBox(height: 12),
                const ClipRRect(
                  borderRadius: BorderRadius.all(Radius.circular(4)),
                  child: LinearProgressIndicator(
                    value: 1,
                    color: mint,
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          ),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  onPressed: () => setState(() => details = true),
                  icon: const Icon(Icons.visibility_outlined, size: 16),
                  label: const Text(
                    'View Item Now',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  onPressed: () => setState(() => sku = null),
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text(
                    'Scan Another',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class StockDetailsFlow extends StatelessWidget {
  final String sku;
  const StockDetailsFlow({super.key, required this.sku});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = s.bySku(sku);
    final color = statusColor(item.status);
    final isCritical = item.status == StockStatus.critical;

    return FlowBody(
      title: item.name,
      subtitle: '◎ ${item.rack} • ${item.zone}',
      children: [
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            Tag(
              isCritical ? 'KRITIS / PERLU RESTOCK' : 'STOK AMAN',
              color: color,
              solid: true,
            ),
            Tag('SKU: ${item.sku}', color: brandInk),
            if (item.category != null && item.category!.isNotEmpty)
              Tag('Kategori: ${item.category}', color: brand),
            if (item.supplier != null && item.supplier!.isNotEmpty)
              Tag('Pemasok: ${item.supplier}', color: brandSlate),
          ],
        ),
        const SizedBox(height: 18),
        StockCountBox(item),
        const SizedBox(height: 16),
        Panel(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Data Master Produk',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: brandInk,
                ),
              ),
              const SizedBox(height: 12),
              _DetailRow('Kode SKU', item.sku),
              _DetailRow('Nama Barang', item.name),
              _DetailRow('Lokasi Rak', item.rack),
              _DetailRow('Zona Gudang', item.zone),
              _DetailRow('Satuan Unit', item.unit),
              if (item.price > 0)
                _DetailRow('Harga Satuan', formatRupiah(item.price)),
              if (item.price > 0)
                _DetailRow(
                  'Estimasi Nilai Stok',
                  formatRupiah(item.price * item.quantity),
                  highlight: true,
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: brand,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
            ),
            onPressed: () {
              Navigator.pop(context);
              s.openScanner(
                item.sku,
                mode: isCritical ? ScanMode.putaway : ScanMode.single,
              );
            },
            icon: const Icon(Icons.qr_code_scanner, size: 18),
            label: Text(
              isCritical ? 'Putaway' : 'Single Scan',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: line),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'Tutup',
              style: TextStyle(
                color: brandSlate,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label, value;
  final bool highlight;
  const _DetailRow(this.label, this.value, {this.highlight = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
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
              fontWeight: highlight ? FontWeight.w900 : FontWeight.w700,
              color: highlight ? forest : brandInk,
            ),
          ),
        ),
      ],
    ),
  );
}

class RackCountFlow extends StatefulWidget {
  final String sku;
  const RackCountFlow({super.key, required this.sku});
  @override
  State<RackCountFlow> createState() => _RackCountFlowState();
}

class _RackCountFlowState extends State<RackCountFlow> {
  int step = 1, count = 0;
  bool rackVerified = false, physicallyChecked = false;
  @override
  void initState() {
    super.initState();
    final item = context.read<WarehouseState>().bySku(widget.sku);
    count = item.rackCounts[item.rack] ?? 0;
  }

  Future<void> save() async {
    final s = context.read<WarehouseState>();

    final error = await s.saveRackCount(widget.sku, count, physicallyChecked);
    if (!mounted) return;

    if (error != null) {
      message(context, error);
      return;
    }

    Navigator.pop(context);
    s.navigate(1);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<WarehouseState>();
    final item = s.bySku(widget.sku);
    return FlowBody(
      title:
          step == 1
              ? 'Step 1 Scan Rack Barcode'
              : step == 2
              ? 'Rack Stock Verification'
              : 'After Rack Count',
      subtitle:
          step == 1
              ? 'Verify physical location before inputting count'
              : '◎ ${item.rack}',
      children: [
        if (step == 1) ...[
          Panel(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 20, color: brand),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Target Location: ${item.rack}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: brandInk,
                    ),
                  ),
                ),
                Tag(
                  rackVerified ? 'VERIFIED' : 'PENDING SCAN',
                  color: rackVerified ? mint : amber,
                ),
              ],
            ),
          ),
          BarcodeInput(
            labelPreview: true,
            title: 'AF: Locked (Rack Label Mode)',
            demoCode: item.rack,
            onResult: (code) {
              final error = s.verifyRack(item.sku, code);
              if (error != null) {
                setState(() => rackVerified = false);
                message(context, error);
                return;
              }
              setState(() => rackVerified = true);
            },
          ),
          Panel(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: brandSoft,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: brandSoftBorder),
                  ),
                  child: const Icon(
                    Icons.precision_manufacturing_outlined,
                    color: brand,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Tag(item.sku, color: danger),
                      const SizedBox(height: 6),
                      Text(
                        item.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: brandInk,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Log: ${item.quantity} Units • Safe Min: ${item.minimum} Units',
                        style: const TextStyle(
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
          FilledButton.icon(
            onPressed: rackVerified ? () => setState(() => step = 2) : null,
            icon: const Icon(Icons.check_circle_outline, size: 18),
            label: const Text(
              'Rack Verified • Proceed to Step 2',
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 12),
          const Center(
            child: Text(
              '♧ Step 1 of 2: Location Verification Required',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xff94a3b8),
              ),
            ),
          ),
        ],
        if (step == 2) ...[
          Panel(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Tag(item.sku, color: danger),
                    Tag(
                      statusLabel(item.status),
                      color: statusColor(item.status),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: brandInk,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'System Count: ${item.rackCounts[item.rack] ?? 0} Units    Safe Min: ${item.minimum}',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: muted,
                  ),
                ),
              ],
            ),
          ),
          Panel(
            border: brandSoftBorder,
            padding: const EdgeInsets.all(14),
            child: CountControl(
              value: count,
              system: item.rackCounts[item.rack] ?? 0,
              onChanged:
                  (value) => setState(() {
                    count = value;
                    physicallyChecked = false;
                  }),
            ),
          ),
          Panel(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: CheckboxListTile(
              value: physicallyChecked,
              dense: false,
              activeColor: brand,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'I physically counted all units in this rack',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
              subtitle: const Text(
                'Confirm the floor count before saving.',
                style: TextStyle(fontSize: 11, color: muted),
              ),
              onChanged:
                  (value) => setState(() => physicallyChecked = value ?? false),
            ),
          ),
          FilledButton.icon(
            onPressed: physicallyChecked ? save : null,
            icon: const Icon(Icons.check, size: 18),
            label: const Text('Confirm & Save Rack Count'),
          ),
          TextButton(
            onPressed:
                () => setState(() {
                  step = 1;
                  rackVerified = false;
                }),
            child: const Text('Scan Rack QR First to Confirm Location'),
          ),
        ],
        if (step == 3) ...[
          StockCard(item),
          const Panel(
            tint: brandSoft,
            border: brandSoftBorder,
            child: Text(
              '✓ Verified physical count saved',
              style: TextStyle(
                color: forest,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Back to Stock Monitoring →'),
          ),
        ],
      ],
    );
  }
}

class DiscrepancyFlow extends StatefulWidget {
  final String sku;
  const DiscrepancyFlow({super.key, required this.sku});
  @override
  State<DiscrepancyFlow> createState() => _DiscrepancyFlowState();
}

class _DiscrepancyFlowState extends State<DiscrepancyFlow> {
  int physical = 0;
  bool submitted = false;
  final reason = TextEditingController();
  @override
  void initState() {
    super.initState();
    final q = context.read<WarehouseState>().bySku(widget.sku).quantity;
    physical = q > 0 ? q - 1 : 0;
  }

  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final error = await context.read<WarehouseState>().report(
      widget.sku,
      physical,
      reason.text,
    );
    if (!mounted) return;
    if (error != null) {
      message(context, error);
      return;
    }
    setState(() => submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    final item = context.watch<WarehouseState>().bySku(widget.sku);
    return FlowBody(
      title: submitted ? '' : 'Report Stock Discrepancy',
      subtitle: submitted ? '' : item.sku,
      children: [
        if (!submitted) ...[
          Text(
            item.name,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: brandInk,
            ),
          ),
          const SizedBox(height: 12),
          Panel(
            padding: const EdgeInsets.all(14),
            child: CountControl(
              value: physical,
              system: item.quantity,
              onChanged: (v) => setState(() => physical = v),
            ),
          ),
          TextField(
            controller: reason,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Reason / notes',
              hintText: 'Describe missing, damaged or extra stock',
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: submit,
            icon: const Icon(Icons.send_outlined, size: 16),
            label: const Text('Send Discrepancy Report'),
          ),
        ] else ...[
          const Center(
            child: CircleAvatar(
              radius: 30,
              backgroundColor: Color(0xfffff4cc),
              child: Icon(Icons.warning_amber, size: 32, color: amber),
            ),
          ),
          const SizedBox(height: 14),
          const Center(child: Tag('● TICKET FILED', color: amber)),
          const SizedBox(height: 14),
          const Center(
            child: Text(
              'Report Sent to Manager',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 20,
                letterSpacing: -0.3,
                color: brandInk,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'A stock adjustment request for ${item.sku} has been submitted for Floor Operations Manager approval and inventory ledger review.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: muted, height: 1.5),
          ),
          const SizedBox(height: 20),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(
              children: [
                _ReportRow('Item:', item.name),
                _ReportRow(
                  'Variance:',
                  '${physical - item.quantity} Units (Physical: $physical | System: ${item.quantity})',
                  color: danger,
                ),
                _ReportRow('Location:', item.rack),
                const _ReportRow(
                  'Status:',
                  '● Pending Supervisor Sign-Off',
                  color: amber,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Center(
            child: Text(
              '♧ Logged to the warehouse activity trail',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xff94a3b8),
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Back to Stock Monitoring →'),
          ),
        ],
      ],
    );
  }
}

class _ReportRow extends StatelessWidget {
  final String title, value;
  final Color color;
  const _ReportRow(this.title, this.value, {this.color = ink});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            title,
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
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ),
      ],
    ),
  );
}