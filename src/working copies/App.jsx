import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import GoogleSync from "./GoogleSync.jsx";
import InstallPrompt from "./InstallPrompt.jsx";

// 🌿 Intro quote pool
const quotes = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks.",
  "Every thankful thought plants a seed of joy.",
];

// 🌻 Sections and prompts
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
    "What challenge taught me something valuable?",
    "What habit am I proud of maintaining?",
    "How have I improved compared to last month?",
  ],
  "Nature & Calm": [
    "What part of my home brings me peace or comfort?",
    "What small thing in nature caught my attention today — light, wind, birds, sky, trees?",
    "What simple pleasure did I enjoy — food, music, warmth, quiet?",
    "What modern convenience or tool makes life smoother?",
    "What moment today felt safe, calm, or peaceful?",
    "What detail in nature stood out today?",
    "What moment felt peaceful or quiet?",
    "What simple pleasure grounded me today?",
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
    "Who supports my physical or emotional health — and how can I appreciate them?",
  ],
  "Perspective & Hope": [
    "What opportunity am I grateful to have that others may not?",
    "What am I looking forward to in the coming week?",
    "Who or what reminds me that life is bigger than my worries?",
    "How has a tough time in my life shaped who I am today?",
    "What am I thankful for that I usually take for granted?",
  ],
};

// 💬 Mood label
function moodLabel(mood) {
  if (mood <= 3) return "😞 Sad / Low";
  if (mood <= 6) return "😐 Neutral";
  if (mood <= 8) return "🙂 Positive";
  return "😄 Uplifted";
}

// 🧠 Sentiment
function analyzeSentiment(text, mood) {
  const pos = ["happy", "joy", "grateful", "calm", "love", "hope", "thankful"];
  const neg = ["tired", "sad", "angry", "stressed", "worried"];
  let score = 0;
  const t = text.toLowerCase();
  pos.forEach((w) => t.includes(w) && (score += 1));
  neg.forEach((w) => t.includes(w) && (score -= 1));
  if (mood >= 7) score++;
  if (mood <= 3) score--;
  if (score > 1) return "😊 Positive";
  if (score === 1) return "🙂 Content";
  if (score === 0) return "😐 Neutral";
  return "😟 Stressed";
}

// 🌈 Affirmation
function affirmationFor(sentiment) {
  const A = {
    "😊 Positive": ["Keep radiating gratitude.", "You’re glowing with joy."],
    "🙂 Content": ["Peace is your quiet strength.", "You are calm and balanced."],
    "😐 Neutral": ["Even slow days help you grow.", "Stillness is also progress."],
    "😟 Stressed": ["This too shall pass.", "Breathe. You’ve handled worse."],
  };
  const opts = A[sentiment] || ["Stay thankful."];
  return opts[Math.floor(Math.random() * opts.length)];
}

