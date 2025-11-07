export default function SavedGlow({ visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[1200]">
      <div
        className="px-4 py-2 rounded-full shadow-lg border border-amber-300 bg-amber-100 text-amber-800 text-sm font-medium"
        style={{ animation: "fadePulse 1.6s ease-in-out" }}
      >
        🌿 Saved successfully
      </div>
      <style>{`
        @keyframes fadePulse {
          0% { opacity: 0; transform: translate(-50%, 8px) scale(0.96); }
          20% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -6px) scale(0.98); }
        }
      `}</style>
    </div>
  );
}
