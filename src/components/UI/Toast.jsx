export default function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-black/80 text-white rounded-full shadow-lg text-sm">
      {message}
      <button
        onClick={onClose}
        className="ml-3 text-white/80 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
