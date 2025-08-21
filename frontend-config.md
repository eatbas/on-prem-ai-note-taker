# Frontend Configuration for Local Development 🖥️

## Setup Instructions

Your VPS backend is now running at: **http://95.111.244.159:8000**

### 1. On Your Local Computer

Navigate to the `frontend` folder and create a `.env.local` file:

```bash
cd frontend
```

Create `.env.local` with:
```env
# Point to your VPS backend
VITE_API_BASE_URL=http://95.111.244.159:8000/api

# Optional: Basic auth if you set it up on VPS
# VITE_BASIC_AUTH_USERNAME=your_username
# VITE_BASIC_AUTH_PASSWORD=your_password
```

### 2. Install Dependencies & Run

```bash
npm install
npm run dev
```

The frontend will run on `http://localhost:5173` and connect to your VPS backend.

### 3. Test the Connection

Visit `http://localhost:5173` in your browser. The app should connect to your VPS backend for:
- Speech-to-text transcription
- LLM summarization via Ollama
- All AI processing

### 4. VPS Status

Your VPS services are running:
- ✅ **Backend**: http://95.111.244.159:8000 (FastAPI + Whisper)
- ✅ **Ollama**: http://95.111.244.159:11434 (LLM service)

### 5. Optional: Pull Ollama Model

On your VPS, you can pull a model for better performance:
```bash
docker compose exec ollama ollama pull llama3.1:8b
```

## Architecture

```
Local Computer (Frontend) ←→ VPS (Backend + Ollama)
     Port 5173                    Port 8000 + 11434
```

The frontend runs locally for fast development, while all AI processing happens on your VPS! 🚀
