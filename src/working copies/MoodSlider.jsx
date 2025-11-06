import React from "react";

/** Map mood (1–10) to a friendly emoji */
const moodEmoji = (m) => {
  if (m <= 2) return "😞";
  if (m <= 4) return "😐";
  if (m <= 6) return "🙂";
  if (m <= 8) return "😊";
  return "😄";
};

export default function MoodSlider({ value, onChange }) {
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <p className="font-medium">Mood (1–10)</p>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {moodEmoji(value)} <span className="font-semibold">{value}</span>
        </span>
      </div>

      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-green-600"
      />

      {/* scale hints */}
      <div className="flex justify-between text-xs mt-1 text-gray-500 dark:text-gray-400 select-none">
        <span>1</span><span>3</span><span>5</span><span>7</span><span>10</span>
      </div>
    </div>
  );
}
