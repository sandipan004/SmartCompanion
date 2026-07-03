"use client";

import TaskCard from "@/components/TaskCard";
import ProgressBar from "@/components/ProgressBar";
import RewardPopup from "@/components/RewardPopup";
import { useGamification } from "@/hooks/useGamification";
import { useVoice } from "@/hooks/useVoice";
import { useState, useRef } from "react";
import VideoStream, { VideoStreamHandle } from "@/components/VideoStream";
import { motion, AnimatePresence } from "framer-motion";

import {
  startSession,
  getStepStream,
  sendFeedback,
  getSessionStatus,
} from "@/lib/api";

export default function Home() {
  const { xp, streak, rewardUser, showReward } = useGamification();
  const { speak } = useVoice();

  const [goal, setGoal] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const videoStreamRef = useRef<VideoStreamHandle>(null);
  const [stepData, setStepData] = useState<any>(null);
  const [liveText, setLiveText] = useState("");
  const [scene, setScene] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const currentStepText = stepData?.step || liveText;
  
  // MAX_STEPS is 8, so 12.5% progress per step is a great fit.
  const progress = stepData
    ? Math.min((stepData.iteration + 1) * 12.5, 100)
    : 0;

  // 🟢 START SESSION
  async function handleStart() {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const data = await startSession(goal.trim());
      setSessionId(data.session_id);
      setCompletedSteps([]);
      setStepData(null);
      setLiveText("");
      setScene("");
      setDone(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 📷 ANALYZE IMAGE + GET STEP
  async function handleAnalyze() {
    if (!sessionId) return;
    
    const snapshot = await videoStreamRef.current?.captureImage();
    if (!snapshot) return;

    setLoading(true);
    setStepData(null);
    setLiveText("");

    try {
      const stream = await getStepStream(sessionId, snapshot);
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        result += decoder.decode(value);
        setLiveText(result);
      }

      const status = await getSessionStatus(sessionId);

      setStepData({
        step: result.trim(),
        scene: status.scene || "",
        iteration: status.iteration,
        done: status.is_done,
      });
      setScene(status.scene || "");
      setCompletedSteps(status.completed_steps);
      
      speak(result.trim());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Handle Feedback
  async function handleFeedback(status: string) {
    if (loading || !sessionId) return;
    setLoading(true);

    try {
      const data = await sendFeedback(sessionId, status);
      
      if (status === 'completed') {
        // Award XP & trigger micro-interaction popup
        await rewardUser();
      } else {
        speak("Okay, let me adjust the step for you. Let me see the scene again.");
      }

      // Clear the current step so the user returns to the live view
      setStepData(null);
      setLiveText("");

      // Sync completed steps
      setCompletedSteps(data.completed_steps);
      
      if (data.is_done) {
        setDone(true);
        speak("Fantastic! You have achieved your goal!");
      } else if (status === 'completed') {
        speak("Awesome! Let's do the next step.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Reset Session
  function handleReset() {
    setSessionId(null);
    setGoal("");
    setStepData(null);
    setLiveText("");
    setScene("");
    setCompletedSteps([]);
    setDone(false);
  }

  return (
    <main className="flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950 text-slate-100 p-6 font-sans">
      
      {/* 🌟 Gamification Reward Popup */}
      <AnimatePresence>
        {showReward && (
          <div className="fixed inset-x-0 top-10 z-50 flex justify-center pointer-events-none">
            <RewardPopup />
          </div>
        )}
      </AnimatePresence>

      {/* 🧠 Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-6 border-b border-white/10 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧠</span>
          <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
            SMART COMPANION
          </h1>
        </div>
        
        {/* Streak & XP Display */}
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm font-semibold shadow-inner">
          <span className="flex items-center gap-1 text-yellow-400">
            ⭐ <span className="text-slate-200">{xp} XP</span>
          </span>
          <div className="w-px h-4 bg-white/20" />
          <span className="flex items-center gap-1 text-orange-400">
            🔥 <span className="text-slate-200">{streak} Day Streak</span>
          </span>
        </div>
      </header>

      {/* 🏁 DONE / SUCCESS SCREEN */}
      {done ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xl p-8 rounded-3xl backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl text-center flex flex-col items-center justify-center gap-6 mt-10"
        >
          <span className="text-7xl animate-bounce">🎉</span>
          <h2 className="text-3xl font-extrabold text-transparent bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text">
            Goal Achieved!
          </h2>
          <p className="text-slate-300 text-lg">
            Great work! You completed your task:
            <br />
            <strong className="text-white text-xl">"{goal}"</strong>
          </p>
          
          {completedSteps.length > 0 && (
            <div className="w-full text-left bg-black/20 p-4 rounded-xl border border-white/5 max-h-40 overflow-y-auto">
              <p className="text-xs uppercase text-slate-400 font-bold mb-2 tracking-wider">
                Steps Completed:
              </p>
              <ul className="space-y-1 text-sm text-slate-300">
                {completedSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition duration-300 shadow-lg shadow-purple-500/20 cursor-pointer"
          >
            Start Another Task
          </button>
        </motion.div>
      ) : (
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* LEFT/CENTER AREA: Active Workflow */}
          <div className="md:col-span-2 flex flex-col gap-6 w-full">
            
            {/* 1. Enter Goal Panel */}
            {!sessionId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-slate-200">What are we focusing on today?</h2>
                  <p className="text-xs text-slate-400">
                    Break down your task into simple micro-steps with AI companion assistance.
                  </p>
                </div>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Clean my desk, make coffee, pack bag..."
                  className="p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
                <button
                  onClick={handleStart}
                  disabled={loading || !goal.trim()}
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-purple-500/10"
                >
                  {loading ? "Starting..." : "Begin Focus Session"}
                </button>
              </motion.div>
            )}

            {/* 2. Image Capture / Processing Panel */}
            {sessionId && !currentStepText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-4 items-center justify-center p-6 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl w-full"
              >
                <div className="w-full flex items-center justify-between px-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                      Focusing on:
                    </h2>
                    <p className="text-lg font-bold text-white">"{goal}"</p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Reset Goal
                  </button>
                </div>

                <div className="w-full relative rounded-xl overflow-hidden border border-white/10 bg-black/40 p-4">
                  <VideoStream 
                    ref={videoStreamRef} 
                    sessionId={sessionId} 
                    onDistracted={() => {
                        console.log("User distracted!");
                        // We could trigger a refocus here
                    }} 
                  />
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:from-emerald-950 disabled:to-slate-900 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition duration-300 shadow-lg shadow-emerald-500/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing Environment..." : "🔍 Analyze Environment"}
                </button>

                {loading && (
                  <div className="text-sm text-purple-300 animate-pulse mt-2 flex items-center gap-2">
                    <span>🧠</span> Examining scene objects... this takes about 5-10s
                  </div>
                )}
              </motion.div>
            )}

            {/* 3. Next Micro-Step Display */}
            {sessionId && (currentStepText || liveText) && (
              <div className="flex flex-col gap-6">
                
                {/* Scene description header */}
                {scene && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-sky-950/20 border border-sky-800/30 rounded-xl text-sm flex gap-3 items-center"
                  >
                    <span className="text-lg">📷</span>
                    <p className="text-slate-300">
                      <strong className="text-sky-300">Scene description:</strong> {scene}
                    </p>
                  </motion.div>
                )}

                <TaskCard
                  step={currentStepText}
                  onFeedback={handleFeedback}
                  onRepeat={() => speak(currentStepText)}
                  loading={loading}
                />
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Completed Steps & Progress */}
          {sessionId && (
            <div className="flex flex-col gap-6 w-full">
              
              {/* Progress Tracker */}
              <div className="p-6 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl flex flex-col gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Current Progress
                </h3>
                <ProgressBar progress={progress} />
              </div>

              {/* Steps List */}
              <div className="p-6 rounded-2xl backdrop-blur-md bg-white/5 border border-white/10 shadow-2xl flex flex-col gap-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 pb-3">
                  📜 Step History
                </h3>
                {completedSteps.length > 0 ? (
                  <ul className="space-y-3">
                    {completedSteps.map((stepText, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 bg-white/5 p-3 rounded-lg border border-white/5"
                      >
                        <span className="text-emerald-400 font-extrabold mt-0.5">✓</span>
                        <span className="text-slate-300 text-sm">{stepText}</span>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500 italic py-2">
                    No steps completed in this session yet. Complete tasks to earn XP!
                  </p>
                )}
              </div>

              {/* End session safely */}
              <button
                onClick={handleReset}
                className="w-full bg-white/5 border border-white/10 hover:bg-rose-950/20 hover:border-rose-900/30 text-rose-300 text-xs font-semibold py-3 rounded-xl transition duration-200 cursor-pointer"
              >
                ⚠️ End Session Early
              </button>

            </div>
          )}

        </div>
      )}
    </main>
  );
}