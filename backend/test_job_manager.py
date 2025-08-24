#!/usr/bin/env python3
"""Simple test script for the job manager functionality"""

import asyncio
import json
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from job_manager import job_manager, JobType, JobPhase
from database import init_db, Job, JobStatus
from config import settings

async def test_job_manager():
    """Test basic job manager functionality"""
    print("Testing Job Manager...")
    
    # Initialize database
    init_db()
    
    # Test job submission
    print("\n1. Testing job submission...")
    job_id = await job_manager.submit_job(
        user_id="test_user",
        job_type=JobType.TRANSCRIPTION,
        input_data={"test": "data"}
    )
    print(f"   Job submitted with ID: {job_id}")
    
    # Test job status retrieval
    print("\n2. Testing job status retrieval...")
    status = await job_manager.get_job_status(job_id, "test_user")
    print(f"   Job status: {json.dumps(status, indent=2)}")
    
    # Test progress tracking
    print("\n3. Testing progress tracking...")
    
    def progress_callback(progress):
        print(f"   Progress update: {progress.progress_percent}% - {progress.current_phase}")
    
    job_manager.subscribe_to_progress(job_id, progress_callback)
    
    # Wait a bit for processing
    print("   Waiting for job processing...")
    await asyncio.sleep(2)
    
    # Test job cancellation
    print("\n4. Testing job cancellation...")
    cancelled = await job_manager.cancel_job(job_id, "test_user")
    print(f"   Job cancelled: {cancelled}")
    
    # Cleanup
    job_manager.unsubscribe_from_progress(job_id, progress_callback)
    
    print("\n✅ Job manager test completed successfully!")

async def test_language_validation():
    """Test language validation functionality"""
    print("\nTesting Language Validation...")
    
    from main import validate_language
    
    test_cases = [
        ("tr", "tr"),
        ("en", "en"),
        ("auto", "auto"),
        ("turkish", "tr"),
        ("english", "en"),
        ("TÜRKÇE", "tr"),
        ("", "auto"),
        (None, "auto")
    ]
    
    for input_lang, expected in test_cases:
        try:
            result = validate_language(input_lang)
            status = "✅" if result == expected else "❌"
            print(f"   {status} '{input_lang}' -> '{result}' (expected: '{expected}')")
        except Exception as e:
            print(f"   ❌ '{input_lang}' -> Error: {e}")
    
    print("✅ Language validation test completed!")

async def main():
    """Main test function"""
    print("🚀 Starting VPS Optimizations and Progress Tracking Tests")
    print("=" * 60)
    
    try:
        await test_job_manager()
        await test_language_validation()
        
        print("\n" + "=" * 60)
        print("🎉 All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
