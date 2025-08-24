# VPS Llama Performance Optimization Guide

## Current Situation
- **VPS Specs**: 8 CPU cores, 24GB RAM
- **Model**: Llama 3.1 8B (full precision)
- **Issue**: Slow responses and errors
- **Expected Performance**: 15-30 tokens/second

## Performance Expectations

### **Response Times (Your Hardware)**
| Question Type | Expected Time | Token Count |
|---------------|---------------|-------------|
| Simple (1-2 sentences) | 2-8 seconds | 20-50 tokens |
| Medium (3-5 sentences) | 8-20 seconds | 50-100 tokens |
| Complex (paragraphs) | 20-45 seconds | 100-200 tokens |
| Reasoning tasks | 30-90 seconds | 150-300 tokens |

## Immediate Optimizations

### 1. **Switch to Quantized Model**
```bash
# On your VPS, pull a quantized version
ollama pull llama3.1:8b-q4_K_M
# or
ollama pull llama3.1:8b-q5_K_M
```

**Benefits:**
- **2-3x faster** inference
- **50% less memory** usage
- **Minimal quality loss**

### 2. **Update Backend Configuration**
In your VPS backend `.env` file:
```env
OLLAMA_MODEL=llama3.1:8b-q4_K_M
OLLAMA_BASE_URL=http://localhost:11434
```

### 3. **Optimize Ollama Settings**
Create `/etc/ollama/ollama.conf` on your VPS:
```yaml
# Performance optimizations
numa: true
gpu_layers: 0  # CPU-only mode for your setup
```

## Advanced Optimizations

### 1. **Model Loading Strategy**
```bash
# Pre-load model in memory
ollama run llama3.1:8b-q4_K_M "Hello" &
# Keep it running in background
```

### 2. **Resource Allocation**
```bash
# Limit CPU cores for Ollama (use 6 out of 8)
taskset -c 0-5 ollama serve

# Set memory limits
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_ORIGINS=*
```

### 3. **Backend API Optimization**
Update your FastAPI backend to use:
```python
# Optimized chat parameters
chat_params = {
    "model": "llama3.1:8b-q4_K_M",
    "stream": False,  # Disable streaming for faster responses
    "options": {
        "num_predict": 100,  # Limit response length
        "temperature": 0.7,
        "top_p": 0.9,
        "repeat_penalty": 1.1,
        "num_ctx": 2048,  # Reduce context window
    }
}
```

## Monitoring & Diagnostics

### 1. **Run Performance Test**
```bash
# On your local machine
scripts\llama-performance-test.bat

# Or on VPS (if you have access)
scripts/llama-performance-test.sh
```

### 2. **Check VPS Resources**
```bash
# CPU usage
htop

# Memory usage
free -h

# Disk I/O
iotop

# Network
nethogs
```

### 3. **Ollama Status Check**
```bash
# Check model status
curl http://localhost:11434/api/tags

# Check running processes
ps aux | grep ollama

# Check memory usage
cat /proc/$(pgrep ollama)/status | grep VmRSS
```

## Troubleshooting Common Issues

### **Issue: Model Loading Slowly**
**Solutions:**
1. Use quantized model (`q4_K_M` or `q5_K_M`)
2. Ensure sufficient RAM (8-12GB free)
3. Check disk I/O performance

### **Issue: High CPU Usage**
**Solutions:**
1. Limit CPU cores with `taskset`
2. Use CPU affinity for better cache performance
3. Monitor background processes

### **Issue: Memory Pressure**
**Solutions:**
1. Switch to quantized model
2. Reduce context window size
3. Restart Ollama service periodically

### **Issue: Network Timeouts**
**Solutions:**
1. Increase timeout values in backend
2. Check firewall rules
3. Monitor network latency

## Performance Comparison

### **Model Performance (Your Hardware)**
| Model | Speed | Memory | Quality | Recommendation |
|-------|-------|--------|---------|----------------|
| `llama3.1:8b` | 1x | 8-12GB | 100% | ❌ Too slow |
| `llama3.1:8b-q5_K_M` | 2.5x | 4-6GB | 98% | ✅ Best balance |
| `llama3.1:8b-q4_K_M` | 3x | 3-4GB | 95% | ✅ Fastest |

## Implementation Steps

### **Step 1: Quick Fix (5 minutes)**
```bash
# SSH to your VPS
ssh root@95.111.244.159

# Pull quantized model
ollama pull llama3.1:8b-q5_K_M

# Update backend config
sed -i 's/OLLAMA_MODEL=.*/OLLAMA_MODEL=llama3.1:8b-q5_K_M/' .env

# Restart backend
docker compose restart
```

### **Step 2: Performance Tuning (15 minutes)**
```bash
# Create optimized Ollama config
cat > /etc/ollama/ollama.conf << EOF
numa: true
gpu_layers: 0
EOF

# Restart Ollama
systemctl restart ollama
```

### **Step 3: Monitoring Setup (10 minutes)**
```bash
# Install monitoring tools
apt update && apt install -y htop iotop nethogs

# Set up resource monitoring
watch -n 5 'free -h && echo "---" && uptime'
```

## Expected Results After Optimization

### **Before (Current)**
- Simple questions: 10-30 seconds
- Medium questions: 30-90 seconds
- Complex questions: 60-180 seconds
- Memory usage: 8-12GB
- CPU usage: 80-100%

### **After (Optimized)**
- Simple questions: 2-8 seconds ⚡ **3-4x faster**
- Medium questions: 8-20 seconds ⚡ **3-4x faster**
- Complex questions: 20-45 seconds ⚡ **3-4x faster**
- Memory usage: 4-6GB 💾 **50% less**
- CPU usage: 40-60% 🔋 **More efficient**

## Long-term Optimizations

### 1. **Model Switching Strategy**
- Use `q4_K_M` for simple Q&A
- Use `q5_K_M` for complex reasoning
- Use full model only for critical tasks

### 2. **Load Balancing**
- Run multiple Ollama instances
- Use different models for different use cases
- Implement request queuing

### 3. **Caching Strategy**
- Cache common responses
- Implement response prediction
- Use Redis for session management

## Support & Monitoring

### **Daily Checks**
```bash
# Quick health check
curl -s http://95.111.244.159:8000/api/health | jq '.'

# Ollama status
curl -s http://95.111.244.159:11434/api/tags | jq '.models[]'
```

### **Weekly Maintenance**
```bash
# Restart services
docker compose restart
systemctl restart ollama

# Clean up old models
ollama list
ollama rm llama3.1:8b  # Remove full precision model
```

### **Monthly Optimization**
- Monitor performance metrics
- Update models to latest versions
- Review resource allocation
- Plan capacity upgrades if needed

## Summary

With your current hardware (8 CPU, 24GB RAM), you should achieve:
- **2-8 seconds** for simple questions
- **8-20 seconds** for medium questions  
- **20-45 seconds** for complex questions

**Key actions:**
1. ✅ Switch to `llama3.1:8b-q5_K_M` (immediate 2.5x speedup)
2. ✅ Optimize Ollama configuration
3. ✅ Monitor resource usage
4. ✅ Implement caching strategies

This should resolve your slow response issues and provide a much better user experience!
