import GoogleSync from "./GoogleSync";
import React, { useState, useEffect } from "react";

const DRAFT_KEY = "gj_draft_v1";
const ENTRIES_KEY = "gratitudeEntries";
const AFFIRM_KEY = "savedAffirmations";
const THEME_KEY = "gj_theme";

// 🔹 Sections (6) + curated prompts
const SECTIONS = [
  "People & Relationships",
  "Personal Growth",
  "Work & Learning",
  "Health & Mindfulness",
  "Simple Joys & Daily Life",
  "Challenges & Resilience",
];

const PROMPTS = {
  "People & Relationships": [
    "Who made your day easier today?",
    "What small kindness did you receive recently?",
    "Which relationship are you grateful for and why?",
    "Who did you learn something from this week?",
    "What conversation left you feeling lighter?"
  ],
  "Personal Growth": [
    "What did you handle better today than last time?",
    "Which habit are you proud of keeping?",
    "What skill are you slowly improving?",
    "What felt uncomfortable but helped you grow?",
    "What did you learn about yourself?"
  ],
  "Work & Learning": [
    "What problem did you solve (or move forward) today?",
    "What did you learn that excited you?",
    "Who supported your work or studies?",
    "What progress (however small) did you make?",
    "What tool/process saved you time?"
  ],
  "Health & Mindfulness": [
    "What did your body do for you today?",
    "When did you breathe and feel present?",
    "What nourished you (food, water, rest)?",
    "What movement felt good?",
    "What helped you calm your mind?"
  ],
  "Simple Joys & Daily Life": [
    "What tiny moment brought a smile?",
    "What did you enjoy with your senses (sight/sound/smell/taste/touch)?",
    "What place felt cozy or safe?",
    "What routine made life smoother?",
    "What unexpected pleasant surprise happened?"
  ],
  "Challenges & Resilience": [
    "What challenge taught you something today?",
    "How did you show resilience?",
    "What setback are you grateful for in hindsight?",
    "Who/what helped you through difficulty?",
    "What perspective helped you accept what you can’t control?"
  ],
};

