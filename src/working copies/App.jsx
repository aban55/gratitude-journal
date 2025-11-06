import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import SummaryPanel from "./SummaryPanel.jsx";
import jsPDF from "jspdf";

// 🌿 Intro blurb + quote pool
const QUOTES = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

// 🌻 Sections & prompts (kept + compact)
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
    "What challenge taught me something valuable?",
    "What habit am I proud of maintaining?",
    "How have I improved compared to last month?",
  ],
  "Blessings & Privileges": [
  "What everyday comfort (home, electricity, clean water, AC, internet) made my day easier today?",
  "Which piece of technology or tool saved me time or effort today?",
  "What part of my education or skills helped me solve something today?",
  "When did my health, body, or mind serve me well today?",
  "Who are the people whose support or safety net I can rely on?",
  "What opportunities are available to me that I sometimes take for granted?",
  "Which books, teachers, or mentors shaped me — how did that show up today?",
  "What financial stability or resources quietly reduced stress for me today?",
  "Which safe spaces (home, neighbourhood, workplace, campus) allowed me to focus or rest?",
  "What nourishing food or simple meal did I enjoy — and why did it feel good?",
  "What privilege can I use this week to help someone else?",
  "If I lost one convenience for a week, which would I miss most — and why am I grateful for it today?"
],
  "Nature & Calm": [
    "What part of my home brings me peace or comfort?",
    "What small thing in nature caught my attention today — light, wind, birds, sky, trees?",
    "What simple pleasure did I enjoy — food, music, warmth, quiet?",
    "What modern convenience or tool makes life smoother?",
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
  "Perspective & Hope": [
    "What opportunity am I grateful to have that others may not?",
    "What am I looking forward to in the coming week?",
    "Who or what reminds me that life is bigger than my worries?",
    "How has a tough time in my life shaped who I am today?",
    "What am I thankful for that I usually take for granted?",
  ],
};

// Helpers
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

  // Drive -> local merge (kept)
  const handleRestore = (restored) => {
    if (!restored?.entries) return;
    const incoming = restored.entries;
    const map = new Map(entries.map((e) => [e.id, e]));
    for (const e of incoming) map.set(e.id, { ...map.get(e.id), ...e });
    const merged = Array.from(map.values()).sort((a, b) => (a.id || 0) - (b.id || 0));
    setEntries(merged);
  };

  // -------- Past Entries: horizontal pages --------
  const pages = useMemo(() => {
    const grouped = groupByDate(entries);
    // newest date first
    const ordered = Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((d) => ({ dateKey: d, items: grouped[d] }));
    return ordered;
  }, [entries]);

  const scrollerRef = useRef(null);
  const pageRefs = useRef({}); // key -> ref
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    // snap to first page on entering tab
    if (view === "past" && pages.length && scrollerRef.current) {
      const k = pages[pageIndex]?.dateKey;
      if (k && pageRefs.current[k]) {
        pageRefs.current[k].scrollIntoView({ behavior: "instant", inline: "start" });
      }
    }
  }, [view]); // eslint-disable-line

  const gotoPage = (i) => {
    if (!pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, i));
    setPageIndex(clamped);
    const k = pages[clamped].dateKey;
    pageRefs.current[k]?.scrollIntoView({ behavior: "smooth", inline: "start" });
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

      {/* PAST — horizontal pages with parchment */}
      {view === "past" && (
        <div className="space-y-3">
          {pages.length === 0 ? (
            <Card><CardContent>No entries yet.</CardContent></Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {pageIndex + 1} / {pages.length}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => gotoPage(pageIndex - 1)}>⬅️ Prev</Button>
                  <Button variant="outline" onClick={() => gotoPage(pageIndex + 1)}>Next ➡️</Button>
                  <Button onClick={exportJournalPDF}>📘 Export PDF</Button>
                  <Button variant="outline" onClick={exportTxt}>Export TXT</Button>
                  <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
                </div>
              </div>

              <div
                ref={scrollerRef}
                className={`journal-swiper ${dark ? "" : "parchment-bg"}`}
              >
                {pages.map(({ dateKey, items }) => (
                  <section
                    key={dateKey}
                    ref={(el) => (pageRefs.current[dateKey] = el)}
                    className="journal-page"
                  >
                    <div className="journal-page-inner">
                      <h3 className="journal-date">{dateKey}</h3>
                      <div className="space-y-4">
                        {items.map((e) => (
                          <div key={e.id} className="journal-entry">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-xs text-gray-500">
                                  {new Date(e.iso || e.date).toLocaleTimeString()} — {e.section}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}
                                </p>
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
              <div className="text-center text-xs text-gray-500">
                Tip: swipe horizontally (trackpad / touch) to flip pages.
              </div>
            </>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {view === "summary" && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-semibold">Weekly Summary</h2>
            <SummaryPanel entries={entries} darkMode={dark} onExportPDF={exportJournalPDF} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportTxt}>Export .TXT</Button>
              <Button variant="outline" onClick={exportCsv}>Export .CSV</Button>
              <Button onClick={exportJournalPDF}>Export .PDF</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[90%] max-w-md space-y-4">
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

      {/* Drive Sync + Install */}
      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced to browser storage</div>
        <InstallPrompt />
      </div>
      <div className="text-center mt-3">
        <GoogleSync dataToSync={{ entries }} onRestore={handleRestore} />
      </div>
    </div>
  );
}

// ------- helpers -------
function groupByDate(list) {
  const out = {};
  for (const e of list) {
    const key = toDateKey(e.iso || e.date);
    (out[key] ||= []).push(e);
  }
  return out;
}
