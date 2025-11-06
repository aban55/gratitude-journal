// src/InstallPrompt.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      console.log("✅ PWA install prompt captured.");
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log("✅ PWA installed successfully!");
      setIsInstalled(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // iOS Safari hint
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;
    if (isIOS && !isStandalone) setShowHint(true);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 🔄 Automatically show banner once per session
  useEffect(() => {
    if (deferredPrompt && !autoPrompted) {
      setAutoPrompted(true);
      const timer = setTimeout(async () => {
        try {
          deferredPrompt.prompt(); // ✅ Triggers native install banner
          const choice = await deferredPrompt.userChoice;
          if (choice.outcome === "accepted") {
            console.log("📲 User accepted auto install prompt");
            setIsInstalled(true);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 4000);
          } else {
            console.log("❌ User dismissed auto install prompt");
          }
          setDeferredPrompt(null);
        } catch (err) {
          console.warn("Install prompt failed:", err);
        }
      }, 2500); // wait a couple seconds after load
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, autoPrompted]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("📲 User accepted manual install prompt");
      setIsInstalled(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } else {
      console.log("❌ User dismissed manual install prompt");
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  return (
    <>
      {deferredPrompt && !autoPrompted && (
        <motion.button
          onClick={handleInstall}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.3 }}
          className="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-green-700 fixed bottom-5 right-5 z-50"
        >
          📲 Install App
        </motion.button>
      )}

      {showHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-5 left-5 right-5 text-center bg-yellow-100 text-yellow-800 p-3 rounded-lg shadow z-50"
        >
          💡 Tap <strong>Share ▸ Add to Home Screen</strong> to install this app
        </motion.div>
      )}

      {showSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-800 px-4 py-2 rounded-full shadow-md z-50"
        >
          ✅ App installed successfully!
        </motion.div>
      )}
    </>
  );
}
