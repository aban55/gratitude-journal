import React, { useEffect, useState } from "react";

// Simple live quotes with cache (ZenQuotes)
const CACHE_KEY = "gj_quotes_cache_v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export default function Inspiration({ darkMode }) {
  const [quotes, setQuotes] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let didCancel = false;

    (async function load() {
      // try cache first
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { ts, data } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL_MS && Array.isArray(data) && data.length) {
            setQuotes(data);
          }
        } catch {}
      }

      // fetch live
      try {
        const res = await fetch("https://zenquotes.io/api/quotes");
        if (!res.ok) throw new Error("network");
        const data = await res.json();
        const normalized = (data || [])
          .filter((q) => q.q && q.a)
          .slice(0, 25)
          .map((q) => ({ text: q.q, author: q.a }));
        if (!didCancel && normalized.length) {
          setQuotes(normalized);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: normalized }));
        }
      } catch {
        // if offline, ensure at least a default set
        if (!didCancel && (!quotes || quotes.length === 0)) {
          setQuotes([
            { text: "Gratitude turns what we have into enough.", author: "Aesop" },
            { text: "The more grateful I am, the more beauty I see.", author: "Mary Davis" },
            { text: "Wear gratitude like a cloak, and it will feed every corner of your life.", author: "Rumi" },
          ]);
        }
      }
    })();

    // rotate every 20s
    const t = setInterval(() => setIdx((i) => i + 1), 20000);
    return () => {
      didCancel = true;
      clearInterval(t);
    };
  }, []);

  const cur = quotes.length ? quotes[idx % quotes.length] : null;

  return (
    <div className={`rounded-2xl p-4 border ${darkMode ? "bg-gray-800 border-gray-700" : "bg-white"}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Inspiration</div>
      {cur ? (
        <>
          <div className="text-lg leading-snug">“{cur.text}”</div>
          <div className="text-sm text-gray-500 mt-1">— {cur.author}</div>
          <div className="mt-3 flex gap-2">
            <button
              className="px-2 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => setIdx((i) => (i - 1 + quotes.length) % quotes.length)}
            >
              ◀ Prev
            </button>
            <button
              className="px-2 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => setIdx((i) => i + 1)}
            >
              Next ▶
            </button>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500">Loading quotes…</div>
      )}
    </div>
  );
}
