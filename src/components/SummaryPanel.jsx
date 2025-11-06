import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import jsPDF from "jspdf";

/* Colors */
const SENTIMENT_COLORS = {
  "🙂 Positive": "#16a34a",
  "😊 Positive": "#16a34a",
  "😐 Neutral":  "#6b7280",
  "🙂 Content":  "#6b7280",
  "😟 Low":      "#ef4444",
  "😟 Stressed": "#ef4444",
};

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const keyOf = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function moodColor(mood, dark) {
  if (mood == null) return dark ? "#1f2937" : "#f3f4f6";
  const t = Math.max(0, Math.min(10, mood)) / 10;
  let from, to, p;
  if (t < 0.5) { from=[239,68,68]; to=[245,158,11]; p=t/0.5; }
  else { from=[245,158,11]; to=[22,163,74]; p=(t-0.5)/0.5; }
  const c = from.map((f,i)=>Math.round(f+(to[i]-f)*p));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* NEW: frequency color scale */
function freqColor(count, dark){
  if (!count) return dark ? "#1f2937" : "#f3f4f6";
  const steps = ["#d1fae5","#a7f3d0","#6ee7b7","#34d399","#059669"];
  return steps[Math.min(steps.length-1, count-1)] || steps[steps.length-1];
}

export default function SummaryPanel({ entries = [], darkMode, onExportPDF }) {
  const [heatmapMode, setHeatmapMode] = useState("mood"); // "mood" | "frequency"
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const handle = () => setCompact(window.innerWidth < 540);
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const {
    kpis, last7Data, allTimeData, sentimentMix,
    heatmapWeeks, dayStatMap
  } = useMemo(() => {
    if (!entries.length) {
      return {
        kpis: { total: 0, weeklyAvg: "-", delta: "-", streak: 0, consistency: 0 },
        last7Data: [], allTimeData: [], sentimentMix: [],
        heatmapWeeks: [], dayStatMap: new Map()
      };
    }

    // normalize + sort
    const normalized = entries.map((e) => {
      const iso = e.iso ?? new Date(e.date).toISOString();
      return { ...e, iso };
    }).sort((a, b) => new Date(a.iso) - new Date(b.iso));

    const allTimeData = normalized.map((e) => ({
      date: new Date(e.iso).toLocaleDateString(),
      mood: e.mood,
    }));

    const last7 = normalized.slice(-7);
    const weeklyAvg = (last7.reduce((a,e)=>a+(e.mood||0),0) / last7.length).toFixed(1);

    const prev7 = normalized.slice(-14, -7);
    const prevAvg = prev7.length
      ? (prev7.reduce((a,e)=>a+(e.mood||0),0) / prev7.length).toFixed(1)
      : null;
    const delta = prevAvg === null ? "-" :
      (weeklyAvg - prevAvg >= 0 ? `+${(weeklyAvg - prevAvg).toFixed(1)}` : (weeklyAvg - prevAvg).toFixed(1));

    const last7Data = last7.map((e) => ({
      date: new Date(e.iso).toLocaleDateString(),
      mood: e.mood,
    }));

    // sentiment mix
    const mix = normalized.reduce((acc, e) => {
      acc[e.sentiment] = (acc[e.sentiment] || 0) + 1;
      return acc;
    }, {});
    const sentimentMix = Object.entries(mix).map(([name, value]) => ({ name, value }));

    // day stats
    const dayStat = new Map();
    for (const e of normalized) {
      const d = new Date(e.iso);
      const key = keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      if (!dayStat.has(key)) dayStat.set(key, { count: 0, sum: 0 });
      const v = dayStat.get(key); v.count += 1; v.sum += (e.mood || 0);
    }
    for (const [k,v] of dayStat) v.avgMood = v.sum / v.count;

    // 16-week grid aligned to Monday
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 7*16 + 1);
    const shift = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - shift);

    const weeks = [];
    let cur = new Date(start);
    for (let w=0; w<16; w++){
      const days=[];
      for (let i=0;i<7;i++){
        const k = keyOf(cur);
        days.push(k);
        cur.setDate(cur.getDate()+1);
      }
      weeks.push(days);
    }

    // Consistency last 30d
    const last30Start = new Date(end); last30Start.setDate(last30Start.getDate()-29);
    let active = 0;
    for (let i=0;i<30;i++){
      const k = keyOf(new Date(last30Start.getFullYear(), last30Start.getMonth(), last30Start.getDate()+i));
      if (dayStat.get(k)?.count) active++;
    }
    const consistency = Math.round((active/30)*100);

    // Streak
    let streak = 0;
    for (let i=0;;i++){
      const k = keyOf(new Date(end.getFullYear(), end.getMonth(), end.getDate()-i));
      const has = (dayStat.get(k)?.count || 0) > 0;
      if (i===0 && !has) { streak = 0; break; }
      if (!has) break;
      streak++;
      if (i>365) break;
    }

    return {
      kpis: { total: normalized.length, weeklyAvg, delta, streak, consistency },
      last7Data, allTimeData, sentimentMix,
      heatmapWeeks: weeks, dayStatMap: dayStat
    };
  }, [entries]);

  const gridStroke = darkMode ? "#374151" : "#e5e7eb";
  const textColor = darkMode ? "#e5e7eb" : "#111827";
  const lineColor = darkMode ? "#86efac" : "#16a34a";

  const doExportPDF = async () => {
    if (onExportPDF) return onExportPDF();
    // minimal fallback
    const pdf = new jsPDF("p","pt","a4");
    pdf.text("Gratitude Journal", 48, 64);
    pdf.save("Gratitude_Journal.pdf");
  };

  const heatCellColor = (k) => {
    const stat = dayStatMap.get(k);
    return heatmapMode === "mood"
      ? moodColor(stat?.avgMood, darkMode)
      : freqColor(stat?.count || 0, darkMode);
  };

  return (
    <div className="space-y-5">
      {/* KPI & Consistency */}
      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-4"} gap-3`}>
        <KPI title="Weekly Avg Mood" value={kpis.weeklyAvg} />
        <KPI title="Change vs Prev Week" value={kpis.delta} />
        {!compact && <KPI title="Total Entries" value={kpis.total} />}
        <Ring label="Consistency" percent={kpis.consistency} sub={`${kpis.streak}-day streak`} dark={darkMode} />
      </div>

      {/* Last 7 — line */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold mb-2">Last 7 Entries — Mood Trend</h3>
          <button onClick={doExportPDF} className="text-sm px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">📘 Export as PDF</button>
        </div>
        {last7Data.length === 0 ? (
          <p className="text-sm text-gray-500">No data yet.</p>
        ) : (
          <div style={{ width: "100%", height: compact ? 200 : 240 }}>
            <ResponsiveContainer>
              <LineChart data={last7Data}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={textColor} />
                <YAxis domain={[0, 10]} stroke={textColor} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke={lineColor} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* All-time — line (hidden in ultra-compact) */}
      {!compact && (
        <div className="rounded-xl border p-3">
          <h3 className="font-semibold mb-2">All-Time Mood Trend</h3>
          {allTimeData.length === 0 ? (
            <p className="text-sm text-gray-500">No data yet.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={allTimeData}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke={textColor} />
                  <YAxis domain={[0, 10]} stroke={textColor} />
                  <Tooltip />
                  <Line type="monotone" dataKey="mood" stroke={lineColor} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Heatmap with toggle */}
      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Last 16 Weeks — Journal Heatmap</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Mode:</span>
            <button
              className={`px-2 py-1 rounded ${heatmapMode==="mood"?"bg-green-600 text-white":"border"}`}
              onClick={()=>setHeatmapMode("mood")}
            >
              Mood
            </button>
            <button
              className={`px-2 py-1 rounded ${heatmapMode==="frequency"?"bg-green-600 text-white":"border"}`}
              onClick={()=>setHeatmapMode("frequency")}
            >
              Frequency
            </button>
          </div>
        </div>
        {heatmapWeeks.length === 0 ? (
          <p className="text-sm text-gray-500">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-1">
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-rows-7 gap-1">
                  {week.map((dayKey) => (
                    <div
                      key={dayKey}
                      title={parseKey(dayKey).toLocaleDateString()}
                      className="w-3.5 h-3.5 rounded-[3px] border border-black/5"
                      style={{ background: heatCellColor(dayKey) }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {heatmapMode === "mood"
                ? "Color = average mood that day (red → yellow → green). Empty = no entry."
                : "Color = entries per day (light → dark). Empty = no entry."}
            </div>
          </div>
        )}
      </div>

      {/* Sentiment mix */}
      {!compact && (
        <div className="rounded-xl border p-3">
          <h3 className="font-semibold mb-2">Sentiment Mix (All-Time)</h3>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sentimentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {sentimentMix.map((seg, i) => (
                    <Cell key={i} fill={SENTIMENT_COLORS[seg.name] || "#6b7280"} />
                  ))}
                </Pie>
                <Legend /><Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Ring({ label, percent, sub, dark }) {
  const r = 32, c = 2*Math.PI*r, p = Math.max(0, Math.min(100, percent||0));
  const dash = (p/100)*c;
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke={dark ? "#1f2937" : "#e5e7eb"} strokeWidth="10" />
        <circle
          cx="42" cy="42" r={r} fill="none"
          stroke="#16a34a" strokeWidth="10"
          strokeDasharray={`${dash} ${c-dash}`}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-xl font-bold">{p}%</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
    </div>
  );
}
