#!/usr/bin/env python3
"""Test script for the new chunked transcription and summarization service"""

import sys
import os
import time
import asyncio

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from chunked_service import chunked_service
from progress import job_store, Phase
from prompts import get_chunk_prompt, get_merge_prompt, get_chunk_prompt_tr, get_merge_prompt_tr

def test_prompts():
    """Test the language-specific prompts"""
    print("🧪 Testing Language-Specific Prompts...")
    print("=" * 50)
    
    # Test English prompts
    print("\n1. English Prompts:")
    chunk_en = get_chunk_prompt("en")
    merge_en = get_merge_prompt("en")
    print(f"   Chunk prompt length: {len(chunk_en)} characters")
    print(f"   Merge prompt length: {len(merge_en)} characters")
    print(f"   Contains 'English': {'English' in chunk_en}")
    
    # Test Turkish prompts
    print("\n2. Turkish Prompts:")
    chunk_tr = get_chunk_prompt("tr")
    merge_tr = get_merge_prompt("tr")
    print(f"   Chunk prompt length: {len(chunk_tr)} characters")
    print(f"   Merge prompt length: {len(merge_tr)} characters")
    print(f"   Contains 'Türkçe': {'Türkçe' in chunk_tr}")
    
    # Test auto language (should default to English)
    print("\n3. Auto Language (defaults to English):")
    chunk_auto = get_chunk_prompt("auto")
    merge_auto = get_merge_prompt("auto")
    print(f"   Chunk prompt matches EN: {chunk_auto == chunk_en}")
    print(f"   Merge prompt matches EN: {merge_auto == merge_en}")
    
    print("\n✅ Prompt testing completed!")


def test_progress_tracking():
    """Test the enhanced progress tracking with ETA"""
    print("\n📊 Testing Enhanced Progress Tracking...")
    print("=" * 50)
    
    # Create a test job
    job_id = "test_progress_123"
    job = job_store.create(job_id, Phase.QUEUED)
    print(f"   Created job: {job_id}")
    
    # Simulate progress updates
    print("\n   Simulating transcription progress...")
    for i in range(0, 101, 20):
        job_store.update(
            job_id,
            progress=i,
            current=i,
            total=100,
            message=f"Processing {i}%"
        )
        
        current_job = job_store.get(job_id)
        eta = current_job.eta_seconds
        print(f"     Progress: {i}%, ETA: {eta:.1f}s" if eta else f"     Progress: {i}%, ETA: N/A")
        
        time.sleep(0.1)  # Small delay to simulate processing
    
    # Test phase transitions
    print("\n   Testing phase transitions...")
    phases = [Phase.TRANSCRIBING, Phase.SUMMARIZING, Phase.FINALIZING, Phase.DONE]
    
    for phase in phases:
        job_store.update(job_id, phase=phase, message=f"Phase: {phase.value}")
        current_job = job_store.get(job_id)
        print(f"     Phase: {current_job.phase.value}, Progress: {current_job.progress}%")
        time.sleep(0.1)
    
    # Test cancellation
    print("\n   Testing cancellation...")
    cancelled = job_store.cancel(job_id)
    print(f"     Cancelled: {cancelled}")
    
    # Cleanup
    job_store.delete(job_id)
    print("\n✅ Progress tracking testing completed!")


def test_text_chunking():
    """Test the text chunking functionality"""
    print("\n✂️  Testing Text Chunking...")
    print("=" * 50)
    
    # Test text
    test_text = """
    This is a test transcript with multiple sentences. It should be split into chunks.
    Each chunk should be approximately the right size. We want to test the chunking logic.
    The chunks should break at natural sentence boundaries when possible.
    If no good break point is found, it should break at spaces.
    This ensures that the summarization works well with coherent text segments.
    """
    
    # Test chunking
    chunks = chunked_service._split_text_into_chunks(test_text, chunk_size=100)
    
    print(f"   Original text length: {len(test_text)} characters")
    print(f"   Number of chunks: {len(chunks)}")
    
    for i, chunk in enumerate(chunks):
        print(f"     Chunk {i+1}: {len(chunk)} chars - '{chunk[:50]}...'")
    
    print("\n✅ Text chunking testing completed!")


async def test_chunked_service():
    """Test the chunked service (requires actual audio file)"""
    print("\n🎵 Testing Chunked Service...")
    print("=" * 50)
    
    print("   Note: This test requires an actual audio file.")
    print("   You can test with a real audio file by calling:")
    print("   await chunked_service.process_audio_file(job_id, file_path, language, user_id)")
    
    # Test the service structure
    print(f"   Service initialized: {chunked_service is not None}")
    print(f"   Ollama client configured: {chunked_service.ollama_client is not None}")
    
    print("\n✅ Chunked service testing completed!")


async def main():
    """Run all tests"""
    print("🚀 Starting Chunked Service Tests...")
    print("=" * 60)
    
    try:
        # Test prompts
        test_prompts()
        
        # Test progress tracking
        test_progress_tracking()
        
        # Test text chunking
        test_text_chunking()
        
        # Test chunked service
        await test_chunked_service()
        
        print("\n🎉 All tests completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
