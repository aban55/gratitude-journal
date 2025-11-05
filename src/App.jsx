import React, { useEffect, useState } from "react";
import GoogleSync from "./GoogleSync";

export default function App() {
  const [darkMode, setDarkMode] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [journalData, setJournalData] = useState([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const restoreFromDrive = (data) => {
    setJournalData(data);
    console.log("✅ Data restored from Drive:", data);
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-3xl mx-auto py-10 px-5 text-center">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🌿 Daily Gratitude Journal
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-2xl hover:scale-110 transition-transform"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>

        <p className="text-gray-500 mb-8">
          Save short reflections daily. Track mood & insights weekly.
        </p>

        {/* Example UI */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow mb-6">
          <select className="w-full p-2 mb-3 border rounded dark:bg-gray-700 dark:border-gray-600">
            <option>People & Relationships</option>
            <option>Personal Growth</option>
            <option>Health & Mindfulness</option>
          </select>
          <select className="w-full p-2 mb-3 border rounded dark:bg-gray-700 dark:border-gray-600">
            <option>Pick a gratitude question</option>
            <option>What made you smile today?</option>
            <option>Who helped you recently?</option>
            <option>What are you proud of this week?</option>
          </select>
          <textarea
            placeholder="Write your reflection here..."
            className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600"
            rows={4}
          />
        </div>

        {/* Google Drive Sync */}
        <GoogleSync dataToSync={journalData} onRestore={restoreFromDrive} />
      </div>
    </div>
  );
}
