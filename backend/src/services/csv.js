// Minimal RFC-4180 CSV writer. Descriptions come from free-text WhatsApp
// messages, so quoting is not optional — a "Guzman, y Gomez" would otherwise
// split into two columns.
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  // CRLF line endings and a UTF-8 BOM: without the BOM, Excel misreads
  // non-ASCII characters in descriptions as mojibake.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function sendCsv(res, filename, headers, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(headers, rows));
}

module.exports = { toCsv, sendCsv };
