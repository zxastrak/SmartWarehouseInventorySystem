export const rackSeed = [];
export const scannerShipmentProducts = [];
export function shipmentProducts(shipment, inventory = []) {
  if (shipment.id === "INB-2048" && scannerShipmentProducts.length > 0) {
    return scannerShipmentProducts.map((row) => ({ ...row }));
  }

  const isInspected = ["Review", "Inspected", "Received", "Complete"].includes(shipment.status);

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
      const actualReceived = received !== undefined ? received : (isInspected ? ordered : 0);
      const inv = (inventory || []).find((item) => item.sku === code || item.name === name);
      const category = row.category || inv?.category || (/scanner|light|cord/i.test(name) ? "Electronics" : /label|tape/i.test(name) ? "Accessories" : "General");
      const effectiveBarcodes = safeBarcodes.length > 0
        ? safeBarcodes
        : (isInspected ? Array.from({ length: Math.max(0, actualReceived) }, (_, idx) => `${code}-${String(idx + 1).padStart(3, '0')}`) : []);

      const itemEvidence = row.damage_photo || row.evidence_url || (damaged > 0 ? shipment.evidence_url : null);
      return {
        sku: code || `SKU-${Math.random().toString(36).substring(7)}`,
        name,
        ordered,
        received: received !== undefined ? received : (isInspected ? ordered : 0),
        damaged: damaged !== undefined ? damaged : 0,
        rejected,
        barcodes: effectiveBarcodes,
        category,
        unit: row.unit || inv?.unit || "pcs",
        rack: row.rack || inv?.rack || "Dock Staging",
        image_url: row.image_url || inv?.image_url || null,
        assigned_staff: row.assigned_staff || row.staff || shipment.assigned_staff || shipment.staff || "Semua Staf Lapangan",
        notes: row.notes || inv?.description || "",
        damage_photo: itemEvidence,
        evidence_url: itemEvidence,
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
      const actualReceived = received !== undefined ? received : (isInspected ? ordered : 0);
      const effectiveBarcodes = safeBarcodes.length > 0
        ? safeBarcodes
        : (isInspected ? Array.from({ length: Math.max(0, actualReceived) }, (_, idx) => `${code}-${String(idx + 1).padStart(3, '0')}`) : []);

      const itemEvidence = row.damage_photo || row.evidence_url || (damaged > 0 ? shipment.evidence_url : null);
      return {
        sku: code,
        name,
        ordered,
        received: received !== undefined ? received : (isInspected ? ordered : 0),
        damaged: damaged !== undefined ? damaged : 0,
        rejected,
        barcodes: effectiveBarcodes,
        category,
        unit: row.unit || inv?.unit || "pcs",
        rack: row.rack || inv?.rack || "Dock Staging",
        image_url: row.image_url || inv?.image_url || null,
        assigned_staff: row.assigned_staff || row.staff || shipment.assigned_staff || shipment.staff || "Semua Staf Lapangan",
        notes: row.notes || inv?.description || "",
        damage_photo: itemEvidence,
        evidence_url: itemEvidence,
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
      unit: item.unit || "pcs",
      damage_photo: shipment.evidence_url || null,
      evidence_url: shipment.evidence_url || null,
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
    unit: "pcs",
    damage_photo: shipment.evidence_url || null,
    evidence_url: shipment.evidence_url || null,
  }));
}

export function rackMatches(category, rack) {
  if (!rack) return true;
  return rack.zone === (category === "Electronics" ? "Electronics" : category === "Accessories" ? "Accessories" : category === "PPE" ? "PPE" : "General");
}

export function newReceivingDraft(shipment, inventory, racks = []) {
  const isInspected = ["Review", "Inspected", "Received", "Complete"].includes(shipment.status);
  const rows = shipmentProducts(shipment, inventory).map((row) => ({
    ...row,
    received: row.received !== undefined ? row.received : row.ordered,
    damaged: row.damaged !== undefined ? row.damaged : 0,
    rejected: row.rejected !== undefined ? row.rejected : 0,
    barcodes: row.barcodes || [],
    damage_photo: row.damage_photo || (Number(row.damaged) > 0 ? shipment.evidence_url : null),
    evidence_url: row.evidence_url || shipment.evidence_url || null,
  }));
  return {
    stage: isInspected ? "review" : "inspect",
    rows,
    notes: shipment.notes || "",
    evidence: shipment.evidence_url ? [{ id: "evidence-dock-1", name: "Bukti Foto Dok (Mobile)", url: shipment.evidence_url }] : [],
    evidence_url: shipment.evidence_url || null,
    allocations: {},
    savedAt: isInspected ? new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
  };
}
