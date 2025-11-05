import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SummaryPanel from "./components/SummaryPanel.jsx";
import Inspiration from "./components/Inspiration.jsx";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import { Button } from "./ui/Button.jsx";
import { Card, CardContent } from "./ui/Card.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";

// ✅ Define sections at top to prevent undefined error
const sections = {
  "People & Relationships": [
    "Who made my life easier today?",
    "Which friend or family member am I grateful for — and why?",
    "What act of kindness did I witness or receive?",
    "Whose quality or habit do I admire most?",
    "Who did I help today — and how did that feel?",
  ],
  "Self & Growth": [
    "What ability or strength helped me today?",
    "What challenge did I handle better than before?",
    "What am I proud of learning or improving?",
    "What moment made me feel resilient?",
    "What recent mistake taught me something useful?",
  ],
  "Environment & Comfort": [
    "What space or moment brought peace today?",
    "What in nature caught my attention?",
    "What simple comfort did I enjoy?",
    "What modern convenience am I thankful for?",
    "What made today feel safe or calm?",
  ],
  "Hope & Perspective": [
    "What opportunity am I lucky to have?",
    "What am I looking forward to?",
    "Who reminds me that life is bigger than my worries?",
    "How has a tough time shaped who I am?",
    "What do I often take for granted but value deeply?",
  ],
};

// ✅ Sentiment analyzer (used for graphs & affirmations)
function analyzeSentiment(text) {
  const pos = ["grateful", "happy", "joy", "peace", "love", "hopeful", "proud"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset"];
  let score = 0;
  pos.forEach((w) => text.toLowerCase().includes(w) && (score += 1));
  neg.forEach((w) => text.toLowerCase().includes(w) && (score -= 1));
  if (score > 1) return "🙂 Positive";
  if (score === 0) return "😐 Neutral";
  return "😟 Low";
}

export default function App() {
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);
  const [view, setView] = useState("journal");
  const [darkMode, setDarkMode] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // ✅ Load local data
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
  }, []);

  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  // ✅ System theme listener
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = (e) => setDarkMode(e.matches);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  // ✅ Save entry (also triggers Drive auto-sync)
  const handleSave = () => {
    if (!entry.trim() || !question) return;
    const newE = {
      id: Date.now(),
      iso: new Date().toISOString(),
      section,
      question,
      entry,
      mood,
      sentiment: analyzeSentiment(entry),
    };
    const updated = [...entries, newE];
    setEntries(updated);
    setEntry("");
    setQuestion("");
    setMood(5);
    localStorage.setItem("gratitudeEntries", JSON.stringify(updated));
  };

  // ✅ Edit / Delete
  const handleDelete = (id) => setEntries(entries.filter((e) => e.id !== id));
  const handleEdit = (id, newText) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, entry: newText } : e)));

  // ✅ Local export/import
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "gratitude_journal_backup.json";
    link.click();
  };
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) setEntries(data);
      } catch {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  };

  // ✅ Styling helpers
  const darkBox = darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900";

  // ✅ Render
  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-3xl font-bold text-center">🌿 Daily Gratitude Journal</h1>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-3">
          {["journal", "summary", "settings"].map((tab) => (
            <Button
              key={tab}
              variant={view === tab ? "default" : "outline"}
              onClick={() => setView(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Button>
          ))}
        </div>

        {/* JOURNAL VIEW */}
        {view === "journal" && (
          <Card className={darkBox}>
            <CardContent className="space-y-4">
              <Inspiration darkMode={darkMode} />
              <Select
                value={section}
                onChange={(v) => {
                  setSection(v);
                  setQuestion("");
                }}
                options={Object.keys(sections)}
              />
              <Select
                value={question}
                onChange={setQuestion}
                options={["", ...sections[section]]}
                placeholder="Pick a question"
              />
              {question && (
                <>
                  <p className="text-sm text-gray-500">{question}</p>
                  <Textarea
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="Write your reflection..."
                  />
                  <div className="space-y-1">
                    <p className="text-sm">Mood: <strong>{mood}/10</strong></p>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[mood]}
                      onChange={(v) => setMood(v[0])}
                    />
                  </div>
                  <Button onClick={handleSave}>Save Entry</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* SUMMARY VIEW */}
        {view === "summary" && (
          <Card className={darkBox}>
            <CardContent>
              <SummaryPanel entries={entries} darkMode={darkMode} />
            </CardContent>
          </Card>
        )}

        {/* SETTINGS VIEW */}
        {view === "settings" && (
          <Card className={darkBox}>
            <CardContent className="space-y-4">
              <GoogleSync
                dataToSync={{ entries }}
                onRestore={(restored) =>
                  restored.entries && setEntries(restored.entries)
                }
              />
              <div>
                <h3 className="font-semibold mb-1">Local Backup</h3>
                <div className="flex gap-2">
                  <Button onClick={handleExport}>Export JSON</Button>
                  <label className="bg-gray-200 text-gray-800 px-3 py-2 rounded cursor-pointer hover:bg-gray-300">
                    Import
                    <input type="file" className="hidden" onChange={handleImport} />
                  </label>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Theme</h3>
                <Button
                  variant="outline"
                  onClick={() => setDarkMode((d) => !d)}
                >
                  {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Past Entries */}
        {view === "journal" && entries.length > 0 && (
          <div className="space-y-3 mt-6">
            <h2 className="text-xl font-semibold">🕊 Past Entries</h2>
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <Card key={e.id} className={darkBox}>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400">
                          {new Date(e.iso).toLocaleString()} — {e.section}
                        </p>
                        <p className="text-sm text-gray-500">
                          Mood {e.mood}/10 | {e.sentiment}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newText = prompt("Edit entry:", e.entry);
                            if (newText !== null) handleEdit(e.id, newText);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            window.confirm("Delete entry?") && handleDelete(e.id)
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{e.entry}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Floating Install button */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-5 right-5"
        >
          <InstallPrompt />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
