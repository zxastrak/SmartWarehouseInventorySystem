import { typeOf } from "./productTypes.js";
function download(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
const escapeXml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
function crc32(bytes) {
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 3988292384 : 0);
  }
  return (crc ^ 4294967295) >>> 0;
}
function zip(files) {
  const encoder = new TextEncoder(), chunks = [], central = [];
  let offset = 0;
  const header = (size) => {
    const bytes = new Uint8Array(size);
    return [bytes, new DataView(bytes.buffer)];
  };
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
    const [local, l] = header(30);
    l.setUint32(0, 67324752, true);
    l.setUint16(4, 20, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, data.length, true);
    l.setUint16(26, nameBytes.length, true);
    chunks.push(local, nameBytes, data);
    const [record, c] = header(46);
    c.setUint32(0, 33639248, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    central.push(record, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0);
  const [end, e] = header(22);
  e.setUint32(0, 101010256, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const result = new Uint8Array(all.reduce((sum, b) => sum + b.length, 0));
  let cursor = 0;
  for (const b of all) {
    result.set(b, cursor);
    cursor += b.length;
  }
  return result;
}
function xlsx(rows, sheetName = "Stock Movements") {
  const sheet = rows.map((row, index) => `<row r="${index + 1}">${row.map((value) => typeof value === "number" ? `<c><v>${value}</v></c>` : `<c t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("");
  return zip([
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`]
  ]);
}
function exportMovements(rows, columns, format) {
  const typedColumns = columns.some(([key]) => key === "category") ? columns : [["category", "Product Type"], ...columns];
  const exportColumns = typedColumns.some(([key]) => key === "sku") ? typedColumns : [["sku", "SKU"], ...typedColumns];
  const matrix = [exportColumns.map(([, label]) => label), ...rows.map((row) => exportColumns.map(([key]) => key === "category" ? typeOf(row) : key === "rack" ? `${row.warehouse} / ${row.rack}` : row[key]))];
  if (format === "csv") {
    const safe = (value) => {
      let text = String(value ?? "");
      if (typeof value !== "number" && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    download("\uFEFF" + matrix.map((row) => row.map(safe).join(",")).join("\r\n"), "susuno-stock-movements.csv", "text/csv;charset=utf-8");
  } else if (format === "xlsx") download(xlsx(matrix), "susuno-stock-movements.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  else {
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Allow the print window to open, then try again.");
    popup.document.write(`<html><head><title>SUSUNO Stock Movements</title><style>body{font:12px Arial;padding:20px;color:#191d17}table{width:100%;border-collapse:collapse}td,th{padding:8px;border:1px solid #ddd;text-align:left}h1{color:#5c732b}@page{size:A4 landscape}</style></head><body><h1>Stock Movement Report</h1><p>Frontend demo data \xB7 ${rows.length} records</p><table>${matrix.map((row, index) => `<tr>${row.map((value) => `<${index ? "td" : "th"}>${escapeXml(value)}</${index ? "td" : "th"}>`).join("")}</tr>`).join("")}</table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }
}
export {
  exportMovements,
  xlsx
};
