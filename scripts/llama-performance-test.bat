@echo off
setlocal enabledelayedexpansion

echo 🚀 Llama 3.1 8B Performance Diagnostics
echo ================================================
echo VPS: 95.111.244.159
echo Backend Port: 8000
echo Ollama Port: 11434
echo.

REM Test basic connectivity
echo 📡 Testing Connectivity...
echo ================================================

echo 🔍 Testing Backend Health...
curl -s -w "HTTP: %%{http_code}, Time: %%{time_total}s" --max-time 30 "http://95.111.244.159:8000/api/health" >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ Backend Health: OK
) else (
    echo ❌ Backend Health: FAILED
)

echo.
echo 🔍 Testing Ollama Service...
curl -s -w "HTTP: %%{http_code}, Time: %%{time_total}s" --max-time 30 "http://95.111.244.159:11434/api/tags" >nul 2>&1
if !errorlevel! equ 0 (
    echo ✅ Ollama Service: OK
) else (
    echo ❌ Ollama Service: FAILED
)

echo.
echo 🤖 Testing Llama Chat Performance...
echo ================================================

REM Test 1: Simple question
echo 🔍 Test 1: Simple Math Question
echo Prompt: "What is 2+2?"
echo Max Tokens: 50
echo.

set start_time=%time%
curl -s -w "HTTP: %%{http_code}, Time: %%{time_total}s" --max-time 120 ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Basic bXljYTp3ajJZeXhqNGNxY1hnQ0E=" ^
    -d "{\"prompt\": \"What is 2+2?\", \"model\": \"llama3.1:8b\", \"stream\": false, \"options\": {\"num_predict\": 50, \"temperature\": 0.7, \"top_p\": 0.9}}" ^
    "http://95.111.244.159:8000/api/chat"
set end_time=%time%

echo.
echo ⏱️  Response Time: Measured
echo.

REM Test 2: Medium complexity
echo 🔍 Test 2: Medium Complexity Question
echo Prompt: "Explain machine learning in simple terms"
echo Max Tokens: 100
echo.

curl -s -w "HTTP: %%{http_code}, Time: %%{time_total}s" --max-time 120 ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Basic bXljYTp3ajJZeXhqNGNxY1hnQ0E=" ^
    -d "{\"prompt\": \"Explain the concept of machine learning in simple terms.\", \"model\": \"llama3.1:8b\", \"stream\": false, \"options\": {\"num_predict\": 100, \"temperature\": 0.7, \"top_p\": 0.9}}" ^
    "http://95.111.244.159:8000/api/chat"

echo.
echo ⏱️  Response Time: Measured
echo.

REM Test 3: Complex reasoning
echo 🔍 Test 3: Complex Reasoning Question
echo Prompt: "Compare cloud vs on-premises for business"
echo Max Tokens: 150
echo.

curl -s -w "HTTP: %%{http_code}, Time: %%{time_total}s" --max-time 120 ^
    -H "Content-Type: application/json" ^
    -H "Authorization: Basic bXljYTp3ajJZeXhqNGNxY1hnQ0E=" ^
    -d "{\"prompt\": \"Compare and contrast the benefits and drawbacks of using cloud computing versus on-premises infrastructure for a medium-sized business.\", \"model\": \"llama3.1:8b\", \"stream\": false, \"options\": {\"num_predict\": 150, \"temperature\": 0.7, \"top_p\": 0.9}}" ^
    "http://95.111.244.159:8000/api/chat"

echo.
echo ⏱️  Response Time: Measured
echo.

echo 📊 Performance Analysis
echo ================================================
echo 🎯 Expected Performance for Your Hardware (8 CPU, 24GB RAM):
echo   • Short questions (1-2 sentences): 2-8 seconds
echo   • Medium questions (3-5 sentences): 8-20 seconds
echo   • Long questions (paragraphs): 20-45 seconds
echo   • Complex reasoning tasks: 30-90 seconds
echo   • Expected throughput: 15-30 tokens/second
echo.

echo 🔍 Common Issues & Solutions:
echo   • Slow responses: Check CPU usage and model loading
echo   • Memory issues: Ensure 8-12GB free for Llama 3.1 8B
echo   • Network latency: Test local vs remote response times
echo   • Model optimization: Consider using quantized models
echo.

echo 🚀 Optimization Recommendations:
echo   • Use quantized models (Q4_K_M, Q5_K_M) for faster inference
echo   • Adjust context window size based on your use case
echo   • Monitor system resources during inference
echo   • Consider model switching for different complexity tasks
echo.

echo ✅ Performance diagnostics completed!
echo 💡 Check the results above to identify performance bottlenecks.
echo.

echo 🔧 Next Steps:
echo   1. Check VPS resource usage (CPU, RAM, disk)
echo   2. Verify Ollama model is properly loaded
echo   3. Consider switching to quantized model
echo   4. Monitor network latency between your location and VPS
echo.

pause
