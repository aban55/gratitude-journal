import React, { useEffect, useMemo, useState } from "react";
import SummaryPanel from "./components/SummaryPanel.jsx";
import MoodSlider from "./components/MoodSlider.jsx";
import Inspiration from "./components/Inspiration.jsx";
// If you already have Google sync, you can keep rendering it in Settings:
// import GoogleSync from "./GoogleSync.jsx";

const DRAFT_KEY = "gj_draft_v1";
const ENTRIES_KEY = "gratitudeEntries_v2";
const THEME_KEY = "gj_theme_v2";

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

function analyzeSentiment(text) {
  const pos = ["grateful", "happy", "joy", "calm", "peace", "love", "thankful", "excited", "proud", "hopeful"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset", "frustrated", "lonely"];
  let s = 0;
  const t = text.toLowerCase();
  pos.forEach((w) => t.includes(w) && s++);
  neg.forEach((w) => t.includes(w) && s--);
  if (s > 2) return "😊 Positive";
  if (s > 0) return "🙂 Calm/Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed/Low";
}

export default function App() {
  const [view, setView] = useState("journal"); // journal | summary | settings
  const [section, setSection] = useState(Object.keys(SECTIONS)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);
  const [lastSaved, setLastSaved] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // load from localStorage
  useEffect(() => {
    const e = localStorage.getItem(ENTRIES_KEY);
    if (e) setEntries(JSON.parse(e));
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const d = JSON.parse(draft);
      if (d.section) setSection(d.section);
      if (d.question) setQuestion(d.question);
      if (d.entry) setEntry(d.entry);
      if (typeof d.mood === "number") setMood(d.mood);
    }
    const theme = localStorage.getItem(THEME_KEY);
    if (theme) {
      setDarkMode(theme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
      localStorage.setItem(THEME_KEY, prefersDark ? "dark" : "light");
    }
  }, []);

  // persist entries
  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  // auto-save draft
  useEffect(() => {
    const payload = { section, question, entry, mood, updatedAt: Date.now() };
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setLastSaved(new Date());
    }, 400);
    return () => clearTimeout(t);
  }, [section, question, entry, mood]);

  // apply theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleSave = () => {
    if (!question || !entry.trim()) return;
    const sentiment = analyzeSentiment(entry);
    const payload = {
      date: new Date().toLocaleDateString(),
      section,
      question,
      entry,
      mood,
      sentiment,
    };
    setEntries((prev) => [...prev, payload]);
    setEntry("");
    setQuestion("");
    setMood(5);
    localStorage.removeItem(DRAFT_KEY);
    setLastSaved(null);
  };

  const avgMood = useMemo(() => {
    if (!entries.length) return 0;
    return Number(
      (entries.reduce((s, e) => s + (e.mood || 0), 0) / entries.length).toFixed(1)
    );
  }, [entries]);

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"}`}>
      <div className={`max-w-3xl mx-auto p-6 ${darkMode ? "bg-gray-800" : "bg-white"} rounded-xl shadow-sm`}>
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">🌿 Daily Gratitude Journal</h1>
          <button
            onClick={() => setDarkMode((d) => !d)}
            className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Save short reflections daily. Track mood & insights weekly.
        </p>

        {/* tabs */}
        <div className="flex gap-2 mb-6">
          {["journal", "summary", "settings"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg ${
                view === v
                  ? "bg-green-600 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-200"
                  : "bg-gray-200"
              }`}
            >
              {v === "journal" ? "Journal" : v === "summary" ? "Summary" : "Settings"}
            </button>
          ))}
        </div>

        {/* views */}
        {view === "journal" && (
          <div className="space-y-4">
            <div>
              <label className="block font-semibold mb-2">Section</label>
              <select
                className={`w-full p-2 border rounded ${darkMode ? "bg-gray-700 border-gray-600" : ""}`}
                value={section}
                onChange={(e) => { setSection(e.target.value); setQuestion(""); }}
              >
                {Object.keys(SECTIONS).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-2">Question / Prompt</label>
              <select
                className={`w-full p-2 border rounded ${darkMode ? "bg-gray-700 border-gray-600" : ""}`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              >
                <option value="">Pick a gratitude question</option>
                {SECTIONS[section].map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            {question === "" && <Inspiration />}

            <div>
              <label className="block font-semibold mb-2">Your Entry</label>
              <textarea
                rows="6"
                className={`w-full p-3 border rounded ${darkMode ? "bg-gray-700 border-gray-600" : ""}`}
                placeholder="Write freely..."
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
              />
              {lastSaved && (
                <p className="text-xs text-gray-500 mt-1">
                  Saved •{" "}
                  {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              )}
            </div>

            <MoodSlider value={mood} onChange={setMood} />

            <div className="flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                Save Entry
              </button>
              <button
                onClick={() => { setEntry(""); setQuestion(""); setMood(5); localStorage.removeItem(DRAFT_KEY); setLastSaved(null); }}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {view === "summary" && (
          <div className="space-y-6">
            <SummaryPanel entries={entries} />
          </div>
        )}

        {view === "settings" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Average mood (all time): <strong>{avgMood || "—"}</strong>
            </p>

            {/* Optional Drive sync area */}
            {/* <GoogleSync dataToSync={{ savedEntries: entries }} /> */}

            {/* Export / Import (local file) */}
            <div className="rounded-lg border dark:border-gray-700 p-4">
              <p className="font-medium mb-2">Local backup</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const text = JSON.stringify({ entries }, null, 2);
                    const blob = new Blob([text], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "gratitude_backup.json";
                    a.click();
                  }}
                  className="px-3 py-2 rounded bg-green-600 text-white"
                >
                  Export (.json)
                </button>
                <label className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 cursor-pointer">
                  Import (.json)
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      try {
                        const data = JSON.parse(text);
                        if (Array.isArray(data.entries)) setEntries(data.entries);
                        alert("Imported successfully.");
                      } catch {
                        alert("Invalid file.");
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Clear all */}
            <button
              onClick={() => {
                if (window.confirm("Delete ALL entries? This cannot be undone.")) {
                  setEntries([]);
                  localStorage.removeItem(ENTRIES_KEY);
                }
              }}
              className="px-3 py-2 rounded bg-red-600 text-white"
            >
              Delete all entries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
