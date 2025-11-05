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

  // Load from localStorage
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
  }, []);
  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  // Sync theme with system
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = (e) => setDarkMode(e.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  // Save entry
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
    setEntries([...entries, newE]);
    setEntry("");
    setQuestion("");
    setMood(5);
  };

  // Edit / Delete
  const handleDelete = (id) => setEntries(entries.filter((e) => e.id !== id));
  const handleEdit = (id, newText) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, entry: newText } : e)));

  // Export / Import
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
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        setEntries(Array.isArray(data) ? data : []);
      } catch {
        alert("Invalid file");
      }
    };
    r.readAsText(f);
  };

  // View colors
  const darkBox = darkMode ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900";

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-3xl font-bold text-center">
          🌿 Daily Gratitude Journal
        </h1>

        {/* Tabs */}
        <div className="flex justify-center gap-2">
          {["journal", "summary", "settings"].map((tab) => (
            <Button
              key={tab}
              variant={view === tab ? "default" : "outline"}
              onClick={() => setView(tab)}
            >
              {tab === "journal"
                ? "Journal"
                : tab === "summary"
                ? "Summary"
                : "Settings"}
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
                    <p className="text-sm">
                      Mood: <strong>{mood}/10</strong>
                    </p>
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
                  Array.isArray(restored.entries) && setEntries(restored.entries)
                }
              />
              <div>
                <h3 className="font-semibold mb-1">Local Backup</h3>
                <div className="flex gap-2">
                  <Button onClick={handleExport}>Export JSON</Button>
                  <label className="bg-gray-200 text-gray-800 px-3 py-2 rounded cursor-pointer hover:bg-gray-300">
                    Import
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleImport}
                      accept=".json"
                    />
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
                            window.confirm("Delete entry?") &&
                            handleDelete(e.id)
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

      {/* Floating install prompt */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-5 right-5"
        >
          <InstallPrompt />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
