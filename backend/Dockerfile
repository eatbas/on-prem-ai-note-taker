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
	WHISPER_MODEL=base \
	WHISPER_COMPUTE_TYPE=auto \
	OLLAMA_BASE_URL=http://ollama:11434 \
	OLLAMA_MODEL=llama3.1:8b

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]


