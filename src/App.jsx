import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import SummaryPanel from "./SummaryPanel.jsx";
import jsPDF from "jspdf";

// 🌿 Quotes
const QUOTES = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

// 🌻 Sections & Prompts
const sections = {
  "People & Relationships": [
    "Who brought a smile to my face today?",
    "Which person showed me kindness or patience?",
    "What’s a quality in someone close to me that I admire?",
    "Who did I help today — and how did it make me feel?",
  ],
  "Self & Growth": [
    "What ability or personal quality am I thankful for today?",
    "What challenge have I handled better than before?",
    "What is one thing about my body or health I appreciate?",
    "What habit or discipline am I proud of keeping?",
    "What lesson did a past mistake teach me that helps me now?",
  ],
  "Nature & Calm": [
    "What detail in nature stood out today?",
    "What moment felt peaceful or quiet?",
    "What simple pleasure grounded me today?",
    "What modern convenience or tool makes life smoother?",
  ],
  "Work & Purpose": [
    "What part of my work felt meaningful?",
    "Who supported my goals today?",
    "What task made me feel capable or proud?",
  ],
  "Learning & Inspiration": [
    "What idea or lesson inspired me recently?",
    "What am I curious to learn next?",
    "Who or what sparked my creativity today?",
  ],
  "Health & Wellbeing": [
    "What part of my body served me well today?",
    "What healthy choice did I make today?",
    "How does my body show gratitude when I care for it?",
    "What signs of recovery or strength am I noticing lately?",
  ],
};

// 📝 Helpers

function moodLabel(mood) {
  if (mood <= 3) return "😞 Sad / Low";
  if (mood <= 6) return "😐 Neutral";
  if (mood <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}

function analyzeSentiment(text, mood) {
  const pos = ["happy", "joy", "grateful", "calm", "love", "hope", "thankful"];
  const neg = ["tired", "sad", "angry", "stressed", "worried"];
  let s = 0;
  const t = text.toLowerCase();
  pos.forEach((w) => t.includes(w) && (s += 1));
  neg.forEach((w) => t.includes(w) && (s -= 1));
  if (mood >= 7) s++;
  if (mood <= 3) s--;
  if (s > 1) return "😊 Positive";
  if (s === 1) return "🙂 Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed";
}

const toDateKey = (isoOrDate) => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString();
};

