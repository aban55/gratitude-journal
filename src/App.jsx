// (imports remain same as before)
import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import { loadAll, saveAll } from "./storage.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [section, setSection] = useState("People & Relationships");
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [savedEntries, setSavedEntries] = useState([]);
  const [savedAffirmations, setSavedAffirmations] = useState([]);
  const [mood, setMood] = useState(5);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState("journal");
  const [editingIndex, setEditingIndex] = useState(null);
  const [deletedEntry, setDeletedEntry] = useState(null);
  const [showUndo, setShowUndo] = useState(false);

  // 🔍 Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [moodFilter, setMoodFilter] = useState(0); // NEW

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDarkMode(mq.matches);
    mq.addEventListener("change", (e) => setDarkMode(e.matches));
  }, []);

  useEffect(() => {
    loadAll().then(({ savedEntries, savedAffirmations }) => {
      setSavedEntries(savedEntries);
      setSavedAffirmations(savedAffirmations);
    });
  }, []);

  useEffect(() => {
    saveAll({ savedEntries, savedAffirmations });
  }, [savedEntries, savedAffirmations]);

  const handleSave = () => {
    if (!question || !entry.trim()) return;
    const sentiment = analyzeSentiment(entry);
    const newEntry = {
      date: new Date().toLocaleDateString(),
      section,
      question,
      entry,
      mood,
      sentiment,
    };

    if (editingIndex !== null) {
      const updated = [...savedEntries];
      updated[editingIndex] = newEntry;
      setSavedEntries(updated);
      setEditingIndex(null);
    } else {
      setSavedEntries([...savedEntries, newEntry]);
    }

    setEntry("");
    setQuestion("");
    setMood(5);
  };

  const handleEdit = (index) => {
    const e = savedEntries[index];
    setSection(e.section);
    setQuestion(e.question);
    setEntry(e.entry);
    setMood(e.mood);
    setEditingIndex(index);
    setView("journal");
  };

  const handleDelete = (index) => {
    const entryToDelete = savedEntries[index];
    setDeletedEntry({ entry: entryToDelete, index });
    setSavedEntries(savedEntries.filter((_, i) => i !== index));
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const undoDelete = () => {
    if (deletedEntry) {
      const updated = [...savedEntries];
      updated.splice(deletedEntry.index, 0, deletedEntry.entry);
      setSavedEntries(updated);
      setDeletedEntry(null);
      setShowUndo(false);
    }
  };

  // 📤 Export / Import local backups
  const handleExportLocal = () => {
    const data = { savedEntries, savedAffirmations };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gratitude-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
  };

  const handleImportLocal = async (file) => {
    const text = await file.text();
    const data = JSON.parse(text);
    setSavedEntries(data.savedEntries || []);
    setSavedAffirmations(data.savedAffirmations || []);
  };

  // 🧭 Filtering logic
  const filteredEntries = useMemo(() => {
    return savedEntries.filter((e) => {
      const matchesQuery =
        e.entry.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.section.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = !filterDate || e.date === filterDate;
      const matchesMood = e.mood >= moodFilter;
      return matchesQuery && matchesDate && matchesMood;
    });
  }, [savedEntries, searchQuery, filterDate, moodFilter]);

  const summary = useMemo(() => {
    if (!savedEntries.length) return null;
    const avgMood = (
      savedEntries.reduce((a, e) => a + e.mood, 0) / savedEntries.length
    ).toFixed(1);
    return { avgMood };
  }, [savedEntries]);

  return (
    <div
      className={`min-h-screen p-6 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-800"
      }`}
    >
      <h1 className="text-3xl font-bold text-center mb-4">
        🌿 Daily Gratitude Journal
      </h1>

      <div className="flex justify-center gap-2 mb-4">
        <Button onClick={() => setView("journal")}>Journal</Button>
        <Button onClick={() => setView("summary")}>Summary</Button>
        <Button onClick={() => setView("settings")}>Settings</Button>
      </div>

      {/* --- JOURNAL --- */}
      {view === "journal" && (
        <>
          <Card>
            <CardContent>
              <Select
                value={section}
                onChange={setSection}
                options={Object.keys(sections)}
              />
              <Select
                value={question}
                onChange={setQuestion}
                options={["", ...sections[section]]}
                placeholder="Pick a gratitude question"
              />
              {question && (
                <>
                  <Textarea
                    placeholder="Write your reflection..."
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                  />
                  <p>Mood: {mood}/10</p>
                  <Slider
                    min={1}
                    max={10}
                    value={[mood]}
                    onChange={(v) => setMood(v[0])}
                  />
                  <Button onClick={handleSave}>
                    {editingIndex !== null ? "Update Entry" : "Save Entry"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* 🔍 Filters */}
          <div className="flex flex-wrap justify-center gap-3 mt-6 mb-3">
            <input
              type="text"
              placeholder="🔍 Search your entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`px-3 py-2 rounded border ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-black"
              }`}
            />
            <input
              type="date"
              value={filterDate}
              onChange={(e) =>
                setFilterDate(
                  e.target.value
                    ? new Date(e.target.value).toLocaleDateString()
                    : ""
                )
              }
              className={`px-3 py-2 rounded border ${
                darkMode
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-black"
              }`}
            />
            <div className="flex items-center gap-2">
              <label className="text-sm opacity-80">Mood ≥ {moodFilter}</label>
              <Slider
                min={0}
                max={10}
                value={[moodFilter]}
                onChange={(v) => setMoodFilter(v[0])}
                className="w-32"
              />
            </div>
            {(searchQuery || filterDate || moodFilter > 0) && (
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setFilterDate("");
                  setMoodFilter(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* 📝 Filtered Entries */}
          {filteredEntries.length > 0 ? (
            <div className="mt-2 space-y-2">
              {filteredEntries.map((e, i) => (
                <Card key={i}>
                  <CardContent>
                    <p className="text-xs text-gray-500">
                      {e.date} — {e.section}
                    </p>
                    <p className="font-medium">{e.question}</p>
                    <p className="mt-2">{e.entry}</p>
                    <p className="text-sm opacity-70">
                      Mood: {e.mood}/10 — {e.sentiment}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" onClick={() => handleEdit(i)}>
                        ✏️ Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(i)}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 mt-4">
              No entries match your filters.
            </p>
          )}
        </>
      )}

      {/* --- SUMMARY --- */}
      {view === "summary" && summary && (
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">📊 Summary</h2>
            <p>
              Average Mood: <strong>{summary.avgMood}</strong>
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={savedEntries.map((e) => ({ date: e.date, mood: e.mood }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="#16a34a"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* --- SETTINGS --- */}
      {view === "settings" && (
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">⚙️ Settings</h2>
            <GoogleSync
              dataToSync={{ savedEntries, savedAffirmations }}
              onRestore={(d) => {
                setSavedEntries(d.savedEntries || []);
                setSavedAffirmations(d.savedAffirmations || []);
              }}
              darkMode={darkMode}
            />
            <div className="mt-4 space-y-3">
              <Button onClick={handleExportLocal}>📤 Export Local Backup</Button>
              <label className="block text-sm">
                📥 Import Backup
                <input
                  type="file"
                  accept="application/json"
                  className="block mt-1"
                  onChange={(e) =>
                    e.target.files[0] && handleImportLocal(e.target.files[0])
                  }
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 📱 Install prompt */}
      <InstallPrompt darkMode={darkMode} />

      {/* 🧈 Undo Toast */}
      <AnimatePresence>
        {showUndo && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg ${
              darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900"
            }`}
          >
            <p>🗑️ Entry deleted</p>
            <Button onClick={undoDelete} className="ml-2 text-green-500 underline">
              Undo
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper functions ---
function analyzeSentiment(text) {
  const positive = [
    "grateful","happy","joy","calm","peace","love","thankful","excited","proud","hopeful"
  ];
  const negative = [
    "tired","sad","angry","stressed","worried","upset","frustrated","lonely"
  ];
  let score = 0;
  positive.forEach((w) => text.toLowerCase().includes(w) && (score += 1));
  negative.forEach((w) => text.toLowerCase().includes(w) && (score -= 1));
  if (score > 2) return "😊 Positive";
  if (score > 0) return "🙂 Calm/Content";
  if (score === 0) return "😐 Neutral";
  return "😟 Stressed/Low";
}

const sections = {
  "People & Relationships": [
    "Who made my life easier or better today?",
    "Which friend or family member am I grateful for — and why?",
    "What small act of kindness did someone show me recently?",
  ],
  "Self & Inner Strength": [
    "What ability or quality am I thankful for today?",
    "What challenge did I handle better than before?",
  ],
  "Learning & Growth": [
    "What new idea or skill did I learn recently?",
    "What feedback or advice am I grateful for?",
  ],
  "Environment & Everyday Comforts": [
    "What part of my home brings me peace?",
    "What small thing in nature caught my attention today?",
  ],
};
