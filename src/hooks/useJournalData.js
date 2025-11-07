import { useState, useEffect, useMemo } from "react";

/* =========================
   useJournalData Hook
========================= */
export default function useJournalData() {
  const STORAGE_KEY = "gratitudeEntries";
  const LONGEST_STREAK_KEY = "gj_longest_streak";
  const ENG_DAYS_KEY = "gj_days_with_entry";

  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: Number(localStorage.getItem(LONGEST_STREAK_KEY) || 0),
    entriesThisWeek: 0,
    entriesThisMonth: 0,
    avgMood7d: 0,
  });

  /* ====== Helpers ====== */
  const parseDate = (src) => {
    const d = new Date(src);
    return isNaN(d) ? null : d;
  };
  const toDateKey = (d) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      .toISOString()
      .slice(0, 10);

  const buildEntryDaySet = (list) => {
    const set = new Set();
    list.forEach((e) => {
      const k = toDateKey(parseDate(e.iso || e.date));
      if (k) set.add(k);
    });
    return set;
  };

  const computeEngagement = (list) => {
    const daySet = buildEntryDaySet(list);
    const dayKeys = Array.from(daySet).sort();
    const today = new Date();

    // current streak
    let cur = 0;
    let cursor = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      cur += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    // longest streak
    let longest = 0,
      run = 1;
    for (let i = 1; i < dayKeys.length; i++) {
      const prev = new Date(dayKeys[i - 1]);
      const curr = new Date(dayKeys[i]);
      if ((curr - prev) / 86400000 === 1) run++;
      else {
        longest = Math.max(longest, run);
        run = 1;
      }
    }
    longest = Math.max(longest, run);

    // week & month stats
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);

    let entriesThisWeek = 0,
      entriesThisMonth = 0,
      moodSum = 0,
      moodCount = 0;

    list.forEach((e) => {
      const d = parseDate(e.iso || e.date);
      if (!d) return;
      if (d >= startOfWeek) entriesThisWeek++;
      if (d >= startOfMonth) entriesThisMonth++;
      if (d >= sevenDaysAgo && typeof e.mood === "number") {
        moodSum += e.mood;
        moodCount++;
      }
    });

    return {
      currentStreak: cur,
      longestStreak: Math.max(
        longest,
        Number(localStorage.getItem(LONGEST_STREAK_KEY) || 0)
      ),
      entriesThisWeek,
      entriesThisMonth,
      avgMood7d: moodCount ? moodSum / moodCount : 0,
    };
  };

  /* ===== Load + Persist ===== */
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      try {
        setEntries(JSON.parse(s));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    const newStats = computeEngagement(entries);
    localStorage.setItem(LONGEST_STREAK_KEY, String(newStats.longestStreak));
    localStorage.setItem(ENG_DAYS_KEY, JSON.stringify(Array.from(buildEntryDaySet(entries))));
    setStats(newStats);
  }, [entries]);

  /* ===== Mutators ===== */
  const addEntry = (entry) => setEntries((prev) => [...prev, entry]);
  const updateEntry = (id, updates) =>
    setEntries((arr) => arr.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  const deleteEntry = (id) =>
    setEntries((arr) => arr.filter((e) => e.id !== id));

  return { entries, setEntries, addEntry, updateEntry, deleteEntry, stats };
}

