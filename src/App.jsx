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

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Home from "./Home.jsx"; // your main component


/* =========================
   Constants & Helpers
========================= */
const APP_VERSION = "1.1.0"; // bump when you ship
const STORAGE_KEY = "gratitudeEntries";
const THEME_KEY = "gj_theme";
const RETURN_USER_KEY = "gj_return_user";
const WELCOME_KEY = "gj_seen_welcome";

const REMINDER_ENABLED_KEY = "gj_reminder_enabled";
const REMINDER_TIME_KEY = "gj_reminder_time";
const REMINDER_LAST_SENT_KEY = "gj_reminder_last_sent"; // YYYY-MM-DD

// Local engagement keys (purely offline)
const ENG_DAYS_KEY = "gj_days_with_entry"; // JSON array of date keys (yyyy-mm-dd) that have ≥1 entry
const LONGEST_STREAK_KEY = "gj_longest_streak"; // cached longest streak (recomputed anyway)

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
    "Who made my day a little brighter today?",
    "What kind word or gesture stayed with me?",
    "Whose effort or patience am I grateful for right now?",
    "In what small way did I show care for someone?",
    "Who surprised me with kindness or humour?",
    "Who do I want to thank (even silently) and why?",
  ],

  "Self & Growth": [
    "What personal strength helped me today?",
    "What habit or routine am I proud of keeping alive?",
    "How did I bounce back from a challenge recently?",
    "What have I learned about myself this week?",
    "What small win shows I’m growing?",
    "Where did I choose progress over perfection?",
  ],

  "Blessings & Privileges": [
    "What comfort or convenience quietly supported me today?",
    "Which skill or tool saved me time or stress?",
    "What freedom or choice do I often overlook?",
    "Who or what is part of my safety net?",
    "What knowledge or education helped me solve something today?",
    "How can I use my good fortune to ease someone else’s path?",
  ],

  "Nature & Calm": [
    "What sight, sound, or scent from nature soothed me today?",
    "When did I feel most peaceful or present?",
    "What tiny moment of beauty made me pause?",
    "What space in my surroundings feels like a sanctuary?",
    "What simple pleasure grounded me today?",
    "Where did I notice light, wind, birds, sky, or trees?",
  ],

  "Work & Purpose": [
    "What task gave me a sense of purpose or pride today?",
    "Who supported or collaborated with me meaningfully?",
    "What skill did I use well today?",
    "What small step moved me forward?",
    "Where did I create value for someone else?",
    "What felt meaningful about my effort?",
  ],

  "Learning & Inspiration": [
    "What idea recently opened my mind?",
    "Who or what sparked my creativity or motivation today?",
    "What new thing did I notice or understand better?",
    "What did I read, hear, or watch that stayed with me?",
    "How did curiosity improve my day?",
    "What perspective shift am I thankful for?",
  ],

  "Health & Wellbeing": [
    "What did my body let me do today that I’m thankful for?",
    "What healthy decision did I stick with?",
    "What rest or nourishment felt healing?",
    "Where am I noticing strength or recovery lately?",
    "How did I care for my mind today?",
    "What small ritual helped me feel balanced?",
  ],

  "Perspective & Hope": [
    "What opportunity or freedom am I grateful to have?",
    "What am I hopeful about in the near future?",
    "How has a tough season shaped my empathy or courage?",
    "What reminder helps me see life is unfolding in my favour?",
    "What am I thankful for that I usually take for granted?",
    "What would future-me thank present-me for today?",
  ],
};

/* ===== shuffle helpers ===== */
function pickRandom(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickRandomQuestion(sectionName) {
  const qs = sections[sectionName] || [];
  return pickRandom(qs);
}

/* ===== date utils ===== */
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
  return utc.toISOString().slice(0, 10);
};
const fmtDate = (src) => {
  const d = parseDate(src);
  return d
    ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : "Invalid Date";
};

