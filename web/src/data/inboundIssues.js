const issueChoices = [
  { id: "quarantine", title: "Move to quarantine", description: "Hold in Q-02 for supplier claim", stock: "Quarantine stock", reference: "CLM" },
  { id: "return", title: "Return to supplier", description: "Create return shipment", stock: "Return stock", reference: "RTN" },
  { id: "restricted", title: "Accept with note", description: "Add to restricted stock", stock: "Restricted stock", reference: "RST" },
  { id: "replacement", title: "Request replacement", description: "Supplier sends replacement unit", stock: "Quarantine stock", reference: "RPL" }
];
const inboundIssueSeed = {
  "INB-2044": {
    issue: {
      receivedAt: "2026-09-14T10:20:00+07:00",
      inspector: "Raka",
      items: [{ sku: "WH-4450", name: "Pallet Jack", category: "Equipment", ordered: 2, received: 2, damaged: 1, rejected: 0, description: "Hydraulic handle is leaking and cannot pass inspection." }],
      // No actual photos were supplied: these are explicit demo placeholders.
      evidence: [{ id: "damage-demo-1", name: "Damage photo 1", demo: true }, { id: "damage-demo-2", name: "Damage photo 2", demo: true }]
    },
    products: [
      { name: "Pallet Jack", code: "WH-4450", category: "Equipment", quantity: 2 },
      { name: "LiftPro additional item (demo)", code: "DEMO-LIFTPRO-02", category: "Equipment", quantity: 22 }
    ]
  }
};
export {
  inboundIssueSeed,
  issueChoices
};
