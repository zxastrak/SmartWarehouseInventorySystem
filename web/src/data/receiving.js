export const rackSeed = [];
export const scannerShipmentProducts = [];
export function shipmentProducts(shipment, inventory = []) {
  if (shipment.id === "INB-2048" && scannerShipmentProducts.length > 0) {
    return scannerShipmentProducts.map((row) => ({ ...row }));
  }

  // 1. Ambil dari shipment.products jika ada
  if (Array.isArray(shipment.products) && shipment.products.length > 0) {
    return shipment.products.map((row) => {
      const code = row.code || row.sku || row.product_sku || '';
      const name = row.name || row.product_name || `Product ${code}`;
      const ordered = Number(row.ordered ?? row.quantity ?? row.ordered_qty ?? 1);
      const received = row.received !== undefined ? Number(row.received) : (row.accepted_qty !== undefined ? Number(row.accepted_qty) : undefined);
      const damaged = row.damaged !== undefined ? Number(row.damaged) : (row.damaged_qty !== undefined ? Number(row.damaged_qty) : undefined);
      const rejected = row.rejected !== undefined ? Number(row.rejected) : 0;
      const rawBarcodes = row.barcodes || [];
      let safeBarcodes = Array.isArray(rawBarcodes) ? rawBarcodes : [];
      if (!Array.isArray(safeBarcodes) && typeof rawBarcodes === 'string') {
        try { safeBarcodes = JSON.parse(rawBarcodes); } catch (_) {}
      }
      const actualReceived = received !== undefined ? received : ordered;
      const inv = (inventory || []).find((item) => item.sku === code || item.name === name);
      const category = row.category || inv?.category || (/scanner|light|cord/i.test(name) ? "Electronics" : /label|tape/i.test(name) ? "Accessories" : "General");
      const effectiveBarcodes = safeBarcodes.length > 0
        ? safeBarcodes
        : Array.from({ length: Math.max(0, actualReceived) }, (_, idx) => `${code}-${String(idx + 1).padStart(3, '0')}`);

      return {
        sku: code || `SKU-${Math.random().toString(36).substring(7)}`,
        name,
        ordered,
        received,
        damaged,
        rejected,
        barcodes: effectiveBarcodes,
        category,
      };
    });
  }

  // 2. Ambil dari shipment.items jika ada
  if (Array.isArray(shipment.items) && shipment.items.length > 0) {
    return shipment.items.map((row) => {
      const code = row.sku || row.product_sku || row.code || `SKU-${row.product_id || row.id}`;
      const name = row.product_name || row.name || `Product ${code}`;
      const ordered = Number(row.expected_quantity ?? row.ordered_qty ?? row.quantity ?? row.ordered ?? 1);
      const received = row.accepted_qty !== undefined ? Number(row.accepted_qty) : (row.received !== undefined ? Number(row.received) : undefined);
      const damaged = row.damaged_qty !== undefined ? Number(row.damaged_qty) : (row.damaged !== undefined ? Number(row.damaged) : undefined);
      const rejected = row.rejected !== undefined ? Number(row.rejected) : 0;
      const inv = (inventory || []).find((item) => item.sku === code || item.name === name);
      const category = row.category || inv?.category || (/scanner|light|cord/i.test(name) ? "Electronics" : /label|tape/i.test(name) ? "Accessories" : "General");
      
      const rawBarcodes = row.barcodes || [];
      let safeBarcodes = Array.isArray(rawBarcodes) ? rawBarcodes : [];
      if (!Array.isArray(safeBarcodes) && typeof rawBarcodes === 'string') {
        try { safeBarcodes = JSON.parse(rawBarcodes); } catch (_) {}
      }
      const actualReceived = received !== undefined ? received : ordered;
      const effectiveBarcodes = safeBarcodes.length > 0
        ? safeBarcodes
        : Array.from({ length: Math.max(0, actualReceived) }, (_, idx) => `${code}-${String(idx + 1).padStart(3, '0')}`);

      return {
        sku: code,
        name,
        ordered,
        received,
        damaged,
        rejected,
        barcodes: effectiveBarcodes,
        category,
      };
    });
  }

  // 3. Fallback: ambil produk dari inventory yang tersedia
  if (Array.isArray(inventory) && inventory.length > 0) {
    const rawCount = typeof shipment.items === 'number' && shipment.items > 0 ? shipment.items : inventory.length;
    const count = Math.min(rawCount, inventory.length);
    const chosen = inventory.slice(0, count);
    const totalUnits = Number(shipment.units) || (chosen.length * 10);
    const unitsPerItem = Math.max(1, Math.floor(totalUnits / chosen.length));
    return chosen.map((item, index) => ({
      sku: item.sku,
      name: item.name,
      ordered: unitsPerItem + (index === 0 ? (totalUnits % chosen.length) : 0),
      category: item.category || "General",
    }));
  }

  // 4. Fallback terakhir jika inventaris belum dimuat
  const count = typeof shipment.items === 'number' && shipment.items > 0 ? shipment.items : 1;
  const units = Number(shipment.units) || count;
  return Array.from({ length: count }, (_, index) => ({
    sku: `${shipment.id}-${index + 1}`,
    name: `${shipment.supplier || 'Supplier'} item ${index + 1}`,
    category: "General",
    ordered: Math.floor(units / count) + (index < units % count ? 1 : 0),
  }));
}

export function rackMatches(category, rack) {
  if (!rack) return true;
  return rack.zone === (category === "Electronics" ? "Electronics" : category === "Accessories" ? "Accessories" : category === "PPE" ? "PPE" : "General");
}

export function newReceivingDraft(shipment, inventory, racks = []) {
  const isInspected = shipment.status === "Inspected";
  const rows = shipmentProducts(shipment, inventory).map((row) => ({
    ...row,
    received: row.received !== undefined ? row.received : row.ordered,
    damaged: row.damaged !== undefined ? row.damaged : 0,
    rejected: row.rejected !== undefined ? row.rejected : 0,
    barcodes: row.barcodes || [],
  }));
  return {
    stage: isInspected ? "review" : "inspect",
    rows,
    notes: shipment.notes || "",
    evidence: shipment.evidence_url ? [{ id: "evidence-dock-1", name: "Bukti Foto Dok (Mobile)", url: shipment.evidence_url }] : [],
    allocations: {},
    savedAt: isInspected ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
  };
}
