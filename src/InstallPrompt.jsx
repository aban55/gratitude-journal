import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPrompt({ darkMode }) {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // iOS Safari/Chrome hint (no beforeinstallprompt)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isIOS && !isStandalone) {
      setIosHint(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const askInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome !== "accepted") {
      // let them call again after a while
      setTimeout(() => setShow(true), 10000);
    }
  };

  const bg = darkMode ? "bg-emerald-500" : "bg-green-600";

  return (
    <>
      {/* Floating FAB */}
      <AnimatePresence>
        {show && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={askInstall}
            className={`${bg} text-white fixed right-5 bottom-5 rounded-full shadow-xl px-4 py-3`}
          >
            Install App
          </motion.button>
        )}
      </AnimatePresence>

      {/* iOS hint bubble */}
      {iosHint && !show && (
        <div className="fixed right-5 bottom-5 max-w-xs rounded-xl shadow-lg p-3 text-sm bg-white border">
          <b>Add to Home Screen:</b> Tap <span>Share</span> → <i>Add to Home Screen</i>.
        </div>
      )}
    </>
  );
}
