import { useState, useEffect } from "react";
import { Card, CardContent } from "../../ui/Card.jsx";
import { Button } from "../../ui/Button.jsx";
import { Select } from "../../ui/Select.jsx";
import { Slider } from "../../ui/Slider.jsx";
import { Textarea } from "../../ui/Textarea.jsx";
import PhotoUpload from "./Attachments/PhotoUpload.jsx";
import VoiceRecorder from "./Attachments/VoiceRecorder.jsx";
import SketchPad from "./Attachments/SketchPad.jsx";

export default function JournalEditor({ sections, addEntry, setToast, setShowGlow }) {
  const [section, setSection] = useState(Object.keys(sections)[0]);
  const [question, setQuestion] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState(5);
  const [photo, setPhoto] = useState(null);
  const [voice, setVoice] = useState(null);
  const [sketch, setSketch] = useState(null);

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shufflePrompt = () => {
    const next = pickRandom(Object.keys(sections));
    setSection(next);
    setQuestion(pickRandom(sections[next]));
    setToast("🔀 New prompt loaded");
    setTimeout(() => setToast(""), 1500);
  };

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
      photo,
      voice,
      sketch,
    };
    addEntry(e);
    setEntry("");
    setPhoto(null);
    setVoice(null);
    setSketch(null);
    setMood(5);
    setShowGlow(true);
    setTimeout(() => setShowGlow(false), 1600);
  }

  return (
    <Card className="mt-4">
      <CardContent className="space-y-4">
        {/* section + question selectors */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select
            value={section}
            onChange={(v) => {
              setSection(v);
              setQuestion(pickRandom(sections[v]));
            }}
            options={Object.keys(sections)}
          />
          <Select
            value={question}
            onChange={setQuestion}
            options={["", ...(sections[section] || [])]}
            placeholder="Pick a question"
          />
          <Button variant="outline" onClick={shufflePrompt}>
            🔀 Shuffle
          </Button>
        </div>

        {/* entry */}
        {question && (
          <>
            <Textarea
              placeholder="Write your reflection..."
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />

            {/* mood slider */}
            <div>
              <p className="text-sm">Mood: {mood}/10</p>
              <Slider min={1} max={10} value={[mood]} onChange={(v) => setMood(v[0])} />
            </div>

            {/* attachments */}
            <PhotoUpload photo={photo} setPhoto={setPhoto} />
            <VoiceRecorder voice={voice} setVoice={setVoice} />
            <SketchPad sketch={sketch} setSketch={setSketch} />

            <Button onClick={handleSave}>Save Entry</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

