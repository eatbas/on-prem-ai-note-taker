"""
Centralized environment loader that reads from the root .env file
"""
import os
from pathlib import Path
from dotenv import load_dotenv

def load_root_env():
    """Load environment variables from the root .env file"""
    # Get the project root directory (go up from backend/app/core/)
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent.parent
    env_file = project_root / ".env"
    
    if env_file.exists():
        print(f"📋 Loading centralized config from: {env_file}")
        load_dotenv(env_file)
        return True
    else:
        print(f"⚠️ Root .env file not found at: {env_file}")
        print("📋 Using default environment variables")
        return False

# Load the environment variables when this module is imported
load_root_env()