export default function App() {
  const [view, setView] = useState("journal");
  const [dark, setDark] = useState(false);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  // journal inputs
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);

  // data
  const [entries, setEntries] = useState([]);

  // edit modal
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMood, setEditMood] = useState(5);

  // Load local data
  useEffect(() => {
    const saved = localStorage.getItem("gratitudeEntries");
    if (saved) setEntries(JSON.parse(saved));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);

  // Persist local data
  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  // Save new entry
  const handleSave = () => {
    if (!entry.trim() || !question) return;
    const sentiment = analyzeSentiment(entry, mood);
    const now = new Date();
    const e = {
      id: now.getTime(),
      date: now.toLocaleString(),
      iso: now.toISOString(),
      section,
      question,
      entry,
      mood,
      sentiment,
    };
    setEntries((prev) => [...prev, e]);
    setEntry("");
    setQuestion("");
    setMood(5);
  };

  // Delete entry
  const handleDelete = (id) => setEntries((arr) => arr.filter((e) => e.id !== id));

  // Edit modal
  const openEdit = (item) => {
    setEditing(item);
    setEditText(item.entry);
    setEditMood(item.mood);
  };
  const saveEdit = () => {
    if (!editing) return;
    const sentiment = analyzeSentiment(editText, editMood);
    setEntries((arr) =>
      arr.map((e) =>
        e.id === editing.id ? { ...e, entry: editText, mood: editMood, sentiment } : e
      )
    );
    setEditing(null);
  };

  // -------- Past Entries: horizontal pages --------
  const pages = useMemo(() => {
    const grouped = groupByDate(entries);
    const ordered = Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((d) => ({ dateKey: d, items: grouped[d] }));
    return ordered;
  }, [entries]);

  const scrollerRef = useRef(null);
  const pageRefs = useRef({});
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (view === "past" && pages.length && scrollerRef.current) {
      const k = pages[pageIndex]?.dateKey;
      if (k && pageRefs.current[k]) {
        pageRefs.current[k].scrollIntoView({ behavior: "smooth", inline: "start" });
      }
    }
  }, [view]);

  const gotoPage = (i) => {
    if (!pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, i));
    setPageIndex(clamped);
    const k = pages[clamped].dateKey;
    pageRefs.current[k]?.scrollIntoView({ behavior: "smooth", inline: "start" });
  };

  // Handle restore from external sources (e.g., Google Drive)
  const handleRestore = (restoredEntries) => {
    if (restoredEntries) {
      setEntries((prevEntries) => [...prevEntries, ...restoredEntries]);
    }
  };

  return (
    <div className={`min-h-screen p-6 max-w-3xl mx-auto ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <header className="flex justify-between items-center mb-1">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button variant="outline" onClick={() => { const next = !dark; setDark(next); localStorage.setItem("gj_theme", next ? "dark" : "light"); }}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </header>

      <p className="text-center text-gray-500">“{quote}”</p>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view === "journal" ? "default" : "outline"} onClick={() => setView("journal")}>✍️ Journal</Button>
        <Button variant={view === "past" ? "default" : "outline"} onClick={() => setView("past")}>🕊 Past Entries</Button>
        <Button variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")}>📊 Summary</Button>
      </div>

      {/* JOURNAL */}
      {view === "journal" && (
        <Card>
          <CardContent className="space-y-4">
            <Select value={section} onChange={(v) => { setSection(v); setQuestion(""); }} options={Object.keys(sections)} />
            <Select value={question} onChange={setQuestion} options={["", ...sections[section]]} placeholder="Pick a question" />
            {question && <>
              <Textarea placeholder="Write your reflection..." value={entry} onChange={(e) => setEntry(e.target.value)} />
              <div><p className="text-sm">Mood: {mood}/10 ({moodLabel(mood)})</p>
              <Slider min={1} max={10} value={[mood]} onChange={(v) => setMood(v[0])} /></div>
              <Button onClick={handleSave}>Save Entry</Button>
            </>}
          </CardContent>
        </Card>
      )}

      {/* PAST */}
      {view === "past" && (
        <div className="space-y-4">
          {pages.length === 0 ? <Card><CardContent>No entries yet.</CardContent></Card> : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">Page {pageIndex + 1} / {pages.length}</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => gotoPage(pageIndex - 1)}>⬅️ Prev</Button>
                  <Button variant="outline" onClick={() => gotoPage(pageIndex + 1)}>Next ➡️</Button>
                </div>
              </div>

              <div ref={scrollerRef} className={`journal-swiper ${dark ? "" : "parchment-bg"}`}>
                {pages.map(({ dateKey, items }) => (
                  <section key={dateKey} ref={(el) => (pageRefs.current[dateKey] = el)} className="journal-page">
                    <div className="journal-page-inner">
                      <h3 className="journal-date">{dateKey}</h3>
                      <div className="space-y-4">
                        {items.map((e) => (
                          <div key={e.id} className="journal-entry">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs text-gray-500">{new Date(e.iso || e.date).toLocaleTimeString()} — {e.section}</p>
                                <p className="text-sm text-gray-600">Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                                <Button variant="outline" onClick={() => handleDelete(e.id)}>Delete</Button>
                              </div>
                            </div>
                            <p className="mt-2 font-medium">{e.question}</p>
                            <p className="mt-1 whitespace-pre-wrap">{e.entry}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Google Sync */}
      <GoogleSync dataToSync={{ entries }} onRestore={handleRestore} />

      {/* Footer */}
      <footer className="mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced to browser storage</div>
        <InstallPrompt />
      </footer>
    </div>
  );
}

// Helper function to group entries by date
function groupByDate(entries) {
  const grouped = {};
  entries.forEach(entry => {
    const dateKey = toDateKey(entry.iso || entry.date);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(entry);
  });
  return grouped;
}
