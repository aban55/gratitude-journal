import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from './ui/Card.jsx'
import { Button } from './ui/Button.jsx'
import { Textarea } from './ui/Textarea.jsx'
import { Select } from './ui/Select.jsx'
import { Slider } from './ui/Slider.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import GoogleSync from './GoogleSync.jsx'

// --- SECTIONS & PROMPTS ---
const sections = {
  'People & Relationships': [
    'Who made my life easier or better today?',
    'Which friend or family member am I grateful for — and why?',
    'What small act of kindness did someone show me recently?',
    'What’s a quality in someone close to me that I admire?',
    'Who did I help or encourage today — and how did that feel?'
  ],
  'Self & Inner Strength': [
    'What ability or personal quality am I thankful for today?',
    'What challenge have I handled better than before?',
    'What is one thing about my body or health I appreciate?',
    'What habit or discipline am I proud of keeping?',
    'What lesson did a past mistake teach me that helps me now?'
  ],
  'Learning & Growth': [
    'What new idea or skill did I learn recently?',
    'What feedback or advice am I grateful for?',
    'What am I curious or excited to explore next?',
    'What problem am I grateful to have — because it’s teaching me something?',
    'What book, conversation, or experience gave me insight recently?'
  ],
  'Environment & Everyday Comforts': [
    'What part of my home brings me peace or comfort?',
    'What small thing in nature caught my attention today - light, wind, birds, sky, trees?',
    'What simple pleasure did I enjoy — food, music, warmth, quiet?',
    'What modern convenience or tool makes life smoother?',
    'What moment today felt safe, calm, or peaceful?'
  ],
  'Perspective & Hope': [
    'What opportunity am I grateful to have that others may not?',
    'What am I looking forward to in the coming week?',
    'Who or what reminds me that life is bigger than my worries?',
    'How has a tough time in my life shaped who I am today?',
    'What am I thankful for that I usually take for granted?'
  ],
  'Health & Wellbeing': [
    'What part of my body served me well today?',
    'What healthy choice did I make today?',
    'How does my body show gratitude when I care for it?',
    'What signs of recovery or strength am I noticing lately?',
    'Who supports my physical or emotional health — and how can I appreciate them?'
  ]
}

// --- SENTIMENT ANALYSIS ---
function analyzeSentiment(text, mood) {
  const positiveWords = ['grateful', 'happy', 'joy', 'calm', 'peace', 'love', 'thankful', 'excited', 'proud', 'hopeful']
  const negativeWords = ['tired', 'sad', 'angry', 'stressed', 'worried', 'upset', 'frustrated', 'lonely']
  let score = 0
  const lower = text.toLowerCase()
  positiveWords.forEach(w => lower.includes(w) && (score += 1))
  negativeWords.forEach(w => lower.includes(w) && (score -= 1))
  if (mood >= 7) score += 2
  if (mood <= 3) score -= 2

  if (score > 2) return '😊 Positive'
  if (score > 0) return '🙂 Calm/Content'
  if (score === 0) return '😐 Neutral'
  return '😟 Stressed/Low'
}

// --- AFFIRMATIONS ---
function getAffirmation(sentiment) {
  const affirmations = {
    '😊 Positive': [
      'Keep nurturing your joy; it’s contagious.',
      'You are radiating warmth and balance today.',
      'Happiness expands when you acknowledge it — well done.'
    ],
    '🙂 Calm/Content': [
      'Peace is your quiet strength; cherish it.',
      'You are centered and composed — keep flowing with grace.',
      'Tranquility is the sign of inner growth; honor it.'
    ],
    '😐 Neutral': [
      'Even neutral days are steps forward — awareness itself is growth.',
      'Stillness allows new gratitude to form — stay open.',
      'Your calm presence is your power today.'
    ],
    '😟 Stressed/Low': [
      'Breathe — difficult moments are teachers in disguise.',
      'This feeling will pass; you’ve overcome tougher days.',
      'Strength grows quietly through resilience — you’re doing fine.'
    ]
  }
  const options = affirmations[sentiment] || ['Keep showing up — it matters more than you know.']
  return options[Math.floor(Math.random() * options.length)]
}

