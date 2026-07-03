import { useEffect, useState } from "react";
import { db } from "@/lib/db";

export function useGamification() {
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const data = await db.stats.toArray();
    if (data.length > 0) {
      setXp(data[0].xp);
      setStreak(data[0].streak);
    }
  }

  async function rewardUser() {
    const today = new Date().toDateString();
    const data = await db.stats.toArray();
    let current = data[0];

    if (!current) {
      current = { xp: 0, streak: 0, lastCompleted: today };
    }

    const isSameDay = current.lastCompleted === today;

    const newStreak = isSameDay ? current.streak : current.streak + 1;

    const updated = {
      xp: current.xp + 10,
      streak: newStreak,
      lastCompleted: today
    };

    await db.stats.clear();
    await db.stats.add(updated);

    setXp(updated.xp);
    setStreak(updated.streak);
    setShowReward(true);

    if (navigator.vibrate) navigator.vibrate(100);

    setTimeout(() => setShowReward(false), 1500);
  }

  return { xp, streak, rewardUser, showReward };
}