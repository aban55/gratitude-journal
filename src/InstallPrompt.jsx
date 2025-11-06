// src/InstallPrompt.jsx
import React, { useEffect, useState } from "react";

export default function InstallPrompt({ inline = false }) {
  const [deferred, setDeferred] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      // Intercept so we can control when to show the prompt
      e.preventDefault();
      setDeferred(e);
      setCanInstall(true);

      // Auto prompt ONCE per session to avoid console warning
      const autoKey = "gj_pwa_autoprompted";
      const alreadyAutoPrompted = sessionStorage.getItem(autoKey) === "1";
      if (!alreadyAutoPrompted) {
        (async () => {
          try {
            const choice = await e.prompt(); // show now
            // choice = { outcome: 'accepted' | 'dismissed' }
            // Mark that we tried auto-prompt this session
            sessionStorage.setItem(autoKey, "1");
            // After prompting, this event is single-use; clear it
            setDeferred(null);
            setCanInstall(false);
            // If dismissed, we’ll show manual button next time event fires again
          } catch {
            // ignore
          }
        })();
      }
    };

    const onInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      setDeferred(null);
      // optional: clean session flag
      sessionStorage.removeItem("gj_pwa_autoprompted");
      // console.log("✅ App installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) {
      alert("Install prompt not available yet. Try again in a moment.");
      return;
    }
    const choice = await deferred.prompt();
    // choice.outcome is 'accepted' | 'dismissed'
    // This event can only be used once
    setDeferred(null);
    setCanInstall(false);
  };

  if (installed || !canInstall) return null;

  // Render either inline small button (for putting inside a banner)
  // or floating FAB style (default).
  const Button = (
    <button
      onClick={handleInstall}
      className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
    >
      📱 Install App
    </button>
  );

  if (inline) return Button;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border rounded-lg shadow p-3">
      <div className="text-sm mb-2">Install Gratitude Journal?</div>
      {Button}
    </div>
  );
}
