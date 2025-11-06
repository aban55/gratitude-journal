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

/* =========================
   Constants & Helpers
========================= */
const STORAGE_KEY = "gratitudeEntries";
const THEME_KEY = "gj_theme";
const WELCOME_KEY = "gj_seen_welcome";
const REMINDER_ENABLED_KEY = "gj_reminder_enabled";
const REMINDER_TIME_KEY = "gj_reminder_time";
const REMINDER_LAST_SENT_KEY = "gj_reminder_last_sent";

const QUOTES = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

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

function parseDate(src) {
  if (!src) return null;
  const d = new Date(src);
  return isNaN(d) ? null : d;
}
const toDateKey = (d) => {
  const dt = parseDate(d);
  if (!dt) return "";
  const utc = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  return utc.toISOString().slice(0, 10);
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
  let s = 0;
  const t = (text || "").toLowerCase();
  pos.forEach((w) => t.includes(w) && (s += 1));
  neg.forEach((w) => t.includes(w) && (s -= 1));
  if (mood >= 7) s += 1;
  if (mood <= 3) s -= 1;
  if (s > 1) return "😊 Positive";
  if (s === 1) return "🙂 Content";
  if (s === 0) return "😐 Neutral";
  return "😟 Stressed";
}
function triggerDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =========================
   Toast & Reminder Modal
========================= */
function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-black/80 text-white rounded-full shadow-lg text-sm">
      {message}
      <button onClick={onClose} className="ml-3 text-white/80 hover:text-white">✕</button>
    </div>
  );
}

function ReminderSettingsModal({
  open,
  onClose,
  enabled,
  time,
  onEnabled,
  onTime,
  onSave
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999]">
      <div className="bg-[#fbf5e6] text-amber-900 rounded-2xl shadow-2xl border border-amber-300 p-6 w-[90%] max-w-md">
        <h3 className="text-xl font-semibold mb-3">⚙️ Daily Reminder</h3>

        <div className="flex items-center justify-between mb-4">
          <span>Enable Reminder</span>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-amber-200 rounded-full peer-checked:bg-amber-500 transition-all relative">
              <div className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full transition-all ${enabled ? "translate-x-5" : ""}`} />
            </div>
          </label>
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">Time (24h)</label>
          <input
            type="time"
            value={time}
            onChange={(e) => onTime(e.target.value)}
            disabled={!enabled}
            className="w-full border border-amber-300 rounded-lg p-2 bg-white disabled:opacity-60"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="bg-white hover:bg-amber-100">Cancel</Button>
          <Button onClick={onSave} className="bg-amber-600 hover:bg-amber-700 text-white">Save</Button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Welcome Modal
========================= */
// ... (keep your existing WelcomeModal code exactly as it is)

/* =========================
   Main App
========================= */
export default function App() {
  const [view, setView] = useState("journal");
  const [dark, setDark] = useState(false);
  const [quote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMood, setEditMood] = useState(5);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY));

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(() => localStorage.getItem(REMINDER_ENABLED_KEY) === "1");
  const [reminderTime, setReminderTime] = useState(() => localStorage.getItem(REMINDER_TIME_KEY) || "20:00");
  const [toast, setToast] = useState("");
  const [showReminders, setShowReminders] = useState(false);

  // Load local data + theme
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) try { const parsed = JSON.parse(s); if (Array.isArray(parsed)) setEntries(parsed); } catch {}
    const th = localStorage.getItem(THEME_KEY);
    if (th) setDark(th === "dark");
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem(REMINDER_ENABLED_KEY, reminderEnabled ? "1" : "0"); }, [reminderEnabled]);
  useEffect(() => { localStorage.setItem(REMINDER_TIME_KEY, reminderTime); }, [reminderTime]);

  // Toast on change
  useEffect(() => {
    if (!reminderEnabled) return;
    setToast(`🌼 Reminder set for ${formatTimeLabel(reminderTime)}`);
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [reminderEnabled, reminderTime]);

  // Reminder check (every minute)
  useEffect(() => {
    if (!reminderEnabled) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const currentHHMM = `${hh}:${mm}`;
      const todayKey = toDateKey(now);
      const lastSent = localStorage.getItem(REMINDER_LAST_SENT_KEY);
      if (currentHHMM === reminderTime && lastSent !== todayKey) {
        try {
          if ("Notification" in window && Notification.permission === "granted")
            new Notification("🌼 Gentle Gratitude Reminder", { body: "Pause for a moment — what made you smile today?" });
          else alert("🌿 Pause for a moment — what made you smile today?");
        } catch {
          alert("🌿 Pause for a moment — what made you smile today?");
        }
        localStorage.setItem(REMINDER_LAST_SENT_KEY, todayKey);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [reminderEnabled, reminderTime]);

  // Entry CRUD, Exporters, etc. — (keep same as your version)

  /* Footer */
  return (
    <div className={`min-h-screen p-6 max-w-3xl mx-auto ${dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <Toast message={toast} onClose={() => setToast("")} />
      {/* existing body & tabs ... */}

      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced locally</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReminders(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100"
          >
            ⚙️ Reminders
          </button>
          <InstallPrompt />
        </div>
      </div>

      <div className="text-center mt-3">
        <GoogleSync dataToSync={{ entries }} onRestore={() => {}} />
      </div>

      <ReminderSettingsModal
        open={showReminders}
        onClose={() => setShowReminders(false)}
        enabled={reminderEnabled}
        time={reminderTime}
        onEnabled={setReminderEnabled}
        onTime={setReminderTime}
        onSave={() => {
          setShowReminders(false);
          setToast(`🌼 Reminder set for ${formatTimeLabel(reminderTime)}`);
        }}
      />
    </div>
  );
}

/* ===== utils ===== */
function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
