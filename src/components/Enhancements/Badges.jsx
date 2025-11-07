import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Badges({ stats }) {
  const [badges, setBadges] = useState(
    JSON.parse(localStorage.getItem("badgesUnlocked") || "[]")
  );

  useEffect(() => {
    const newBadges = [...badges];
    if (stats.currentStreak >= 3 && !newBadges.includes("3day")) {
      newBadges.push("3day");
    }
    if (stats.currentStreak >= 7 && !newBadges.includes("7day")) {
      newBadges.push("7day");
    }
    if (stats.entriesThisMonth >= 30 && !newBadges.includes("month")) {
      newBadges.push("month");
    }
    if (newBadges.length !== badges.length) {
      localStorage.setItem("badgesUnlocked", JSON.stringify(newBadges));
      setBadges(newBadges);
    }
  }, [stats]);

  const badgeMap = {
    "3day": "🪷 3-Day Flow",
    "7day": "🌞 7-Day Calm",
    "month": "🎉 First Month Complete",
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {badges.map((b) => (
        <motion.div
          key={b}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border border-amber-300 rounded-full px-3 py-1 text-sm"
        >
          {badgeMap[b]}
        </motion.div>
      ))}
    </div>
  );
}
