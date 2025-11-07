import { Button } from "../../ui/Button.jsx";

export default function FirstEntryPrompt({ open, onClose, onStart }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#fbf5e6] text-amber-900 rounded-2xl shadow-2xl w-[90%] max-w-md p-6 border border-amber-300">
        <h2 className="text-2xl font-bold mb-2 text-center">🌞 Your First Entry</h2>
        <p className="text-[15px] text-center leading-relaxed mb-5">
          Start with something simple — <strong>What made you smile today?</strong>
        </p>
        <div className="flex justify-center gap-2">
          <Button
            onClick={onStart}
            className="bg-amber-600 hover:bg-amber-700 text-white px-5"
          >
            Start Writing
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="border border-amber-300 bg-white"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}
