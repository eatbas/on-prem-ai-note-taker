"""
Centralized environment loader that reads from the root .env file
"""
import os
from pathlib import Path
from dotenv import load_dotenv

def load_root_env():
    """Load environment variables from the root .env file"""
    # Try multiple possible locations for .env file
    current_dir = Path(__file__).parent
    
    # Possible .env file locations (in order of preference):
    possible_paths = [
        # Docker environment: .env is in /app/.env
        Path("/app/.env"),
        # Development environment: go up from backend/app/core/
        current_dir.parent.parent.parent / ".env",
        # Alternative: relative to current working directory
        Path.cwd() / ".env",
    ]
    
    for env_file in possible_paths:
        if env_file.exists():
            print(f"📋 Loading centralized config from: {env_file}")
            load_dotenv(env_file)
            return True
    
    # If no .env file found, show all attempted paths
    attempted_paths = [str(p) for p in possible_paths]
    print(f"⚠️ Root .env file not found. Tried: {', '.join(attempted_paths)}")
    print("📋 Using default environment variables")
    return False

# Load the environment variables when this module is imported
load_root_env()
