import io
import requests
import streamlit as st

BACKEND_URL = "http://localhost:8000"

st.set_page_config(page_title="ADHD Companion", page_icon="🧠", layout="centered")
st.title("🧠 ADHD Smart Companion")

if "session_id" not in st.session_state:
    st.session_state.session_id = None
if "goal" not in st.session_state:
    st.session_state.goal = ""
if "current_step" not in st.session_state:
    st.session_state.current_step = None
if "completed_steps" not in st.session_state:
    st.session_state.completed_steps = []
if "done" not in st.session_state:
    st.session_state.done = False
if "waiting_feedback" not in st.session_state:
    st.session_state.waiting_feedback = False   # True after a step is shown

def start_session(goal: str):
    resp = requests.post(f"{BACKEND_URL}/session/new", json={"goal": goal})
    resp.raise_for_status()
    data = resp.json()
    st.session_state.session_id       = data["session_id"]
    st.session_state.goal             = goal
    st.session_state.completed_steps  = []
    st.session_state.done             = False
    st.session_state.current_step     = None
    st.session_state.waiting_feedback = False

def call_step(image_bytes: bytes) -> dict:
    files = {"image": ("frame.jpg", io.BytesIO(image_bytes), "image/jpeg")}
    resp  = requests.post(
        f"{BACKEND_URL}/session/{st.session_state.session_id}/step",
        files=files,
    )
    resp.raise_for_status()
    return resp.json()

def send_feedback(status: str):
    resp = requests.post(
        f"{BACKEND_URL}/session/{st.session_state.session_id}/feedback",
        json={"status": status},
    )
    resp.raise_for_status()
    st.session_state.waiting_feedback = False

if not st.session_state.session_id:
    st.subheader("What do you want to accomplish?")
    goal_input = st.text_input("Your goal", placeholder="e.g. open my glasses case")
    if st.button("▶ Start", disabled=not goal_input.strip()):
        with st.spinner("Starting session..."):
            start_session(goal_input.strip())
        st.rerun()
    st.stop()

st.caption(f"Goal: **{st.session_state.goal}**  |  Session: `{st.session_state.session_id[:8]}…`")

if st.session_state.done:
    st.success("✅ Goal achieved! Great work.")
    if st.button("🔄 Start new session"):
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.rerun()
    st.stop()

with st.sidebar:
    st.header("📜 Completed Steps")
    if st.session_state.completed_steps:
        for i, s in enumerate(st.session_state.completed_steps, 1):
            st.markdown(f"**{i}.** {s}")
    else:
        st.caption("No completed steps yet.")

st.subheader("📷 Capture your environment")
camera_img = st.camera_input("Point at your workspace and capture")

if st.session_state.waiting_feedback and st.session_state.current_step:
    result = st.session_state.current_step
    st.info(f"🧠 **Scene:** {result['scene']}")
    st.success(f"🟢 **Your next step:** {result['step']}")
    st.caption(f"⏱ {result['elapsed']}s")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        if st.button("✅ Done!", use_container_width=True):
            send_feedback('completed')
            st.session_state.completed_steps = result["completed_steps"] + (
                [result["step"]] if result["step"] not in result["completed_steps"] else []
            )
            if result["done"]:
                st.session_state.done = True
            st.rerun()
    with col2:
        if st.button("⏭️ Skip", use_container_width=True):
            send_feedback('skipped')
            st.rerun()
    with col3:
        if st.button("❓ Help", use_container_width=True):
            send_feedback('need_help')
            st.rerun()
    with col4:
        if st.button("😵 Distracted", use_container_width=True):
            send_feedback('distracted')
            st.rerun()
    st.stop()

if camera_img is not None:
    if st.button("🔍 Analyse & get next step", use_container_width=True):
        with st.spinner("Running VLM + LLM... (~10s)"):
            try:
                result = call_step(camera_img.getvalue())
                st.session_state.current_step     = result
                st.session_state.waiting_feedback = True
                if result["done"]:
                    st.session_state.done = True
                st.rerun()
            except requests.HTTPError as e:
                st.error(f"Backend error: {e.response.text}")
else:
    st.caption("Capture an image above to get your next micro-step.")

with st.expander("⚠️ End session early"):
    if st.button("End session"):
        requests.delete(f"{BACKEND_URL}/session/{st.session_state.session_id}")
        for k in list(st.session_state.keys()):
            del st.session_state[k]
        st.rerun()
