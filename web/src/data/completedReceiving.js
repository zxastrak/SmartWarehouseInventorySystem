export const completedReceivingSeed = {
  'INB-2046': {
    receivingCompleted: true,
    poStatus: 'Closed',
    receipt: {
      completedAt: '2026-09-15T08:42:00+07:00',
      user: 'Naura',
      notes: 'All items received in good condition.\nPackaging and quantities verified.',
      evidence: [],
      summary: {ordered: 86, received: 86, accepted: 86, damaged: 0, rejected: 0, short: 0},
      stockChanges: [
        {sku: 'WH-1209', name: 'LED Work Light', received: 40, accepted: 40, damaged: 0, rejected: 0, short: 0, before: 35, after: 75, allocations: [{rack: 'C-07', quantity: 40}]},
        {sku: 'WH-6108', name: 'Extension Cord', received: 30, accepted: 30, damaged: 0, rejected: 0, short: 0, before: 76, after: 106, allocations: [{rack: 'C-02', quantity: 30}]},
        {sku: 'DEMO-BATTERY-01', name: 'Work Lamp Battery', received: 16, accepted: 16, damaged: 0, rejected: 0, short: 0, before: 24, after: 40, allocations: [{rack: 'C-09', quantity: 16}]},
      ],
    },
  },
};
