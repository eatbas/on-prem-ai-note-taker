# 🎤 On-Prem AI Note Taker — Phased Development Plan

**Goal:** Restructure project around **Tauri v2** with **native audio capture**, **local Whisper transcription**, and **speaker diarization** (pyannote).  
**Status:** Planning → Implementation  

---

## 🚨 Background

- Old Electron / WebRTC audio capture was unreliable, especially for **system audio** (macOS, Linux).  
- Whole-meeting recording → transcription caused **high latency** and **big storage overhead**.  
- No first-class **speaker separation** (needed Speaker 1–5, with possible enrollment to names).  

We are already migrated to **Tauri**, but we need to **remove old audio paths** and **restructure the repo** with a streaming pipeline.

---

## 🏗️ Target Architecture

**Native Capture (Rust plugin)**  
➡️ **Chunk WAV (10–15s)**  
➡️ **Transcribe (faster-whisper, local FastAPI or remote VPS)**  
➡️ **Diarize (pyannote.audio, local FastAPI)**  
➡️ **Align segments ↔ speakers**  
➡️ **Emit live transcript events**  
➡️ **Store JSONL, TXT**  
➡️ **Post-process full session** (concat → diarize again)  
➡️ **Export final artifacts** (TXT, JSONL, SRT, WAV)

---

# 🔄 Phased Development Plan

Each phase has **objectives**, **Cursor prompts**, and **deliverables**.  
Copy-paste each block into Cursor with **GPT-5** selected.

---

## Phase 1 — Cleanup & Preparation

**Objective:** Remove obsolete Electron/WebRTC paths. Prepare repo structure.

**Actions:**
- Delete all Electron-related code, configs, scripts.  
- Delete browser-only capture paths (`getDisplayMedia`, systemAudio flags).  
- Prepare directories for plugins/services:  
  ```
  src-tauri/plugins/audio_capture/
  src-tauri/transcriber/local_server/
  src-tauri/diarizer/local_server/
  docs/
  recordings/
  ```

**Deliverable:** Clean repo; no Electron/WebRTC audio logic left.

---

## Phase 2 — Native Audio Capture Plugin (Rust, Tauri v2)

**Objective:** Implement OS-level audio capture with chunking + events.

**Cursor Prompt:**
```
Create a Tauri v2 plugin at `src-tauri/plugins/audio_capture`:

Commands:
- get_devices()
- start_mic(sample_rate=48000, mono=true)
- start_system(sample_rate=48000, mono=true)
- start_mix(sample_rate=48000, mono=true) // soft-clip mixer
- stop_all()

Behavior:
- macOS: ScreenCaptureKit (Info.plist keys: NSMicrophoneUsageDescription, NSAudioCaptureUsageDescription)
- Windows: WASAPI loopback (default render device)
- Linux: PulseAudio/PipeWire monitor source
- Chunking: write 10s WAV files to app_data_dir()/recordings/<sessionId>/
- Emit Tauri event "audio:chunk" with metadata after each chunk
```

**Deliverable:**  
- Cross-platform plugin  
- Rolling chunk WAVs  
- Events delivered to frontend  

---

## Phase 3 — Local Whisper Transcriber Service

**Objective:** Stream transcription locally (faster-whisper CPU).

**Cursor Prompt:**
```
At `src-tauri/transcriber/local_server/` create:

- main.py (FastAPI)
- requirements.txt (fastapi, uvicorn, soundfile, numpy, faster-whisper==1.*)

API:
POST /transcribe
- Input: multipart (file, language?, beam_size?)
- Output: { segments: [{start,end,text}], text }

Defaults:
- Model: "medium"
- compute_type="int8"
- beam_size=5
```

**Deliverable:**  
- Local transcription API  
- Rust wrapper for calling `/transcribe`  

---

## Phase 4 — Local Diarizer Service

**Objective:** Add speaker separation (Speaker 1–5).

**Cursor Prompt:**
```
At `src-tauri/diarizer/local_server/` create:

- main.py (FastAPI)
- requirements.txt (fastapi, uvicorn, soundfile, numpy, torch, pyannote.audio==3.*)

API:
POST /diarize
- Input: multipart (file, max_speakers?)
- Output: { turns: [{start, end, speaker}] }

Implementation:
- Load pyannote pipeline with HF_TOKEN env
- Map raw speaker IDs -> stable "Speaker 1..N"
```

