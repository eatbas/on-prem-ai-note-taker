#!/usr/bin/env python3
"""Simple test script for the new progress module"""

import sys
import os
import time

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from progress import job_store, Phase, JobStatus

def test_progress_module():
    """Test the progress module functionality"""
    print("🚀 Testing Progress Module...")
    print("=" * 50)
    
    # Test 1: Create jobs
    print("\n1. Creating test jobs...")
    job1 = job_store.create("test_job_1", Phase.QUEUED)
    job2 = job_store.create("test_job_2", Phase.TRANSCRIBING)
    print(f"   Created job 1: {job1.id} - {job1.phase.value}")
    print(f"   Created job 2: {job2.id} - {job2.phase.value}")
    
    # Test 2: Update progress
    print("\n2. Updating job progress...")
    job_store.update("test_job_1", phase=Phase.TRANSCRIBING, progress=25.0, message="Processing audio...")
    job_store.update("test_job_2", progress=50.0, message="Halfway done!", current=50, total=100)
    
    # Test 3: Get updated jobs
    print("\n3. Retrieving updated jobs...")
    updated_job1 = job_store.get("test_job_1")
    updated_job2 = job_store.get("test_job_2")
    
    print(f"   Job 1: {updated_job1.phase.value} - {updated_job1.progress}% - {updated_job1.message}")
    print(f"   Job 2: {updated_job2.phase.value} - {updated_job2.progress}% - {updated_job2.message}")
    
    # Test 4: List jobs
    print("\n4. Listing all jobs...")
    all_jobs = job_store.list_jobs()
    print(f"   Total jobs: {len(all_jobs)}")
    for job in all_jobs:
        print(f"     {job.id}: {job.phase.value} - {job.progress}%")
    
    # Test 5: Cancel job
    print("\n5. Canceling a job...")
    success = job_store.cancel("test_job_1")
    print(f"   Cancel result: {success}")
    
    canceled_job = job_store.get("test_job_1")
    print(f"   Canceled job status: {canceled_job.phase.value}")
    
    # Test 6: Get stats
    print("\n6. Getting store statistics...")
    stats = job_store.get_stats()
    print(f"   Store stats: {stats}")
    
    # Test 7: Test progress update with ETA calculation
    print("\n7. Testing progress update with ETA...")
    job_store.update("test_job_2", progress=75.0, message="Almost done!")
    
    # Wait a bit to simulate time passing
    time.sleep(1)
    
    job_store.update("test_job_2", progress=90.0, message="Finalizing...")
    
    final_job = job_store.get("test_job_2")
    print(f"   Final job: {final_job.progress}% - ETA: {final_job.eta_seconds:.1f}s")
    
    # Test 8: Cleanup
    print("\n8. Cleaning up test jobs...")
    job_store.delete("test_job_1")
    job_store.delete("test_job_2")
    
    remaining_jobs = job_store.list_jobs()
    print(f"   Remaining jobs: {len(remaining_jobs)}")
    
    print("\n✅ Progress module test completed successfully!")
    print("=" * 50)

if __name__ == "__main__":
    test_progress_module()
