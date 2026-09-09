// Small, pure helper functions. No state, no DOM — just utilities
// that any screen file can import and reuse.

export const DAY_MS = 86400000;

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function fmtDur(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date(today())) / DAY_MS);
}

// Returns an array of the last N dates (including today), oldest first.
// e.g. last7Dates() -> ["2026-09-02", "2026-09-03", ..., "2026-09-08"]
export function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Escapes single/double quotes so text can be safely inserted into
// HTML attribute values (e.g. inside onclick="...").
export function esc(str) {
  return (str || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
