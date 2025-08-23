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

	def check_health(self) -> Dict[str, Any]:
		"""Check if Ollama is reachable via simple HTTP connectivity test.
		
		IMPORTANT: This does NOT call any Ollama API endpoints to avoid
		creating unnecessary llama processes. It only checks basic connectivity.

		Returns a dict like {"up": bool, "version": Optional[str]}.
		"""
		try:
			# Only check basic HTTP connectivity to the base URL
			# Don't call /api/version or /api/tags as they spawn llama processes
			import socket
			from urllib.parse import urlparse
			
			parsed = urlparse(self.base_url)
			host = parsed.hostname or 'localhost'
			port = parsed.port or 11434
			
			# Simple TCP socket check - much faster and doesn't spawn processes
			sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
			sock.settimeout(3)  # 3 second timeout
			result = sock.connect_ex((host, port))
			sock.close()
			
			if result == 0:
				return {"up": True, "version": "unknown"}
			else:
				return {"up": False, "version": None}
		except Exception:
			return {"up": False, "version": None}


