from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
import numpy as np
import soundfile as sf
import io
import os

app = FastAPI()

PIPELINE = None

@app.on_event("startup")
def load_pipeline():
    global PIPELINE
    from pyannote.audio import Pipeline
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN not set")
    PIPELINE = Pipeline.from_pretrained("pyannote/speaker-diarization", use_auth_token=hf_token)

@app.post("/diarize")
async def diarize(file: UploadFile = File(...), max_speakers: int | None = Form(None)):
    data = await file.read()
    audio, sr = sf.read(io.BytesIO(data))
    # Pyannote expects a dict with 'waveform' and 'sample_rate'
    waveform = np.array(audio, dtype=np.float32)
    if waveform.ndim > 1:
        waveform = waveform.mean(axis=1)
    item = {"waveform": waveform, "sample_rate": sr}
    diarization = PIPELINE(item)
    # Convert to turns
    turns = []
    speaker_map = {}
    for i, segment, _, label in diarization.itertracks(yield_label=True):
        spk = str(label)
        if spk not in speaker_map:
            speaker_map[spk] = f"Speaker {len(speaker_map)+1}"
        turns.append({
            "start": float(segment.start),
            "end": float(segment.end),
            "speaker": speaker_map[spk]
        })
    if max_speakers:
        # Best-effort cap without reclustering: keep existing mapping size
        pass
    return JSONResponse({"turns": turns})


