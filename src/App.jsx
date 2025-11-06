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

// ---------- Helpers (unchanged spirit, safe) ----------
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
  const t = (text || "").toLowerCase();
  pos.forEach((w) => t.includes(w) && (s += 1));
  neg.forEach((w) => t.includes(w) && (s -= 1));
  if (mood >= 7) s++;
  if (mood <= 3) s--;
  if (s > 1) return "😊 Positive";
  if (s === 1) return "🙂 Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed";
}
/**
 * Your file already groups by calendar day via a *locale* string key.
 * Keep that to avoid changing storage. We’ll use the same for the matrix.
 */
const toDateKey = (isoOrDate) => {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const atMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // locale key (same as your clean file)
  return atMidnight.toLocaleDateString();
};
function fmtShort(isoOrDate) {
  const d = new Date(isoOrDate);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
/** Smooth red→amber→green scale for mood; gray for no data */
function moodToColor(mood) {
  if (mood == null) return "#f3f4f6";
  const t = Math.max(0, Math.min(10, mood)) / 10;
  let from, to, p;
  if (t < 0.5) {
    from = [239, 68, 68];  // red-500
    to = [245, 158, 11];   // amber-500
    p = t / 0.5;
  } else {
    from = [245, 158, 11]; // amber-500
    to = [22, 163, 74];    // green-600
    p = (t - 0.5) / 0.5;
  }
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * p));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
/** Frequency blue scale for alternative heatmap mode */
function freqToColor(count) {
  if (!count) return "#f3f4f6";
  const capped = Math.min(count, 5) / 5; // cap at 5 entries/day
  const start = [191, 219, 254]; // blue-200
  const end = [30, 64, 175];     // blue-900
  const mix = start.map((s, i) => Math.round(s + (end[i] - s) * capped));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}
function groupByDate(list) {
  const out = {};
  for (const e of list) {
    const key = toDateKey(e.iso || e.date);
    (out[key] ||= []).push(e);
  }
  return out;
}

// ---------- NEW: 12-month (52×7) matrix builder ----------
function buildYearMatrix(byDayMap, mode = "mood") {
  // end at today (normalized); start at 52 weeks earlier, then align to Monday
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 7 * 52 + 1);
  const shift = (start.getDay() + 6) % 7; // Mon=0
  start.setDate(start.getDate() - shift);

  const weeks = [];
  const monthAnchors = [];
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  const cur = new Date(start);
  for (let w = 0; w < 52; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKey(cur);
      const items = byDayMap.get(key) || [];
      const avgMood = items.length
        ? items.reduce((a, e) => a + (e.mood || 0), 0) / items.length
        : null;

      const color =
        items.length === 0
          ? "#f3f4f6"
          : mode === "frequency"
          ? freqToColor(items.length)
          : moodToColor(avgMood);

      const title =
        items.length === 0
          ? `${cur.toLocaleDateString()}\nNo entries`
          : `${cur.toLocaleDateString()}\n${items.length} entr${items.length === 1 ? "y" : "ies"}${
              avgMood != null ? `, avg mood ${avgMood.toFixed(1)}` : ""
            }`;

      col.push({
        key, color, title,
        isToday:
          cur.getFullYear() === end.getFullYear() &&
          cur.getMonth() === end.getMonth() &&
          cur.getDate() === end.getDate(),
      });

      if (cur.getDate() === 1) {
        monthAnchors.push({ key, date: new Date(cur), col: w });
      }
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(col);
  }

  const monthLabels = monthAnchors.map((a) => ({
    key: a.key,
    label: MONTHS[a.date.getMonth()],
    offsetPx: a.col * (13 + 2), // 13px cell + 2px gap (match your CSS)
  }));

  return { weeks, monthLabels };
}

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

  // NEW: heatmap mode toggle
  const [heatmapMode, setHeatmapMode] = useState("mood"); // 'mood' | 'frequency'

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
    const marginX = 40, marginY = 60, lineH = 20;
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

  // Past: pages (kept)
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

  // NEW: data map + matrix
  const byDayMap = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const k = toDateKey(e.iso || e.date);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  }, [entries]);
  const { weeks, monthLabels } = useMemo(
    () => buildYearMatrix(byDayMap, heatmapMode),
    [byDayMap, heatmapMode]
  );

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

      {/* PAST — matrix + horizontal pages */}
      {view === "past" && (
        <div className="space-y-4">
          {/* NEW: Rolling 12-Month Matrix */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Rolling 12-Month Journal Matrix</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span>Color by:</span>
                  <Button
                    variant={heatmapMode === "mood" ? "default" : "outline"}
                    onClick={() => setHeatmapMode("mood")}
                  >
                    Mood
                  </Button>
                  <Button
                    variant={heatmapMode === "frequency" ? "default" : "outline"}
                    onClick={() => setHeatmapMode("frequency")}
                  >
                    Frequency
                  </Button>
                </div>
              </div>

              <div className="year-matrix">
                {weeks.map((week, wi) => (
                  <div key={wi} className="year-week">
                    {week.map((cell, ci) => (
                      <button
                        key={`${wi}-${ci}-${cell.key}`}
                        title={cell.title}
                        className={`year-cell ${cell.isToday ? "year-today" : ""}`}
                        style={{ background: cell.color }}
                        onClick={() => {
                          if (!cell.key) return;
                          // scroll to that page if it exists
                          const pagesIdx = pages.findIndex((p) => p.dateKey === cell.key);
                          if (pagesIdx >= 0) gotoPage(pagesIdx);
                        }}
                      />
                    ))}
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

              <div className="year-legend">
                <span>Low</span>
                <span className="box low" />
                <span>Mid</span>
                <span className="box mid" />
                <span>High</span>
                <span className="box high" />
              </div>
            </CardContent>
          </Card>

          {/* Horizontal journal pages (kept) */}
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
