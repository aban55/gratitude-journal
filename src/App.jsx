import React, { useEffect, useMemo, useRef, useState } from "react";
import GoogleSync from "./GoogleSync";
import InstallPrompt from "./InstallPrompt";

// storage keys
const ENTRIES_KEY = "gj_entries_v1";
const DRAFT_KEY   = "gj_draft_v1";
const THEME_KEY   = "gj_theme_v1";

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
    "What small thing in nature caught my attention today — light, wind, birds, sky, trees?",
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

const sentiments = { pos: "🙂 Positive", neu: "😐 Neutral", neg: "😟 Low" };

export default function App() {
  // UI state
  const [tab, setTab] = useState("journal"); // journal | summary | settings
  const [darkMode, setDarkMode] = useState(false);

  // compose state
  const [section, setSection] = useState(Object.keys(SECTIONS)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);

  // data
  const [entries, setEntries] = useState([]);
  const [autoUploadTick, setAutoUploadTick] = useState(0);

  // edit state
  const [editingId, setEditingId] = useState(null);
  const lastDeletedRef = useRef(null);

  // theme init
  useEffect(() => {
    const t = localStorage.getItem(THEME_KEY);
    if (t) setDarkMode(t === "dark");
    else {
      const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefers);
      localStorage.setItem(THEME_KEY, prefers ? "dark" : "light");
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  // load & persist entries
  useEffect(() => {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (raw) setEntries(JSON.parse(raw));
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const d = JSON.parse(draft);
      setSection(d.section ?? section);
      setQuestion(d.question ?? "");
      setEntry(d.entry ?? "");
      setMood(typeof d.mood === "number" ? d.mood : 5);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);
  // autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ section, question, entry, mood, updatedAt: Date.now() })
      );
    }, 300);
    return () => clearTimeout(t);
  }, [section, question, entry, mood]);

  function analyzeSentiment(text) {
    const p = ["grateful", "happy", "love", "peace", "calm", "joy"];
    const n = ["tired", "sad", "angry", "stress", "worried", "anxious"];
    let score = 0;
    p.forEach((w) => (text.toLowerCase().includes(w) ? (score += 1) : 0));
    n.forEach((w) => (text.toLowerCase().includes(w) ? (score -= 1) : 0));
    if (score > 0) return sentiments.pos;
    if (score < 0) return sentiments.neg;
    return sentiments.neu;
  }

  function clearEditor() {
    setQuestion("");
    setEntry("");
    setMood(5);
    setEditingId(null);
    localStorage.removeItem(DRAFT_KEY);
  }

  function saveEntry() {
    if (!question || !entry.trim()) return;
    const now = new Date();
    const payload = {
      id: editingId ?? crypto.randomUUID(),
      date: now.toLocaleDateString(),
      iso: now.toISOString(),
      section,
      question,
      entry,
      mood,
      sentiment: analyzeSentiment(entry),
    };
    setEntries((prev) => {
      let next = [...prev];
      if (editingId) next = next.map((e) => (e.id === editingId ? payload : e));
      else next.push(payload);
      return next;
    });
    clearEditor();

    // 🔁 trigger auto upload if signed-in
    setAutoUploadTick((t) => t + 1);
  }

  function deleteEntry(id) {
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) lastDeletedRef.current = target;
      return prev.filter((e) => e.id !== id);
    });
  }
  function undoDelete() {
    const item = lastDeletedRef.current;
    if (!item) return;
    setEntries((p) => [...p, item]);
    lastDeletedRef.current = null;
  }
  function beginEdit(e) {
    setEditingId(e.id);
    setSection(e.section);
    setQuestion(e.question);
    setEntry(e.entry);
    setMood(e.mood);
    setTab("journal");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Summary metrics
  const summary = useMemo(() => {
    if (!entries.length) return null;
    const last7 = [...entries].slice(-7);
    const avg = (last7.reduce((a, e) => a + e.mood, 0) / last7.length).toFixed(1);
    const bySent = last7.reduce((acc, e) => {
      acc[e.sentiment] = (acc[e.sentiment] || 0) + 1;
      return acc;
    }, {});
    return { avgMood: avg, count: entries.length, bySent };
  }, [entries]);

  const darkBox = darkMode ? "bg-gray-800 text-gray-100" : "bg-white";
  const inputStyle = darkMode ? "bg-gray-700 border-gray-600" : "";

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
      <div className={`max-w-3xl mx-auto p-6 ${darkMode ? "" : ""}`}>
        {/* header */}
        <div className={`${darkBox} rounded-2xl p-5 shadow mb-4`}>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-green-600">🌿 Daily Gratitude Journal</h1>
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="px-3 py-1 rounded bg-green-600 text-white"
              title="Toggle theme"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            {["journal", "summary", "settings"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg ${
                  tab === t ? "bg-green-600 text-white" : darkMode ? "bg-gray-700" : "bg-gray-200"
                }`}
              >
                {t === "journal" ? "Journal" : t === "summary" ? "Summary" : "Settings"}
              </button>
            ))}
          </div>
        </div>

        {/* Journal */}
        {tab === "journal" && (
          <div className={`${darkBox} rounded-2xl p-5 shadow`}>
            <label className="font-medium">Section</label>
            <select
              className={`w-full p-2 border rounded mb-3 ${inputStyle}`}
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

            <label className="font-medium">Question / Prompt</label>
            <select
              className={`w-full p-2 border rounded mb-3 ${inputStyle}`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            >
              <option value="">Pick a gratitude question</option>
              {SECTIONS[section].map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>

            <label className="font-medium">Your Entry</label>
            <textarea
              rows={5}
              className={`w-full p-2 border rounded mb-3 ${inputStyle}`}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Write freely…"
            />

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="font-medium">Mood (1–10)</label>
                <span className="text-sm">{mood}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={saveEntry} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                {editingId ? "Update Entry" : "Save Entry"}
              </button>
              <button onClick={clearEditor} className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400">
                Clear
              </button>
            </div>

            {/* list */}
            {entries.length > 0 && (
              <div className="mt-6 space-y-3">
                {[...entries].reverse().map((e) => (
                  <div key={e.id} className={`p-3 border rounded ${darkMode ? "border-gray-700 bg-gray-800" : "bg-gray-50"}`}>
                    <div className="text-sm text-gray-500">{e.date} • {e.section}</div>
                    <div className="italic text-sm">{e.question}</div>
                    <div className="mt-1">{e.entry}</div>
                    <div className="text-xs mt-1 text-green-700">
                      Mood: {e.mood} | Sentiment: {e.sentiment}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => beginEdit(e)} className="px-3 py-1 rounded bg-amber-500 text-white">Edit</button>
                      <button onClick={() => deleteEntry(e.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
                    </div>
                  </div>
                ))}
                {lastDeletedRef.current && (
                  <button onClick={undoDelete} className="text-sm underline text-blue-600">Undo last delete</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        {tab === "summary" && (
          <div className={`${darkBox} rounded-2xl p-5 shadow`}>
            <h2 className="text-xl font-semibold mb-2">📊 Summary</h2>
            {!summary ? (
              <p className="text-gray-500">No entries yet.</p>
            ) : (
              <>
                <p className="mb-2">Average Mood (last 7): <b>{summary.avgMood}</b></p>
                <p className="mb-2">Entries saved: <b>{summary.count}</b></p>
                <ul className="list-disc list-inside">
                  {Object.entries(summary.bySent).map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Settings */}
        {tab === "settings" && (
          <div className={`${darkBox} rounded-2xl p-5 shadow`}>
            <h2 className="text-xl font-semibold mb-2">⚙️ Settings</h2>

            {/* Export / Import – purely local */}
            <div className="mb-4">
              <p className="font-medium mb-2">Local Export / Import</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  onClick={() => {
                    const text = JSON.stringify(entries, null, 2);
                    const blob = new Blob([text], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "gratitude_entries.json";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  Export JSON
                </button>
                <label className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const parsed = JSON.parse(reader.result);
                          if (Array.isArray(parsed)) setEntries(parsed);
                        } catch {}
                      };
                      reader.readAsText(f);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Drive Sync Component */}
            <GoogleSync
              dataToSync={{ entries }}
              onRestore={(data) => Array.isArray(data.entries) && setEntries(data.entries)}
              autoUploadTrigger={autoUploadTick}
              darkMode={darkMode}
            />
          </div>
        )}
      </div>

      {/* Floating install button + iOS hint */}
      <InstallPrompt darkMode={darkMode} />
    </div>
  );
}
