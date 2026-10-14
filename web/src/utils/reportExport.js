import { xlsx } from "./exportMovements.js";
const ascii = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
const esc = (value) => ascii(value).replace(/([\\()])/g, "\\$1");
export function reportPdf(matrix, title, scope) {
  const cols = matrix[0], width = 752 / cols.length, max = Math.max(8, Math.floor((width - 8) / 5)), wrap = (value) => {
    const lines = [];
    let line = "";
    for (const word of ascii(value).split(" ")) {
      if (line && line.length + word.length + 1 > max) {
        lines.push(line);
        line = "";
      }
      const chunks = word.match(new RegExp(".{1," + max + "}", "g")) || [""];
      while (chunks.length > 1) lines.push(chunks.shift());
      line = line ? line + " " + chunks[0] : chunks[0];
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  };
  const groups = [[]];
  let height = 0;
  for (const row of matrix.slice(1)) {
    const wrapped = row.map(wrap), lineCount = Math.max(...wrapped.map((cell) => cell.length));
    for (let offset = 0; offset < lineCount; offset += 30) {
      const cells = wrapped.map((cell) => cell.slice(offset, offset + 30)), rh = Math.max(22, ...cells.map((cell) => cell.length * 11 + 10));
      if (height + rh > 370 && groups.at(-1).length) {
        groups.push([]);
        height = 0;
      }
      groups.at(-1).push({ cells, rh });
      height += rh;
    }
  }
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"], pages = [];
  groups.forEach((rows, i) => {
    let stream = "";
    const text = (x, y2, value, size = 9, bold = false) => {
      stream += `BT /${bold ? "FB" : "FR"} ${size} Tf 0.10 0.12 0.09 rg ${x} ${y2} Td (${esc(value)}) Tj ET
`;
    };
    text(45, 553, title, 18, true);
    text(45, 532, ascii(scope).slice(0, 160), 8);
    text(45, 516, `Frontend records - ${matrix.length - 1} data rows`, 8);
    cols.forEach((c, j) => wrap(c).forEach((line, k) => text(45 + j * width, 492 - k * 10, line, 8, true)));
    let y = 462;
    for (const { cells, rh } of rows) {
      cells.forEach((lines, j) => lines.forEach((line, k) => text(45 + j * width, y - k * 11, line, 8)));
      y -= rh;
      stream += `0.85 0.89 0.83 RG 0.5 w 45 ${y + 8} m 797 ${y + 8} l S
`;
    }
    text(45, 40, "SUSUNO - Read-only export of frontend demo records", 8);
    text(722, 40, `Page ${i + 1}/${groups.length}`, 8);
    const content = objects.length + 1;
    objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>
stream
${stream}endstream`);
    const page = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /FR 3 0 R /FB 4 0 R >> >> /Contents ${content} 0 R >>`);
    pages.push(page);
  });
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((id) => id + " 0 R").join(" ")}] >>`;
  let pdf = "%PDF-1.4\n", offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${i + 1} 0 obj
${obj}
endobj
`;
  });
  const start = new TextEncoder().encode(pdf).length;
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
` + offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n \n").join("") + `trailer
<< /Root 1 0 R /Size ${objects.length + 1} >>
startxref
${start}
%%EOF`;
  return new TextEncoder().encode(pdf);
}
export function prepareReportExport({ rows, columns, format, title, filename, scope, summary = [] }) {
  if (!rows.length) throw new Error("No records match this export.");
  if (!columns.length) throw new Error("Select at least one data group.");
  const matrix = [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => row[key] ?? "Not provided"))];
  if (summary.length) {
    matrix.push(columns.map(() => ""));
    for (const [key, value] of summary) matrix.push(columns.map((_, i) => i === 0 ? key : i === 1 ? value : ""));
  }
  let bytes, type;
  if (format === "xlsx") {
    bytes = xlsx(matrix, title.slice(0, 31));
    type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (format === "pdf") {
    bytes = reportPdf(matrix, title, scope);
    type = "application/pdf";
  } else {
    const quote = (value) => '"' + (typeof value === "number" ? String(value) : String(value ?? "").replace(/^[=+\-@\t\r]/, "'$&")).replaceAll('"', '""') + '"';
    bytes = "\uFEFF" + matrix.map((row) => row.map(quote).join(",")).join("\r\n");
    type = "text/csv;charset=utf-8";
  }
  return { blob: new Blob([bytes], { type }), filename: `${filename}.${format}`, count: rows.length, format, scope };
}
export function downloadPreparedReport(result) {
  const url = URL.createObjectURL(result.blob), link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
