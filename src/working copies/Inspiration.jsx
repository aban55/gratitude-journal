// src/components/Inspiration.jsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Inspiration({ darkMode }) {
  const [quote, setQuote] = useState("Loading inspiration...");
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await fetch(
          "https://api.allorigins.win/get?url=https://zenquotes.io/api/quotes"
        );
        const data = await res.json();
        const quotes = JSON.parse(data.contents);
        if (quotes?.length) {
          const random = quotes[Math.floor(Math.random() * quotes.length)];
          setQuote(`${random.q} — ${random.a}`);
          setFadeKey((k) => k + 1);
        }
      } catch (err) {
        console.error("Quote fetch failed:", err);
        setQuote("✨ Stay positive, stay grateful.");
      }
    };

    fetchQuote();
    const interval = setInterval(fetchQuote, 15000); // new quote every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-3 text-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={fadeKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6 }}
          className={`italic ${
            darkMode ? "text-green-300" : "text-green-700"
          } text-sm`}
        >
          “{quote}”
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
