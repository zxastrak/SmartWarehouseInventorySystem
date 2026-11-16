// Frontend dashboard data. Empty clean state ready for API connection.
export const stockItems = [];

export const stockHistory = [];

export const metrics = [
  { label: 'Total Items', value: '0', trend: '0%', icon: 'box', tone: 'green' },
  { label: 'In Stock', value: '0', trend: '0%', icon: 'box', tone: 'green' },
  { label: 'Low Stock', value: '0', trend: '0%', icon: 'warning', tone: 'rose' },
  { label: 'Out of Stock', value: '0', trend: '0%', icon: 'close', tone: 'rose' },
];
