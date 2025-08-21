## On-Prem AI Note Taker

End-to-end, fully local note-taking app:
- Backend: FastAPI + faster-whisper (speech-to-text) + Ollama (LLM summarization)
- Frontend: Vite + React
- Deploy: Docker Compose (backend, frontend, Ollama)

### Features
- Upload audio/video; transcribe locally via faster-whisper
- Summarize transcript via your local Ollama model
- One-click Transcribe + Summarize

### Architecture
- `backend/`: FastAPI API
  - `/api/transcribe` — accepts `multipart/form-data` with `file`
  - `/api/summarize` — accepts JSON `{ text }`
  - `/api/transcribe-and-summarize` — accepts file, returns transcript + summary
- `frontend/`: React single-page app
- `ollama` service: runs your LLM locally in the same Docker network

---

## Quickstart (Docker Compose)

Requirements:
- Docker and Docker Compose installed

1) Clone and enter the repo
```bash
git clone <your-fork-or-repo-url>
cd on-prem-ai-note-taker
```

2) Start the stack
```bash
docker compose up -d --build
```

3) Pull an Ollama model (first time only)
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

4) Open the app
```bash
# Frontend
http://localhost:8080

# Backend health
http://localhost:8000/api/health
```

Environment variables (optional):
- `WHISPER_MODEL` (default `base`) – e.g. `small`, `medium`, `large-v3`
- `WHISPER_COMPUTE_TYPE` (default `auto`) – e.g. `int8`, `int8_float16`, `float16`
- `OLLAMA_MODEL` (default `llama3.1:8b`)
- `MAX_UPLOAD_MB` (default `200`) – request body limit for large audio/video
- `MAX_CONCURRENCY` (default `2`) – concurrent transcriptions allowed

You can set them inline when starting Compose:
```bash
WHISPER_MODEL=small OLLAMA_MODEL=llama3.1:8b docker compose up -d --build
```

---

## Local Development (no Docker)

### Backend
Requirements: Python 3.11, FFmpeg
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt

# Optional: set envs
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama3.1:8b

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# App on http://localhost:5173
```

Run Ollama locally on your machine (outside Docker) if you prefer:
```bash
# Install Ollama: https://ollama.com/download
ollama serve &
ollama pull llama3.1:8b
```

---

## VPS Installation (Ubuntu 22.04/24.04)

1) Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Re-login or: newgrp docker
```

2) Clone and start
```bash
git clone <your-repo-url>
cd on-prem-ai-note-taker
docker compose up -d --build
docker compose exec ollama ollama pull llama3.1:8b
```

3) Optional: expose with Nginx
Point your domain to the VPS IP, then create an Nginx site:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

TLS: Use Certbot or a reverse proxy like Caddy/Traefik as you prefer.

### Hardening and Ops
- Healthchecks are enabled for all services; `docker compose ps` to inspect.
- Models are persisted in volumes: `ollama_models` and `whisper_models`.
- Increase upload and proxy timeouts for long files or slow CPUs.
- Monitor container logs: `docker compose logs -f backend frontend ollama`.

---

## Configuration

Backend env vars:
- `APP_HOST` (default `0.0.0.0`)
- `APP_PORT` (default `8000`)
- `ALLOWED_ORIGINS` (comma-separated, default `*`)
- `WHISPER_MODEL`, `WHISPER_COMPUTE_TYPE`, `WHISPER_DOWNLOAD_ROOT`
- `OLLAMA_BASE_URL` (default `http://ollama:11434` in Docker)
- `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`

Frontend env:
- `VITE_API_BASE_URL` (default `/api` when served via Nginx inside container)

---

## Notes and Tips
- The first transcription will download the Whisper model files; allow time and disk space.
- If using GPU builds of Ollama/Whisper, refer to their docs for GPU flags and base images.
- Large models need more RAM/VRAM; consider `small` or `medium` for modest servers.

---

## References
- Ollama docs: `https://ollama.com`
- faster-whisper: `https://github.com/guillaumekln/faster-whisper`
- FastAPI: `https://fastapi.tiangolo.com`


