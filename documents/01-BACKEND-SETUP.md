# 🖥️ VPS Backend Setup Guide

## 📍 **Current Status: COMPLETED** ✅

Your VPS backend is already running and secured! Here's what's configured:

### **🌐 VPS Information:**
- **IP Address**: 95.111.244.159
- **Backend API**: http://95.111.244.159:8000
- **Ollama Service**: http://95.111.244.159:11434
- **Status**: ✅ Running & Healthy

### **🔧 Services Running:**
1. **FastAPI Backend** (Port 8000)
   - Speech-to-text transcription
   - LLM summarization
   - Authentication system
   - CORS protection

2. **Ollama LLM** (Port 11434)
   - Model: llama3.1:8b
   - AI text processing
   - Meeting summarization

## 🛡️ **Security Features:**

### **Authentication Required:**
- **Username**: Set in your `.env` file
- **Password**: Set in your `.env` file
- **No anonymous access allowed**

### **CORS Protection:**
- Only localhost domains can access
- Frontend must run locally
- No external websites can use your API

### **Firewall Ready:**
- UFW firewall script available: `py/secure_server.py`
- Run with: `sudo python3 py/secure_server.py`

## 📁 **Configuration Files:**

### **Main Environment File:**
- **Location**: `.env` (in project root)
- **Contains**: Server settings, credentials, API keys

### **Generated Files:**
- **`py/server.env`**: Backup of server configuration
- **`py/generate_env.py`**: Script to regenerate config

## 🚀 **Management Commands:**

### **Check Status:**
```bash
# View running services
docker compose ps

# Check backend health
curl http://localhost:8000/api/health

# View logs
docker compose logs -f backend
docker compose logs -f ollama
```

### **Restart Services:**
```bash
# Stop all services
docker compose down

# Start all services
docker compose up -d

# Restart specific service
docker compose restart backend
docker compose restart ollama
```

### **Update Configuration:**
```bash
# Regenerate .env file
python3 py/generate_env.py

# Restart with new config
docker compose down && docker compose up -d
```

## 🔐 **Security Setup (Optional):**

### **Install Firewall:**
```bash
sudo python3 py/secure_server.py
```

### **Change Credentials:**
1. Edit `.env` file
2. Change `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`
3. Restart services: `docker compose down && docker compose up -d`

## 📊 **Monitoring:**

### **Resource Usage:**
```bash
# Check container resources
docker stats

# View disk usage
df -h

# Check memory
free -h
```

### **Logs:**
```bash
# Real-time logs
docker compose logs -f

# Specific service logs
docker compose logs -f backend
docker compose logs -f ollama
```

## 🆘 **Troubleshooting:**

### **Common Issues:**

1. **Port Already in Use:**
   ```bash
   # Check what's using port 8000
   sudo netstat -tlnp | grep :8000
   ```

2. **Service Won't Start:**
   ```bash
   # Check logs
   docker compose logs backend
   
   # Check container status
   docker compose ps
   ```

3. **Authentication Issues:**
   - Verify credentials in `.env` file
   - Check CORS settings
   - Restart services after changes

### **Reset Everything:**
```bash
# Stop and remove everything
docker compose down -v

# Remove all images
docker system prune -a

# Start fresh
docker compose up -d --build
```

## 📋 **Next Steps:**

1. ✅ **Backend**: Running and secured
2. 🔄 **Frontend**: Set up on your local computer
3. 🔗 **Connection**: Test frontend-to-backend communication
4. 🧪 **Testing**: Upload audio and test transcription

## 📞 **Support:**

- **Backend Health**: http://95.111.244.159:8000/api/health
- **Ollama Status**: Check with `docker compose ps`
- **Logs**: Use `docker compose logs` commands

---

**🎉 Your VPS backend is ready and waiting for your frontend!**