export default function App() {
  const [view, setView] = useState("journal");
  const [dark, setDark] = useState(false);
  const [quote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [entries, setEntries] = useState([]);

  // Modal Editing
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [editMood, setEditMood] = useState(5);

  // Load local theme + entries
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDark(theme === "dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
  }, [entries]);

  // Save entry
  const handleSave = () => {
    if (!entry.trim() || !question) return;
    const sentiment = analyzeSentiment(entry, mood);
    const e = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      section,
      question,
      entry,
      mood,
      sentiment,
    };
    setEntries((prev) => [...prev, e]);
    setEntry("");
    setQuestion("");
    setMood(5);
  };

  // Delete
  const handleDelete = (id) => setEntries((arr) => arr.filter((e) => e.id !== id));

  // Modal edit
  const openEdit = (item) => {
    setEditing(item);
    setEditText(item.entry);
    setEditMood(item.mood);
  };

  const saveEdit = () => {
    if (!editing) return;
    const sentiment = analyzeSentiment(editText, editMood);
    setEntries((arr) =>
      arr.map((e) =>
        e.id === editing.id ? { ...e, entry: editText, mood: editMood, sentiment } : e
      )
    );
    setEditing(null);
  };

  // Export TXT
  const exportTxt = () => {
    const content = entries
      .map(
        (e) =>
          `${e.date}\nSection: ${e.section}\nMood: ${e.mood}/10 (${e.sentiment})\nQ: ${e.question}\nA: ${e.entry}\n`
      )
      .join("\n----------------\n");
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Gratitude_Journal.txt";
    link.click();
  };

  // Export CSV
  const exportCsv = () => {
    const header = ["Date", "Section", "Mood", "Sentiment", "Question", "Entry"];
    const rows = entries.map((e) => [
      `"${e.date}"`,
      `"${e.section}"`,
      e.mood,
      `"${e.sentiment}"`,
      `"${e.question}"`,
      `"${e.entry.replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Gratitude_Journal.csv";
    link.click();
  };

  // Summary
  const summary = useMemo(() => {
    if (!entries.length) return null;
    const last7 = entries.slice(-7);
    const avgMood = (last7.reduce((a, e) => a + e.mood, 0) / last7.length).toFixed(1);
    const trend = entries.map((e) => ({ date: e.date, mood: e.mood }));
    const sentiment = entries.at(-1)?.sentiment || "🙂 Content";
    const tip = affirmationFor(sentiment);
    return { avgMood, trend, sentiment, tip };
  }, [entries]);

  // Handle restore from GoogleSync: update React state immediately (cross-device)
  const handleRestore = (restored) => {
    if (restored?.entries) {
      // clone so React sees a new reference
      setEntries([...restored.entries]);
    }
  };

  return (
    <div
      className={`min-h-screen p-6 max-w-3xl mx-auto ${
        dark ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button variant="outline" onClick={() => setDark((d) => !d)}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </div>

      <p className="text-center text-gray-500 mt-1">
        Save short reflections daily. Track mood & insights weekly.
      </p>
      <p className="italic text-center text-green-600 mb-4">“{quote}”</p>

      {/* Suggested sections (tiny nudge) */}
      <p className="text-center text-sm text-gray-500 mb-2">
        Try rotating topics: <em>People & Relationships</em>, <em>Self & Growth</em>,
        <em> Nature & Calm</em>, <em>Work & Purpose</em>, <em>Health</em>, <em>Hope</em>.
      </p>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        <Button
          variant={view === "journal" ? "default" : "outline"}
          onClick={() => setView("journal")}
        >
          ✍️ Journal
        </Button>
        <Button
          variant={view === "summary" ? "default" : "outline"}
          onClick={() => setView("summary")}
        >
          📊 Summary
        </Button>
      </div>

      {/* JOURNAL */}
      {view === "journal" && (
        <Card>
          <CardContent className="space-y-4">
            <Select
              value={section}
              onChange={(v) => {
                setSection(v);
                setQuestion("");
              }}
              options={Object.keys(sections)}
            />
            <Select
              value={question}
              onChange={setQuestion}
              options={["", ...sections[section]]}
              placeholder="Pick a question"
            />
            {question && (
              <>
                <Textarea
                  placeholder="Write your reflection..."
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
                <div>
                  <p className="text-sm">
                    Mood: {mood}/10 ({moodLabel(mood)})
                  </p>
                  <Slider min={1} max={10} step={1} value={[mood]} onChange={(v) => setMood(v[0])} />
                </div>
                <Button onClick={handleSave}>Save Entry</Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* SUMMARY */}
      {view === "summary" && summary && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-2xl font-semibold">Weekly Summary</h2>
            <p>
              Average mood: <strong>{summary.avgMood}/10</strong>
            </p>

            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={summary.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#16a34a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>

            <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
              <p className="font-semibold text-green-800">🌞 Reflection Tip:</p>
              <p className="italic text-green-700">“{summary.tip}”</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={exportTxt} variant="outline">
                Export .TXT
              </Button>
              <Button onClick={exportCsv} variant="outline">
                Export .CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past entries */}
      {view === "journal" && entries.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">🕊 Past Entries</h3>
            <Button variant="outline" onClick={exportTxt}>
              Export All
            </Button>
          </div>
          {entries
            .slice()
            .reverse()
            .map((e) => (
              <Card key={e.id}>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-400">
                        {e.date} — {e.section}
                      </p>
                      <p className="text-sm text-gray-600">
                        Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => openEdit(e)}>
                        Edit
                      </Button>
                      <Button variant="outline" onClick={() => handleDelete(e.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 font-medium">{e.question}</p>
                  <p className="mt-1 whitespace-pre-wrap">{e.entry}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[90%] max-w-md space-y-4">
            <h3 className="text-lg font-semibold">✏️ Edit Entry</h3>
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div>
              <p className="text-sm">
                Mood: {editMood}/10 ({moodLabel(editMood)})
              </p>
              <Slider min={1} max={10} value={[editMood]} onChange={(v) => setEditMood(v[0])} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Sync + Install */}
      <div className="flex justify-between items-center mt-8">
        <div className="text-sm text-gray-500">💾 Auto-synced to browser storage</div>
        <InstallPrompt />
      </div>

      <div className="text-center mt-3">
        <GoogleSync
          dataToSync={{ entries }}
          onRestore={handleRestore}
        />
      </div>
    </div>
  );
}
