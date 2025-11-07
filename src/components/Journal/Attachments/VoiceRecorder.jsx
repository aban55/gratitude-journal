import { useState, useRef } from "react";

export default function VoiceRecorder({ voice, setVoice }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        chunks.current = [];
        const url = URL.createObjectURL(blob);
        setVoice(url);
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch {
      alert("🎙️ Microphone permission denied");
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  return (
    <div className="mt-3">
      <p className="text-sm font-medium mb-1">🎙️ Voice Note</p>
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`px-3 py-1 rounded-md border ${
          recording ? "bg-red-100 border-red-300" : "bg-amber-50 border-amber-200"
        }`}
      >
        {recording ? "⏹ Stop" : "🎤 Record"}
      </button>
      {voice && (
        <div className="mt-2">
          <audio controls src={voice} className="w-full" />
          <button
            onClick={() => setVoice(null)}
            className="text-xs text-red-600 underline mt-1"
          >
            remove
          </button>
        </div>
      )}
    </div>
  );
}

