import { useEffect, useState } from "react";

export default function WeeklyRecap({ stats }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    if (now.getDay() === 0 && !localStorage.getItem("weeklyShown")) {
      setVisible(true);
      localStorage.setItem("weeklyShown", now.toISOString().slice(0, 10));
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 text-center max-w-sm">
        <h2 className="text-2xl mb-2">🌻 Your Weekly Reflection</h2>
        <p className="text-amber-800 mb-3">
          You journaled <b>{stats.entriesThisWeek}</b> days this week.  
          Avg mood: <b>{stats.avgMood7d?.toFixed(1) || "–"}</b>.
        </p>
        <button
          onClick={() => setVisible(false)}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
