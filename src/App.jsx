import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import SummaryPanel from "./SummaryPanel.jsx";

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

/* ---- Robust Date Helpers ---- */
function parseDate(src) {
  if (!src) return null;
  if (src instanceof Date) return isNaN(src) ? null : src;
  if (typeof src === "number") {
    const d = new Date(src);
    return isNaN(d) ? null : d;
  }
  const d1 = new Date(src);
  if (!isNaN(d1)) return d1;

  const parts = String(src).trim().split(/[\s,/-]+/).map(Number);
  if (parts.length >= 3) {
    const [a, b, c] = parts;
    const y = c > 31 ? c : parts[2];
    const m = a > 12 ? b - 1 : a - 1;
    const day = a > 12 ? a : b;
    const d2 = new Date(y, m, day);
    return isNaN(d2) ? null : d2;
  }
  return null;
}

const toDateKey = (d) => {
  const dt = parseDate(d);
  if (!dt) return "";
  const utc = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  return utc.toISOString().slice(0, 10); // YYYY-MM-DD
};

const fmtDate = (src) => {
  const d = parseDate(src);
  return d
    ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : "Invalid Date";
};

function moodLabel(m) {
  if (m <= 3) return "😞 Sad / Low";
  if (m <= 6) return "😐 Neutral";
  if (m <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}
function analyzeSentiment(text, mood) {
  const pos = ["happy","joy","grateful","calm","love","hope","thankful","peace"];
  const neg = ["tired","sad","angry","stressed","worried","upset"];
  let s = 0; const t = (text || "").toLowerCase();
  pos.forEach((w)=>t.includes(w)&&(s+=1));
  neg.forEach((w)=>t.includes(w)&&(s-=1));
  if (mood>=7) s+=1; if (mood<=3) s-=1;
  if (s>1) return "😊 Positive";
  if (s===1) return "🙂 Content";
  if (s===0) return "😐 Neutral";
  return "😟 Stressed";
}
function moodToColor(mood){
  if(mood==null) return "#f3f4f6"; // light gray = no entries
  const t=Math.max(0,Math.min(10,mood))/10;
  let from,to,p;
  if(t<0.5){from=[239,68,68];to=[245,158,11];p=t/0.5;}     // red -> amber
  else{from=[245,158,11];to=[22,163,74];p=(t-0.5)/0.5;}    // amber -> green
  const c=from.map((f,i)=>Math.round(f+(to[i]-f)*p));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ===== Rolling 12-Month Matrix Builder ===== */
function buildYearMatrix(dayMap){
  // end = today (normalized), start = 364 days before → align to Monday start
  const end=new Date();
  const endKey=toDateKey(end);
  const endDate=parseDate(endKey); // normalize to midnight
  const start=new Date(endDate);
  start.setDate(start.getDate()-364);
  const shift=(start.getDay()+6)%7; // Monday=0
  start.setDate(start.getDate()-shift);

  const weeks=[]; const anchors=[]; const cur=new Date(start);
  const MONTHS=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

  for(let w=0;w<52;w++){
    const col=[];
    for(let d=0;d<7;d++){
      const key=toDateKey(cur);
      const label=cur.toLocaleDateString();
      const items=dayMap.get(key)||[];
      const stat=items.length
        ? {count:items.length,avgMood:items.reduce((a,e)=>a+(e.mood||0),0)/items.length}
        : null;

      const isToday =
        cur.getFullYear()===endDate.getFullYear() &&
        cur.getMonth()===endDate.getMonth() &&
        cur.getDate()===endDate.getDate();

      col.push({key,label,stat,isToday});
      if(cur.getDate()===1) anchors.push({key,date:new Date(cur),col:w});
      cur.setDate(cur.getDate()+1);
    }
    weeks.push(col);
  }
  const monthLabels=anchors.map(a=>({key:a.key,label:MONTHS[a.date.getMonth()],offsetPx:a.col*(13+2)}));
  return {weeks,monthLabels};
}

/* ===== App ===== */
export default function App(){
  const [view,setView]=useState("journal");
  const [dark,setDark]=useState(false);
  const [quote]=useState(QUOTES[Math.floor(Math.random()*QUOTES.length)]);
  const [section,setSection]=useState(Object.keys(sections)[0]);
  const [question,setQuestion]=useState("");
  const [entry,setEntry]=useState("");
  const [mood,setMood]=useState(5);
  const [entries,setEntries]=useState([]);
  const [editing,setEditing]=useState(null);
  const [editText,setEditText]=useState("");
  const [editMood,setEditMood]=useState(5);
  const [selectedDayKey,setSelectedDayKey]=useState(null);

  /* Load & persist */
  useEffect(()=>{
    const s=localStorage.getItem("gratitudeEntries");
    if(s){
      try{ setEntries(JSON.parse(s)); }catch{ /* ignore */ }
    }
    const th=localStorage.getItem("gj_theme");
    if(th) setDark(th==="dark");
  },[]);
  useEffect(()=>{
    localStorage.setItem("gratitudeEntries",JSON.stringify(entries));
  },[entries]);

  /* Save new entry */
  const handleSave=()=>{
    if(!entry.trim()||!question) return;
    const now=new Date();
    const e={
      id:now.getTime(),
      date:now.toLocaleString(),
      iso:now.toISOString(),
      section,question,entry,mood,
      sentiment:analyzeSentiment(entry,mood)
    };
    setEntries(p=>[...p,e]);
    setEntry("");setQuestion("");setMood(5);
    setSelectedDayKey(toDateKey(e.iso));
  };

  /* Edit / Delete */
  const handleDelete=(id)=>setEntries(a=>a.filter(e=>e.id!==id));
  const openEdit=(i)=>{setEditing(i);setEditText(i.entry);setEditMood(i.mood);};
  const saveEdit=()=>{
    if(!editing) return;
    const snt=analyzeSentiment(editText,editMood);
    setEntries(a=>a.map(e=>e.id===editing.id?{...e,entry:editText,mood:editMood,sentiment:snt}:e));
    setEditing(null);
  };

  /* Restore (Drive import merges, not overwrites) */
  const handleRestore=(r)=>{
    const incoming = Array.isArray(r?.entries)? r.entries : [];
    if(!incoming.length) return;
    const map=new Map(entries.map(e=>[e.id,e]));
    for(const e of incoming){
      if(!e?.id) continue;
      map.set(e.id,{...map.get(e.id),...e});
    }
    setEntries(Array.from(map.values()).sort((a,b)=>(a.id||0)-(b.id||0)));
  };

  /* ---- Matrix + Data Grouping ---- */
  const byDay=useMemo(()=>{
    const m=new Map();
    for(const e of entries){
      const k=toDateKey(e.iso||e.date);
      if(!k) continue;
      if(!m.has(k)) m.set(k,[]);
      m.get(k).push(e);
    }
    return m;
  },[entries]);

  const {weeks,monthLabels}=useMemo(()=>buildYearMatrix(byDay),[byDay]);

  const recent3=useMemo(
    ()=>[...entries].sort((a,b)=>new Date(b.iso||b.date)-new Date(a.iso||a.date)).slice(0,3),
    [entries]
  );
  const dayEntries=useMemo(()=>byDay.get(selectedDayKey)||[],[byDay,selectedDayKey]);

  /* ---------- UI ---------- */
  return(
  <div className={`min-h-screen p-6 max-w-3xl mx-auto ${dark?"bg-gray-900 text-gray-100":"bg-gray-50 text-gray-900"}`}>
    <header className="flex justify-between items-center mb-1">
      <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
      <Button variant="outline" onClick={()=>{const n=!dark;setDark(n);localStorage.setItem("gj_theme",n?"dark":"light");}}>
        {dark?"☀️ Light":"🌙 Dark"}
      </Button>
    </header>

    <p className="text-center text-gray-500 mb-4 italic">“{quote}”</p>

    {/* Tabs */}
    <div className="flex justify-center gap-2 mb-4">
      <Button variant={view==="journal"?"default":"outline"} onClick={()=>setView("journal")}>✍️ Journal</Button>
      <Button variant={view==="past"?"default":"outline"} onClick={()=>{
        setView("past");
        if(!selectedDayKey) setSelectedDayKey(toDateKey(new Date()));
      }}>🕊 Past Entries</Button>
      <Button variant={view==="summary"?"default":"outline"} onClick={()=>setView("summary")}>📊 Summary</Button>
    </div>

    {/* JOURNAL */}
    {view==="journal"&&(
      <Card><CardContent className="space-y-4">
        <Select value={section} onChange={(v)=>{setSection(v);setQuestion("");}} options={Object.keys(sections)} />
        <Select value={question} onChange={setQuestion} options={["",...sections[section]]} placeholder="Pick a question"/>
        {question&&<>
          <Textarea placeholder="Write your reflection..." value={entry} onChange={(e)=>setEntry(e.target.value)} />
          <div><p className="text-sm">Mood: {mood}/10 ({moodLabel(mood)})</p>
          <Slider min={1} max={10} value={[mood]} onChange={(v)=>setMood(v[0])}/></div>
          <Button onClick={handleSave}>Save Entry</Button>
        </>}
      </CardContent></Card>
    )}

    {/* PAST */}
    {view==="past"&&(
      <div className="space-y-4">
        {/* Recent 3 */}
        <Card><CardContent>
          <h3 className="font-semibold mb-2">Recent</h3>
          {recent3.length===0?<p className="text-sm text-gray-500">No entries yet.</p>:
          <div className="space-y-2">
            {recent3.map(e=>(
              <div key={e.id} className="flex justify-between border p-2 rounded">
                <div>
                  <div className="text-xs text-gray-500">{fmtDate(e.iso||e.date)} — {e.section}</div>
                  <div className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</div>
                  <div className="text-sm font-medium">{e.question}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={()=>setSelectedDayKey(toDateKey(e.iso||e.date))}>Open</Button>
                  <Button variant="outline" onClick={()=>openEdit(e)}>Edit</Button>
                  <Button variant="outline" onClick={()=>handleDelete(e.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>}
        </CardContent></Card>

        {/* Matrix */}
        <div className="rounded-xl border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Rolling 12-month Journal Matrix</h3>
            <div className="text-xs text-gray-500">
              {fmtDate(toDateKey(new Date(new Date().setDate(new Date().getDate()-364))))} → {fmtDate(new Date().toISOString())}
            </div>
          </div>
          <div className="year-matrix">
            {weeks.map((week,wi)=>(
              <div key={wi} className="year-week">
                {week.map((cell,ci)=>{
                  const stat=cell.stat;
                  const bg=stat?moodToColor(stat.avgMood):"#f3f4f6";
                  const title=`${cell.label}\n${stat?`${stat.count} entr${stat.count>1?"ies":"y"}, avg ${stat.avgMood.toFixed(1)}`:"No entry"}`;
                  return(
                    <button
                      key={`${wi}-${ci}-${cell.key}`}
                      className={`year-cell ${cell.key===selectedDayKey?"year-cell-selected":""} ${cell.isToday?"year-today":""}`}
                      style={{background:bg}}
                      title={title}
                      onClick={()=>setSelectedDayKey(cell.key)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="year-month-labels">
            {monthLabels.map(m=><span key={m.key} style={{left:`${m.offsetPx}px`}}>{m.label}</span>)}
          </div>
        </div>

        {/* Day Page */}
        <section className={`${dark?"":"parchment-bg"} p-4 rounded`}>
          <h3 className="text-lg font-semibold mb-2">{selectedDayKey?fmtDate(selectedDayKey):"Select a day"}</h3>
          {dayEntries.length===0?<p className="text-sm text-gray-500">No entries for this day.</p>:
          dayEntries.map(e=>(
            <div key={e.id} className="border-b pb-2 mb-2">
              <p className="text-xs text-gray-500">{new Date(e.iso||e.date).toLocaleTimeString()} — {e.section}</p>
              <p className="text-sm text-gray-600">Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}</p>
              <p className="mt-2 font-medium">{e.question}</p>
              <p className="mt-1 whitespace-pre-wrap">{e.entry}</p>
            </div>
          ))}
        </section>
      </div>
    )}

    {/* SUMMARY */}
    {view==="summary"&&(
      <Card><CardContent><SummaryPanel entries={entries} darkMode={dark}/></CardContent></Card>
    )}

    {/* Edit Modal */}
    {editing&&(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[90%] max-w-md space-y-4">
          <h3 className="text-lg font-semibold">✏️ Edit Entry</h3>
          <Textarea value={editText} onChange={(e)=>setEditText(e.target.value)}/>
          <div><p className="text-sm">Mood: {editMood}/10 ({moodLabel(editMood)})</p>
          <Slider min={1} max={10} value={[editMood]} onChange={(v)=>setEditMood(v[0])}/></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></div>
        </div>
      </div>
    )}

    {/* Footer */}
    <div className="flex justify-between items-center mt-8">
      <div className="text-sm text-gray-500">💾 Auto-synced locally</div>
      <InstallPrompt/>
    </div>
    <div className="text-center mt-3">
      <GoogleSync dataToSync={{entries}} onRestore={(r)=>handleRestore(r)}/>
    </div>
  </div>);
}
