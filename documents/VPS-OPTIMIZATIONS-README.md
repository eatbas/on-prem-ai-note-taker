# VPS Optimizations and Progress Tracking

This document describes the VPS optimizations and progress tracking features implemented for the On-Prem AI Note Taker application.

## 🚀 Features Overview

### 1. CPU-Only VPS Tuning (6 vCPU, 18 GB RAM)
- **Whisper Optimizations**: Forced CPU usage with optimized thread count
- **Ollama Optimizations**: CPU thread allocation and memory limits
- **Resource Management**: Docker Compose resource limits for optimal VPS performance

### 2. TR/EN Language Handling
- **Language Restrictions**: Force "tr" | "en" | "auto" language options
- **Validation**: Configurable language validation with normalization
- **Flexibility**: Support for Turkish, English, and auto-detection

### 3. Progress & ETA Reporting
- **Real-time Updates**: Live progress tracking for transcription and summarization
- **Two-Phase Bars**: Overall progress + current phase progress
- **ETA Calculation**: Estimated time remaining based on current progress
- **Status Messages**: Detailed status updates throughout processing

### 4. Job Management APIs
- **Submit Jobs**: Async job submission for long-running tasks
- **Status Tracking**: Real-time job status monitoring
- **Job Cancellation**: Ability to cancel running jobs
- **SSE Support**: Server-Sent Events for live progress updates

### 5. Frontend Progress UI
- **Progress Tracker Component**: Modern, responsive progress display
- **Two-Phase Visualization**: Overall and phase-specific progress bars
- **ETA Display**: Time remaining estimates
- **Job Controls**: Cancel buttons and status indicators

## 🏗️ Architecture

### Backend Components

#### Job Manager (`backend/app/job_manager.py`)
- **JobManager**: Main job orchestration and tracking
- **JobProgressTracker**: Individual job progress monitoring
- **Progress Callbacks**: Real-time progress notification system

#### Database Models (`backend/app/database.py`)
- **Job**: Job tracking with progress, phases, and ETA
- **JobStatus**: Enum for job states (pending, processing, completed, failed, cancelled)
- **JobType**: Enum for job types (transcription, summarization, transcribe_and_summarize)

#### API Endpoints (`backend/app/main.py`)
- `POST /api/jobs/submit` - Submit new jobs
- `GET /api/jobs/{job_id}/status` - Get job status
- `POST /api/jobs/{job_id}/cancel` - Cancel running jobs
- `GET /api/jobs/{job_id}/stream` - SSE progress streaming

### Frontend Components

#### Progress Tracker (`frontend/src/ProgressTracker.tsx`)
- **Real-time Updates**: EventSource-based progress streaming
- **Visual Progress**: Two-phase progress bars with colors
- **Status Display**: Job status, current phase, and ETA
- **Interactive Controls**: Cancel buttons for running jobs

#### API Integration (`frontend/src/api.ts`)
- **Job Submission**: Helper functions for different job types
- **Progress Streaming**: EventSource creation for live updates
- **Type Safety**: TypeScript interfaces for all job-related data

## ⚙️ Configuration

### Environment Variables

#### VPS Optimizations
```bash
# Whisper Settings
WHISPER_DEVICE=cpu                    # Force CPU usage
WHISPER_CPU_THREADS=6                 # Optimize for 6 vCPU
WHISPER_MEMORY_LIMIT_GB=16            # Memory limit for Whisper

# Ollama Settings
OLLAMA_CPU_THREADS=6                  # CPU thread allocation
OLLAMA_MEMORY_LIMIT_GB=16             # Memory limit for Ollama
```

#### Language Restrictions
```bash
ALLOWED_LANGUAGES=tr,en,auto          # Allowed language options
FORCE_LANGUAGE_VALIDATION=true        # Strict language validation
```

#### Progress Tracking
```bash
ENABLE_PROGRESS_TRACKING=true         # Enable progress tracking
PROGRESS_UPDATE_INTERVAL_MS=500       # Progress update frequency
ENABLE_SSE=true                       # Enable Server-Sent Events
```

### Docker Compose Resource Limits

```yaml
services:
  ollama:
    deploy:
      resources:
        limits:
          cpus: '6.0'                  # 6 vCPU limit
          memory: 16G                   # 16GB memory limit
        reservations:
          cpus: '2.0'                  # 2 vCPU reservation
          memory: 8G                    # 8GB memory reservation

  backend:
    deploy:
      resources:
        limits:
          cpus: '4.0'                  # 4 vCPU for processing
          memory: 8G                    # 8GB for backend
        reservations:
          cpus: '1.0'                  # 1 vCPU minimum
          memory: 2G                    # 2GB minimum

  redis:
    deploy:
      resources:
        limits:
          cpus: '1.0'                  # Minimal Redis resources
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

## 📱 Usage Examples

### Submitting a Transcription Job

```typescript
import { submitTranscriptionJob } from './api'

