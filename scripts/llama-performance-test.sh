#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
VPS_IP=${1:-"95.111.244.159"}
VPS_PORT=${2:-"8000"}
OLLAMA_PORT=${3:-"11434"}

echo -e "${BLUE}🚀 Llama 3.1 8B Performance Diagnostics${NC}"
echo "=================================================="
echo -e "VPS: ${CYAN}$VPS_IP${NC}"
echo -e "Backend Port: ${CYAN}$VPS_PORT${NC}"
echo -e "Ollama Port: ${CYAN}$OLLAMA_PORT${NC}"
echo ""

# Function to test API endpoint with timeout
test_api() {
    local endpoint="$1"
    local description="$2"
    local timeout="${3:-30}"
    
    echo -e "${BLUE}🔍 Testing: $description${NC}"
    echo -e "Endpoint: ${CYAN}$endpoint${NC}"
    
    # Test with curl and measure time
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "\n%{http_code}\n%{time_total}" --max-time $timeout "$endpoint" 2>/dev/null)
    local end_time=$(date +%s.%N)
    
    # Parse response
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local curl_time=$(echo "$response" | tail -n 1)
    local response_body=$(echo "$response" | head -n -2)
    
    # Calculate actual time
    local actual_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Status: OK (HTTP $http_code)${NC}"
        echo -e "${GREEN}⏱️  Response Time: ${curl_time}s${NC}"
        echo -e "${GREEN}🕐 Total Time: ${actual_time}s${NC}"
        
        # Show response preview
        if [ -n "$response_body" ]; then
            echo -e "${CYAN}📄 Response Preview:${NC}"
            echo "$response_body" | head -c 200 | sed 's/^/  /'
            if [ ${#response_body} -gt 200 ]; then
                echo -e "${CYAN}  ... (truncated)${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Status: FAILED (HTTP $http_code)${NC}"
        echo -e "${RED}⏱️  Timeout: ${timeout}s${NC}"
        if [ -n "$response_body" ]; then
            echo -e "${RED}📄 Error Response:${NC}"
            echo "$response_body" | head -c 200 | sed 's/^/  /'
        fi
    fi
    echo ""
}

# Function to test Llama chat performance
test_llama_chat() {
    local prompt="$1"
    local description="$2"
    local max_tokens="${3:-100}"
    
    echo -e "${BLUE}🤖 Testing Llama Chat: $description${NC}"
    echo -e "Prompt: ${CYAN}$prompt${NC}"
    echo -e "Max Tokens: ${CYAN}$max_tokens${NC}"
    
    local chat_data=$(cat <<EOF
{
    "prompt": "$prompt",
    "model": "llama3.1:8b",
    "stream": false,
    "options": {
        "num_predict": $max_tokens,
        "temperature": 0.7,
        "top_p": 0.9
    }
}
EOF
)
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "\n%{http_code}\n%{time_total}" --max-time 120 \
        -H "Content-Type: application/json" \
        -H "Authorization: Basic $(echo -n 'myca:wj2YyxrJ4cqcXgCA' | base64)" \
        -d "$chat_data" \
        "http://$VPS_IP:$VPS_PORT/api/chat" 2>/dev/null)
    
    local end_time=$(date +%s.%N)
    
    # Parse response
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local curl_time=$(echo "$response" | tail -n 1)
    local response_body=$(echo "$response" | head -n -2)
    
    # Calculate actual time
    local actual_time=$(echo "$end_time - $start_time" | bc -l 2>/dev/null || echo "0")
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Chat Response: OK (HTTP $http_code)${NC}"
        echo -e "${GREEN}⏱️  Response Time: ${curl_time}s${NC}"
        echo -e "${GREEN}🕐 Total Time: ${actual_time}s${NC}"
        
        # Extract response text and token count
        local response_text=$(echo "$response_body" | jq -r '.response // .message // .content // "No response text"' 2>/dev/null)
        local token_count=$(echo "$response_body" | jq -r '.usage.total_tokens // .tokens // "Unknown"' 2>/dev/null)
        
        if [ -n "$response_text" ] && [ "$response_text" != "null" ]; then
            echo -e "${CYAN}📝 Response:${NC}"
            echo "$response_text" | sed 's/^/  /' | head -c 300
            if [ ${#response_text} -gt 300 ]; then
                echo -e "${CYAN}  ... (truncated)${NC}"
            fi
            echo ""
        fi
        
        echo -e "${CYAN}🔢 Tokens: $token_count${NC}"
        
        # Calculate performance metrics
        if [ "$token_count" != "null" ] && [ "$token_count" -gt 0 ] 2>/dev/null; then
            local tokens_per_second=$(echo "scale=2; $token_count / $actual_time" | bc -l 2>/dev/null || echo "N/A")
            echo -e "${CYAN}⚡ Performance: ${tokens_per_second} tokens/second${NC}"
        fi
        
    else
        echo -e "${RED}❌ Chat Response: FAILED (HTTP $http_code)${NC}"
        echo -e "${RED}⏱️  Timeout: 120s${NC}"
        if [ -n "$response_body" ]; then
            echo -e "${RED}📄 Error Response:${NC}"
            echo "$response_body" | head -c 200 | sed 's/^/  /'
        fi
    fi
    echo ""
}

# Function to check system resources
check_system_resources() {
    echo -e "${BLUE}💻 System Resource Check${NC}"
    echo "=================================================="
    
    # Check if we can access the VPS
    if ! curl -s --max-time 10 "http://$VPS_IP:$VPS_PORT/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Cannot access VPS backend${NC}"
        echo -e "${YELLOW}⚠️  Skipping system resource check${NC}"
        echo ""
        return
    fi
    
    # Try to get system info from health endpoint
    local health_response=$(curl -s --max-time 10 "http://$VPS_IP:$VPS_PORT/api/health" 2>/dev/null)
    if [ -n "$health_response" ]; then
        echo -e "${CYAN}📊 Backend Health Status:${NC}"
        echo "$health_response" | jq -r '.' 2>/dev/null || echo "$health_response"
        echo ""
    fi
    
    # Check Ollama status
    local ollama_response=$(curl -s --max-time 10 "http://$VPS_IP:$OLLAMA_PORT/api/tags" 2>/dev/null)
    if [ -n "$ollama_response" ]; then
        echo -e "${CYAN}🤖 Ollama Models Available:${NC}"
        echo "$ollama_response" | jq -r '.models[] | "  - \(.name) (\(.size))"' 2>/dev/null || echo "$ollama_response"
        echo ""
    fi
}

# Main diagnostic flow
echo -e "${PURPLE}🔧 Starting Performance Diagnostics...${NC}"
echo ""

# 1. Basic connectivity tests
echo -e "${BLUE}📡 Connectivity Tests${NC}"
echo "=================================================="
test_api "http://$VPS_IP:$VPS_PORT/api/health" "Backend Health Check" 30
test_api "http://$VPS_IP:$OLLAMA_PORT/api/tags" "Ollama Service Check" 30

# 2. System resource check
check_system_resources

# 3. Llama performance tests
echo -e "${BLUE}🤖 Llama Performance Tests${NC}"
echo "=================================================="

# Test 1: Simple question
test_llama_chat "What is 2+2?" "Simple Math Question" 50

# Test 2: Medium complexity
test_llama_chat "Explain the concept of machine learning in simple terms." "Medium Complexity Question" 100

# Test 3: Complex reasoning
test_llama_chat "Compare and contrast the benefits and drawbacks of using cloud computing versus on-premises infrastructure for a medium-sized business." "Complex Reasoning Question" 150

# 4. Performance analysis
echo -e "${BLUE}📊 Performance Analysis${NC}"
echo "=================================================="

echo -e "${CYAN}🎯 Expected Performance for Your Hardware (8 CPU, 24GB RAM):${NC}"
echo -e "  • Short questions (1-2 sentences): 2-8 seconds"
echo -e "  • Medium questions (3-5 sentences): 8-20 seconds"
echo -e "  • Long questions (paragraphs): 20-45 seconds"
echo -e "  • Complex reasoning tasks: 30-90 seconds"
echo -e "  • Expected throughput: 15-30 tokens/second"
echo ""

echo -e "${CYAN}🔍 Common Issues & Solutions:${NC}"
echo -e "  • Slow responses: Check CPU usage and model loading"
echo -e "  • Memory issues: Ensure 8-12GB free for Llama 3.1 8B"
echo -e "  • Network latency: Test local vs remote response times"
echo -e "  • Model optimization: Consider using quantized models"
echo ""

echo -e "${CYAN}🚀 Optimization Recommendations:${NC}"
echo -e "  • Use quantized models (Q4_K_M, Q5_K_M) for faster inference"
echo -e "  • Adjust context window size based on your use case"
echo -e "  • Monitor system resources during inference"
echo -e "  • Consider model switching for different complexity tasks"
echo ""

echo -e "${GREEN}✅ Performance diagnostics completed!${NC}"
echo -e "${YELLOW}💡 Check the results above to identify performance bottlenecks.${NC}"