export default function App() {
  const [section, setSection] = useState(SECTIONS[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [savedEntries, setSavedEntries] = useState([]);
  const [savedAffirmations, setSavedAffirmations] = useState([]);
  const [mood, setMood] = useState(5);
  const [view, setView] = useState("journal");
  const [lastSaved, setLastSaved] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // ---- load from localStorage on mount ----
  useEffect(() => {
    const stored = localStorage.getItem(ENTRIES_KEY);
    if (stored) setSavedEntries(JSON.parse(stored));

    const storedAffirmations = localStorage.getItem(AFFIRM_KEY);
    if (storedAffirmations) setSavedAffirmations(JSON.parse(storedAffirmations));

    const draftRaw = localStorage.getItem(DRAFT_KEY);
    if (draftRaw) {
      const d = JSON.parse(draftRaw);
      if (d.section) setSection(d.section);
      if (d.question) setQuestion(d.question);
      if (typeof d.mood === "number") setMood(d.mood);
      if (d.entry) setEntry(d.entry);
      if (d.updatedAt) setLastSaved(new Date(d.updatedAt));
    }

    // 🌙 Auto-detect theme on first visit
    const storedTheme = localStorage.getItem(THEME_KEY);
    if (storedTheme) {
      setDarkMode(storedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
      localStorage.setItem(THEME_KEY, prefersDark ? "dark" : "light");
    }
  }, []);

  // ---- persist entries + affirmations ----
  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(savedEntries));
    localStorage.setItem(AFFIRM_KEY, JSON.stringify(savedAffirmations));
  }, [savedEntries, savedAffirmations]);

  // ---- auto-save draft ----
  useEffect(() => {
    const payload = { section, question, entry, mood, updatedAt: Date.now() };
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setLastSaved(new Date());
    }, 400);
    return () => clearTimeout(t);
  }, [section, question, entry, mood]);

  // ---- apply dark/light theme ----
  useEffect(() => {
    localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // ---- simple sentiment detector ----
  const analyzeSentiment = (text) => {
    const positive = ["good", "grateful", "happy", "love", "peace"];
    const negative = ["bad", "sad", "angry", "hate", "stress"];
    let score = 0;
    positive.forEach((w) => text.toLowerCase().includes(w) && score++);
    negative.forEach((w) => text.toLowerCase().includes(w) && score--);
    return score >= 0 ? "Positive" : "Negative";
  };

  // ---- save entry ----
  const handleSave = () => {
    if (question && entry.trim()) {
      const sentiment = analyzeSentiment(entry);
      setSavedEntries([
        ...savedEntries,
        { date: new Date().toLocaleDateString(), section, question, entry, mood, sentiment },
      ]);
      setEntry("");
      setQuestion("");
      setMood(5);
      localStorage.removeItem(DRAFT_KEY);
      setLastSaved(null);
    }
  };

  // ---- clear draft ----
  const handleClearDraft = () => {
    if (window.confirm("Clear this draft? This cannot be undone.")) {
      setEntry("");
      setQuestion("");
      setMood(5);
      localStorage.removeItem(DRAFT_KEY);
      setLastSaved(null);
    }
  };

  // ---- when section changes, keep current typed question OR let user pick new one
  const handleSectionChange = (e) => {
    const next = e.target.value;
    setSection(next);
    // If no manual question yet, auto-fill the first prompt for convenience
    if (!question.trim() && PROMPTS[next]?.length) {
      setQuestion(PROMPTS[next][0]);
    }
  };

  // ---- UI ----
  return (
    <div
      className={`min-h-screen p-6 transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      }`}
    >
      {/* 🌙 Theme toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-5 right-5 p-2 rounded-full shadow-md bg-green-500 hover:bg-green-600 text-white"
        title="Toggle dark mode"
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <div
        className={`max-w-2xl mx-auto p-6 rounded-2xl shadow ${
          darkMode ? "bg-gray-800" : "bg-white"
        }`}
      >
        <h1
          className={`text-2xl font-bold mb-4 ${
            darkMode ? "text-green-400" : "text-green-600"
          }`}
        >
          🌿 Daily Gratitude Journal
        </h1>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          {["journal", "summary"].map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-2 rounded-lg ${
                view === tab
                  ? "bg-green-500 text-white"
                  : darkMode
                  ? "bg-gray-700 text-gray-200"
                  : "bg-gray-200"
              }`}
            >
              {tab === "journal" ? "Journal" : "Past Entries"}
            </button>
          ))}
        </div>

        {/* Journal view */}
        {view === "journal" && (
          <>
            {/* Section */}
            <label className="block mb-2 font-semibold">Section</label>
            <select
              className={`w-full p-2 border rounded mb-4 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={section}
              onChange={handleSectionChange}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Prompt picker -> auto-fills the question input */}
            <label className="block mb-2 font-semibold">Pick a prompt</label>
            <select
              className={`w-full p-2 border rounded mb-4 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={question && PROMPTS[section]?.includes(question) ? question : ""}
              onChange={(e) => setQuestion(e.target.value)}
            >
              <option value="">— Choose a prompt —</option>
              {PROMPTS[section]?.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Question text (editable after selecting prompt) */}
            <label className="block mb-2 font-semibold">Question / Prompt</label>
            <input
              type="text"
              className={`w-full p-2 border rounded mb-4 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are you grateful for today?"
            />

            {/* Entry */}
            <label className="block mb-2 font-semibold">Your Entry</label>
            <textarea
              rows="5"
              className={`w-full p-2 border rounded mb-2 ${
                darkMode ? "bg-gray-700 border-gray-600" : ""
              }`}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Write freely here..."
            />

            {lastSaved && (
              <p className="text-xs text-gray-500 mb-3">
                Saved •{" "}
                {lastSaved.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}

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
                Save Entry
              </button>
              <button
                onClick={handleClearDraft}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
              >
                Clear Draft
              </button>
            </div>
          </>
        )}

        {/* Past entries */}
        {view === "summary" && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Past Entries</h2>
            {savedEntries.length === 0 ? (
              <p className="text-gray-500">No entries yet.</p>
            ) : (
              savedEntries
                .slice()
                .reverse()
                .map((e, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 mb-3 shadow-sm ${
                      darkMode
                        ? "bg-gray-700 border-gray-600 text-gray-100"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="text-sm text-gray-500">{e.date}</div>
                    <div className="font-semibold">{e.section}</div>
                    <div className="text-sm italic">{e.question}</div>
                    <div className="mt-1">{e.entry}</div>
                    <div className="text-xs mt-1 text-green-700">
                      Mood: {e.mood} | Sentiment: {e.sentiment}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div> {/* end of inner card */}

      {/* Google Drive Backup/Restore */}
      <GoogleSync dataToSync={{ savedEntries, savedAffirmations }} />
    </div>
  );
}

// ---- Register service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
  });
}
