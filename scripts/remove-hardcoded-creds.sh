#!/bin/bash

# Security Audit Script - Remove Hardcoded Credentials
# This script helps find and verify removal of hardcoded credentials

set -e

PROJECT_ROOT="$(dirname "$0")/.."
cd "$PROJECT_ROOT"

echo "🔒 Security Audit: Checking for hardcoded credentials..."
echo "=================================================="

# Function to check for hardcoded credentials
check_credentials() {
    local pattern="$1"
    local description="$2"
    
    echo "🔍 Searching for: $description"
    
    # Search for the pattern
    local matches=$(grep -r -i "$pattern" . \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=venv \
        --exclude-dir=dist \
        --exclude="*.log" \
        --exclude="*.md" \
        2>/dev/null || true)
    
    if [ -n "$matches" ]; then
        echo "❌ Found hardcoded credentials:"
        echo "$matches"
        echo ""
        return 1
    else
        echo "✅ No hardcoded $description found"
        echo ""
        return 0
    fi
}

# Function to verify environment variables are set
check_env_vars() {
    echo "🔧 Checking if environment variables are properly configured..."
    
    if [ -f ".env" ]; then
        echo "✅ .env file exists"
        
        if grep -q "BASIC_AUTH_USERNAME=" .env; then
            echo "✅ BASIC_AUTH_USERNAME is configured in .env"
        else
            echo "⚠️ BASIC_AUTH_USERNAME not found in .env"
        fi
        
        if grep -q "BASIC_AUTH_PASSWORD=" .env; then
            echo "✅ BASIC_AUTH_PASSWORD is configured in .env"
        else
            echo "⚠️ BASIC_AUTH_PASSWORD not found in .env"
        fi
    else
        echo "❌ .env file not found! Please create it from env.example"
        return 1
    fi
    echo ""
}

# Function to show security recommendations
show_recommendations() {
    echo "🛡️ Security Recommendations:"
    echo "=============================="
    echo "✅ Use strong, unique passwords"
    echo "✅ Never commit .env files to git"
    echo "✅ Rotate credentials regularly"
    echo "✅ Use different credentials for different environments"
    echo "✅ Consider using secrets management tools for production"
    echo ""
}

# Main security audit
main() {
    local has_issues=false
    
    # Check for hardcoded username
    if ! check_credentials "myca" "username 'myca'"; then
        has_issues=true
    fi
    
    # Check for hardcoded password (but be careful not to expose it)
    if ! check_credentials "wj2YyxrJ4cqcXgCA" "password"; then
        has_issues=true
    fi
    
    # Check environment configuration
    if ! check_env_vars; then
        has_issues=true
    fi
    
    # Show recommendations
    show_recommendations
    
    if [ "$has_issues" = true ]; then
        echo "❌ Security issues found! Please fix the hardcoded credentials above."
        echo ""
        echo "🔧 Quick fix command:"
        echo "   Edit the files shown above and replace hardcoded values with:"
        echo "   - process.env.BASIC_AUTH_USERNAME"
        echo "   - process.env.BASIC_AUTH_PASSWORD"
        echo ""
        return 1
    else
        echo "🎉 Security audit passed! No hardcoded credentials found."
        echo ""
        return 0
    fi
}

# Handle command line arguments
case "${1:-audit}" in
    "audit")
        main
        ;;
    "check-env")
        check_env_vars
        ;;
    "recommendations")
        show_recommendations
        ;;
    *)
        echo "Usage: $0 [audit|check-env|recommendations]"
        echo "  audit          - Full security audit (default)"
        echo "  check-env      - Check environment variables only"
        echo "  recommendations - Show security recommendations"
        exit 1
        ;;
esac
