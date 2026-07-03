"""
Endpoints
---------
POST /session/new            { goal }                        → { session_id }
POST /session/{id}/step      image file (multipart/form-data) → StepResponse
POST /session/{id}/step-stream image file (multipart/form-data) → text/plain (streamed)
POST /session/{id}/feedback  { completed: bool }             → { ok }
GET  /session/{id}/status                                    → SessionStatus
DELETE /session/{id}                                         → { ok }
GET  /health                                                 → { status }
"""
import io
import logging
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
from pydantic import BaseModel
from PIL import Image
from session import CompanionSession
from tracker import process_frame

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("api")

app = FastAPI(title="ADHD Smart Companion API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, CompanionSession] = {}

def _get(session_id: str) -> CompanionSession:
    s = _sessions.get(session_id)
    if not s:
        raise HTTPException(404, f"Session {session_id!r} not found")
    return s

class NewSessionRequest(BaseModel):
    goal: str

class NewSessionResponse(BaseModel):
    session_id: str
    goal: str

class StepResponse(BaseModel):
    session_id: str
    iteration: int
    step: str
    scene: str
    elapsed: float
    done: bool
    completed_steps: list[str]

class FeedbackRequest(BaseModel):
    status: str

class FeedbackResponse(BaseModel):
    ok: bool
    iteration: int
    completed_steps: list[str]
    is_done: bool

class SessionStatus(BaseModel):
    session_id: str
    goal: str
    iteration: int
    completed_steps: list[str]
    is_done: bool
    scene: str

@app.get("/health")
def health():
    return {"status": "ok", "active_sessions": len(_sessions)}

@app.post("/session/new", response_model=NewSessionResponse)
def new_session(body: NewSessionRequest):
    sid = str(uuid.uuid4())
    _sessions[sid] = CompanionSession(session_id=sid, goal=body.goal)
    log.info(f"New session {sid!r}: {body.goal!r}")
    return NewSessionResponse(session_id=sid, goal=body.goal)


@app.post("/session/{session_id}/step", response_model=StepResponse)
async def run_step(session_id: str, image: UploadFile = File(...)):
    """
    Frontend sends the current webcam frame as a file upload.
    Server runs VLM + LLM and returns the next micro-step.
    """
    s = _get(session_id)
    if s.is_done:
        raise HTTPException(400, "Session already complete.")

    raw = await image.read()
    pil_image = Image.open(io.BytesIO(raw)).convert("RGB")

    result = s.run_step(pil_image)
    return StepResponse(
        session_id=session_id,
        iteration=result.iteration,
        step=result.step,
        scene=result.scene,
        elapsed=result.elapsed,
        done=result.done,
        completed_steps=s.completed_steps,
    )


@app.post("/session/{session_id}/step-stream")
async def stream_step(session_id: str, image: UploadFile = File(...)):
    s = _get(session_id)

    raw = await image.read()
    pil_image = Image.open(io.BytesIO(raw)).convert("RGB")

    result = s.run_step(pil_image)

    async def generate():
        words = result.step.split()

        for word in words:
            yield word + " "
            await asyncio.sleep(0.03)  # typing effect

    return StreamingResponse(generate(), media_type="text/plain")


@app.post("/session/{session_id}/feedback", response_model=FeedbackResponse)
def record_feedback(session_id: str, body: FeedbackRequest):
    s = _get(session_id)
    if s.is_done:
        return FeedbackResponse(
            ok=True,
            iteration=s.iteration,
            completed_steps=s.completed_steps,
            is_done=True
        )
    s.record_feedback(body.status)
    return FeedbackResponse(
        ok=True,
        iteration=s.iteration,
        completed_steps=s.completed_steps,
        is_done=s.is_done
    )

@app.get("/session/{session_id}/status", response_model=SessionStatus)
def session_status(session_id: str):
    s = _get(session_id)
    return SessionStatus(
        session_id=session_id,
        goal=s.goal,
        iteration=s.iteration,
        completed_steps=s.completed_steps,
        is_done=s.is_done,
        scene=s.last_scene,
    )

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    _get(session_id)
    del _sessions[session_id]
    log.info(f"Session {session_id!r} deleted.")
    return {"ok": True}

@app.websocket("/session/{session_id}/stream")
async def websocket_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    s = _get(session_id)
    try:
        while True:
            data = await websocket.receive_bytes()
            tracking_data = process_frame(data)
            trigger = s.process_stream_frame(tracking_data)
            
            response = {
                "tracking": tracking_data,
                "trigger": trigger
            }
            await websocket.send_json(response)
    except WebSocketDisconnect:
        log.info(f"WebSocket disconnected for session {session_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
