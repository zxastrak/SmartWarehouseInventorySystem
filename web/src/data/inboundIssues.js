export const issueChoices = [
  {id: 'quarantine', title: 'Move to quarantine', description: 'Hold in Q-02 for supplier claim', stock: 'Quarantine stock', reference: 'CLM'},
  {id: 'return', title: 'Return to supplier', description: 'Create return shipment', stock: 'Return stock', reference: 'RTN'},
  {id: 'restricted', title: 'Accept with note', description: 'Add to restricted stock', stock: 'Restricted stock', reference: 'RST'},
  {id: 'replacement', title: 'Request replacement', description: 'Supplier sends replacement unit', stock: 'Quarantine stock', reference: 'RPL'},
];

export const inboundIssueSeed = {};
