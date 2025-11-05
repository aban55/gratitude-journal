import React, { useEffect, useMemo, useState } from "react";
import GoogleSync from "./GoogleSync.jsx";

/* ----------------------- Helpers ----------------------- */
function analyzeSentiment(text) {
  const positive = [
    "grateful","happy","joy","calm","peace","love","thankful","excited","proud","hopeful"
  ];
  const negative = [
    "tired","sad","angry","stressed","worried","upset","frustrated","lonely"
  ];
  let score = 0;
  const t = text.toLowerCase();
  positive.forEach((w) => t.includes(w) && (score += 1));
  negative.forEach((w) => t.includes(w) && (score -= 1));
  if (score > 2) return "😊 Positive";
  if (score > 0) return "🙂 Calm/Content";
  if (score === 0) return "😐 Neutral";
  return "😟 Stressed/Low";
}

const SECTIONS = {
  "People & Relationships": [
    "Who made my life easier or better today?",
    "Which friend or family member am I grateful for — and why?",
    "What small act of kindness did someone show me recently?",
    "What’s a quality in someone close to me that I admire?",
    "Who did I help or encourage today — and how did that feel?",
  ],
  "Self & Inner Strength": [
    "What ability or personal quality am I thankful for today?",
    "What challenge have I handled better than before?",
    "What is one thing about my body or health I appreciate?",
    "What habit or discipline am I proud of keeping?",
    "What lesson did a past mistake teach me that helps me now?",
  ],
  "Learning & Growth": [
    "What new idea or skill did I learn recently?",
    "What feedback or advice am I grateful for?",
    "What am I curious or excited to explore next?",
    "What problem am I grateful to have — because it’s teaching me something?",
    "What book, conversation, or experience gave me insight recently?",
  ],
  "Environment & Everyday Comforts": [
    "What part of my home brings me peace or comfort?",
    "What small thing in nature caught my attention today —  light, wind, birds, sky, trees?",
    "What simple pleasure did I enjoy — food, music, warmth, quiet?",
    "What modern convenience or tool makes life smoother?",
    "What moment today felt safe, calm, or peaceful?",
  ],
  "Perspective & Hope": [
    "What opportunity am I grateful to have that others may not?",
    "What am I looking forward to in the coming week?",
    "Who or what reminds me that life is bigger than my worries?",
    "How has a tough time in my life shaped who I am today?",
    "What am I thankful for that I usually take for granted?",
  ],
  "Health & Wellbeing": [
    "What part of my body served me well today?",
    "What healthy choice did I make today?",
    "How does my body show gratitude when I care for it?",
    "What signs of recovery or strength am I noticing lately?",
    "Who supports my physical or emotional health — and how can I appreciate them?",
  ],
};

const LS_ENTRIES = "gj_entries_v1";
const LS_AFFIRMS = "gj_affirms_v1";
const LS_THEME = "gj_theme_v1";

