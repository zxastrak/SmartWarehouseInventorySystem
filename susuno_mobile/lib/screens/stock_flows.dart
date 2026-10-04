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
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
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
        width: 35,
        height: 4,
        margin: const EdgeInsets.only(top: 10, bottom: 4),
        decoration: BoxDecoration(
          color: const Color(0xffcbd5e1),
          borderRadius: BorderRadius.circular(3),
        ),
      ),
      Expanded(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 7, 16, 15),
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
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                            height: 1.25,
                          ),
                        ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 5),
                        Text(
                          subtitle,
                          style: const TextStyle(color: muted, fontSize: 10),
                        ),
                      ],
                    ],
                  ),
                ),
                SizedBox(
                  width: 27,
                  height: 27,
                  child: IconButton(
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xfff1f5f9),
                    ),
                    padding: EdgeInsets.zero,
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(
                      Icons.close,
                      color: Color(0xff8095b5),
                      size: 15,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 15),
            ...children,
          ],
        ),
      ),
    ],
  );
}

Future<void> openStockScan(
  BuildContext context, {
  String demoCode = 'SKU-9249',
}) => flowSheet(context, StockScanFlow(demoCode: demoCode));
Future<void> openRack(BuildContext context, String sku) =>
    flowSheet(context, RackCountFlow(sku: sku));
Future<void> openDiscrepancy(BuildContext context, String sku) =>
    flowSheet(context, DiscrepancyFlow(sku: sku));

