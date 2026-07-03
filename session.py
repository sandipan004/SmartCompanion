import logging
import base64
import io
import time
from dataclasses import dataclass, field
from PIL import Image
from config import SYSTEM_PROMPT, MAX_STEPS, MIN_STEPS_BEFORE_DONE
from vlm import get_scene_description
from llm import build_user_message, call_llm

log = logging.getLogger("session")

@dataclass
class StepResult:
    step: str
    scene: str
    elapsed: float
    iteration: int
    done: bool

@dataclass
class LiveSessionState:
    gaze: str = "center"
    distracted_frames: int = 0

@dataclass
class CompanionSession:
    session_id: str
    goal: str
    chat_history: list = field(default_factory=list)
    completed_steps: list = field(default_factory=list)
    last_step: str = ""
    last_completed: bool = False
    iteration: int = 0
    is_done: bool = False
    last_done: bool = False
    last_scene: str = ""
    last_feedback_msg: str = ""
    live_state: LiveSessionState = field(default_factory=LiveSessionState)

    def __post_init__(self):
        self.chat_history = [{"role": "system", "content": SYSTEM_PROMPT}]
        log.info(f"[{self.session_id}] Session started. Goal: {self.goal}")

    def process_stream_frame(self, tracking_data: dict) -> str | None:
        gaze = tracking_data.get("gaze", "center")
        self.live_state.gaze = gaze
        
        if gaze != "center":
            self.live_state.distracted_frames += 1
        else:
            self.live_state.distracted_frames = max(0, self.live_state.distracted_frames - 2)
            
        if self.live_state.distracted_frames > 30: # ~3 seconds at 10fps
            self.live_state.distracted_frames = 0
            return "distracted"
            
        return None

    def run_step(self, image: Image.Image) -> StepResult:
        if self.is_done:
            raise RuntimeError("Session already complete.")
        if self.iteration >= MAX_STEPS:
            raise RuntimeError(f"Max steps ({MAX_STEPS}) reached")

        t0 = time.time()
        scene = get_scene_description(image)
        previous_scene = self.last_scene
        self.last_scene = scene

        user_msg = build_user_message(
            self.goal, scene,
            previous_scene=previous_scene,
            accepted_steps=len(self.completed_steps),
            feedback_msg=self.last_feedback_msg
        )
        self.last_feedback_msg = ""
        self.chat_history.append({"role": "user", "content": user_msg})

        retries = 0
        step = ""
        while retries < 3:
            step = call_llm(self.chat_history)
            
            words = step.split()
            is_valid = True
            error_msg = ""
            
            if len(words) > 15:
                is_valid = False
                error_msg = "Error: Step is too long. Keep it under 6 words."
            elif step == self.last_step:
                is_valid = False
                error_msg = "Error: Do not repeat the exact same step."
            elif not step:
                is_valid = False
                error_msg = "Error: Step cannot be empty."
                
            if is_valid:
                break
                
            retries += 1
            if retries < 3:
                self.chat_history.append({"role": "assistant", "content": step})
                self.chat_history.append({"role": "user", "content": error_msg})
                
        if retries == 3:
            step = "Take a small breath and look at your goal."
        
        if retries > 0 and retries < 3:
            for _ in range(retries * 2):
                self.chat_history.pop()

        elapsed = round(time.time() - t0, 2)

        clean = step.strip()
        last_word = clean.split()[-1].upper().rstrip(".,!") if clean else ""
        
        is_done_signal = last_word == "DONE"
        done = is_done_signal and (len(self.completed_steps) >= MIN_STEPS_BEFORE_DONE)

        if is_done_signal:
            if clean.upper() != "DONE":
                step = clean[:clean.rfind(clean.split()[-1])].strip().rstrip(".")
            else:
                step = "Goal achieved!" if done else "Keep going!"

        self.chat_history.append({"role": "assistant", "content": step})
        self.last_done = done

        return StepResult(
            step=step if not done else "✅ Goal achieved!",
            scene=scene,
            elapsed=elapsed,
            iteration=self.iteration,
            done=done,
        )

    def record_feedback(self, status: str) -> None:
        step_text = ""
        if self.chat_history and self.chat_history[-1]["role"] == "assistant":
            step_text = self.chat_history[-1]["content"]

        if status == 'completed':
            self.last_completed = True
            self.last_step = step_text
            self.completed_steps.append(step_text)
            if self.last_done:
                self.is_done = True
                log.info(f"[{self.session_id}] Goal achieved after {self.iteration + 1} steps.")
            else:
                log.info(f"[{self.session_id}] Step {self.iteration + 1} complete.")
        else:
            self.last_completed = False
            self.last_step = step_text
            
            if status == 'skipped':
                self.last_feedback_msg = "User skipped this step. Provide a different or alternative action."
            elif status == 'need_help':
                self.last_feedback_msg = "User needs help with this step. Break it down or make it simpler."
            elif status == 'distracted':
                self.last_feedback_msg = "User got distracted. Provide a very gentle, simple step to refocus."
            else:
                self.last_feedback_msg = "User did not complete this step. Try something else."

            if self.chat_history and self.chat_history[-1]["role"] == "assistant":
                self.chat_history.pop()
            if self.chat_history and self.chat_history[-1]["role"] == "user":
                self.chat_history.pop()
            log.info(f"[{self.session_id}] Step {self.iteration + 1} — {status}, will rephrase.")

        self.iteration += 1
