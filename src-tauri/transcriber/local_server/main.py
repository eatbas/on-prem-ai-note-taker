import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pkg_resources")

# Local Faster-Whisper transcriber (lazy init, healthcheck)
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import numpy as np
import soundfile as sf
import io
import os

# Optional: import faster-whisper lazily
model = None
MODEL_NAME = os.environ.get("LOCAL_WHISPER_MODEL", "medium")
COMPUTE_TYPE = os.environ.get("LOCAL_WHISPER_COMPUTE", "int8")

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


def get_model():
    global model
    if model is None:
        from faster_whisper import WhisperModel  # lazy import to speed startup
        model = WhisperModel(MODEL_NAME, compute_type=COMPUTE_TYPE)
    return model


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(None),
    beam_size: int = Form(5)
):
    # Read audio bytes
    data = await file.read()

    # Decode with soundfile; ensures float32 array in [-1,1]
    audio, sr = sf.read(io.BytesIO(data), dtype="float32")

    # Faster-Whisper accepts raw float32 PCM and sample rate information
    # It can resample internally; but we can downmix to mono if needed
    if audio.ndim == 2:
        audio = audio.mean(axis=1)

    # Run transcription
    m = get_model()
    segments, info = m.transcribe(audio, language=language, beam_size=beam_size)

    segs = []
    full_text = []
    for seg in segments:
        segs.append({"start": seg.start, "end": seg.end, "text": seg.text})
        full_text.append(seg.text)

    return JSONResponse({"segments": segs, "text": " ".join(full_text)})


