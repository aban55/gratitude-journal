import { useEffect, useMemo, useState, useRef } from "react";
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

/* ---- Sections ---- */
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
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toLocaleDateString();
};

export default function App() {
  const [view, setView] = useState("journal"); // journal | past | summary
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

  // Load local
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);
  // Persist local
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

  // Delete
  const handleDelete = (id) =>
    setEntries((arr) => arr.filter((e) => e.id !== id));

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
        e.id === editing.id
          ? { ...e, entry: editText, mood: editMood, sentiment }
          : e
      )
    );
    setEditing(null);
  };

  // Export: TXT, CSV, PDF
  const exportTxt = () => {
    const content = entries
      .map(
        (e) =>
          `${e.date}\nSection: ${e.section}\nMood: ${e.mood}/10 (${e.sentiment})\nQ: ${e.question}\nA: ${e.entry}\n`
      )
      .join("\n----------------\n");
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Gratitude_Journal.txt";
    link.click();
  };
  const exportCsv = () => {
    const header = ["Date", "Section", "Mood", "Sentiment", "Question", "Entry"];
    const rows = entries.map((e) => [
      `"${e.date}"`,
      `"${e.section}"`,
      e.mood,
      `"${e.sentiment}"`,
      `"${e.question}"`,
      `"${e.entry.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Gratitude_Journal.csv";
    link.click();
  };
  const exportJournalPDF = async () => {
    const pdf = new jsPDF("p", "pt", "a4");
    const marginX = 40,
      marginY = 60,
      lineH = 20;
    let y = marginY;

    pdf.setFont("Times", "normal");
    pdf.setFontSize(16);
    pdf.text("🌿 My Gratitude Journal", marginX, y);
    y += 26;

    // group by date asc
    const byDate = groupByDate(entries);
    const sortedDates = Object.keys(byDate).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    for (const d of sortedDates) {
      if (y + 60 > pdf.internal.pageSize.height) {
        pdf.addPage();
        y = marginY;
      }
      pdf.setFontSize(12);
      pdf.setTextColor(34, 139, 34);
      pdf.text(d, marginX, y);
      y += 18;

      for (const e of byDate[d]) {
        if (y + 90 > pdf.internal.pageSize.height) {
          pdf.addPage();
          y = marginY;
        }
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.text(`Section: ${e.section}`, marginX, y);
        y += lineH;
        pdf.text(`Mood: ${e.mood}/10 | ${e.sentiment}`, marginX, y);
        y += lineH;
        pdf.setFont("Times", "bold");
        pdf.text(`Q: ${e.question}`, marginX, y);
        y += lineH;
        pdf.setFont("Times", "normal");
        const lines = pdf.splitTextToSize(e.entry, 520);
        pdf.text(lines, marginX, y);
        y += lines.length * lineH + 14;
      }
    }
    pdf.save(`Gratitude_Journal_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div
      className={`min-h-screen p-6 max-w-3xl mx-auto app-fade ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <header className="flex justify-between items-center mb-1">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button
          variant="outline"
          onClick={() => {
            const next = !dark;
            setDark(next);
            localStorage.setItem("gj_theme", next ? "dark" : "light");
          }}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </header>

      <p className="text-center text-gray-500">
        Save short reflections daily. Track mood & insights weekly.
      </p>
      <p className="italic text-center text-green-600 mb-4">“{quote}”</p>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view === "journal" ? "default" : "outline"} onClick={() => setView("journal")}>
          ✍️ Journal
        </Button>
        <Button variant={view === "past" ? "default" : "outline"} onClick={() => setView("past")}>
          🕊 Past Entries
        </Button>
        <Button variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")}>
          📊 Summary
        </Button>
      </div>

      {/* JOURNAL */}
      {view === "journal" && (
        <Card>
          <CardContent className="space-y-4">
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
                <Textarea
                  placeholder="Write your reflection..."
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
                <div>
                  <p className="text-sm">
                    Mood: {mood}/10 ({moodLabel(mood)})
                  </p>
                  <Slider min={1} max={10} step={1} value={[mood]} onChange={(v) => setMood(v[0])} />
                </div>
                <Button onClick={handleSave}>Save Entry</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAST */}
      {view === "past" && (
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="font-semibold mb-2">Rolling 12-Month Matrix</h2>
              <div className="year-matrix">
                {weeks.map((week, wi) => (
                  <div key={wi} className="year-week">
                    {week.map((cell) => {
                      const stat = cell.stat;
                      const bg = stat ? moodToColor(stat.avgMood) : "#f3f4f6";
                      return (
                        <button
                          key={cell.key}
                          title={`${cell.label}\n${stat ? `${stat.count} entries` : "No entry"}`}
                          className={`year-cell ${cell.key === selectedDayKey ? "year-cell-selected" : ""}`}
                          style={{ background: bg }}
                          onClick={() => setSelectedDayKey(cell.key)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="year-month-labels">
                {monthLabels.map((m) => (
                  <span key={m.key} style={{ left: `${m.offsetPx}px` }}>
                    {m.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Entries */}
          {selectedDayKey && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-2">{fmtDate(selectedDayKey)}</h3>
                {dayEntries.length === 0 ? (
                  <p>No entries for this date.</p>
                ) : (
                  dayEntries.map((e) => (
                    <div key={e.id} className="border-b pb-2 mb-2">
                      <p className="text-xs text-gray-500">{e.section}</p>
                      <p className="text-sm">
                        Mood {e.mood}/10 ({moodLabel(e.mood)})
                      </p>
                      <p className="mt-2 font-medium">{e.question}</p>
                      <p className="mt-1 whitespace-pre-wrap">{e.entry}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {view === "summary" && (
        <Card>
          <CardContent>
            <SummaryPanel entries={entries} darkMode={dark} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
