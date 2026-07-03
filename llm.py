import time
import logging
import requests
from config import (
    LLM_MODEL, OLLAMA_URL,
    LLM_TEMPERATURE, LLM_NUM_PREDICT, LLM_STOP_SEQS,
    MIN_STEPS_BEFORE_DONE,
)

log = logging.getLogger("llm")

def build_user_message(
    goal,
    current_scene,
    previous_scene="",
    accepted_steps=0,   # ✅ KEEP THIS
    feedback_msg="",
):
    scene_context = f"Current Scene Objects: {current_scene}"
    if previous_scene:
        scene_context = f"Previous Scene Objects: {previous_scene}\n{scene_context}"

    feedback_context = f"Feedback on previous step: {feedback_msg}\n" if feedback_msg else ""

    return f"""
Goal: {goal}
{scene_context}
Steps completed so far: {accepted_steps}
{feedback_context}
Give ONLY ONE micro-step:
- Max 6 words
- Simple action
- No explanation
- Only suggest interacting with the currently visible objects.
"""

def call_llm(chat_history: list[dict]) -> str:
    """Send the full chat history to Ollama and return the assistant's reply."""
    t0 = time.time()
    resp = requests.post(
        OLLAMA_URL,
        json={
            "model": LLM_MODEL,
            "messages": chat_history,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 40,   # reduce from large value
            },
        },
        timeout=120,
    )
    resp.raise_for_status()
    elapsed = time.time() - t0
    reply = resp.json()["message"]["content"].strip()
    log.info(f"LLM ({elapsed:.2f}s): {reply}")
    return reply