class StockScanFlow extends StatefulWidget {
  final String demoCode;
  const StockScanFlow({super.key, this.demoCode = 'SKU-9249'});
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
            tint: const Color(0xffecfdf5),
            border: const Color(0xff9eeccf),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SKU DETECTED & VERIFIED',
                  style: TextStyle(
                    fontSize: 8,
                    color: mint,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '✓ ${item.sku} • ${item.name}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  '◎ ${item.rack} • ${item.zone}',
                  style: const TextStyle(fontSize: 9, color: muted),
                ),
                const SizedBox(height: 12),
                const LinearProgressIndicator(
                  value: 1,
                  color: mint,
                  minHeight: 4,
                ),
              ],
            ),
          ),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: forest),
                  onPressed: () => setState(() => details = true),
                  icon: const Icon(Icons.visibility_outlined, size: 15),
                  label: const Text('View Item Now'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() => sku = null),
                  icon: const Icon(Icons.refresh, size: 15),
                  label: const Text('Scan Another'),
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
    final item = context.watch<WarehouseState>().bySku(sku);
    return FlowBody(
      title: item.name,
      subtitle: '◎ ${item.rack} • ${item.zone}',
      children: [
        Wrap(
          spacing: 6,
          children: [
            Tag(
              statusLabel(item.status),
              color: statusColor(item.status),
              solid: item.status == StockStatus.critical,
            ),
            Tag(item.sku, color: muted),
          ],
        ),
        const SizedBox(height: 15),
        const Tag('Category: Mechanical Parts', color: muted),
        const SizedBox(height: 7),
        const Tag('Supplier: Warehouse Partner', color: muted),
        const SizedBox(height: 19),
        StockCountBox(item),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: Panel(
                child: Row(
                  children: [
                    const Icon(Icons.history, color: forest, size: 18),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'INBOUND LOG\n4d ago (+300)',
                        style: TextStyle(fontSize: 9),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Panel(
                child: Row(
                  children: [
                    const Icon(Icons.hourglass_empty, color: forest, size: 18),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'AI FORECAST\n${item.daysLeft.toStringAsFixed(1)} days buffer',
                        style: const TextStyle(fontSize: 9, color: danger),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: forest),
          onPressed: () async {
            final previous = item.verifiedAt;
            await openRack(context, sku);
            if (!context.mounted) {
              return;
            }
            if (item.verifiedAt != previous) {
              Navigator.pop(context);
            }
          },
          icon: const Icon(Icons.fact_check_outlined, size: 17),
          label: const Text('Verify Rack Count'),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: amber,
            side: const BorderSide(color: amber),
          ),
          onPressed: () => openDiscrepancy(context, sku),
          icon: const Icon(Icons.warning_amber, size: 17),
          label: const Text('Report Stock Discrepancy'),
        ),
      ],
    );
  }
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

  void save() {
    final s = context.read<WarehouseState>();

    final error = s.saveRackCount(widget.sku, count, physicallyChecked);

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
            padding: const EdgeInsets.all(9),
            child: Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 17, color: forest),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Target Location: ${item.rack}',
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
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
            child: Row(
              children: [
                const Icon(
                  Icons.precision_manufacturing_outlined,
                  color: forest,
                  size: 28,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Tag(item.sku, color: danger),
                      const SizedBox(height: 6),
                      Text(
                        item.name,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Log: ${item.quantity} Units • Safe Min: ${item.minimum} Units',
                        style: const TextStyle(fontSize: 9, color: muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: forest),
            onPressed: rackVerified ? () => setState(() => step = 2) : null,
            icon: const Icon(Icons.check_circle_outline, size: 17),
            label: const Text(
              'Rack Barcode Verified • Proceed to Step 2',
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 10),
          const Center(
            child: Text(
              '♧ Step 1 of 2: Location Verification Required',
              style: TextStyle(fontSize: 9, color: Color(0xff94a3b8)),
            ),
          ),
        ],
        if (step == 2) ...[
          Panel(
            tint: const Color(0xfff8faff),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  children: [
                    Tag(item.sku, color: danger),
                    Tag(
                      statusLabel(item.status),
                      color: statusColor(item.status),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'System Count: ${item.rackCounts[item.rack] ?? 0} Units    Safe Min: ${item.minimum}',
                  style: const TextStyle(fontSize: 9, color: muted),
                ),
              ],
            ),
          ),
          Panel(
            tint: const Color(0xfff8faff),
            border: const Color(0xff9ccbb5),
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
            tint: const Color(0xfff8faff),
            padding: EdgeInsets.zero,
            child: CheckboxListTile(
              value: physicallyChecked,
              dense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 6),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'I physically counted all units in this rack',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
              ),
              subtitle: const Text(
                'Confirm the floor count before saving.',
                style: TextStyle(fontSize: 9),
              ),
              onChanged:
                  (value) => setState(() => physicallyChecked = value ?? false),
            ),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: forest),
            onPressed: physicallyChecked ? save : null,
            icon: const Icon(Icons.check, size: 17),
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
            tint: Color(0xffecfdf5),
            child: Text(
              '✓ Verified physical count saved',
              style: TextStyle(color: mint, fontSize: 11),
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: forest),
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

  void submit() {
    final error = context.read<WarehouseState>().report(
      widget.sku,
      physical,
      reason.text,
    );
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
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          Panel(
            tint: const Color(0xfff8faff),
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
            style: FilledButton.styleFrom(backgroundColor: forest),
            onPressed: submit,
            icon: const Icon(Icons.send_outlined, size: 16),
            label: const Text('Send Discrepancy Report'),
          ),
        ] else ...[
          const Center(
            child: CircleAvatar(
              radius: 28,
              backgroundColor: Color(0xfffff4cc),
              child: Icon(Icons.warning_amber, size: 31, color: amber),
            ),
          ),
          const SizedBox(height: 14),
          const Center(child: Tag('● TICKET FILED', color: amber)),
          const SizedBox(height: 14),
          const Center(
            child: Text(
              'Report Sent to Manager',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'A stock adjustment request for ${item.sku} has been submitted for Floor Operations Manager approval and inventory ledger review.',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: muted, height: 1.5),
          ),
          const SizedBox(height: 22),
          Panel(
            tint: const Color(0xfff8faff),
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
          const SizedBox(height: 18),
          const Center(
            child: Text(
              '♧ Logged to the warehouse activity trail',
              style: TextStyle(fontSize: 9, color: Color(0xff94a3b8)),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: forest),
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
    padding: const EdgeInsets.symmetric(vertical: 11),
    child: Row(
      children: [
        SizedBox(
          width: 65,
          child: Text(title, style: const TextStyle(fontSize: 9, color: muted)),
        ),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 9, color: color),
          ),
        ),
      ],
    ),
  );
}
