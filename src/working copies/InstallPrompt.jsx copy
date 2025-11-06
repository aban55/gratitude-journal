// src/InstallPrompt.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Capture the install prompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect already-installed state
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    // iOS Safari hint
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isIOS && !isStandalone) setShowHint(true);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  return (
    <>
      {deferredPrompt && (
        <motion.button
          onClick={handleInstall}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
          className="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-green-700"
        >
          📲 Install App
        </motion.button>
      )}

      {showHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-5 left-5 right-5 text-center bg-yellow-100 text-yellow-800 p-3 rounded-lg shadow"
        >
          💡 Tap <strong>Share ▸ Add to Home Screen</strong> to install this app
        </motion.div>
      )}
    </>
  );
}
