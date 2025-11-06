// Lightweight local analytics (no external tracking)
self.addEventListener("message", (event) => {
  if (!event.data?.type) return;
  const entry = {
    event: event.data.type,
    timestamp: new Date().toISOString(),
  };
  const logs = JSON.parse(localStorage.getItem("gratitude_analytics") || "[]");
  logs.push(entry);
  localStorage.setItem("gratitude_analytics", JSON.stringify(logs));
});
