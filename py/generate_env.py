#!/usr/bin/env python3
"""
Generate .env file for On-Prem AI Note Taker Server
This script creates a .env file with all the necessary environment variables
"""

import os
import socket

def get_local_ip():
    """Get the local IP address of the server"""
    try:
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "0.0.0.0"

def generate_env_file():
    """Generate the .env file content"""
    
    # Get server IP
    server_ip = get_local_ip()
    
    env_content = f"""# ===== On-Prem AI Note Taker Server Configuration =====
# Generated automatically - customize as needed

# ===== Application =====
APP_HOST=0.0.0.0
APP_PORT=8000
# Restrict CORS to only your frontend domains
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
WHISPER_MODEL=base
WHISPER_COMPUTE_TYPE=auto
WHISPER_DOWNLOAD_ROOT=/models
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_SECONDS=120
MAX_UPLOAD_MB=200
MAX_CONCURRENCY=2
LOG_LEVEL=INFO

# ===== Backend Auth (Required for Security) =====
# Set these to secure your API - CHANGE THESE PASSWORDS!
BASIC_AUTH_USERNAME=admin
BASIC_AUTH_PASSWORD=your_very_secure_password_here

# ===== Frontend Configuration =====
# Your frontend will connect to: http://{server_ip}:8000/api
VITE_API_BASE_URL=http://{server_ip}:8000/api

# ===== VPS Information =====
VPS_HOST={server_ip}
VPS_USER=$USER
VPS_PORT=22
# VPS_SSH_KEY=~/.ssh/id_rsa

# ===== Public URL (if you have a domain) =====
# PUBLIC_BASE_URL=https://yourdomain.com

# ===== Optional: Exchange Proxy =====
# EXCHANGE_PROXY_URL=

# ===== Security Notes =====
# 1. Frontend runs on your local computer at http://localhost:5173
# 2. Backend runs on this VPS at http://{server_ip}:8000
# 3. Ollama runs on this VPS at http://{server_ip}:11434
# 4. Update VITE_API_BASE_URL in your local frontend .env.local file
# 5. IMPORTANT: Set up firewall rules to restrict access
# 6. Consider using VPN or SSH tunneling for additional security
"""
    
    return env_content

def main():
    """Main function to generate and save the .env file"""
    
    # Create py directory if it doesn't exist
    os.makedirs("py", exist_ok=True)
    
    # Generate the .env content
    env_content = generate_env_file()
    
    # Save to .env file
    env_file_path = ".env"
    with open(env_file_path, "w") as f:
        f.write(env_content)
    
    print("✅ .env file generated successfully!")
    print(f"📁 Location: {os.path.abspath(env_file_path)}")
    print("\n📋 Copy this content to your .env file:")
    print("=" * 50)
    print(env_content)
    print("=" * 50)
    
    # Also save a copy in the py folder
    py_env_path = "py/server.env"
    with open(py_env_path, "w") as f:
        f.write(env_content)
    
    print(f"\n📁 Backup saved to: {os.path.abspath(py_env_path)}")
    print("\n🚀 Your server is ready to use!")
    print(f"🌐 Frontend should connect to: http://{get_local_ip()}:8000/api")

if __name__ == "__main__":
    main()
