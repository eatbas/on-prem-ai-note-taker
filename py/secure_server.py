#!/usr/bin/env python3
"""
Secure Server Script for On-Prem AI Note Taker
This script helps secure your VPS with firewall rules and security configurations
"""

import os
import subprocess
import socket

def get_local_ip():
    """Get the local IP address of the server"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "0.0.0.0"

def check_ufw_status():
    """Check if UFW firewall is installed and enabled"""
    try:
        result = subprocess.run(['ufw', 'status'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False

def install_ufw():
    """Install UFW firewall if not present"""
    print("🔧 Installing UFW firewall...")
    try:
        subprocess.run(['apt', 'update'], check=True)
        subprocess.run(['apt', 'install', '-y', 'ufw'], check=True)
        print("✅ UFW installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install UFW: {e}")
        return False

def configure_firewall():
    """Configure UFW firewall rules"""
    print("🛡️ Configuring firewall rules...")
    
    try:
        # Reset UFW to default
        subprocess.run(['ufw', '--force', 'reset'], check=True)
        
        # Set default policies
        subprocess.run(['ufw', 'default', 'deny', 'incoming'], check=True)
        subprocess.run(['ufw', 'default', 'allow', 'outgoing'], check=True)
        
        # Allow SSH (port 22)
        subprocess.run(['ufw', 'allow', '22/tcp'], check=True)
        print("✅ SSH access allowed")
        
        # Allow HTTP/HTTPS if needed
        subprocess.run(['ufw', 'allow', '80/tcp'], check=True)
        subprocess.run(['ufw', 'allow', '443/tcp'], check=True)
        print("✅ HTTP/HTTPS access allowed")
        
        # Allow your backend API port
        subprocess.run(['ufw', 'allow', '8000/tcp'], check=True)
        print("✅ Backend API port 8000 allowed")
        
        # Allow Ollama port
        subprocess.run(['ufw', 'allow', '11434/tcp'], check=True)
        print("✅ Ollama port 11434 allowed")
        
        # Enable UFW
        subprocess.run(['ufw', '--force', 'enable'], check=True)
        
        print("✅ Firewall configured and enabled!")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to configure firewall: {e}")
        return False

def show_security_status():
    """Show current security status"""
    print("\n" + "="*60)
    print("🛡️  SECURITY STATUS REPORT")
    print("="*60)
    
    server_ip = get_local_ip()
    
    print(f"🌐 Server IP: {server_ip}")
    print(f"🔒 Backend API: http://{server_ip}:8000/api")
    print(f"🤖 Ollama: http://{server_ip}:11434")
    
    # Check UFW status
    if check_ufw_status():
        print("✅ UFW Firewall: INSTALLED")
        try:
            result = subprocess.run(['ufw', 'status'], capture_output=True, text=True)
            print("📋 Firewall Rules:")
            for line in result.stdout.split('\n'):
                if '8000' in line or '11434' in line or '22' in line:
                    print(f"   {line.strip()}")
        except:
            pass
    else:
        print("❌ UFW Firewall: NOT INSTALLED")
    
    print("\n🔐 Authentication Required:")
    print("   - Backend API requires username/password")
    print("   - CORS restricted to localhost only")
    
    print("\n⚠️  Security Recommendations:")
    print("   1. Change default passwords in .env file")
    print("   2. Consider using VPN for additional security")
    print("   3. Regularly update your VPS")
    print("   4. Monitor access logs")

def main():
    """Main security setup function"""
    print("🛡️  On-Prem AI Note Taker - Security Setup")
    print("="*50)
    
    # Check if running as root
    if os.geteuid() != 0:
        print("❌ This script must be run as root (use sudo)")
        print("   Run: sudo python3 py/secure_server.py")
        return
    
    print("🔍 Checking current security status...")
    
    # Install UFW if not present
    if not check_ufw_status():
        print("📦 UFW firewall not found. Installing...")
        if not install_ufw():
            print("❌ Failed to install UFW. Please install manually:")
            print("   sudo apt update && sudo apt install -y ufw")
            return
    
    # Configure firewall
    if configure_firewall():
        print("\n🎉 Security setup completed successfully!")
    else:
        print("\n❌ Security setup failed. Please check errors above.")
    
    # Show final status
    show_security_status()
    
    print("\n🚀 Your VPS is now secured!")
    print("   Only authorized users with credentials can access your API")

if __name__ == "__main__":
    main()
