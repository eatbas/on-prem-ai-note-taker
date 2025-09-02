use serde::{Deserialize, Serialize};
use std::{fs::OpenOptions, io::Write, path::PathBuf, sync::Arc};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptPartial {
    pub session_id: String,
    pub chunk_path: String,
    pub start: f32,
    pub end: f32,
    pub text: String,
    pub speaker: Option<String>,
}

pub struct Coordinator {
    app: AppHandle,
}

impl Coordinator {
    pub fn new(app: AppHandle) -> Self { Self { app } }

    pub async fn handle_chunk(&self, session_id: &str, chunk_path: &str, start_ms: u128, end_ms: u128) {
        let start = (start_ms as f32) / 1000.0;
        let end = (end_ms as f32) / 1000.0;

        // Transcribe
        let text = match crate::whisper::LocalWhisperService::new(crate::whisper::WhisperConfig::default())
            .transcribe_wav_file(chunk_path).await {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Transcribe error: {}", e);
                String::new()
            }
        };

        // Diarize (best-effort; may fail if service not running)
        let speaker = match crate::whisper::diarize_wav_file(chunk_path.to_string()).await {
            Ok(turns) => {
                let mid = (start + end) / 2.0;
                let mut sp: Option<String> = None;
                for t in turns {
                    if mid >= t.start && mid <= t.end {
                        sp = Some(t.speaker);
                        break;
                    }
                }
                sp
            },
            Err(_) => None,
        };

        // Emit partial
        let partial = TranscriptPartial {
            session_id: session_id.to_string(),
            chunk_path: chunk_path.to_string(),
            start,
            end,
            text: text.clone(),
            speaker: speaker.clone(),
        };
        let _ = self.app.emit("transcript:partial", &partial);

        // Append JSONL and TXT
        if let Some(session_dir) = PathBuf::from(chunk_path).parent().map(|p| p.to_path_buf()) {
            let jsonl = session_dir.join("transcript.jsonl");
            let txt = session_dir.join("live.txt");
            let line = serde_json::json!({
                "start": start,
                "end": end,
                "text": text,
                "speaker": speaker,
                "chunk": chunk_path,
            }).to_string() + "\n";
            let _ = append_file(&jsonl, line.as_bytes());
            let pretty = format!("[{} - {}] {}: {}\n",
                hhmmss(start as f64), hhmmss(end as f64), speaker.clone().unwrap_or("Speaker".into()), text);
            let _ = append_file(&txt, pretty.as_bytes());
        }
    }
}

fn append_file(path: &PathBuf, data: &[u8]) -> std::io::Result<()> {
    let mut f = OpenOptions::new().create(true).append(true).open(path)?;
    f.write_all(data)
}

fn hhmmss(seconds: f64) -> String {
    let s = seconds as u64;
    let h = s / 3600;
    let m = (s % 3600) / 60;
    let sec = s % 60;
    format!("{:02}:{:02}:{:02}", h, m, sec)
}