/* ===== mood & sentiment ===== */
function moodLabel(m) {
  if (m <= 3) return "😞 Sad / Low";
  if (m <= 6) return "😐 Neutral";
  if (m <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}
function analyzeSentiment(text, mood) {
  const pos = ["happy", "joy", "grateful", "calm", "love", "hope", "thankful", "peace"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset"];
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

/* ===== file download helper ===== */
function triggerDownload(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =========================
   Toast
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

/* =========================
   Feedback Modal (Fixed)
========================= */
function FeedbackModal({ open, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const emojis = [
    { v: 1, label: "😣" },
    { v: 2, label: "😕" },
    { v: 3, label: "😐" },
    { v: 4, label: "🙂" },
    { v: 5, label: "🤩" },
  ];

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center"
      onClick={(e) => {
        // click outside closes modal
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl shadow-2xl w-[92%] max-w-md p-5 animate-fadeIn">
        <h3 className="text-xl font-semibold mb-2">💬 Share quick feedback</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Your journal stays on your device. Feedback is sent separately and never includes your entries.
        </p>

        {/* Emoji rating row */}
        <div className="mb-4">
          <label className="text-sm font-medium">Overall experience</label>
          <div className="flex gap-2 mt-2 justify-center">
            {emojis.map((e) => (
              <button
                key={e.v}
                onClick={() => setRating(e.v)}
                className={`text-2xl rounded-md px-2 py-1 transition-all ${
                  rating === e.v
                    ? "bg-amber-100 border border-amber-300 scale-110"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback category */}
        <div className="mb-4">
          <label className="text-sm font-medium">Topic</label>
          <select
            className="mt-1 w-full border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="general">General</option>
            <option value="bugs">Bug</option>
            <option value="design">Design/Flow</option>
            <option value="features">New Feature</option>
            <option value="performance">Performance</option>
          </select>
        </div>

        {/* Text area */}
        <div className="mb-3">
          <label className="text-sm font-medium">Suggestions (optional)</label>
          <Textarea
            placeholder="What would make this better for you?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <Button
            variant="outline"
            onClick={onClose}
            className="border border-gray-300 bg-white hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSubmit({ rating, category, message });
            }}
            disabled={!rating && !message}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Welcome Modal (2-Page with Progress + Slide Animations)
========================= */
function WelcomeModal({
  open,
  onClose,
  onStart,
  returning = false,
  reminderEnabled,
  reminderTime,
  onReminderEnabled,
  onReminderTime,
  onOpenFeedback,
}) {
  const [step, setStep] = useState(1); // 1 = intro, 2 = setup
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex flex-col justify-center items-center"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="mx-auto max-w-[640px] w-[92%] sm:w-[85%] bg-[#fbf5e6] text-amber-900 border border-amber-300 rounded-2xl shadow-2xl overflow-hidden parchment-bg relative">
        <div className="p-6 sm:p-8 overflow-y-auto max-h-[85vh] transition-all duration-300 ease-in-out">

          {/* Header */}
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-2 text-amber-900">
            {returning ? "🌿 Welcome Back" : "🌿 Welcome to Your Gratitude Journal"}
          </h2>

          {/* Progress Dots */}
          <div className="flex justify-center items-center gap-2 mb-4 mt-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  step === i ? "bg-amber-600 scale-125" : "bg-amber-300"
                }`}
              />
            ))}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div key="step1" className="animate-slideInLeft">
              <p className="leading-relaxed text-[15px] mb-4">
                {returning
                  ? "Good to see you again. Take a quiet moment today to reflect on what went right. Small steps make lasting calm."
                  : "Practising gratitude trains your mind to notice what’s going right. Even a few lines a day can improve mood, reduce stress, and build resilience. This app helps you build that habit—gently and consistently."}
              </p>

              <h3 className="font-semibold text-lg mb-2 text-amber-900">✨ How it works</h3>
              <ul className="list-disc pl-5 space-y-1 text-[15px]">
                <li>Select a question or write freely about what you’re thankful for.</li>
                <li>Record your reflection and set your mood (1–10).</li>
                <li>Your entries save automatically — locally and to Google Drive (if signed in).</li>
                <li>Review, edit, and export from the <i>Past Entries</i> or <i>Summary</i> tabs.</li>
              </ul>

              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-2">🪷 Why Gratitude Matters</h3>
                <p className="leading-relaxed text-[15px] mb-3">
                  Gratitude is more than a feeling — it’s a practice that reshapes how your mind
                  interprets the world. Just a few minutes a day can:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[15px]">
                  <li>Reduce stress and overthinking.</li>
                  <li>Improve sleep and balance.</li>
                  <li>Strengthen relationships through empathy.</li>
                  <li>Rewire your brain to notice positives naturally.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div key="step2" className="animate-slideInRight">
              <h3 className="text-2xl font-bold mb-3">🌞 Build Your Daily Habit</h3>
              <p className="text-[15px] text-amber-800/90 leading-relaxed mb-3">
                Take two quiet minutes each day to pause and note one thing you’re grateful for.
                Consistency &gt; perfection — tiny steps, every day.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                  value={reminderTime}
                  onChange={(e) => onReminderTime(e.target.value)}
                  className="h-10 border border-amber-300 rounded-md px-2 bg-white text-amber-900"
                >
                  <option value="07:00">7:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="21:00">9:00 PM</option>
                  <option value="22:00">10:00 PM</option>
                </select>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => onReminderEnabled(e.target.checked)}
                    className="h-5 w-5"
                  />
                  <span className="text-[15px]">Enable Daily Reminder</span>
                </label>
              </div>

              <div className="text-[13px] text-amber-700 mb-5">
                You’ll get a gentle nudge at your chosen time. If notifications are blocked,
                an in-app alert appears instead.
              </div>

              <div className="text-[14px] p-3 rounded-lg bg-amber-50 border border-amber-200 leading-relaxed mb-3">
                <strong>Private by design.</strong> Your journal entries are stored only on your device.
                If you connect Google Drive, a copy can be synced to <i>your</i> Drive. We never see your entries.
                Feedback, if you share it, is separate and contains no journal content.
                <button
                  onClick={() => onOpenFeedback()}
                  className="ml-2 text-amber-700 underline hover:text-amber-900 transition-colors duration-150"
                >
                  Leave feedback →
                </button>
              </div>

              <div className="text-[13px] text-amber-900/80 bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed mb-3">
                <strong>🔒 Note on Google Sign-in:</strong><br />
                If you see <i>“Google hasn’t verified this app”</i> — don’t worry.
                This simply means the developer (<b>abhishekbansal55@gmail.com</b>) is completing Google’s verification process.<br />
                You can safely continue by choosing <b>“Advanced → Go to Gratitude Journal (unsafe)”</b>.
                Your journal data always stays private — stored locally or in <i>your own</i> Drive.
              </div>

              <div className="mt-3 text-[13px] text-center text-amber-900/80">
                <a href="/privacy" className="underline hover:text-amber-900 mr-3">Privacy Policy</a>•
                <a href="/terms" className="underline hover:text-amber-900 ml-3">Terms of Use</a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 sm:px-8 py-4 border-t border-amber-200 bg-[#fbf5e6] flex justify-between gap-3 sticky bottom-0">
          {step === 1 ? (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 bg-white border border-amber-300 h-12 text-base"
              >
                Maybe Later
              </Button>
              <Button
                onClick={() => setStep(2)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white h-12 text-base"
              >
                Next →
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 bg-white border border-amber-300 h-12 text-base"
              >
                ← Back
              </Button>
              <Button
                onClick={onStart}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white h-12 text-base"
              >
                Start Journaling
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

  const seenBefore = localStorage.getItem(WELCOME_KEY);
  const returning = localStorage.getItem(RETURN_USER_KEY);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isReturning, setIsReturning] = useState(!!returning);

  useEffect(() => {
  // Always show a welcome screen, but mark returning visitors
  if (seenBefore) {
    setIsReturning(true);
  }
  setShowWelcome(true);
}, []);


  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(
    () => localStorage.getItem(REMINDER_ENABLED_KEY) === "1"
  );
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem(REMINDER_TIME_KEY) || "20:00"
  );
  const [toast, setToast] = useState("");

  // Feedback modal
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Engagement stats (derived)
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: Number(localStorage.getItem(LONGEST_STREAK_KEY) || 0),
    entriesThisWeek: 0,
    entriesThisMonth: 0,
    avgMood7d: 0,
  });

// App.jsx (inside the App() component, once)
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;

  // If there's a waiting SW (new build), tell it to activate now
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  });

  // Listen for the SW telling us a new version is ready
  const onMessage = (event) => {
    if (event.data?.type === "NEW_VERSION_READY") {
      // optional: show a toast first
      setToast("✨ New version installed. Reloading…");
      setTimeout(() => {
        // hard reload to pick up fresh assets
        window.location.reload(true);
      }, 800);
    }
  };

  navigator.serviceWorker.addEventListener("message", onMessage);
  return () => navigator.serviceWorker.removeEventListener("message", onMessage);
}, []);


  // Load local + theme
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch {}
    }
    const th = localStorage.getItem(THEME_KEY);
    if (th) setDark(th === "dark");
  }, []);

  // Persist local entries
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    // Recompute stats whenever entries change
    const newStats = computeEngagement(entries);
    setStats((prev) => {
      const longest = Math.max(prev.longestStreak, newStats.longestStreak);
      localStorage.setItem(LONGEST_STREAK_KEY, String(longest));
      return { ...newStats, longestStreak: longest };
    });
    // Store day keys with entries (optional, helpful for insights)
    const daySet = Array.from(buildEntryDaySet(entries));
    localStorage.setItem(ENG_DAYS_KEY, JSON.stringify(daySet));
  }, [entries]);

  // Save reminder settings + toast when changed
  useEffect(() => {
    localStorage.setItem(REMINDER_ENABLED_KEY, reminderEnabled ? "1" : "0");
  }, [reminderEnabled]);
  useEffect(() => {
    localStorage.setItem(REMINDER_TIME_KEY, reminderTime);
  }, [reminderTime]);

  // Request permission if enabling
  useEffect(() => {
    if (!reminderEnabled) return;
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
    setToast(`🌼 Reminder set for ${formatTimeLabel(reminderTime)}`);
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [reminderEnabled, reminderTime]);

  // Auto-shuffle on load (every time)
  useEffect(() => {
    const allSections = Object.keys(sections);
    const randomSection = pickRandom(allSections);
    const randomQuestion = pickRandomQuestion(randomSection);
    setSection(randomSection);
    setQuestion(randomQuestion);
    setToast("🌼 Fresh prompt loaded!");
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, []);

  // Reminder tick: check every minute; send once/day
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
        const title = "🌼 Gentle Gratitude Reminder";
        const body = "Pause for a moment — what made you smile today?";
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, { body });
          } catch {
            alert("🌿 Pause for a moment — what made you smile today?");
          }
        } else {
          alert("🌿 Pause for a moment — what made you smile today?");
        }
        localStorage.setItem(REMINDER_LAST_SENT_KEY, todayKey);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [reminderEnabled, reminderTime]);

  // Merge Drive restore without overwriting local
  function handleRestoreFromDrive(payload) {
    if (!payload || !Array.isArray(payload.entries)) return;
    const incoming = payload.entries;
    const map = new Map(entries.map((e) => [e.id, e]));
    for (const it of incoming) {
      if (!it || !it.id) continue;
      const merged = {
        ...map.get(it.id),
        ...it,
        sentiment: it.sentiment ?? analyzeSentiment(it.entry || "", it.mood ?? 5),
      };
      map.set(it.id, merged);
    }
    const mergedList = Array.from(map.values()).sort((a, b) => (a.id || 0) - (b.id || 0));
    setEntries(mergedList);
  }

  /* Create new entry */
  function handleSave() {
    if (!entry.trim() || !question) return;
    const now = new Date();
    const e = {
      id: now.getTime(),
      date: now.toLocaleString(),
      iso: now.toISOString(),
      section,
      question,
      entry,
      mood,
      sentiment: analyzeSentiment(entry, mood),
    };
    setEntries((p) => [...p, e]);
    setEntry("");
    setQuestion("");
    setMood(5);
  }

  /* Edit/Delete */
  function openEdit(item) {
    setEditing(item);
    setEditText(item.entry);
    setEditMood(item.mood);
  }
  function saveEdit() {
    if (!editing) return;
    const snt = analyzeSentiment(editText, editMood);
    setEntries((arr) => arr.map((e) => (e.id === editing.id ? { ...e, entry: editText, mood: editMood, sentiment: snt } : e)));
    setEditing(null);
  }
  function handleDelete(id) {
    setEntries((arr) => arr.filter((e) => e.id !== id));
  }

  /* Past view helpers */
  const pastSorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.iso || b.date) - new Date(a.iso || a.date)),
    [entries]
  );
  const recent3 = useMemo(() => pastSorted.slice(0, 3), [pastSorted]);

  /* Exporters */
  function exportTxt() {
    const txt = pastSorted
      .map(
        (e) =>
          `${fmtDate(e.iso || e.date)}\nSection: ${e.section}\nMood: ${e.mood}/10 (${e.sentiment})\nQ: ${e.question}\nA: ${e.entry}\n`
      )
      .join("\n----------------\n");
    triggerDownload(new Blob([txt], { type: "text/plain" }), "Gratitude_Journal.txt");
  }
  function exportCsv() {
    const header = ["Date", "Section", "Mood", "Sentiment", "Question", "Entry"];
    const rows = pastSorted.map((e) => [
      `"${fmtDate(e.iso || e.date)}"`,
      `"${e.section}"`,
      e.mood,
      `"${e.sentiment}"`,
      `"${e.question}"`,
      `"${(e.entry || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv" }), "Gratitude_Journal.csv");
  }
  function exportPdf() {
    if (!pastSorted.length) return;
    const pdf = new jsPDF("p", "pt", "a4");
    const marginX = 56;
    const marginY = 64;
    const lineH = 18;

    pdf.setFont("Times", "bold");
    pdf.setFontSize(22);
    pdf.text("🌿 My Gratitude Journal", marginX, marginY);
    pdf.setFont("Times", "normal");
    pdf.setFontSize(12);
    pdf.text(`Exported on ${new Date().toLocaleString()}`, marginX, marginY + 24);
    pdf.text(`Total entries: ${pastSorted.length}`, marginX, marginY + 42);

    pdf.addPage();
    let y = marginY;

    for (const e of [...pastSorted].reverse()) {
      if (y > pdf.internal.pageSize.height - 120) {
        pdf.addPage();
        y = marginY;
      }
      pdf.setFont("Times", "bold");
      pdf.setFontSize(14);
      pdf.text(fmtDate(e.iso || e.date), marginX, y);
      y += lineH;

      pdf.setFont("Times", "normal");
      pdf.setFontSize(12);
      pdf.text(`Section: ${e.section}`, marginX, y);
      y += lineH;
      pdf.text(`Mood: ${e.mood}/10  |  ${e.sentiment}`, marginX, y);
      y += lineH;

      pdf.setFont("Times", "bold");
      pdf.text(`Q: ${e.question}`, marginX, y);
      y += lineH;

      pdf.setFont("Times", "normal");
      const lines = pdf.splitTextToSize(e.entry || "", 520);
      pdf.text(lines, marginX, y);
      y += lines.length * lineH + 12;
    }

    pdf.save(`Gratitude_Journal_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /* ===== manual shuffle handler ===== */
  function shufflePrompt() {
    const allSections = Object.keys(sections);
    const nextSection = pickRandom(allSections);
    const nextQuestion = pickRandomQuestion(nextSection);
    setSection(nextSection);
    setQuestion(nextQuestion);
    setEntry("");
    setToast("🔀 New prompt loaded");
    const t = setTimeout(() => setToast(""), 1500);
    return () => clearTimeout(t);
  }

  /* ===== feedback submission ===== */
  async function submitFeedback({ rating, category, message }) {
    try {
      const payload = {
        rating: Number(rating) || null,
        category: category || "general",
        message: message || "",
        clientTime: new Date().toISOString(),
        device: `${navigator.platform} • ${navigator.userAgent}`,
        version: APP_VERSION,
        stats, // include local, non-sensitive engagement stats
      };
      const resp = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({ ok: false }));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "Submit failed");
      setToast("💌 Thanks for your feedback!");
      setFeedbackOpen(false);
    } catch (e) {
      setToast("⚠️ Could not send feedback (offline?). Saved locally.");
      // Optional: stash locally for later retry
      const q = JSON.parse(localStorage.getItem("gj_feedback_queue") || "[]");
      q.push({
        rating,
        category,
        message,
        clientTime: new Date().toISOString(),
        version: APP_VERSION,
      });
      localStorage.setItem("gj_feedback_queue", JSON.stringify(q));
      setFeedbackOpen(false);
    } finally {
      setTimeout(() => setToast(""), 2500);
    }
  }

  /* Render */
  return (
    <div
  className={`min-h-screen p-4 sm:p-6 max-w-3xl mx-auto ${dark ? "bg-gray-900 text-gray-100" : "bg-gradient-to-b from-amber-50 to-white text-gray-900"}`}
>

      {/* Toast */}
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={submitFeedback}
      />

      {/* Welcome Overlay */}
      <WelcomeModal
        open={showWelcome}
        returning={isReturning}
        onClose={() => {
          setShowWelcome(false);
          localStorage.setItem(WELCOME_KEY, "1");
          localStorage.setItem(RETURN_USER_KEY, "1");
        }}
        onStart={() => {
        setShowWelcome(false);
        localStorage.setItem(WELCOME_KEY, "1");
        localStorage.setItem(RETURN_USER_KEY, "1");
        setView("journal");
        }}

        reminderEnabled={reminderEnabled}
        reminderTime={reminderTime}
        onReminderEnabled={(v) => setReminderEnabled(v)}
        onReminderTime={(v) => setReminderTime(v)}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />

      {/* Header */}
      <header className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFeedbackOpen(true)}>💬 Feedback</Button>
          <Button
            variant="outline"
            onClick={() => {
              const next = !dark;
              setDark(next);
              localStorage.setItem(THEME_KEY, next ? "dark" : "light");
            }}
          >
            {dark ? "☀️ Light" : "🌙 Dark"}
          </Button>
        </div>
      </header>
      <p className="text-center text-amber-800/90 italic text-[17px] sm:text-lg mt-1 mb-5 tracking-wide font-serif drop-shadow-sm">
  “{quote}”
</p>


      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view === "journal" ? "default" : "outline"} onClick={() => setView("journal")}>✍️ Journal</Button>
        <Button variant={view === "past" ? "default" : "outline"} onClick={() => setView("past")}>🕊 Past Entries</Button>
        <Button variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")}>📊 Summary</Button>
      </div>

      {/* JOURNAL */}
      {view === "journal" && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1">
                <Select
                  value={section}
                  onChange={(v) => {
                    setSection(v);
                    const q = pickRandomQuestion(v);
                    setQuestion(q || "");
                  }}
                  options={Object.keys(sections)}
                />
              </div>
              <div className="flex-1">
                <Select
                  value={question}
                  onChange={setQuestion}
                  options={["", ...(sections[section] || [])]}
                  placeholder="Pick a question"
                />
              </div>
              <div className="shrink-0">
                <Button variant="outline" onClick={shufflePrompt}>🔀 Shuffle Prompt</Button>
              </div>
            </div>

            {question && (
              <>
                <Textarea
                  placeholder="Write your reflection..."
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
                <div>
                  <p className="text-sm">Mood: {mood}/10 ({moodLabel(mood)})</p>
                  <Slider min={1} max={10} value={[mood]} onChange={(v) => setMood(v[0])} />
                </div>
                <Button onClick={handleSave}>Save Entry</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAST */}
      {view === "past" && (
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h3 className="font-semibold mb-2">Recent entries</h3>
              {recent3.length === 0 ? (
                <p className="text-sm text-gray-500">No entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent3.map((e) => (
                    <div key={e.id} className="flex justify-between border p-2 rounded">
                      <div>
                        <div className="text-xs text-gray-500">{fmtDate(e.iso || e.date)} — {e.section}</div>
                        <div className="text-sm">Mood {e.mood}/10 ({moodLabel(e.mood)})</div>
                        <div className="text-sm font-medium">{e.question}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                        <Button variant="outline" onClick={() => handleDelete(e.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="font-semibold mb-2">All entries (latest first)</h3>
              {pastSorted.length === 0 ? (
                <p className="text-sm text-gray-500">No entries yet.</p>
              ) : (
                <div className="space-y-3">
                  {pastSorted.map((e) => (
                    <div key={e.id} className="rounded-lg border p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <div className="text-xs text-gray-500">{fmtDate(e.iso || e.date)} — {e.section}</div>
                          <div className="text-sm text-gray-600">
                            Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}
                          </div>
                          <div className="mt-1 font-medium">{e.question}</div>
                          <div className="mt-1 whitespace-pre-wrap text-sm">{e.entry}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                          <Button variant="outline" onClick={() => handleDelete(e.id)}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="outline" onClick={exportTxt}>Export .TXT</Button>
                <Button variant="outline" onClick={exportCsv}>Export .CSV</Button>
                <Button onClick={exportPdf}>Export .PDF</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUMMARY */}
      {view === "summary" && (
        <Card>
          <CardContent className="space-y-4">
            {/* Engagement snapshot (offline) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <SummaryStat label="Current Streak" value={`${stats.currentStreak} 🔥`} />
              <SummaryStat label="Longest Streak" value={`${stats.longestStreak} 🏆`} />
              <SummaryStat label="This Week" value={String(stats.entriesThisWeek)} />
              <SummaryStat label="This Month" value={String(stats.entriesThisMonth)} />
              <SummaryStat label="Avg Mood (7d)" value={stats.avgMood7d ? stats.avgMood7d.toFixed(1) : "—"} />
            </div>

            {/* Existing charts/insights */}
            <SummaryPanel entries={entries} darkMode={dark} />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportTxt}>Export .TXT</Button>
              <Button variant="outline" onClick={exportCsv}>Export .CSV</Button>
              <Button onClick={exportPdf}>Export .PDF</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[90%] max-w-md space-y-4">
            <h3 className="text-lg font-semibold">✏️ Edit Entry</h3>
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div>
              <p className="text-sm">Mood: {editMood}/10 ({moodLabel(editMood)})</p>
              <Slider min={1} max={10} value={[editMood]} onChange={(v) => setEditMood(v[0])} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">
          💾 Auto-synced locally • v{APP_VERSION}
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={() => setFeedbackOpen(true)}>💬 Feedback</Button>
          <InstallPrompt />
        </div>
      </div>

      <div className="text-center mt-3">
        {/* GoogleSync will try silent Drive restore and call handleRestoreFromDrive when available */}
        <GoogleSync dataToSync={{ entries }} onRestore={handleRestoreFromDrive} />
      </div>
    </div>
  );
}

/* ===== small stat capsule ===== */
function SummaryStat({ label, value }) {
  return (
    <div className="rounded-xl border bg-white/60 dark:bg-gray-800/60 px-3 py-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/* ===== utils ===== */
function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ===== engagement computation (offline) ===== */
function buildEntryDaySet(entries) {
  const set = new Set();
  for (const e of entries || []) {
    const k = toDateKey(e.iso || e.date);
    if (k) set.add(k);
  }
  return set;
}

function computeEngagement(entries) {
  const daySet = buildEntryDaySet(entries);
  const dayKeys = Array.from(daySet).sort(); // ascending

  // Current streak: walk backward from today
  const today = new Date();
  let cur = 0;
  let cursor = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    cur += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Longest streak: scan runs of consecutive days
  let longest = 0;
  if (dayKeys.length) {
    let run = 1;
    for (let i = 1; i < dayKeys.length; i++) {
      const prev = new Date(dayKeys[i - 1]);
      const curr = new Date(dayKeys[i]);
      const diff = (curr - prev) / (24 * 3600 * 1000);
      if (diff === 1) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        longest = Math.max(longest, run);
        run = 1;
      }
    }
    longest = Math.max(longest, run);
  }

  // Entries this week & month + avg mood (7d)
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday-based
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let entriesThisWeek = 0;
  let entriesThisMonth = 0;

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  let moodSum7 = 0;
  let moodCount7 = 0;

  for (const e of entries || []) {
    const d = parseDate(e.iso || e.date);
    if (!d) continue;
    if (d >= startOfWeek) entriesThisWeek += 1;
    if (d >= startOfMonth) entriesThisMonth += 1;
    if (d >= sevenDaysAgo) {
      if (typeof e.mood === "number") {
        moodSum7 += e.mood;
        moodCount7 += 1;
      }
    }
  }

  const avgMood7d = moodCount7 ? moodSum7 / moodCount7 : 0;

  return { currentStreak: cur, longestStreak: longest, entriesThisWeek, entriesThisMonth, avgMood7d };
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </Router>
  );
}
