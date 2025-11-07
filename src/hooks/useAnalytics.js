import { useEffect } from "react";

export default function useAnalytics(eventName, payload = {}) {
  useEffect(() => {
    const metrics = JSON.parse(localStorage.getItem("gj_metrics") || "{}");
    const count = metrics[eventName] ? metrics[eventName] + 1 : 1;
    metrics[eventName] = count;
    metrics.lastEvent = { name: eventName, time: new Date().toISOString(), payload };
    localStorage.setItem("gj_metrics", JSON.stringify(metrics));
  }, []);
}