// Submit job
const response = await submitTranscriptionJob(audioFile, {
  language: 'tr',
  vadFilter: true
})

const jobId = response.job_id
```

### Tracking Job Progress

```typescript
import ProgressTracker from './ProgressTracker'

function MyComponent() {
  const handleJobComplete = (result) => {
    console.log('Job completed:', result)
  }

  const handleJobError = (error) => {
    console.error('Job failed:', error)
  }

  const handleJobCancel = async () => {
    await cancelJob(jobId)
  }

  return (
    <ProgressTracker
      jobId={jobId}
      onComplete={handleJobComplete}
      onError={handleJobError}
      onCancel={handleJobCancel}
    />
  )
}
```

### Using the Job APIs Directly

```typescript
import { submitJob, getJobStatus, cancelJob } from './api'

// Submit custom job
const jobResponse = await submitJob({
  job_type: 'summarization',
  input_data: { text: 'Long text to summarize' }
})

// Check status
const status = await getJobStatus(jobResponse.job_id)

// Cancel if needed
if (status.status === 'processing') {
  await cancelJob(jobResponse.job_id)
}
```

## 🔧 Testing

### Running Tests

```bash
cd backend
python test_job_manager.py
```

### Test Coverage

- **Job Manager**: Job submission, status tracking, progress updates, cancellation
- **Language Validation**: TR/EN language handling and normalization
- **API Endpoints**: Job management API functionality
- **Progress Tracking**: Real-time progress updates and ETA calculation

## 🚀 Performance Optimizations

### Whisper Optimizations
- **CPU Threading**: Optimized for 6 vCPU VPS
- **Memory Management**: 16GB memory limit with system buffer
- **VAD Settings**: Optimized Voice Activity Detection parameters
- **Beam Search**: Single-pass decoding for speed

### Ollama Optimizations
- **CPU Allocation**: Dedicated CPU threads for AI processing
- **Memory Limits**: Controlled memory usage for stability
- **Parallel Processing**: Optimized for concurrent requests

### Resource Management
- **Docker Limits**: Strict resource constraints for VPS stability
- **Queue Management**: Redis-based job queuing system
- **Concurrency Control**: Configurable worker limits

## 🔒 Security Features

- **Language Validation**: Prevents unauthorized language processing
- **User Isolation**: Jobs are isolated by user ID
- **Authentication**: HTTP Basic Auth support
- **Input Validation**: File size and type restrictions

## 📊 Monitoring

### Health Endpoints
- `GET /api/health` - System health with VPS optimization info
- `GET /api/vps/health` - VPS connectivity status

### Job Statistics
- Real-time job status tracking
- Progress percentage and phase information
- ETA calculations and performance metrics

## 🐛 Troubleshooting

### Common Issues

#### Job Not Starting
- Check Redis connectivity
- Verify job manager initialization
- Check user authentication

#### Progress Not Updating
- Verify SSE endpoint accessibility
- Check EventSource connection
- Monitor backend logs for errors

#### Performance Issues
- Adjust CPU thread allocations
- Monitor memory usage
- Check Docker resource limits

### Debug Mode

```bash
LOG_LEVEL=DEBUG
ENABLE_PROGRESS_TRACKING=true
PROGRESS_UPDATE_INTERVAL_MS=100
```

## 🔮 Future Enhancements

- **WebSocket Support**: Alternative to SSE for better real-time updates
- **Job Queuing**: Priority-based job scheduling
- **Batch Processing**: Multiple file processing
- **Advanced ETA**: Machine learning-based time estimation
- **Progress Persistence**: Resume interrupted jobs

## 📚 API Reference

### Job Models

```typescript
interface JobSubmitRequest {
  job_type: 'transcription' | 'summarization' | 'transcribe_and_summarize'
  input_data: Record<string, any>
}

interface JobStatusResponse {
  id: string
  type: string
  status: string
  progress_percent: number
  current_phase: string
  phase_progress: number
  estimated_remaining_seconds?: number
  created_at?: string
  started_at?: string
  completed_at?: string
  result_data?: Record<string, any>
  error_message?: string
}
```

### Progress Phases

- **initializing**: Job setup and file processing
- **transcribing**: Audio transcription in progress
- **summarizing**: Text summarization in progress
- **finalizing**: Job completion and cleanup

## 🤝 Contributing

When contributing to VPS optimizations:

1. **Test Performance**: Always test on actual VPS hardware
2. **Resource Limits**: Respect Docker resource constraints
3. **Language Support**: Maintain TR/EN language restrictions
4. **Progress Tracking**: Ensure real-time updates work correctly
5. **Error Handling**: Implement proper error handling and recovery

## 📄 License

This implementation follows the same license as the main project.
