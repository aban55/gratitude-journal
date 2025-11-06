import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "./ui/Card.jsx";
import { Button } from "./ui/Button.jsx";
import { Textarea } from "./ui/Textarea.jsx";
import { Select } from "./ui/Select.jsx";
import { Slider } from "./ui/Slider.jsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import GoogleSync from "./GoogleSync.jsx";

// 🌿 Quote pool for intro
const quotes = [
  "Gratitude turns ordinary days into blessings.",
  "Peace begins the moment you choose gratitude.",
  "Joy grows in the soil of appreciation.",
  "The more grateful you are, the more beauty you see.",
  "Each day is a new page to write your thanks."
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

// 🌈 Sentiment analysis
function analyzeSentiment(text, mood) {
  const pos = ["grateful", "happy", "joy", "peace", "love", "thankful", "hopeful", "calm"];
  const neg = ["tired", "sad", "angry", "stressed", "worried", "upset", "lonely"];
  let score = 0;
  const t = text.toLowerCase();
  pos.forEach(w => t.includes(w) && (score += 1));
  neg.forEach(w => t.includes(w) && (score -= 1));
  if (mood >= 7) score += 1;
  if (mood <= 3) score -= 1;
  if (score > 1) return "😊 Positive";
  if (score === 1) return "🙂 Calm/Content";
  if (score === 0) return "😐 Neutral";
  return "😟 Stressed/Low";
}

// 💬 Mood label
function moodLabel(mood) {
  if (mood <= 3) return "😞 Low";
  if (mood <= 6) return "😐 Neutral";
  if (mood <= 8) return "🙂 Happy";
  return "😄 Uplifted";
}

// 🌤 Affirmations
function getAffirmation(sentiment) {
  const affirm = {
    "😊 Positive": [
      "Keep radiating gratitude — it shapes your world.",
      "Your light today makes someone else's day brighter.",
    ],
    "🙂 Calm/Content": [
      "Tranquility is strength in motion.",
      "Your centeredness is a quiet superpower.",
    ],
    "😐 Neutral": [
      "Even stillness is progress — awareness counts.",
      "Neutral moments prepare you for joy ahead.",
    ],
    "😟 Stressed/Low": [
      "This moment will pass — breathe and release.",
      "You’ve overcome before; you’ll rise again soon.",
    ],
  };
  const list = affirm[sentiment] || ["Keep noticing small blessings — they multiply."];
  return list[Math.floor(Math.random() * list.length)];
}

export default function App() {
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);
  const [mood, setMood] = useState(5);
  const [view, setView] = useState("journal");
  const [darkMode, setDarkMode] = useState(false);
  const [quote, setQuote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);

  // Load data
  useEffect(() => {
    const s = localStorage.getItem("gratitudeEntries");
    if (s) setEntries(JSON.parse(s));
    const theme = localStorage.getItem("gj_theme");
    if (theme) setDarkMode(theme === "dark");
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(prefersDark);
      localStorage.setItem("gj_theme", prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("gratitudeEntries", JSON.stringify(entries));
    localStorage.setItem("gj_theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [entries, darkMode]);

  // Save entry
  const handleSave = () => {
    if (!entry.trim() || !question) return;
    const sentiment = analyzeSentiment(entry, mood);
    const newE = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      section,
      question,
      entry,
      mood,
      sentiment,
    };
    setEntries([...entries, newE]);
    setEntry("");
    setQuestion("");
    setMood(5);
  };

  const handleDelete = (id) => setEntries(entries.filter((e) => e.id !== id));

  const summary = useMemo(() => {
    if (!entries.length) return null;
    const last7 = entries.slice(-7);
    const avgMood = (last7.reduce((a, e) => a + e.mood, 0) / last7.length).toFixed(1);
    const moodTrend = entries.map((e) => ({ date: e.date, mood: e.mood }));
    const sectionCounts = last7.reduce((a, e) => ((a[e.section] = (a[e.section] || 0) + 1), a), {});
    const leastFocused = Object.entries(sectionCounts)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([s]) => s);
    const topSent = entries[entries.length - 1].sentiment;
    return { avgMood, moodTrend, leastFocused, topSent, affirmation: getAffirmation(topSent) };
  }, [entries]);

  // --- UI ---
  return (
    <div
      className={`p-6 space-y-4 max-w-3xl mx-auto transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <Button onClick={() => setDarkMode(!darkMode)} variant="outline">
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </Button>
      </div>

      {/* Intro */}
      <div className="text-center">
        <p className="text-gray-500 mb-2">
          Save short reflections daily. Track mood & insights weekly.
        </p>
        <p className="italic text-green-600 text-sm mb-4">“{quote}”</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-4">
        {["journal", "summary"].map((tab) => (
          <Button
            key={tab}
            variant={view === tab ? "default" : "outline"}
            onClick={() => setView(tab)}
          >
            {tab === "journal" ? "✍️ Journal" : "📊 Summary"}
          </Button>
        ))}
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
              placeholder="Pick a gratitude question"
            />
            {question && (
              <>
                <p className="text-sm text-gray-500">{question}</p>
                <Textarea
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Write your reflection here..."
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

      {/* SUMMARY */}
      {view === "summary" && summary && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-semibold">📈 Weekly Mood Summary</h2>
            <p>Average Mood (last 7 entries): <strong>{summary.avgMood}/10</strong></p>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={summary.moodTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>

            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="font-semibold text-green-800">🌞 Reflection Tip:</p>
              <p className="text-green-700 italic">“{summary.affirmation}”</p>
            </div>

            {summary.leastFocused.length > 0 && (
              <div className="mt-3">
                <p className="font-medium">💡 Try exploring next:</p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {summary.leastFocused.map((sec) => (
                    <li key={sec}>{sec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past Entries */}
      {view === "journal" && entries.length > 0 && (
        <div className="space-y-3 mt-6">
          <h2 className="text-xl font-semibold">🕊 Recent Entries</h2>
          {entries
            .slice()
            .reverse()
            .map((e) => (
              <Card key={e.id}>
                <CardContent>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs text-gray-400">
                        {e.date} — {e.section}
                      </p>
                      <p className="text-sm text-gray-600">
                        Mood {e.mood}/10 ({moodLabel(e.mood)}) | {e.sentiment}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.confirm("Delete this entry?") && handleDelete(e.id)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="mt-2 font-medium">{e.question}</p>
                  <p className="mt-2 whitespace-pre-wrap">{e.entry}</p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Google Drive Sync */}
      <div className="text-center mt-6">
        <GoogleSync
          dataToSync={{ entries }}
          onRestore={(restored) => {
            if (restored.entries) setEntries(restored.entries);
          }}
        />
      </div>
    </div>
  );
}
