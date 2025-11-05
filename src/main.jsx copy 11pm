import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
    // If SW asks page to upload (after background sync), re-dispatch a custom event
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "DO_PAGE_UPLOAD") {
        window.dispatchEvent(new CustomEvent("gj-sync-request"));
      }
    });
  });
}
