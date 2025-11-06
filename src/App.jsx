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

/* ---- Quotes ---- */
const QUOTES = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

/* ---- Sections & prompts ---- */
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

/* ---- Helpers ---- */
const toDateKey = (d) => {
  const x = new Date(d);
  if (isNaN(x)) return null;
  const y = new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return y.toISOString().slice(0, 10); // YYYY-MM-DD
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString();

function moodLabel(m) {
  if (m <= 3) return "😞 Sad / Low";
  if (m <= 6) return "😐 Neutral";
  if (m <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}
function analyzeSentiment(text, mood) {
  const pos = ["happy", "joy", "grateful", "calm", "love", "hope", "thankful", "peace"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset"];
  let s = 0;
  const t = (text || "").toLowerCase();
  pos.forEach((w) => t.includes(w) && (s += 1));
  neg.forEach((w) => t.includes(w) && (s -= 1));
  if (mood >= 7) s += 1;
  if (mood <= 3) s -= 1;
  if (s > 1) return "😊 Positive";
  if (s === 1) return "🙂 Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed";
}
function moodToColor(mood) {
  if (mood == null) return "#f3f4f6";
  const t = Math.max(0, Math.min(10, mood)) / 10;
  let from, to, p;
  if (t < 0.5) {
    from = [239, 68, 68]; // red-500
    to = [245, 158, 11]; // amber-500
    p = t / 0.5;
  } else {
    from = [245, 158, 11];
    to = [22, 163, 74]; // green-600
    p = (t - 0.5) / 0.5;
  }
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * p));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function freqToColor(count) {
  if (!count) return "#f3f4f6";
  const capped = Math.min(count, 5);
  const t = capped / 5; // normalize
  const from = [191, 219, 254]; // blue-200
  const to = [30, 64, 175]; // blue-800
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ===== App ===== */
export default function App() {
  const [view, setView] = useState("journal");
  const [dark, setDark] = useState(false);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [heatmapMode, setHeatmapMode] = useState("mood"); // "mood" | "freq"

  // journal inputs
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);

  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMood, setEditMood] = useState(5);
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  /* Load/persist theme & entries */
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);
  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  /* Save new entry */
  const handleSave = () => {
    if (!entry.trim() || !question) return;
    const now = new Date();
    const e = {
      id: now.getTime(),
      date: now.toLocaleString(),
      iso: now.toISOString(),
      section,
      question,
      entry,
      mood,
      sentiment: analyzeSentiment(entry, mood),
    };
    setEntries((prev) => [...prev, e]);
    setEntry("");
    setQuestion("");
    setMood(5);
    setSelectedDayKey(toDateKey(e.iso));
  };

  const handleDelete = (id) => setEntries((arr) => arr.filter((e) => e.id !== id));
  const openEdit = (item) => { setEditing(item); setEditText(item.entry); setEditMood(item.mood); };
  const saveEdit = () => {
    if (!editing) return;
    const sentiment = analyzeSentiment(editText, editMood);
    setEntries((arr) =>
      arr.map((e) => (e.id === editing.id ? { ...e, entry: editText, mood: editMood, sentiment } : e))
    );
    setEditing(null);
  };

  /* ---- Stats for matrix ---- */
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      let d = new Date(e.iso || e.date);
      if (isNaN(d)) continue;
      const k = toDateKey(d);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  }, [entries]);

  const { weeks, monthLabels } = useMemo(() => buildYearMatrix(byDay), [byDay]);
  const recent3 = useMemo(() => [...entries].sort((a, b) => new Date(b.iso) - new Date(a.iso)).slice(0, 3), [entries]);
  const dayEntries = useMemo(() => byDay.get(selectedDayKey) || [], [byDay, selectedDayKey]);

  /* ---------- UI ---------- */
  return (
    <div className={`min-h-screen p-6 max-w-3xl mx-auto ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <header className="flex justify-between items-center mb-1">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button variant="outline" onClick={() => {
          const next = !dark;
          setDark(next);
          localStorage.setItem("gj_theme", next ? "dark" : "light");
        }}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </header>

      <p className="text-center text-gray-500">Save short reflections daily. Track mood & insights weekly.</p>
      <p className="italic text-center text-green-600 mb-4">“{quote}”</p>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view === "journal" ? "default" : "outline"} onClick={() => setView("journal")}>✍️ Journal</Button>
        <Button variant={view === "past" ? "default" : "outline"} onClick={() => setView("past")}>🕊 Past Entries</Button>
        <Button variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")}>📊 Summary</Button>
      </div>

      {view === "past" && (
        <div className="space-y-4">
          {/* Recent */}
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-2">Recent</h3>
              {recent3.length === 0 ? (
                <p className="text-sm text-gray-500">No entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent3.map((e) => (
                    <div key={e.id} className="flex justify-between border rounded-lg p-2">
                      <div>
                        <div className="text-xs text-gray-500">{fmtDate(e.iso || e.date)} — {e.section}</div>
                        <div className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</div>
                        <div className="text-sm font-medium">{e.question}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setSelectedDayKey(toDateKey(e.iso))}>Open</Button>
                        <Button variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                        <Button variant="outline" onClick={() => handleDelete(e.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Matrix */}
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Rolling 12-month Journal Matrix</h3>
              <div className="flex items-center gap-3 text-sm">
                <span>{heatmapMode === "mood" ? "🎨 Mood" : "📅 Frequency"}</span>
                <Button variant="outline" size="sm" onClick={() => setHeatmapMode(heatmapMode === "mood" ? "freq" : "mood")}>
                  Toggle
                </Button>
              </div>
            </div>

            <div className="year-matrix">
              {weeks.map((week, wi) => (
                <div key={wi} className="year-week">
                  {week.map((cell) => {
                    const stat = cell.stat;
                    const color =
                      heatmapMode === "mood"
                        ? moodToColor(stat?.avgMood)
                        : freqToColor(stat?.count);
                    const title = `${cell.label}\n${
                      stat
                        ? `${stat.count} entr${stat.count > 1 ? "ies" : "y"}, avg mood ${stat.avgMood?.toFixed(1) || "-"}`
                        : "No entry"
                    }`;
                    return (
                      <button
                        key={cell.key}
                        className={`year-cell ${cell.key === selectedDayKey ? "year-cell-selected" : ""}`}
                        style={{ background: color }}
                        title={title}
                        onClick={() => setSelectedDayKey(cell.key)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="year-month-labels">
              {monthLabels.map((m) => (
                <span key={m.key} style={{ transform: `translateX(${m.offsetPx}px)` }}>{m.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-[90%] max-w-md space-y-4">
            <h3 className="text-lg font-semibold">✏️ Edit Entry</h3>
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div>
              <p className="text-sm">Mood: {editMood}/10 ({moodLabel(editMood)})</p>
              <Slider min={1} max={10} value={[editMood]} onChange={(v) => setEditMood(v[0])} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced to browser storage</div>
        <InstallPrompt />
      </div>
      <div className="text-center mt-3">
        <GoogleSync dataToSync={{ entries }} />
      </div>
    </div>
  );
}

/* ===== Year matrix builder ===== */
function buildYearMatrix(dayMap) {
  const end = new Date();
  const endKey = toDateKey(end);
  const endDate = new Date(endKey);

  const start = new Date(endDate);
  start.setDate(start.getDate() - 7 * 52 + 1);
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);

  const weeks = [];
  const monthAnchors = [];
  let cur = new Date(start);

  for (let w = 0; w < 52; w++) {
    const column = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKey(cur);
      const label = cur.toLocaleDateString();
      const items = dayMap.get(key) || [];
      const stat = items.length
        ? { count: items.length, avgMood: items.reduce((a, e) => a + (e.mood || 0), 0) / items.length }
        : null;
      column.push({ key, label, stat });
      if (cur.getDate() === 1) monthAnchors.push({ key, date: new Date(cur), col: w });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(column);
  }

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monthLabels = monthAnchors.map((a) => ({
    key: a.key,
    label: MONTHS[a.date.getMonth()],
    offsetPx: a.col * 15,
  }));

  return { weeks, monthLabels };
}
