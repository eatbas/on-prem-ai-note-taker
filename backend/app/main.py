from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional
import asyncio
import logging

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from faster_whisper import WhisperModel

from .config import settings
from .ollama_client import OllamaClient


app = FastAPI(title="On-Prem AI Note Taker", version="0.1.0")

# Logging
_level = getattr(logging, settings.log_level.upper(), logging.INFO)
logging.basicConfig(level=_level)
logger = logging.getLogger("on_prem_note_taker")

# CORS
if settings.allowed_origins == ["*"]:
	allow_origins = ["*"]
else:
	allow_origins = settings.allowed_origins

app.add_middleware(
	CORSMiddleware,
	allow_origins=allow_origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class TranscriptionSegment(BaseModel):
	start: float
	end: float
	text: str


class TranscriptionResponse(BaseModel):
	language: Optional[str]
	duration: Optional[float]
	text: str
	segments: List[TranscriptionSegment]


class SummarizeRequest(BaseModel):
	text: str
	model: Optional[str] = None


class SummarizeResponse(BaseModel):
	summary: str


class TranscribeAndSummarizeResponse(BaseModel):
	transcript: TranscriptionResponse
	summary: str


_whisper_model: Optional[WhisperModel] = None
_transcribe_semaphore: Optional[asyncio.Semaphore] = None
_ollama_client = OllamaClient(
	base_url=settings.ollama_base_url,
	default_model=settings.ollama_model,
	timeout_seconds=settings.ollama_timeout_seconds,
)


def get_whisper_model() -> WhisperModel:
	global _whisper_model
	if _whisper_model is None:
		_whisper_model = WhisperModel(
			settings.whisper_model_name,
			compute_type=settings.whisper_compute_type,
			download_root=settings.whisper_download_root,
		)
	return _whisper_model


def get_transcribe_semaphore() -> asyncio.Semaphore:
	global _transcribe_semaphore
	if _transcribe_semaphore is None:
		_concurrency = max(1, settings.max_concurrency)
		_transcribe_semaphore = asyncio.Semaphore(_concurrency)
	return _transcribe_semaphore


@app.get("/api/health")
def health() -> Dict[str, Any]:
	return {
		"status": "ok",
		"whisper_model": settings.whisper_model_name,
		"ollama_model": settings.ollama_model,
	}


@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe(
	file: UploadFile = File(...),
	language: Optional[str] = Form(default=None),
	vad_filter: bool = Form(default=True),
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> TranscriptionResponse:
	sem = get_transcribe_semaphore()
	model = get_whisper_model()

	async with sem:
		# Read and validate size
		content = await file.read()
		size_mb = len(content) / (1024 * 1024)
		if size_mb > settings.max_upload_mb:
			raise HTTPException(status_code=413, detail=f"File too large: {size_mb:.1f} MB > {settings.max_upload_mb} MB")
		logger.info("Transcribe request: filename=%s size_mb=%.2f lang=%s user=%s", file.filename, size_mb, language, x_user_id)

		# Save to a temp file for faster-whisper consumption
		with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "audio")[1]) as tmp:
			tmp.write(content)
			tmp_path = tmp.name

		segments_out: List[TranscriptionSegment] = []
		text_parts: List[str] = []
		language_out: Optional[str] = None
		duration_out: Optional[float] = None

		try:
			segments, info = model.transcribe(
				tmp_path,
				language=language,
				vad_filter=vad_filter,
			)
			language_out = info.language if hasattr(info, "language") else None
			duration_out = info.duration if hasattr(info, "duration") else None
			for s in segments:
				segments_out.append(
					TranscriptionSegment(start=float(s.start), end=float(s.end), text=s.text.strip())
				)
				text_parts.append(s.text.strip())
		finally:
			try:
				os.remove(tmp_path)
			except OSError:
				pass

		return TranscriptionResponse(
			language=language_out,
			duration=duration_out,
			text="\n".join(text_parts).strip(),
			segments=segments_out,
		)


@app.post("/api/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
	summary_text = _ollama_client.summarize(req.text, model=req.model)
	return SummarizeResponse(summary=summary_text)


@app.post("/api/transcribe-and-summarize", response_model=TranscribeAndSummarizeResponse)
async def transcribe_and_summarize(
	file: UploadFile = File(...),
	language: Optional[str] = Form(default=None),
	vad_filter: bool = Form(default=True),
	x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> TranscribeAndSummarizeResponse:
	sem = get_transcribe_semaphore()
	async with sem:
		transcript = await transcribe(file=file, language=language, vad_filter=vad_filter, x_user_id=x_user_id)  # type: ignore[arg-type]
		summary = _ollama_client.summarize(transcript.text)
		return TranscribeAndSummarizeResponse(transcript=transcript, summary=summary)



