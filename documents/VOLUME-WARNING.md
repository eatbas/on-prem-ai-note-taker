# ⚠️ **CRITICAL WARNING: Docker Volumes & Model Persistence**

## 🚨 **THE PROBLEM YOU DISCOVERED**

Your Ollama models keep disappearing because the `restart-services.sh` script was using:

```bash
docker compose down --remove-orphans --volumes
```

The `--volumes` flag **DELETES ALL DOCKER VOLUMES**, including:
- ✅ Ollama models (1.9GB `qwen2.5:3b-instruct`)
- ✅ Whisper models 
- ✅ Redis data
- ✅ Any other persistent data

## 🔧 **FIXED SCRIPTS**

### ✅ **Safe Scripts (PRESERVE models):**
- `quick-restart.sh` ✅ - Already safe
- `restart-services.sh` ✅ - Fixed to preserve volumes

### ❌ **Dangerous Commands (AVOID):**
```bash
# These commands DELETE your models:
docker compose down --volumes
docker compose down -v
docker volume prune -f
docker system prune -a --volumes
```

### ✅ **Safe Commands (PRESERVE models):**
```bash
# These commands keep your models:
docker compose down
docker compose down --remove-orphans
docker compose restart
./quick-restart.sh
./restart-services.sh  # (now fixed)
```

## 🎯 **Model Persistence Check**

Your Ollama models are stored in the Docker volume:
```bash
# Check volume exists:
docker volume ls | grep ollama
# Result should show: on-prem-ai-note-taker_ollama_models

# Check models in volume:
docker exec on-prem-ai-note-taker-ollama-1 ollama list
# Should show: qwen2.5:3b-instruct
```

## 🚀 **Recommended Restart Workflow**

### **For Quick Restarts:**
```bash
./quick-restart.sh
```

### **For Full Restarts with Optimizations:**
```bash
./restart-services.sh  # (now safe - preserves models)
```

### **If You INTENTIONALLY Want to Reset Everything:**
```bash
# Only run this if you want to delete ALL data:
docker compose down --volumes
docker volume prune -f
# Then reinstall models: docker exec ... ollama pull qwen2.5:3b-instruct
```

## 📊 **Volume Management Best Practices**

### **Check What's in Your Volumes:**
```bash
# List all volumes:
docker volume ls

# Inspect volume details:
docker volume inspect on-prem-ai-note-taker_ollama_models

# Check Ollama models:
docker exec on-prem-ai-note-taker-ollama-1 ollama list
```

### **Backup Important Volumes (Optional):**
```bash
# Create backup of Ollama models:
docker run --rm -v on-prem-ai-note-taker_ollama_models:/source -v $(pwd):/backup alpine tar czf /backup/ollama-models-backup.tar.gz -C /source .

# Restore from backup:
docker run --rm -v on-prem-ai-note-taker_ollama_models:/target -v $(pwd):/backup alpine tar xzf /backup/ollama-models-backup.tar.gz -C /target
```

## 🎉 **Your Setup is Now Protected**

✅ **Models will persist** through normal restarts  
✅ **Scripts are fixed** to preserve volumes  
✅ **You can safely restart** services without losing models  
✅ **Performance optimizations** remain intact  

## 💡 **Remember**

- ✅ Use `./quick-restart.sh` for fast restarts
- ✅ Use `./restart-services.sh` for full restarts with optimizations  
- ❌ Never use `--volumes` flag unless you want to delete everything
- 🔍 Always check `ollama list` after restarts to verify models exist

**Your models are now safe!** 🛡️✨
