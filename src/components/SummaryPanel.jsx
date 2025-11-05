import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#16a34a", "#60a5fa", "#f59e0b", "#a78bfa", "#ea580c", "#ef4444"];

export default function SummaryPanel({ entries = [] }) {
  const {
    avgMood,
    last7Trend,
    distribution,
    topSections,
    total,
  } = useMemo(() => {
    if (!entries.length) {
      return { avgMood: 0, last7Trend: [], distribution: [], topSections: [], total: 0 };
    }

    const last7 = entries.slice(-7);
    const avg = (last7.reduce((s, e) => s + (e.mood || 0), 0) / last7.length) || 0;

    const trend = last7.map((e, i) => ({
      idx: i + 1,
      date: e.date,
      mood: e.mood,
    }));

    // distribution 1-10
    const distCount = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({
      mood: n,
      count: entries.filter((e) => e.mood === n).length,
    }));

    // sections
    const secCount = entries.reduce((acc, e) => {
      acc[e.section] = (acc[e.section] || 0) + 1;
      return acc;
    }, {});
    const secArr = Object.entries(secCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      avgMood: Number(avg.toFixed(1)),
      last7Trend: trend,
      distribution: distCount,
      topSections: secArr,
      total: entries.length,
    };
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span role="img" aria-label="chart">📊</span> Summary
        </h2>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Average Mood (last 7 entries): <strong>{avgMood || "—"}</strong>
        </p>
        <p className="text-gray-600 dark:text-gray-300">Entries saved: <strong>{total}</strong></p>
      </div>

      {/* Mood trend */}
      <div className="rounded-lg border dark:border-gray-700 p-4">
        <p className="font-medium mb-2">Recent Mood Trend (last 7)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={last7Trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[1, 10]} />
            <Tooltip />
            <Line type="monotone" dataKey="mood" stroke="#16a34a" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution */}
      <div className="rounded-lg border dark:border-gray-700 p-4">
        <p className="font-medium mb-2">Mood Distribution</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mood" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top sections */}
      <div className="rounded-lg border dark:border-gray-700 p-4">
        <p className="font-medium mb-2">Top Gratitude Sections</p>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={topSections}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={85}
              label
            >
              {topSections.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