**Deliverable:**  
- Local diarization API using Hugging Face token  
- Rust wrapper to call `/diarize`  

---

## Phase 5 — Coordinator (Rust): Chunks → Transcribe → Diarize → Align

**Objective:** Glue together capture + ASR + diarization, emit transcript events.

**Cursor Prompt:**
```
In `src-tauri/src/coordinator.rs`:

- Subscribe to "audio:chunk"
- For each chunk:
  1) transcribe(path) -> segments
  2) diarize(path, MAX_SPEAKERS) -> turns
  3) align segments with turns by overlap
  4) emit "transcript:partial" with {chunk,start,end,text,speaker}
  5) append JSONL line to sessionDir/transcript.jsonl
  6) append text to sessionDir/live.txt

Add:
- start_session(kind: "mic"|"system"|"mix") -> sessionId
- stop_session(sessionId) -> stop capture, drain queue, trigger Phase 6
```

**Deliverable:**  
- Live streaming transcripts  
- JSONL + TXT per session  

---

## Phase 6 — Post-Process on Stop (Concat + Global Diarization + Final Outputs)

**Objective:** Improve diarization + generate exportable artifacts.

**Cursor Prompt:**
```
When stop_session is called:

- Concatenate chunks into sessionDir/final.wav
- Run diarizer once on final.wav -> global turns
- Relabel all transcript.jsonl segments
- Produce:
  - final.jsonl (relabeled)
  - final.txt (plain text with speakers)
  - final.srt (subtitle format with speakers)
- Add command export_session(sessionId, fmt) to zip/export outputs
```

**Deliverable:**  
- Final outputs with consistent speaker labels  
- Export command for user  

---

## Phase 7 — Frontend (React)

**Objective:** Live transcript UI + settings.

**Cursor Prompt:**
```
Create `src/components/LiveTranscript.tsx`:

Features:
- Start Mic / System / Mix / Stop buttons
- Render transcript rows: [HH:MM:SS] Speaker 2: text...
- Show latency per segment
- Export buttons (.txt, .jsonl, .srt)
- Settings panel:
  - Transcriber mode (local/remote)
  - Whisper model (medium/large-v3/distil-*)
  - Language hint (tr/en)
  - Diarization toggle + maxSpeakers
  - Chunk size (8–20s)
```

**Deliverable:**  
- Working UI for live captions  
- Configurable settings  

---

## Phase 8 — Advanced: Mixing & Echo

**Objective:** Handle mic+system better.

**Cursor Prompt:**
```
In audio_capture plugin:

- Implement soft-clip float mixer for start_mix
- Add option to emit mic/system separately ("audio:chunk_mic", "audio:chunk_sys")
- Windows: add AEC toggle (no-op on others)
- Frontend: add "Keep tracks separate" toggle
```

**Deliverable:**  
- Cleaner mixes  
- Optional separate channels  

---

## Phase 9 — Speaker Enrollment (Optional)

**Objective:** Map speakers → real names.

**Cursor Prompt:**
```
Extend diarizer service:

- POST /enroll (name, file) -> store embedding
- During diarization: compare cluster centroids vs stored embeddings
- If similarity > threshold (0.75), relabel to real name
Frontend:
- Allow renaming "Speaker 2" -> "Merve" and persist mapping to session.json
```

**Deliverable:**  
- Optional named speaker mapping  
- Persistence across sessions  

---

## Phase 10 — Testing & Validation

- macOS (Apple Silicon): Mic/System/Mix; permissions ok; final outputs valid.  
- Windows 10/11: WASAPI loopback; optional AEC.  
- Linux: PulseAudio/PipeWire monitor capture.  
- Language hints (`tr` / `en`) tested.  
- Diarization outputs stable Speaker 1–5.  
- End-to-caption latency < 2s on CPU (10–15s chunks).  

---

# 📦 Dev Environment Commands

Transcriber:
```bash
cd src-tauri/transcriber/local_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8123 --reload
```

Diarizer:
```bash
cd src-tauri/diarizer/local_server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export HF_TOKEN=your_token_here
uvicorn main:app --port 8124 --reload
```

---

# 🎯 End Result

- **Robust native audio capture** (mic/system/mix)  
- **Live transcription with Whisper** (on-prem)  
- **Speaker diarization (Speaker 1–5)**  
- **Final exports (txt/jsonl/srt/wav)**  
- **Settings for models, diarization, chunk size**  
- **Clean repo: no Electron/web-only code left**
