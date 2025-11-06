import React, { useEffect, useState } from "react";

/**
 * InstallPrompt.jsx
 * Handles the PWA install flow cleanly:
 * - Captures the beforeinstallprompt event
 * - Shows a small “Install App” button when installable
 * - Calls .prompt() properly to avoid console warnings
 */

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Stop default mini-info bar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log("✅ PWA install prompt captured.");
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log("✅ App installed successfully.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return alert("⚠️ Install prompt not available yet.");
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") console.log("✅ User accepted install.");
    else console.log("❌ User dismissed install.");
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (installed || !isInstallable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-green-700 transition-all">
      <button onClick={handleInstallClick}>📱 Install Gratitude Journal</button>
    </div>
  );
}
