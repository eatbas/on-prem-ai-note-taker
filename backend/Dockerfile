FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
	ffmpeg \
	curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV APP_HOST=0.0.0.0 \
	APP_PORT=8000 \
	WHISPER_MODEL=tiny \
	WHISPER_COMPUTE_TYPE=int8 \
	OLLAMA_BASE_URL=http://localhost:11434 \
	OLLAMA_MODEL=qwen2.5:3b-instruct

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


