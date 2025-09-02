from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
import numpy as np
import soundfile as sf
import io
import os

app = FastAPI()

MODEL_NAME = os.environ.get("LOCAL_WHISPER_MODEL", "medium")
COMPUTE_TYPE = os.environ.get("LOCAL_WHISPER_COMPUTE", "int8")

model = None

@app.on_event("startup")
def load_model():
    global model
    model = WhisperModel(MODEL_NAME, compute_type=COMPUTE_TYPE)

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str | None = Form(None), beam_size: int = Form(5)):
    data = await file.read()
    audio, sr = sf.read(io.BytesIO(data))
    if sr != 16000:
        # Convert to 16k if needed
        import resampy
        audio = resampy.resample(audio.astype(np.float32), sr, 16000)
        sr = 16000

    segments, info = model.transcribe(audio, language=language, beam_size=beam_size)
    segs = []
    full_text = []
    for seg in segments:
        segs.append({"start": seg.start, "end": seg.end, "text": seg.text})
        full_text.append(seg.text)
    return JSONResponse({"segments": segs, "text": " ".join(full_text)})


