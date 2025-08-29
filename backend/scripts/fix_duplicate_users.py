#!/usr/bin/env python3
"""
Script to fix duplicate users by merging them into a single user.
This script handles cases where multiple users might have been created for the same person
due to inconsistent username detection.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.models.user import User
from app.models.meeting import Meeting
from app.models.job import Job


def get_database_session():
    """Create a database session"""
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def merge_duplicate_users(db):
    """
    Find and merge duplicate users that might have been created for the same person.
    This function will:
    1. Identify users that might be duplicates
    2. Keep the user with more activity (meetings)
    3. Transfer all meetings and jobs to the primary user
    4. Delete the duplicate user
    """
    print("🔍 Searching for potential duplicate users...")
    
    # Get all users
    users = db.query(User).all()
    
    if len(users) <= 1:
        print("✅ No duplicate users found (only 0-1 users exist)")
        return
    
    print(f"Found {len(users)} users:")
    for user in users:
        meeting_count = db.query(Meeting).filter(Meeting.user_id == user.id).count()
        job_count = db.query(Job).filter(Job.user_id == user.id).count()
        print(f"  - User: {user.username} (ID: {user.id}) - {meeting_count} meetings, {job_count} jobs")
    
    # Group users by potential username patterns
    user_groups = {}
    for user in users:
        # Extract base username from different patterns
        base_username = user.username
        
        # Remove common prefixes that might have been added
        if base_username.startswith('user_'):
            base_username = base_username[5:]
        
        # Group by base username
        if base_username not in user_groups:
            user_groups[base_username] = []
        user_groups[base_username].append(user)
    
    # Process each group
    merged_count = 0
    for base_username, user_list in user_groups.items():
        if len(user_list) > 1:
            print(f"\n📋 Found potential duplicates for base username '{base_username}':")
            
            # Sort by activity (meetings + jobs) to determine primary user
            user_activities = []
            for user in user_list:
                meeting_count = db.query(Meeting).filter(Meeting.user_id == user.id).count()
                job_count = db.query(Job).filter(Job.user_id == user.id).count()
                total_activity = meeting_count + job_count
                user_activities.append((user, total_activity, meeting_count, job_count))
                print(f"  - {user.username} (ID: {user.id}): {meeting_count} meetings, {job_count} jobs, total: {total_activity}")
            
            # Sort by total activity (descending)
            user_activities.sort(key=lambda x: x[1], reverse=True)
            
            # The user with the most activity becomes the primary user
            primary_user, primary_activity, primary_meetings, primary_jobs = user_activities[0]
            print(f"✨ Primary user: {primary_user.username} (ID: {primary_user.id})")
            
            # Merge other users into the primary user
            for user, activity, meetings, jobs in user_activities[1:]:
                print(f"🔄 Merging {user.username} into {primary_user.username}...")
                
                # Transfer meetings
                meeting_update = db.query(Meeting).filter(Meeting.user_id == user.id).update({
                    Meeting.user_id: primary_user.id
                })
                print(f"  📝 Transferred {meeting_update} meetings")
                
                # Transfer jobs
                job_update = db.query(Job).filter(Job.user_id == user.id).update({
                    Job.user_id: primary_user.id
                })
                print(f"  💼 Transferred {job_update} jobs")
                
                # Delete the duplicate user
                db.delete(user)
                print(f"  🗑️ Deleted duplicate user: {user.username}")
                merged_count += 1
            
            db.commit()
            print(f"✅ Merge completed for '{base_username}' group")
    
    if merged_count > 0:
        print(f"\n🎉 Successfully merged {merged_count} duplicate users!")
    else:
        print("\n✅ No duplicate users found to merge")


def main():
    """Main function"""
    print("🚀 Starting duplicate user cleanup script...")
    
    try:
        db = get_database_session()
        
        # Show current user count
        total_users = db.query(User).count()
        print(f"📊 Current total users: {total_users}")
        
        # Merge duplicates
        merge_duplicate_users(db)
        
        # Show final user count
        final_users = db.query(User).count()
        print(f"📊 Final total users: {final_users}")
        
        # Show final user list
        if final_users > 0:
            print("\n👥 Final user list:")
            users = db.query(User).all()
            for user in users:
                meeting_count = db.query(Meeting).filter(Meeting.user_id == user.id).count()
                job_count = db.query(Job).filter(Job.user_id == user.id).count()
                print(f"  - {user.username} (ID: {user.id}) - {meeting_count} meetings, {job_count} jobs")
        
        db.close()
        print("\n✅ Cleanup completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
