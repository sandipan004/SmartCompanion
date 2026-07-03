import { motion } from "framer-motion";

export default function RewardPopup() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="fixed top-10 bg-yellow-400 p-6 rounded-xl text-xl shadow-xl"
    >
      🎉 +10 XP!
    </motion.div>
  );
}