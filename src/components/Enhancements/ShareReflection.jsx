export default function ShareReflection({ entry }) {
  if (!entry) return null;

  function handleCopy() {
    const text = `🌿 Gratitude Entry\n${entry.question}\n\n${entry.entry}\n— ${entry.sentiment}`;
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard 🌸");
  }

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-amber-700 underline hover:text-amber-900"
    >
      Share Reflection
    </button>
  );
}
