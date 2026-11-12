export const insightUsageAssumptions = {};
const kinds = {};
export function buildInventoryInsights(items = []) {
  const products = (items || []).map(item => {
    const dailyUsage = insightUsageAssumptions[item.sku] || null;
    const daysLeft = dailyUsage ? Math.ceil(item.current / dailyUsage) : (item.current === 0 ? 0 : null);
    const kind = kinds[item.sku] || (item.current <= 0 ? 'restock' : item.current < item.reorder ? 'restock' : 'reorder');
    return {
      ...item,
      dailyUsage,
      daysLeft,
      gap: Math.max(0, item.reorder - item.current),
      kind,
    };
  });
  const atRisk = products.filter(item => item.current < item.reorder || (item.daysLeft !== null && item.daysLeft <= 14))
    .sort((a, b) => a.current - b.current || a.name.localeCompare(b.name));
  const modeled = products.filter(item => item.dailyUsage);
  const forecast = Array.from({ length: 15 }, (_, day) => {
    const stockouts = modeled.filter(item => item.current - item.dailyUsage * day <= 0).length;
    return { day, stockouts, percent: modeled.length ? (stockouts / modeled.length) * 100 : 0 };
  });
  return {
    atRisk,
    modeled,
    forecast,
    critical: atRisk.filter(item => item.current === 0 || (item.daysLeft !== null && item.daysLeft <= 4)).length,
    actions: atRisk.length,
  };
}
export const insightActionLabels = { restock: 'Review restock', location: 'Review location', reorder: 'Review reorder' };
