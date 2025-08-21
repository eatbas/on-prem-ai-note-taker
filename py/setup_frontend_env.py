#!/usr/bin/env python3
"""
Frontend Environment Setup Script
This script helps you create the .env.local file for your frontend
"""

import os
import getpass

def create_frontend_env():
    """Create the frontend .env.local file with user input"""
    
    print("🎯 Frontend Environment Setup")
    print("="*40)
    print("This will create .env.local for your frontend to connect to VPS")
    print()
    
    # Get VPS credentials from user
    print("Enter your VPS backend credentials:")
    username = input("Username: ").strip()
    password = getpass.getpass("Password: ").strip()
    
    if not username or not password:
        print("❌ Username and password are required!")
        return False
    
    # Create the .env.local content
    env_content = f"""# ===== Frontend Configuration for Local Development =====
# This file connects your local frontend to the VPS backend

# ===== VPS Backend Connection =====
# Your VPS backend API endpoint
VITE_API_BASE_URL=http://95.111.244.159:8000/api

# ===== Authentication Credentials =====
# These credentials connect to your VPS backend
VITE_BASIC_AUTH_USERNAME={username}
VITE_BASIC_AUTH_PASSWORD={password}

# ===== Frontend Settings =====
# Frontend will run on this port locally
VITE_FRONTEND_PORT=5173
VITE_FRONTEND_HOST=localhost

# ===== Development Settings =====
# Enable debug mode for development
VITE_DEBUG=true
VITE_LOG_LEVEL=info

# ===== Notes =====
# 1. This file should be on your local computer, not on the VPS
# 2. Your frontend will run at http://localhost:5173
# 3. Your backend is at http://95.111.244.159:8000
# 4. Keep this file secure - it contains your credentials
"""
    
    # Create frontend directory if it doesn't exist
    frontend_dir = "frontend"
    if not os.path.exists(frontend_dir):
        os.makedirs(frontend_dir)
    
    # Save to frontend/.env.local
    env_file_path = os.path.join(frontend_dir, ".env.local")
    with open(env_file_path, "w") as f:
        f.write(env_content)
    
    print(f"\n✅ Frontend .env.local created successfully!")
    print(f"📁 Location: {os.path.abspath(env_file_path)}")
    
    # Also save a copy in py folder for reference
    py_env_path = "py/frontend.env.local"
    with open(py_env_path, "w") as f:
        f.write(env_content)
    
    print(f"📁 Backup saved to: {os.path.abspath(py_env_path)}")
    
    print("\n🚀 Next Steps:")
    print("1. Copy the .env.local file to your local computer")
    print("2. Place it in your frontend folder")
    print("3. Run: npm install && npm run dev")
    print("4. Your frontend will connect to the VPS backend!")
    
    return True

def main():
    """Main function"""
    try:
        create_frontend_env()
    except KeyboardInterrupt:
        print("\n\n❌ Setup cancelled by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main()
