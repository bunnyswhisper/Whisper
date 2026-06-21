/**
 * Sanitize a CSV cell against formula injection and escape quotes/newlines.
 */
export function sanitizeCsvCell(value: unknown): string {
  let cell = String(value ?? '');
  if (/^[\t\r\n]/.test(cell) || /^\s*[=+\-@]/.test(cell)) {
    cell = `'${cell}`;
  }
  return cell;
}

export function formatCsvCell(value: unknown): string {
  const cell = sanitizeCsvCell(value);
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function csvLine(cells: (string | number)[]): string {
  return cells.map(formatCsvCell).join(',');
}
