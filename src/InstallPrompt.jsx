import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logEvent } from "./analytics";

export default function InstallPrompt({ darkMode }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    // iOS custom banner
    if (isIOS && !isStandalone) {
      setShowIOSBanner(true);
      logEvent("pwa_ios_banner_shown");
    }

    // Chrome / Edge install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
      logEvent("pwa_prompt_shown");
    });

    window.addEventListener("appinstalled", () => {
      logEvent("pwa_installed");
      setVisible(false);
      setShowIOSBanner(false);
    });
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    logEvent("pwa_prompt_result", { outcome });
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-4 left-0 right-0 flex justify-center z-50"
        >
          <button
            onClick={handleInstall}
            className={`px-5 py-3 rounded-xl shadow-lg font-medium flex items-center gap-2 ${
              darkMode
                ? "bg-green-600 text-white hover:bg-green-500"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            📲 Install Gratitude Journal
          </button>
        </motion.div>
      )}

      {showIOSBanner && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.6 }}
          className="fixed bottom-4 left-0 right-0 flex justify-center z-50"
        >
          <div
            className={`max-w-sm mx-auto text-center px-4 py-3 rounded-lg text-sm shadow-md ${
              darkMode
                ? "bg-gray-800 text-gray-100"
                : "bg-white text-gray-800 border border-gray-200"
            }`}
          >
            <p className="font-medium">📱 Add to Home Screen</p>
            <p className="text-xs opacity-80 mt-1">
              Tap <span className="font-semibold">Share → Add to Home Screen</span> to install.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
