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
const toDateKey = (d) => new Date(d).toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso).toLocaleDateString();

function moodLabel(m) {
  if (m <= 3) return "😞 Sad / Low";
  if (m <= 6) return "😐 Neutral";
  if (m <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}
function moodToColor(mood) {
  if (mood == null) return "#e5e7eb";
  const t = Math.max(0, Math.min(10, mood)) / 10;
  let from, to, p;
  if (t < 0.5) {
    from = [239, 68, 68]; // red
    to = [245, 158, 11]; // amber
    p = t / 0.5;
  } else {
    from = [245, 158, 11];
    to = [22, 163, 74]; // green
    p = (t - 0.5) / 0.5;
  }
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * p));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---- Component ---- */
export default function App() {
  const [view, setView] = useState("journal");
  const [dark, setDark] = useState(false);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  /* Load / persist */
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);
  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  /* Save entry */
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
    };
    setEntries((p) => [...p, e]);
    setEntry(""); setQuestion(""); setMood(5);
  };

  /* Group entries by day */
  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      const k = toDateKey(e.iso || e.date);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return m;
  }, [entries]);

  const { weeks, monthLabels } = useMemo(() => buildYearMatrix(byDay), [byDay]);
  const recent3 = useMemo(() => [...entries].sort((a,b)=>new Date(b.iso)-new Date(a.iso)).slice(0,3), [entries]);
  const dayEntries = useMemo(() => byDay.get(selectedDayKey) || [], [byDay, selectedDayKey]);

  /* UI */
  return (
    <div className={`min-h-screen p-6 max-w-3xl mx-auto ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button variant="outline" onClick={()=>{
          const next=!dark;setDark(next);localStorage.setItem("gj_theme",next?"dark":"light");
        }}>{dark?"☀️ Light":"🌙 Dark"}</Button>
      </header>

      <p className="text-center text-gray-500">Save short reflections daily. Track mood & insights weekly.</p>
      <p className="italic text-center text-green-600 mb-4">“{quote}”</p>

      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view==="journal"?"default":"outline"} onClick={()=>setView("journal")}>✍️ Journal</Button>
        <Button variant={view==="past"?"default":"outline"} onClick={()=>setView("past")}>🕊 Past Entries</Button>
        <Button variant={view==="summary"?"default":"outline"} onClick={()=>setView("summary")}>📊 Summary</Button>
      </div>

      {/* Journal form */}
      {view==="journal" && (
        <Card>
          <CardContent className="space-y-4">
            <Select value={section} onChange={(v)=>{setSection(v);setQuestion("");}} options={Object.keys(sections)} />
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

      {/* Past entries & Matrix */}
      {view==="past" && (
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-2">Recent</h3>
              {recent3.length===0?<p>No entries yet.</p>:recent3.map((e)=>(
                <div key={e.id} className="border p-2 mb-2 rounded-md">
                  <div className="text-xs text-gray-500">{fmtDate(e.iso)} — {e.section}</div>
                  <div className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</div>
                  <div className="text-sm font-medium">{e.question}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 12-month horizontal matrix */}
          <div className="rounded-xl border p-3">
            <div className="flex justify-between mb-2">
              <h3 className="font-semibold">Rolling 12-month Journal Matrix</h3>
              <span className="text-xs text-gray-500">{fmtDate(new Date(new Date().setDate(new Date().getDate()-364)))} → {fmtDate(new Date().toISOString())}</span>
            </div>

            <div className="year-matrix">
              {weeks.map((week,wi)=>(
                <div key={wi} className="year-week">
                  {week.map((cell)=>(
                    <div
                      key={cell.key}
                      className={`year-cell ${cell.key===selectedDayKey?"year-cell-selected":""}`}
                      style={{background: cell.stat?moodToColor(cell.stat.avgMood):"#f3f4f6"}}
                      title={`${cell.label}: ${cell.stat?`${cell.stat.count} entr${cell.stat.count>1?"ies":"y"}, avg mood ${cell.stat.avgMood.toFixed(1)}`:"No entry"}`}
                      onClick={()=>setSelectedDayKey(cell.key)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="year-month-labels">
              {monthLabels.map(m=><span key={m.key} style={{transform:`translateX(${m.offsetPx}px)`}}>{m.label}</span>)}
            </div>
          </div>

          {selectedDayKey && (
            <Card>
              <CardContent>
                <h3 className="font-semibold mb-2">{fmtDate(selectedDayKey)}</h3>
                {dayEntries.length===0?<p>No entries for this day.</p>:dayEntries.map(e=>(
                  <div key={e.id} className="border p-2 mb-2 rounded-md">
                    <p className="text-sm text-gray-500">{e.section}</p>
                    <p className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</p>
                    <p className="font-medium">{e.question}</p>
                    <p className="text-sm whitespace-pre-wrap">{e.entry}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {view==="summary" && (
        <Card>
          <CardContent>
            <SummaryPanel entries={entries} darkMode={dark} />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced to browser storage</div>
        <InstallPrompt/>
      </div>
      <div className="text-center mt-3">
        <GoogleSync dataToSync={{entries}}/>
      </div>
    </div>
  );
}

/* ---- Build rolling matrix (52w × 7d) ---- */
function buildYearMatrix(dayMap) {
  const end = new Date();
  const endKey = toDateKey(end);
  const endDate = new Date(endKey);
  const start = new Date(endDate);
  start.setDate(start.getDate() - 7*52 + 1);
  const shift = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - shift);

  const weeks=[],monthAnchors=[];
  let cur=new Date(start);
  for(let w=0;w<52;w++){
    const column=[];
    for(let d=0;d<7;d++){
      const key=toDateKey(cur);
      const label=cur.toLocaleDateString();
      const items=dayMap.get(key)||[];
      const stat=items.length?{count:items.length,avgMood:items.reduce((a,e)=>a+(e.mood||0),0)/items.length}:null;
      column.push({key,label,stat});
      if(cur.getDate()===1)monthAnchors.push({key,date:new Date(cur),col:w});
      cur.setDate(cur.getDate()+1);
    }
    weeks.push(column);
  }
  const MONTHS=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const monthLabels=monthAnchors.map(a=>({key:a.key,label:MONTHS[a.date.getMonth()],offsetPx:a.col*15}));
  return {weeks,monthLabels};
}
