from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import requests


logger = logging.getLogger(__name__)


class OllamaClient:
	"""Optimized client to call an Ollama server for text generation with connection pooling."""

	def __init__(self, base_url: str, default_model: str, timeout_seconds: int = 120) -> None:
		self.base_url = base_url.rstrip("/")
		self.default_model = default_model
		self.timeout_seconds = timeout_seconds
		
		# Create session with connection pooling and retries
		self.session = requests.Session()
		
		# Configure retry strategy
		retry_strategy = Retry(
			total=3,
			backoff_factor=1,
			status_forcelist=[429, 500, 502, 503, 504],
			allowed_methods=["POST", "GET"]
		)
		
		# Configure HTTP adapter with connection pooling
		adapter = HTTPAdapter(
			pool_connections=10,
			pool_maxsize=20,
			max_retries=retry_strategy
		)
		
		self.session.mount("http://", adapter)
		self.session.mount("https://", adapter)
		
		# Set default headers
		self.session.headers.update({
			'Content-Type': 'application/json',
			'User-Agent': 'on-prem-ai-note-taker/1.0'
		})
		
		logger.info(f"Ollama client initialized for {self.base_url} with model {self.default_model}")

	def generate(
		self,
		prompt: str,
		model: Optional[str] = None,
		options: Optional[Dict[str, Any]] = None,
		stream: bool = False,
	) -> str:
		"""Call /api/generate and return the complete response text."""
		# Default optimized options for performance
		default_options = {
			"temperature": 0.3,
			"top_p": 0.9,
			"top_k": 20,
			"repeat_penalty": 1.1,
			"num_predict": 500,  # Limit response length
		}
		
		if options:
			default_options.update(options)
		
		payload = {
			"model": model or self.default_model,
			"prompt": prompt,
			"stream": stream,
			"options": default_options
		}

		try:
			logger.info(f"Generating response with model {model or self.default_model} for prompt: {prompt[:100]}...")
			
			resp = self.session.post(
				f"{self.base_url}/api/generate",
				data=json.dumps(payload),
				timeout=self.timeout_seconds,
			)
			resp.raise_for_status()
			data = resp.json()
			
			response_text = data.get("response", "")
			logger.info(f"Generated response: {len(response_text)} characters")
			
			return response_text
			
		except Exception as e:
			logger.error(f"Ollama generation failed: {str(e)}")
			raise

	def summarize(self, text: str, model: Optional[str] = None) -> str:
		"""Generate an optimized summary with performance settings."""
		# Truncate text if too long to prevent long processing times
		max_text_length = 4000  # Reasonable limit for processing
		if len(text) > max_text_length:
			text = text[:max_text_length] + "..."
			logger.info(f"Truncated input text to {max_text_length} characters for faster processing")
		
		prompt = (
			"You are an assistant that writes concise meeting notes. "
			"Summarize the following transcript into: 1) a concise summary (3-6 sentences), "
			"2) key decisions, 3) action items with owners if possible, 4) open questions.\n\nTranscript:\n" + text
		)
		
		# Use optimized options for summarization
		summary_options = {
			"temperature": 0.2,  # More focused output
			"top_p": 0.8,
			"top_k": 10,
			"num_predict": 300,  # Shorter summaries
		}
		
		return self.generate(prompt, model=model, options=summary_options)

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


