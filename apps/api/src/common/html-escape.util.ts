/** Escape text for safe insertion into HTML email templates (text nodes). */
export function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape values used inside HTML attribute quotes (e.g. href). */
export function escapeHtmlAttribute(value: unknown): string {
  return escapeHtmlText(value).replace(/`/g, '&#96;');
}
