import React, { useMemo } from "react";

const QUOTES = [
  "Gratitude turns what we have into enough.",
  "What you focus on grows.",
  "Small joys, noticed daily, become a good life.",
  "The more grateful I am, the more beauty I see.",
  "Let today be your fresh page.",
  "Peace begins with a thankful heart.",
  "You didn’t come this far to feel small.",
];

const SUGGESTIONS = [
  "Write one thing from your surroundings that made today easier.",
  "Thank someone silently in your head—describe why.",
  "Recall a challenge you handled better than before.",
  "Name a habit you kept this week and how it helped.",
  "Pick one simple pleasure (food, music, warmth) and savor it in words.",
];

export default function Inspiration() {
  const { quote, tip } = useMemo(() => {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const t = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    return { quote: q, tip: t };
  }, []);

  return (
    <div className="rounded-lg border dark:border-gray-700 p-4 bg-green-50 dark:bg-green-900/20">
      <p className="font-semibold text-green-800 dark:text-green-300">🌞 Inspiration</p>
      <p className="italic mt-1 text-green-700 dark:text-green-200">“{quote}”</p>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
        Try this today: <span className="italic">{tip}</span>
      </p>
    </div>
  );
}
