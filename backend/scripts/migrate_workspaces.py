#!/usr/bin/env python3
"""
Migration script to add workspace support to existing database.
Run this once to upgrade your database schema.
"""

import os
import sys
import sqlite3
from pathlib import Path

# Add the parent directory to the Python path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.base import get_db_path


def migrate_database():
    """Add workspace columns to existing database"""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        print("No existing database found. Schema will be created on first run.")
        return
    
    print(f"Migrating database at: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if workspaces table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='workspaces';
        """)
        
        if not cursor.fetchone():
            print("Creating workspaces table...")
            cursor.execute("""
                CREATE TABLE workspaces (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(128) UNIQUE NOT NULL,
                    description VARCHAR(512),
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP
                );
            """)
            
            # Create index on name
            cursor.execute("CREATE INDEX ix_workspaces_name ON workspaces (name);")
            print("✓ Workspaces table created")
        else:
            print("✓ Workspaces table already exists")
        
        # Check and add workspace_id to users table
        cursor.execute("PRAGMA table_info(users);")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'workspace_id' not in columns:
            print("Adding workspace_id column to users table...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN workspace_id INTEGER 
                REFERENCES workspaces(id);
            """)
            print("✓ Users table updated")
        else:
            print("✓ Users table already has workspace_id column")
        
        # Check and add workspace columns to meetings table
        cursor.execute("PRAGMA table_info(meetings);")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'workspace_id' not in columns:
            print("Adding workspace_id column to meetings table...")
            cursor.execute("""
                ALTER TABLE meetings 
                ADD COLUMN workspace_id INTEGER 
                REFERENCES workspaces(id);
            """)
            print("✓ Meetings table updated with workspace_id")
        else:
            print("✓ Meetings table already has workspace_id column")
            
        if 'is_personal' not in columns:
            print("Adding is_personal column to meetings table...")
            cursor.execute("""
                ALTER TABLE meetings 
                ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT 1;
            """)
            print("✓ Meetings table updated with is_personal")
        else:
            print("✓ Meetings table already has is_personal column")
        
        # Update existing meetings to be personal by default
        cursor.execute("""
            UPDATE meetings 
            SET is_personal = 1 
            WHERE is_personal IS NULL;
        """)
        
        conn.commit()
        conn.close()
        
        print("\n🎉 Database migration completed successfully!")
        print("All existing meetings have been marked as personal.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)


if __name__ == "__main__":
    print("🚀 Starting workspace database migration...")
    migrate_database()
