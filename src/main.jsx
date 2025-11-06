import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Render the React App
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker Registration & Install Prompt
if (import.meta?.env?.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then((registration) => {
      console.log("Service Worker registered:", registration);

      // Handle the 'beforeinstallprompt' event
      let deferredPrompt;
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault(); // Prevent the default prompt
        deferredPrompt = e; // Save the event so it can be triggered later

        // Show a custom install button or banner
        const installButton = document.getElementById("install-btn");
        if (installButton) {
          installButton.style.display = "block"; // Show the button
          installButton.addEventListener("click", () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((result) => {
              if (result.outcome === "accepted") {
                console.log("User accepted the A2HS prompt");
              } else {
                console.log("User dismissed the A2HS prompt");
              }
              deferredPrompt = null; // Reset the prompt
            });
          });
        }
      });

      // Listen for 'message' events from service worker
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "DO_PAGE_UPLOAD") {
          window.dispatchEvent(new CustomEvent("gj-sync-request"));
        }
      });
    });
  });
}