export default function App() {
  const [section, setSection] = useState('People & Relationships')
  const [question, setQuestion] = useState('')
  const [entry, setEntry] = useState('')
  const [savedEntries, setSavedEntries] = useState([])
  const [savedAffirmations, setSavedAffirmations] = useState([])
  const [mood, setMood] = useState(5)
  const [view, setView] = useState('journal')
  const [lastSaved, setLastSaved] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  const [googleUser, setGoogleUser] = useState(null)

  // --- Load from localStorage ---
  useEffect(() => {
    const e = localStorage.getItem('gratitudeEntries')
    if (e) setSavedEntries(JSON.parse(e))
    const a = localStorage.getItem('savedAffirmations')
    if (a) setSavedAffirmations(JSON.parse(a))
    const d = localStorage.getItem('gj_draft_v1')
    if (d) {
      const draft = JSON.parse(d)
      if (draft.entry) setEntry(draft.entry)
      if (draft.section) setSection(draft.section)
      if (draft.question) setQuestion(draft.question)
      if (draft.mood) setMood(draft.mood)
    }
    const storedTheme = localStorage.getItem('gj_theme')
    if (storedTheme) setDarkMode(storedTheme === 'dark')
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkMode(prefersDark)
      localStorage.setItem('gj_theme', prefersDark ? 'dark' : 'light')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('gratitudeEntries', JSON.stringify(savedEntries))
    localStorage.setItem('savedAffirmations', JSON.stringify(savedAffirmations))
  }, [savedEntries, savedAffirmations])

  useEffect(() => {
    localStorage.setItem('gj_theme', darkMode ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // --- Auto-save draft ---
  useEffect(() => {
    const payload = { section, question, entry, mood, updatedAt: Date.now() }
    const t = setTimeout(() => {
      localStorage.setItem('gj_draft_v1', JSON.stringify(payload))
      setLastSaved(new Date())
    }, 500)
    return () => clearTimeout(t)
  }, [section, question, entry, mood])

  // --- Save Entry ---
  const handleSave = () => {
    if (question && entry.trim()) {
      const sentiment = analyzeSentiment(entry, mood)
      const newEntry = { date: new Date().toLocaleDateString(), section, question, entry, mood, sentiment }
      setSavedEntries([...savedEntries, newEntry])
      setEntry('')
      setQuestion('')
      setMood(5)
      localStorage.removeItem('gj_draft_v1')
      setLastSaved(null)
    }
  }

  // --- Export All ---
  const handleExport = () => {
    const text = savedEntries.map(e =>
      `${e.date} — ${e.section}\nMood: ${e.mood}/10\nSentiment: ${e.sentiment}\nQ: ${e.question}\nA: ${e.entry}\n`
    ).join('\n-------------------\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'Gratitude_Journal.txt'
    link.click()
  }

  const handleSaveAffirmation = quote => {
    if (!savedAffirmations.some(a => a.quote === quote))
      setSavedAffirmations([...savedAffirmations, { quote, date: new Date().toLocaleDateString() }])
  }

  // --- 9 PM Reminder ---
  useEffect(() => {
    const now = new Date()
    const target = new Date()
    target.setHours(21, 0, 0, 0)
    const ms = target.getTime() - now.getTime()
    if (ms > 0) {
      const t = setTimeout(() => alert('🕯 Time for your daily gratitude reflection!'), ms)
      return () => clearTimeout(t)
    }
  }, [])

  // --- Summary Computation ---
  const summary = useMemo(() => {
    if (!savedEntries.length) return null
    const last10 = savedEntries.slice(-10)
    const last7 = savedEntries.slice(-7)
    const avgMood = (last7.reduce((acc, e) => acc + e.mood, 0) / last7.length).toFixed(1)
    const sectionCounts = last7.reduce((acc, e) => { acc[e.section] = (acc[e.section] || 0) + 1; return acc }, {})
    const topSections = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
    const bestDays = last7.slice().sort((a, b) => b.mood - a.mood).slice(0, 3).map(e => `${e.date} (${e.mood}/10) — ${e.section}`)
    const sentimentSummary = last10.reduce((acc, e) => { acc[e.sentiment] = (acc[e.sentiment] || 0) + 1; return acc }, {})
    const topSentiment = Object.entries(sentimentSummary).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const leastFocused = Object.entries(sectionCounts).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k]) => k)
    const dailyAffirmation = getAffirmation(topSentiment)
    return { avgMood, topSections, bestDays, sentimentSummary, topSentiment, leastFocused, dailyAffirmation }
  }, [savedEntries])

  // --- UI ---
  return (
    <div className={`p-6 space-y-4 max-w-3xl mx-auto transition-colors duration-300 ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">🌿 Daily Gratitude Journal</h1>
        <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-green-500 text-white" title="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <p className="text-center text-gray-500 mb-4">Save short reflections daily. Track mood & insights weekly.</p>

      <div className="flex justify-center gap-2 mb-4">
        <Button variant={view === 'journal' ? 'default' : 'outline'} onClick={() => setView('journal')}>Journal</Button>
        <Button variant={view === 'summary' ? 'default' : 'outline'} onClick={() => setView('summary')}>Weekly Summary</Button>
        <Button variant={view === 'affirmations' ? 'default' : 'outline'} onClick={() => setView('affirmations')}>Saved Affirmations</Button>
      </div>

      {/* Journal */}
      {view === 'journal' && (
        <>
          <Card>
            <CardContent className="space-y-4">
              <Select value={section} onChange={val => { setSection(val); setQuestion('') }} options={Object.keys(sections)} />
              <Select value={question} onChange={setQuestion} options={['', ...sections[section]]} placeholder="Pick a gratitude question" />

              {question && (
                <>
                  <p className="text-sm text-gray-600">{question}</p>
                  <Textarea placeholder="Write your reflection here..." value={entry} onChange={e => setEntry(e.target.value)} />
                  <div className="space-y-2">
                    <p className="text-sm">Mood for today: {mood}/10</p>
                    <Slider min={1} max={10} step={1} value={[mood]} onChange={v => setMood(v[0])} />
                  </div>
                  {lastSaved && <p className="text-xs text-gray-400">Saved • {lastSaved.toLocaleTimeString()}</p>}
                  <Button onClick={handleSave}>Save Entry</Button>
                </>
              )}
            </CardContent>
          </Card>

          {savedEntries.length > 0 && (
            <div className="space-y-3 mt-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">🕊 Past Entries</h2>
                <Button onClick={handleExport} variant="outline">Export All</Button>
              </div>
              {savedEntries.map((e, i) => (
                <Card key={i}>
                  <CardContent>
                    <p className="text-sm text-gray-500">{e.date} — {e.section}</p>
                    <div className="text-xs mt-1 font-semibold flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        e.mood >= 7 ? 'bg-green-500' : e.mood <= 3 ? 'bg-red-500' : 'bg-yellow-400'
                      }`}></span>
                      <span className={
                        e.sentiment.includes('Positive') ? 'text-green-600' :
                        e.sentiment.includes('Low') ? 'text-red-500' : 'text-gray-600'
                      }>
                        Mood: {e.mood}/10 | Sentiment: {e.sentiment}
                      </span>
                    </div>
                    <p className="font-medium mt-1">{e.question}</p>
                    <p className="mt-2 whitespace-pre-wrap">{e.entry}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Summary */}
      {view === 'summary' && summary && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-semibold">📊 Weekly Summary & Insights</h2>
            <p>Average Mood (last 7 entries): <strong>{summary.avgMood}/10</strong></p>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={savedEntries.map(e => ({ date: e.date, mood: e.mood }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="mood" stroke="#16a34a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>

            <div>
              <p className="font-medium">Top 3 Gratitude Themes:</p>
              <ul className="list-disc list-inside">
                {summary.topSections.map((sec, i) => <li key={i}>{sec}</li>)}
              </ul>
            </div>

            <div>
              <p className="font-medium">Top 3 Positive Days:</p>
              <ul className="list-disc list-inside">
                {summary.bestDays.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>

            <div>
              <p className="font-medium">🧠 Reflection Insights:</p>
              <p>Dominant Sentiment: <strong>{summary.topSentiment}</strong></p>
              <ul className="list-disc list-inside">
                {Object.entries(summary.sentimentSummary).map(([tone, count], i) => (
                  <li key={i}>{tone}: {count} entries</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium">🌈 Positive Focus for Next Week:</p>
              <ul className="list-disc list-inside">
                {summary.leastFocused.map((sec, i) => <li key={i}>{sec}</li>)}
              </ul>
              <p className="text-sm text-gray-500 mt-2">Exploring these may bring new balance and gratitude variety.</p>
            </div>

            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="font-semibold text-green-800">🌞 Daily Affirmation:</p>
              <p className="text-green-700 italic">“{summary.dailyAffirmation}”</p>
              <Button variant="outline" className="mt-2" onClick={() => handleSaveAffirmation(summary.dailyAffirmation)}>
                Save to My Favorites
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affirmations */}
      {view === 'affirmations' && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-semibold">💖 My Saved Affirmations</h2>
            {savedAffirmations.length === 0 ? (
              <p className="text-gray-600">No…saved affirmations yet. Save ones that inspire you from the Summary.</p>
            ) : (
              <ul className="list-disc list-inside space-y-2">
                {savedAffirmations.map((a, i) => (
                  <li key={i}>
                    <span className="italic">“{a.quote}”</span>
                    <p className="text-xs text-gray-500">Saved on {a.date}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Google Drive Sync + Account Display */}
      <div className="text-center mt-6">
        <GoogleSync
  	  dataToSync={{ savedEntries, savedAffirmations }}
  	  onRestore={(restored) => {
   	  if (restored.savedEntries) setSavedEntries(restored.savedEntries);
  	  if (restored.savedAffirmations)
     	  setSavedAffirmations(restored.savedAffirmations);
 	  }}
	/>

        {googleUser && (
          <p className="text-sm text-green-500 mt-2">
            ✅ Signed in as <strong>{googleUser.email}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
