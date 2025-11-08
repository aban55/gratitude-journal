/* === metricsHelpers.js === */
// Imported by useAnalytics and also reused elsewhere

// Reuse parseDate safely
export function parseDate(src) {
  const d = new Date(src);
  return isNaN(d) ? null : d;
}

// Calculates positivity score (0–100) from journal entries
export function positivityIndex(entries = [], days = 30) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const subset = (entries || []).filter((e) => parseDate(e.iso || e.date)?.getTime() >= cutoff);
  const pos = ["love", "peace", "thank", "calm", "joy", "grateful", "hope", "kind"];
  let hits = 0;
  subset.forEach((e) => {
    const text = (e.entry || "").toLowerCase();
    pos.forEach((p) => text.includes(p) && hits++);
  });
  return Math.min(100, Math.round((hits / Math.max(1, subset.length)) * 25));
}