/* ----------------------- App ----------------------- */
export default function App() {
  // compose state
  const [view, setView] = useState("journal"); // journal | summary | settings
  const [darkMode, setDarkMode] = useState(false);

  const [section, setSection] = useState("People & Relationships");
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);

  const [savedEntries, setSavedEntries] = useState([]);
  const [savedAffirmations, setSavedAffirmations] = useState([]);

  const [editingIndex, setEditingIndex] = useState(null);
  const [deletedEntry, setDeletedEntry] = useState(null);
  const [showUndo, setShowUndo] = useState(false);

  // filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [moodFilter, setMoodFilter] = useState(0);

  /* ----- load/persist theme ----- */
  useEffect(() => {
    const stored = localStorage.getItem(LS_THEME);
    if (stored) {
      setDarkMode(stored === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
      localStorage.setItem(LS_THEME, prefersDark ? "dark" : "light");
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem(LS_THEME, darkMode ? "dark" : "light");
  }, [darkMode]);

  /* ----- load/persist data ----- */
  useEffect(() => {
    const e = localStorage.getItem(LS_ENTRIES);
    if (e) setSavedEntries(JSON.parse(e));
    const a = localStorage.getItem(LS_AFFIRMS);
    if (a) setSavedAffirmations(JSON.parse(a));
  }, []);
  useEffect(() => {
    localStorage.setItem(LS_ENTRIES, JSON.stringify(savedEntries));
    localStorage.setItem(LS_AFFIRMS, JSON.stringify(savedAffirmations));
  }, [savedEntries, savedAffirmations]);

  /* ----- actions ----- */
  const handleSave = () => {
    if (!question || !entry.trim()) return;
    const newEntry = {
      date: new Date().toLocaleDateString(),
      section,
      question,
      entry,
      mood,
      sentiment: analyzeSentiment(entry),
    };
    if (editingIndex !== null) {
      const copy = [...savedEntries];
      copy[editingIndex] = newEntry;
      setSavedEntries(copy);
      setEditingIndex(null);
    } else {
      setSavedEntries((s) => [...s, newEntry]);
    }
    setEntry("");
    setQuestion("");
    setMood(5);
  };

  const handleEdit = (i) => {
    const e = savedEntries[i];
    setSection(e.section);
    setQuestion(e.question);
    setEntry(e.entry);
    setMood(e.mood);
    setEditingIndex(i);
    setView("journal");
  };

  const handleDelete = (i) => {
    const e = savedEntries[i];
    setSavedEntries(savedEntries.filter((_, idx) => idx !== i));
    setDeletedEntry({ entry: e, index: i });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };
  const undoDelete = () => {
    if (!deletedEntry) return;
    const copy = [...savedEntries];
    copy.splice(deletedEntry.index, 0, deletedEntry.entry);
    setSavedEntries(copy);
    setDeletedEntry(null);
    setShowUndo(false);
  };

  const handleExportLocal = () => {
    const data = { savedEntries, savedAffirmations };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gratitude-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const handleImportLocal = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setSavedEntries(Array.isArray(data.savedEntries) ? data.savedEntries : []);
      setSavedAffirmations(
        Array.isArray(data.savedAffirmations) ? data.savedAffirmations : []
      );
      alert("✅ Imported local backup.");
    } catch {
      alert("❌ Invalid backup file.");
    }
  };

  /* ----- filters ----- */
  const filteredEntries = useMemo(() => {
    return savedEntries.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesQ =
        e.entry.toLowerCase().includes(q) ||
        e.question.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q);
      const matchesDate = !filterDate || e.date === filterDate;
      const matchesMood = e.mood >= moodFilter;
      return matchesQ && matchesDate && matchesMood;
    });
  }, [savedEntries, searchQuery, filterDate, moodFilter]);

  const avgMood = useMemo(() => {
    if (!savedEntries.length) return "-";
    return (savedEntries.reduce((a, e) => a + e.mood, 0) / savedEntries.length).toFixed(1);
  }, [savedEntries]);

  /* ----------------------- UI ----------------------- */
  return (
    <div
      className={`min-h-screen p-6 transition-colors ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* theme toggle */}
      <button
        onClick={() => setDarkMode((d) => !d)}
        className="fixed top-4 right-4 rounded-full px-3 py-2 bg-green-600 text-white shadow hover:bg-green-700"
        title="Toggle dark mode"
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <div
        className={`max-w-3xl mx-auto p-6 rounded-2xl shadow ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <h1 className={`text-2xl font-bold mb-4 ${darkMode ? "text-green-400" : "text-green-700"}`}>
          🌿 Daily Gratitude Journal
        </h1>

        {/* nav */}
        <div className="flex gap-2 mb-6">
          {[
            ["journal", "Journal"],
            ["summary", "Summary"],
            ["settings", "Settings"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-2 rounded-lg ${
                view === key
                  ? "bg-green-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-200"
                  : "bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---------------- JOURNAL ---------------- */}
        {view === "journal" && (
          <>
            <label className="block mb-2 font-semibold">Section</label>
            <select
              className={`w-full p-2 border rounded mb-4 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={section}
              onChange={(e) => {
                setSection(e.target.value);
                setQuestion("");
              }}
            >
              {Object.keys(SECTIONS).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <label className="block mb-2 font-semibold">Question / Prompt</label>
            <select
              className={`w-full p-2 border rounded mb-4 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            >
              <option value="">— pick a prompt —</option>
              {SECTIONS[section].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>

            {question && (
              <>
                <label className="block mb-2 font-semibold">Your Entry</label>
                <textarea
                  rows="5"
                  className={`w-full p-2 border rounded mb-3 ${
                    darkMode ? "bg-gray-700 border-gray-600" : ""
                  }`}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Write freely..."
                />

                <label className="block mb-2 font-semibold">Mood (1–10)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={mood}
                  onChange={(e) => setMood(Number(e.target.value))}
                  className="w-full mb-4"
                />

                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                  >
                    {editingIndex !== null ? "Update Entry" : "Save Entry"}
                  </button>
                  <button
                    onClick={() => {
                      setEntry("");
                      setQuestion("");
                      setMood(5);
                      setEditingIndex(null);
                    }}
                    className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}

            {/* filters */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="🔍 search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`px-3 py-2 rounded border ${
                  darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                }`}
              />
              <input
                type="date"
                value={filterDate ? new Date(filterDate).toISOString().slice(0, 10) : ""}
                onChange={(e) =>
                  setFilterDate(e.target.value ? new Date(e.target.value).toLocaleDateString() : "")
                }
                className={`px-3 py-2 rounded border ${
                  darkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                }`}
              />
              <div className="flex items-center gap-2 col-span-1 md:col-span-2">
                <span className="text-sm opacity-80">Mood ≥ {moodFilter}</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={moodFilter}
                  onChange={(e) => setMoodFilter(Number(e.target.value))}
                  className="w-full"
                />
                {(searchQuery || filterDate || moodFilter > 0) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterDate("");
                      setMoodFilter(0);
                    }}
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* entries */}
            <div className="mt-4 space-y-3">
              {filteredEntries.length === 0 ? (
                <p className="text-gray-500">No entries match your filters.</p>
              ) : (
                filteredEntries
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div
                      key={`${e.date}-${i}`}
                      className={`border rounded-lg p-3 shadow-sm ${
                        darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50"
                      }`}
                    >
                      <div className="text-sm text-gray-500">
                        {e.date} • <span className="font-medium">{e.section}</span>
                      </div>
                      <div className="text-sm italic">{e.question}</div>
                      <div className="mt-2 whitespace-pre-wrap">{e.entry}</div>
                      <div className="text-xs mt-1 opacity-80">
                        Mood: {e.mood} | Sentiment: {e.sentiment}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEdit(savedEntries.indexOf(e))}
                          className="px-3 py-1 rounded bg-white/20 border hover:bg-white/30"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(savedEntries.indexOf(e))}
                          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Undo toast */}
            {showUndo && (
              <div
                className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg ${
                  darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
                }`}
              >
                <span>Entry deleted.</span>
                <button onClick={undoDelete} className="ml-2 text-green-600 underline">
                  Undo
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------------- SUMMARY ---------------- */}
        {view === "summary" && (
          <div>
            <h2 className="text-xl font-semibold mb-2">📊 Summary</h2>
            <p className="mb-3">
              Average Mood: <strong>{avgMood}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Entries saved: <strong>{savedEntries.length}</strong>
            </p>
          </div>
        )}

        {/* ---------------- SETTINGS ---------------- */}
        {view === "settings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">☁️ Google Drive Sync</h2>
              <GoogleSync
                dataToSync={{ savedEntries, savedAffirmations }}
                onRestore={(data) => {
                  setSavedEntries(Array.isArray(data.savedEntries) ? data.savedEntries : []);
                  setSavedAffirmations(
                    Array.isArray(data.savedAffirmations) ? data.savedAffirmations : []
                  );
                }}
                darkMode={darkMode}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">🧱 Local Backup</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportLocal}
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                >
                  📤 Export (.json)
                </button>
                <label className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer">
                  📥 Import (.json)
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && handleImportLocal(e.target.files[0])}
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Local backup works offline and doesn’t require Google Drive.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
