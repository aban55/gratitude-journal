import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function InstallPrompt({ inline = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (installed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4"
    >
      {deferredPrompt && (
        <button
          onClick={installApp}
          className="bg-green-600 text-white px-4 py-2 rounded-full shadow hover:bg-green-700"
        >
          📲 Install App
        </button>
      )}
    </motion.div>
  );
}
