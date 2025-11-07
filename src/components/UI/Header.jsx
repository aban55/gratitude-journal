import { Button } from "../../ui/Button.jsx";


export default function Header({ dark, setDark, stats }) {
  return (
    <header className="flex justify-between items-center mb-2">
      <div>
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <div className="text-sm text-amber-800/90 mt-1">
          {stats.currentStreak > 0 ? (
            <span>
              🔥 {stats.currentStreak}-day streak • You journaled{" "}
              {stats.entriesThisWeek} days this week 🌞
            </span>
          ) : (
            <span>Start your first gratitude note today ✨</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            const next = !dark;
            setDark(next);
            localStorage.setItem("gj_theme", next ? "dark" : "light");
          }}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </div>
    </header>
  );
}
