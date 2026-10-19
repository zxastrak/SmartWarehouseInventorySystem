export const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const key = (value) => cleanText(value).toLowerCase();

export function normaliseType(value) {
  const text = cleanText(value);
  const aliases = {
    electric: 'Electronics', electrical: 'Electronics',
    electronic: 'Electronics', electronics: 'Electronics',
    ppe: 'PPE', equipment: 'Equipment', storage: 'Storage',
    safety: 'Safety', hardware: 'Hardware', accessories: 'Accessories',
  };
  return aliases[key(text)] || text;
}

export function findProduct(text, inventory = []) {
  const value = key(text);
  if (!value) return null;
  const matches = inventory.filter((row) =>
    [row.sku, row.code, row.name, `${row.name} · ${row.sku || row.code}`]
      .some((candidate) => candidate && key(candidate) === value)
  );
  return matches.length === 1 ? matches[0] : null;
}

export function typeOf(row, inventory = []) {
  return normaliseType(
    row?.category || findProduct(row?.sku || row?.code, inventory)?.category
  ) || 'Not recorded';
}

export function matchesText(query, value, allValue = '') {
  return !key(query) || key(query) === key(allValue) || key(value).includes(key(query));
}

export function withProductTypes(value, inventory) {
  const copy = structuredClone(value);
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if ((node.sku || node.code) && node.name && !node.category) {
      const category = typeOf(node, inventory);
      if (category !== 'Not recorded') node.category = category;
    }
    Object.values(node).forEach(visit);
  }
  visit(copy);
  return copy;
}
