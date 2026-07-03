const BASE_URL = "http://localhost:8000";

export async function startSession(goal: string) {
  const res = await fetch(`${BASE_URL}/session/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });

  return res.json();
}

export async function getNextStep(sessionId: string, image: File) {
  const formData = new FormData();
  formData.append("image", image);

  const res = await fetch(
    `${BASE_URL}/session/${sessionId}/step`,
    {
      method: "POST",
      body: formData,
    }
  );

  return res.json();
}

export async function getStepStream(sessionId: string, image: File) {
  const formData = new FormData();
  formData.append("image", image);

  const res = await fetch(`${BASE_URL}/session/${sessionId}/step-stream`, {
    method: "POST",
    body: formData,
  });

  if (!res.body) {
    throw new Error("Stream body is not available");
  }

  return res.body;
}

export async function sendFeedback(
  sessionId: string,
  status: string
) {
  const res = await fetch(
    `${BASE_URL}/session/${sessionId}/feedback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );

  return res.json();
}

export async function getSessionStatus(sessionId: string) {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/status`);
  if (!res.ok) {
    throw new Error(`Failed to get session status: ${res.statusText}`);
  }
  return res.json();
}