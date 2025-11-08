import { useEffect } from "react";
import { positivityIndex } from "../utils/metricsHelpers.js";

export default function useAnalytics(entries) {
  useEffect(() => {
    // Guard: do nothing until entries are available
    if (!Array.isArray(entries) || entries.length === 0) return;

    const sessionId =
      localStorage.getItem("gj_session_id") ||
      (() => {
        const id = Math.random().toString(36).slice(2, 10);
        localStorage.setItem("gj_session_id", id);
        return id;
      })();

    const totalEntries = entries.length;
    const avgMood =
      entries.reduce((sum, e) => sum + (e.mood || 0), 0) / entries.length;
    const posIndex = positivityIndex(entries);

    const payload = {
      sessionId,
      totalEntries,
      avgMood: avgMood.toFixed(1),
      positivityIndex: posIndex,
      browser: navigator.userAgent,
      platform: navigator.platform,
      version: "1.1.0",
    };

    // Replace this URL with your Apps Script deployment link
    const scriptURL = "https://script.google.com/macros/s/___YOUR_DEPLOY_ID___/exec";

    try {
      fetch(scriptURL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Telemetry error:", err);
    }
  }, [entries]);
}
