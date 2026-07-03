import { motion } from "framer-motion";

interface TaskCardProps {
  step: string;
  onFeedback: (status: string) => void;
  onRepeat: () => void;
  loading?: boolean;
}

export default function TaskCard({
  step,
  onFeedback,
  onRepeat,
  loading = false,
}: TaskCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full p-8 rounded-2xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl text-slate-100"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-wide text-purple-300">
          🎯 Current Step
        </h2>
        <button
          onClick={onRepeat}
          className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition duration-200"
          title="Repeat Instruction"
        >
          🔊 Repeat
        </button>
      </div>

      <p className="text-2xl font-semibold mb-8 leading-relaxed text-slate-50">
        {step}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <button
          onClick={() => onFeedback('completed')}
          disabled={loading}
          className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition duration-200 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer text-center"
        >
          ✅ Done!
        </button>

        <button
          onClick={() => onFeedback('skipped')}
          disabled={loading}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-6 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer text-center"
        >
          ⏭️ Skip
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onFeedback('need_help')}
          disabled={loading}
          className="bg-sky-600/30 hover:bg-sky-500/40 text-sky-200 border border-sky-500/40 font-semibold py-3 px-6 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer text-center"
        >
          ❓ Need Help
        </button>
        <button
          onClick={() => onFeedback('distracted')}
          disabled={loading}
          className="bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 border border-rose-500/30 font-semibold py-3 px-6 rounded-xl transition duration-200 disabled:opacity-50 cursor-pointer text-center"
        >
          😵 Distracted
        </button>
      </div>
    </motion.div>
  );
}