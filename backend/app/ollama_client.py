from __future__ import annotations

import json
from typing import Any, Dict, Optional

import requests


class OllamaClient:
	"""Thin client to call an Ollama server for text generation."""

	def __init__(self, base_url: str, default_model: str, timeout_seconds: int = 120) -> None:
		self.base_url = base_url.rstrip("/")
		self.default_model = default_model
		self.timeout_seconds = timeout_seconds

	def generate(
		self,
		prompt: str,
		model: Optional[str] = None,
		options: Optional[Dict[str, Any]] = None,
		stream: bool = False,
	) -> str:
		"""Call /api/generate and return the complete response text."""
		payload = {
			"model": model or self.default_model,
			"prompt": prompt,
			"stream": stream,
		}
		if options:
			payload["options"] = options

		resp = requests.post(
			f"{self.base_url}/api/generate",
			headers={"Content-Type": "application/json"},
			data=json.dumps(payload),
			timeout=self.timeout_seconds,
		)
		resp.raise_for_status()
		data = resp.json()
		# Non-streaming returns one JSON with 'response'.
		return data.get("response", "")

	def summarize(self, text: str, model: Optional[str] = None) -> str:
		prompt = (
			"You are an assistant that writes concise meeting notes. "
			"Summarize the following transcript into: 1) a concise summary (3-6 sentences), "
			"2) key decisions, 3) action items with owners if possible, 4) open questions.\n\nTranscript:\n" + text
		)
		return self.generate(prompt, model=model)


