import os
import time
import logging
from huggingface_hub import InferenceClient
from config import (
    LLM_MODEL,
    LLM_TEMPERATURE, LLM_NUM_PREDICT,
    MIN_STEPS_BEFORE_DONE,
)

log = logging.getLogger("llm")

# Initialize the Hugging Face Inference Client
# If HF_TOKEN is in the environment (which it will be in the Space settings), it will use it.
client = InferenceClient(model=LLM_MODEL, token=os.environ.get("HF_TOKEN"))

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
    """Send the full chat history to Hugging Face Inference API and return the assistant's reply."""
    t0 = time.time()
    try:
        reply = client.chat_completion(
            messages=chat_history,
            max_tokens=LLM_NUM_PREDICT,
            temperature=LLM_TEMPERATURE,
        )
        content = reply.choices[0].message.content.strip()
    except Exception as e:
        log.error(f"HF Inference Error: {e}")
        raise e

    elapsed = time.time() - t0
    log.info(f"LLM ({elapsed:.2f}s): {content}")
    return content
