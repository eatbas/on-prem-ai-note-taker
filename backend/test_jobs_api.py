#!/usr/bin/env python3
"""Test script for the new jobs API endpoints"""

import sys
import os
import time
import requests
import json

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_jobs_api():
    """Test the jobs API endpoints"""
    print("🚀 Testing Jobs API Endpoints...")
    print("=" * 50)
    
    # Configuration
    base_url = "http://localhost:8000"
    headers = {
        "X-User-Id": "test_user_123",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    # Test 1: Submit a transcribe-and-summarize job
    print("\n1. Testing job submission...")
    try:
        # Create a dummy audio file (1 second of silence in WAV format)
        dummy_audio = create_dummy_wav()
        
        files = {"file": ("test_audio.wav", dummy_audio, "audio/wav")}
        data = {"language": "auto"}
        
        response = requests.post(
            f"{base_url}/api/jobs/transcribe-and-summarize",
            files=files,
            data=data,
            headers=headers
        )
        
        if response.status_code == 202:
            job_data = response.json()
            job_id = job_data["job_id"]
            print(f"   ✅ Job submitted successfully: {job_id}")
            print(f"   Status: {job_data['status']}")
            print(f"   Message: {job_data['message']}")
        else:
            print(f"   ❌ Job submission failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return
            
    except Exception as e:
        print(f"   ❌ Job submission error: {e}")
        return
    
    # Test 2: Get job status
    print("\n2. Testing job status retrieval...")
    try:
        response = requests.get(
            f"{base_url}/api/jobs/{job_id}/status",
            headers=headers
        )
        
        if response.status_code == 200:
            status_data = response.json()
            print(f"   ✅ Job status retrieved successfully")
            print(f"   Phase: {status_data['phase']}")
            print(f"   Progress: {status_data['progress']}%")
            print(f"   Message: {status_data['message']}")
            print(f"   ETA: {status_data.get('eta_seconds', 'N/A')}s")
        else:
            print(f"   ❌ Status retrieval failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Status retrieval error: {e}")
    
    # Test 3: Monitor job progress
    print("\n3. Monitoring job progress...")
    max_wait = 60  # Maximum wait time in seconds
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        try:
            response = requests.get(
                f"{base_url}/api/jobs/{job_id}/status",
                headers=headers
            )
            
            if response.status_code == 200:
                status_data = response.json()
                current_phase = status_data['phase']
                current_progress = status_data['progress']
                current_message = status_data['message']
                
                print(f"   📊 Phase: {current_phase}, Progress: {current_progress:.1f}%, Message: {current_message}")
                
                # Check if job is complete
                if current_phase in ['done', 'error', 'canceled']:
                    print(f"   ✅ Job completed with phase: {current_phase}")
                    break
                    
            else:
                print(f"   ❌ Status check failed: {response.status_code}")
                break
                
        except Exception as e:
            print(f"   ❌ Progress monitoring error: {e}")
            break
        
        # Wait before next check
        time.sleep(2)
    
    # Test 4: Test SSE events (if job is still running)
    print("\n4. Testing SSE events...")
    try:
        response = requests.get(
            f"{base_url}/api/jobs/{job_id}/events",
            headers=headers,
            stream=True,
            timeout=10
        )
        
        if response.status_code == 200:
            print("   ✅ SSE connection established")
            # Read a few events
            event_count = 0
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data: '):
                        event_count += 1
                        print(f"   📡 Event {event_count}: {line_str[6:]}")
                        if event_count >= 3:  # Just show first 3 events
                            break
        else:
            print(f"   ❌ SSE connection failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ SSE test error: {e}")
    
    # Test 5: Test job cancellation (if job is still running)
    print("\n5. Testing job cancellation...")
    try:
        # Check current status first
        response = requests.get(
            f"{base_url}/api/jobs/{job_id}/status",
            headers=headers
        )
        
        if response.status_code == 200:
            status_data = response.json()
            if status_data['phase'] in ['queued', 'transcribing', 'summarizing', 'finalizing']:
                # Cancel the job
                response = requests.post(
                    f"{base_url}/api/jobs/{job_id}/cancel",
                    headers=headers
                )
                
                if response.status_code == 202:
                    cancel_data = response.json()
                    print(f"   ✅ Job cancelled successfully: {cancel_data['message']}")
                else:
                    print(f"   ❌ Job cancellation failed: {response.status_code}")
            else:
                print(f"   ℹ️  Job already completed (phase: {status_data['phase']}), skipping cancellation")
        else:
            print(f"   ❌ Status check failed for cancellation: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Job cancellation error: {e}")
    
    print("\n✅ Jobs API testing completed!")
    print("=" * 50)


def create_dummy_wav():
    """Create a dummy WAV file for testing"""
    # WAV header for 1 second of silence at 44.1kHz, 16-bit mono
    sample_rate = 44100
    duration = 1  # 1 second
    num_samples = sample_rate * duration
    
    # WAV file header
    wav_header = bytearray([
        # RIFF header
        0x52, 0x49, 0x46, 0x46,  # "RIFF"
        0x24, 0x00, 0x00, 0x00,  # File size - 8 (36 bytes)
        0x57, 0x41, 0x56, 0x45,  # "WAVE"
        
        # fmt chunk
        0x66, 0x6D, 0x74, 0x20,  # "fmt "
        0x10, 0x00, 0x00, 0x00,  # fmt chunk size (16 bytes)
        0x01, 0x00,               # Audio format (PCM)
        0x01, 0x00,               # Number of channels (1 = mono)
        0x44, 0xAC, 0x00, 0x00,  # Sample rate (44100)
        0x88, 0x58, 0x01, 0x00,  # Byte rate (88200)
        0x02, 0x00,               # Block align (2 bytes)
        0x10, 0x00,               # Bits per sample (16)
        
        # data chunk
        0x64, 0x61, 0x74, 0x61,  # "data"
        0x00, 0x00, 0x00, 0x00   # Data chunk size (will be filled)
    ]])
    
    # Calculate data size and update header
    data_size = num_samples * 2  # 2 bytes per sample (16-bit)
    wav_header[40:44] = data_size.to_bytes(4, 'little')
    
    # Create silent audio data
    audio_data = bytearray([0x00, 0x00] * num_samples)
    
    return wav_header + audio_data


if __name__ == "__main__":
    print("Note: This test requires the FastAPI server to be running on localhost:8000")
    print("Make sure to start the server first with: uvicorn app.main:app --reload")
    print()
    
    test_jobs_api()
