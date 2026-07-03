import time
import logging
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForImageTextToText

from config import (
    VLM_MODEL, DEVICE,
    VLM_MAX_NEW_TOKENS, VLM_MIN_NEW_TOKENS, VLM_TEMPERATURE,
)

log = logging.getLogger("vlm")
log.info(f"Loading VLM ({VLM_MODEL}) on {DEVICE}...")
processor = AutoProcessor.from_pretrained(VLM_MODEL)
vlm_model = AutoModelForImageTextToText.from_pretrained(
    VLM_MODEL,
    dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
).to(DEVICE)
log.info("VLM ready.")

_QUESTION = "Describe the visible objects and surfaces in this room in 1-2 sentences."

def get_scene_description(image: Image.Image) -> str:
    # Resize for speed (CRITICAL)
    image = image.resize((224, 224))
    """Run SmolVLM on a PIL image and return a short scene description."""
    messages = [{
        "role": "user",
        "content": [
            {"type": "image"},
            {"type": "text", "text": "List the key objects visible in this scene, separated by commas."},
        ],
    }]

    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[image], return_tensors="pt").to(DEVICE)

    t0 = time.time()
    with torch.no_grad():
        output = vlm_model.generate(
            **inputs,
            max_new_tokens=40,
            min_new_tokens=VLM_MIN_NEW_TOKENS,
            do_sample=False,
        )
    elapsed = time.time() - t0

    input_len = inputs["input_ids"].shape[1]
    caption = processor.decode(output[0][input_len:], skip_special_tokens=True).strip()
    log.info(f"VLM FAST ({elapsed:.2f}s): {caption}")
    return caption
