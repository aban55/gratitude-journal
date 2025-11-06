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

/* Intro + quotes */
const QUOTES = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

/* Sections & prompts */
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

/* Helpers */
function moodLabel(mood) {
  if (mood <= 3) return "😞 Sad / Low";
  if (mood <= 6) return "😐 Neutral";
  if (mood <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}
function analyzeSentiment(text, mood) {
  const pos = ["happy", "joy", "grateful", "calm", "love", "hope", "thankful", "peace"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset"];
  let s = 0; const t = text.toLowerCase();
  pos.forEach(w => t.includes(w) && (s += 1));
  neg.forEach(w => t.includes(w) && (s -= 1));
  if (mood >= 7) s += 1;
  if (mood <= 3) s -= 1;
  if (s > 1) return "😊 Positive";
  if (s === 1) return "🙂 Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed";
}
const toDateKey = (d) => {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).toISOString().slice(0,10);
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString();

/* ------------ Component ------------ */
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

  // calendar tab
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  /* Load from local */
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);

  /* Persist to local */
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
      section, question, entry, mood,
      sentiment: analyzeSentiment(entry, mood),
    };
    setEntries(prev => [...prev, e]);
    setEntry(""); setQuestion(""); setMood(5);
    // if we're on Past tab (calendar), keep selection in sync to today:
    setSelectedDayKey(toDateKey(e.iso));
  };

  /* Delete */
  const handleDelete = (id) => setEntries(arr => arr.filter(e => e.id !== id));

  /* Edit */
  const openEdit = (item) => { setEditing(item); setEditText(item.entry); setEditMood(item.mood); };
  const saveEdit = () => {
    if (!editing) return;
    const sentiment = analyzeSentiment(editText, editMood);
    setEntries(arr => arr.map(e => e.id === editing.id ? { ...e, entry: editText, mood: editMood, sentiment } : e));
    setEditing(null);
  };

  /* Exporters */
  const exportTxt = () => {
    const content = entries.map(e =>
      `${fmtDate(e.iso||e.date)}\nSection: ${e.section}\nMood: ${e.mood}/10 (${e.sentiment})\nQ: ${e.question}\nA: ${e.entry}\n`
    ).join("\n----------------\n");
    triggerDownload(new Blob([content], { type: "text/plain" }), "Gratitude_Journal.txt");
  };
  const exportCsv = () => {
    const header = ["Date","Section","Mood","Sentiment","Question","Entry"];
    const rows = entries.map(e => [
      `"${fmtDate(e.iso||e.date)}"`,
      `"${e.section}"`,
      e.mood,
      `"${e.sentiment}"`,
      `"${e.question}"`,
      `"${e.entry.replace(/"/g,'""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map(r=>r.join(","))].join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv" }), "Gratitude_Journal.csv");
  };
  const exportJournalPDF = async () => {
    // Cover page + month grouping
    const pdf = new jsPDF("p","pt","a4");
    const pageH = pdf.internal.pageSize.height;
    const marginX = 56, marginY = 64, lineH = 18;

    // Cover
    pdf.setFont("Times","bold"); pdf.setFontSize(22);
    pdf.text("🌿 My Gratitude Journal", marginX, marginY);
    pdf.setFont("Times","normal"); pdf.setFontSize(12);
    pdf.text(`Exported on ${new Date().toLocaleString()}`, marginX, marginY+26);
    pdf.text(`Total entries: ${entries.length}`, marginX, marginY+44);
    pdf.text(`Average mood (last 7): ${avgLastN(entries,7).toFixed(1)}/10`, marginX, marginY+62);
    pdf.addPage();

    // Group by YYYY-MM
    const byMonth = new Map();
    const sorted = [...entries].sort((a,b)=>new Date(a.iso)-new Date(b.iso));
    for (const e of sorted) {
      const d = new Date(e.iso || e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(e);
    }

    for (const [mon, list] of byMonth.entries()) {
      let y = marginY;
      pdf.setFont("Times","bold"); pdf.setFontSize(16);
      const title = new Date(`${mon}-01T00:00:00`).toLocaleString(undefined,{month:"long",year:"numeric"});
      pdf.text(title, marginX, y); y += 24;

      pdf.setFont("Times","normal"); pdf.setFontSize(12);
      for (const e of list) {
        if (y > pageH - 120) { pdf.addPage(); y = marginY; }
        pdf.setTextColor(34,139,34); // green-ish date
        pdf.text(fmtDate(e.iso||e.date), marginX, y); y += lineH;
        pdf.setTextColor(0,0,0);
        pdf.text(`Section: ${e.section}`, marginX, y); y += lineH;
        pdf.text(`Mood: ${e.mood}/10  |  ${e.sentiment}`, marginX, y); y += lineH;
        pdf.setFont("Times","bold"); pdf.text(`Q: ${e.question}`, marginX, y); y += lineH;
        pdf.setFont("Times","normal");
        const lines = pdf.splitTextToSize(e.entry, 520);
        pdf.text(lines, marginX, y); y += lines.length*lineH + 14;
      }
      pdf.addPage();
    }
    pdf.save(`Gratitude_Journal_${new Date().toISOString().slice(0,10)}.pdf`);
  };
  const triggerDownload = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  };
  const avgLastN = (arr,n) => {
    if (!arr.length) return 0;
    const last = arr.slice(-n);
    return last.reduce((a,e)=>a+(e.mood||0),0)/last.length;
  };

  /* Drive -> local merge (kept; de-dup by id) */
  const handleRestore = (restored) => {
    if (!restored?.entries) return;
    const incoming = restored.entries;
    const map = new Map(entries.map(e=>[e.id,e]));
    for (const e of incoming) map.set(e.id, { ...map.get(e.id), ...e });
    const merged = Array.from(map.values()).sort((a,b)=>(a.id||0)-(b.id||0));
    setEntries(merged);
  };

  /* ------- Calendar Past Tab ------- */
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const key = toDateKey(e.iso || e.date);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(e);
    }
    return m;
  }, [entries]);

  const monthMatrix = useMemo(() => {
    // Build a 6 x 7 matrix for current calendarMonth
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-start
    const start = new Date(first); start.setDate(first.getDate() - startOffset);
    const cells = [];
    for (let i=0;i<42;i++) {
      const d = new Date(start); d.setDate(start.getDate()+i);
      const key = toDateKey(d);
      const inMonth = d.getMonth() === calendarMonth.getMonth();
      const items = byDay.get(key) || [];
      // compute avg mood
      const avgMood = items.length ? (items.reduce((a,e)=>a+(e.mood||0),0)/items.length) : null;
      cells.push({ date: d, key, inMonth, count: items.length, avgMood });
    }
    return cells;
  }, [calendarMonth, byDay]);

  const recent3 = useMemo(() => {
    return [...entries].sort((a,b)=>new Date(b.iso)-new Date(a.iso)).slice(0,3);
  }, [entries]);

  const selectTodayIfEmpty = () => {
    if (!selectedDayKey) setSelectedDayKey(toDateKey(new Date()));
  };
  useEffect(() => { if (view === "past") selectTodayIfEmpty(); }, [view]); // ensure default selection on tab open

  const dayEntries = useMemo(() => byDay.get(selectedDayKey) || [], [byDay, selectedDayKey]);

  /* ---------- UI ---------- */
  return (
    <div className={`min-h-screen p-6 max-w-3xl mx-auto app-fade ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <header className="flex justify-between items-center mb-1">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button
          variant="outline"
          onClick={() => {
            const next = !dark; setDark(next);
            localStorage.setItem("gj_theme", next ? "dark" : "light");
          }}
        >
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

      {/* JOURNAL */}
      {view === "journal" && (
        <Card>
          <CardContent className="space-y-4">
            <Select value={section} onChange={(v)=>{ setSection(v); setQuestion(""); }} options={Object.keys(sections)} />
            <Select value={question} onChange={setQuestion} options={["", ...sections[section]]} placeholder="Pick a question" />
            {question && (
              <>
                <Textarea placeholder="Write your reflection..." value={entry} onChange={(e)=>setEntry(e.target.value)} />
                <div>
                  <p className="text-sm">Mood: {mood}/10 ({moodLabel(mood)})</p>
                  <Slider min={1} max={10} step={1} value={[mood]} onChange={(v)=>setMood(v[0])} />
                </div>
                <Button onClick={handleSave}>Save Entry</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAST — Month calendar + parchment day page */}
      {view === "past" && (
        <div className="space-y-4">
          {/* Top: last 3 entries quick access */}
          <Card className="card-hover">
            <CardContent>
              <h3 className="font-semibold mb-2">Recent</h3>
              {recent3.length === 0 ? (
                <p className="text-sm text-gray-500">No entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent3.map(e => (
                    <div key={e.id} className="flex items-start justify-between rounded-lg border p-2">
                      <div>
                        <div className="text-xs text-gray-500">{fmtDate(e.iso||e.date)} — {e.section}</div>
                        <div className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</div>
                        <div className="text-sm font-medium">{e.question}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={()=>{setSelectedDayKey(toDateKey(e.iso));}}>Open</Button>
                        <Button variant="outline" onClick={()=>openEdit(e)}>Edit</Button>
                        <Button variant="outline" onClick={()=>handleDelete(e.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar controls */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))}>← Prev</Button>
              <Button variant="outline" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))}>Next →</Button>
            </div>
            <div className="font-semibold">
              {calendarMonth.toLocaleString(undefined, { month:"long", year:"numeric" })}
            </div>
            <div />
          </div>

          {/* Calendar grid */}
          <div className="calendar-grid">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="calendar-head">{d}</div>
            ))}
            {monthMatrix.map(({date,key,inMonth,count,avgMood}) => {
              const isSel = key === selectedDayKey;
              const moodColor = avgMood == null ? undefined : moodToColor(avgMood);
              return (
                <button
                  key={key}
                  className={`calendar-day ${inMonth ? "" : "calendar-dim"} ${isSel ? "calendar-selected":""}`}
                  style={moodColor ? { background: moodColor } : undefined}
                  onClick={()=>setSelectedDayKey(key)}
                  title={`${date.toDateString()} — ${count} entry${count===1?"":"ies"}`}
                >
                  <span className="calendar-date-num">{date.getDate()}</span>
                  {count > 0 && <span className="calendar-dot" />}
                </button>
              );
            })}
          </div>

          {/* Selected day page */}
          <section className={`journal-page ${dark ? "" : "parchment-bg"}`}>
            <div className="journal-page-inner">
              <div className="flex items-center justify-between">
                <h3 className="journal-date">{selectedDayKey ? fmtDate(selectedDayKey) : "Select a day"}</h3>
                <div className="flex gap-2">
                  <Button onClick={exportJournalPDF}>📘 PDF</Button>
                  <Button variant="outline" onClick={exportTxt}>TXT</Button>
                  <Button variant="outline" onClick={exportCsv}>CSV</Button>
                </div>
              </div>

              {dayEntries.length === 0 ? (
                <p className="text-sm text-gray-500">No entries for this day.</p>
              ) : (
                <div className="space-y-4">
                  {dayEntries.map(e => (
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
                          <Button variant="outline" onClick={()=>openEdit(e)}>Edit</Button>
                          <Button variant="outline" onClick={()=>handleDelete(e.id)}>Delete</Button>
                        </div>
                      </div>
                      <p className="mt-2 font-medium">{e.question}</p>
                      <p className="mt-1 whitespace-pre-wrap">{e.entry}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
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
            <Textarea value={editText} onChange={(e)=>setEditText(e.target.value)} />
            <div>
              <p className="text-sm">Mood: {editMood}/10 ({moodLabel(editMood)})</p>
              <Slider min={1} max={10} value={[editMood]} onChange={(v)=>setEditMood(v[0])} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button>
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

/* ---- helpers ---- */
function moodToColor(mood){
  // red(#ef4444) → yellow(#f59e0b) → green(#16a34a)
  const clamp = Math.max(0, Math.min(10, mood)) / 10;
  let from,to,p;
  if (clamp < 0.5){ from=[239,68,68]; to=[245,158,11]; p=clamp/0.5; }
  else { from=[245,158,11]; to=[22,163,74]; p=(clamp-0.5)/0.5; }
  const c = from.map((f,i)=>Math.round(f + (to[i]-f)*p));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
