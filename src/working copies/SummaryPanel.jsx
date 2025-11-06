import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

const SENTIMENT_COLORS = {
  "🙂 Positive": "#16a34a",
  "😐 Neutral":  "#6b7280",
  "😟 Low":      "#ef4444",
};

export default function SummaryPanel({ entries = [], darkMode }) {
  const { kpis, last7Data, allTimeData, sentimentMix } = useMemo(() => {
    if (!entries.length) {
      return {
        kpis: { total: 0, weeklyAvg: "-", delta: "-" },
        last7Data: [],
        allTimeData: [],
        sentimentMix: [],
      };
    }

    // sort by time
    const sorted = [...entries].sort((a, b) => new Date(a.iso) - new Date(b.iso));

    // all-time series (date, mood)
    const allTimeData = sorted.map((e) => ({
      date: new Date(e.iso).toLocaleDateString(),
      mood: e.mood,
    }));

    // last 7 entries
    const last7 = sorted.slice(-7);
    const weeklyAvg =
      (last7.reduce((acc, e) => acc + (e.mood || 0), 0) / last7.length).toFixed(1);

    // previous 7 for delta
    const prev7 = sorted.slice(-14, -7);
    const prevAvg =
      prev7.length > 0
        ? (prev7.reduce((acc, e) => acc + (e.mood || 0), 0) / prev7.length).toFixed(1)
        : null;
    const delta =
      prevAvg === null ? "-" : (weeklyAvg - prevAvg >= 0 ? `+${(weeklyAvg - prevAvg).toFixed(1)}` : (weeklyAvg - prevAvg).toFixed(1));

    // last7 chart data (keep date uniqueness)
    const last7Data = last7.map((e) => ({
      date: new Date(e.iso).toLocaleDateString(),
      mood: e.mood,
    }));

    // sentiment mix (all time)
    const mix = sorted.reduce((acc, e) => {
      acc[e.sentiment] = (acc[e.sentiment] || 0) + 1;
      return acc;
    }, {});
    const sentimentMix = Object.entries(mix).map(([name, value]) => ({ name, value }));

    return {
      kpis: { total: sorted.length, weeklyAvg, delta },
      last7Data,
      allTimeData,
      sentimentMix,
    };
  }, [entries]);

  const gridStroke = darkMode ? "#374151" : "#e5e7eb";
  const textColor = darkMode ? "#e5e7eb" : "#111827";
  const lineColor = darkMode ? "#86efac" : "#16a34a";

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <KPI title="Weekly Avg Mood" value={kpis.weeklyAvg} />
        <KPI title="Change vs Prev Week" value={kpis.delta} />
        <KPI title="Total Entries" value={kpis.total} />
      </div>

      {/* Last 7 entries — Line */}
      <div className="rounded-xl border p-3">
        <h3 className="font-semibold mb-2">Last 7 Entries — Mood Trend</h3>
        {last7Data.length === 0 ? (
          <p className="text-sm text-gray-500">No data yet.</p>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
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

      {/* All-time entries — Line */}
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

      {/* Sentiment mix — Pie */}
      <div className="rounded-xl border p-3">
        <h3 className="font-semibold mb-2">Sentiment Mix (All-Time)</h3>
        {sentimentMix.length === 0 ? (
          <p className="text-sm text-gray-500">No data yet.</p>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={sentimentMix}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {sentimentMix.map((seg, i) => (
                    <Cell key={i} fill={SENTIMENT_COLORS[seg.name] || "#6b7280"} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
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
