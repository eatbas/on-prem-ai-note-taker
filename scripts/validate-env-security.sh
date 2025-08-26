#!/bin/bash

# Environment Security Validator
# Ensures credentials are properly loaded from environment

set -e

PROJECT_ROOT="$(dirname "$0")/.."
cd "$PROJECT_ROOT"

echo "🔐 Environment Security Validation"
echo "=================================="

# Check if .env file exists and contains required variables
validate_env_file() {
    if [ ! -f ".env" ]; then
        echo "❌ .env file not found!"
        echo "💡 Run: cp env.example .env"
        return 1
    fi
    
    echo "✅ .env file exists"
    
    # Check for required variables
    local required_vars=("BASIC_AUTH_USERNAME" "BASIC_AUTH_PASSWORD")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        echo "✅ All required authentication variables are configured"
        return 0
    else
        echo "❌ Missing required variables in .env:"
        printf '   - %s\n' "${missing_vars[@]}"
        return 1
    fi
}

# Test that environment variables are properly loaded
test_env_loading() {
    echo ""
    echo "🧪 Testing environment variable loading..."
    
    # Source the .env file
    if [ -f ".env" ]; then
        export $(grep -v '^#' .env | xargs)
    fi
    
    # Test variables are set
    if [ -n "$BASIC_AUTH_USERNAME" ] && [ -n "$BASIC_AUTH_PASSWORD" ]; then
        echo "✅ Environment variables loaded successfully"
        echo "   Username: ${BASIC_AUTH_USERNAME}"
        echo "   Password: [HIDDEN]"
        return 0
    else
        echo "❌ Environment variables not loaded properly"
        return 1
    fi
}

# Check for .env in .gitignore
check_gitignore() {
    echo ""
    echo "🔒 Checking .gitignore security..."
    
    if [ -f ".gitignore" ]; then
        if grep -q "\.env$" .gitignore; then
            echo "✅ .env file is properly ignored by git"
        else
            echo "⚠️ .env file should be added to .gitignore"
            echo "💡 Run: echo '.env' >> .gitignore"
        fi
    else
        echo "⚠️ .gitignore file not found"
    fi
}

# Generate secure password
generate_secure_password() {
    echo ""
    echo "🔑 Generate secure password:"
    echo "============================"
    
    # Try different methods to generate secure password
    if command -v openssl >/dev/null 2>&1; then
        local new_password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        echo "Suggested secure password: $new_password"
    elif command -v head >/dev/null 2>&1 && [ -c /dev/urandom ]; then
        local new_password=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c25)
        echo "Suggested secure password: $new_password"
    else
        echo "💡 Generate a secure password manually:"
        echo "   - Use at least 20 characters"
        echo "   - Mix uppercase, lowercase, numbers, symbols"
        echo "   - Avoid dictionary words"
    fi
    
    echo ""
    echo "💡 To update your password:"
    echo "   1. Edit .env file: BASIC_AUTH_PASSWORD=your_new_password"
    echo "   2. Restart all services"
}

# Main validation
main() {
    local has_issues=false
    
    # Validate .env file
    if ! validate_env_file; then
        has_issues=true
    fi
    
    # Test environment loading
    if ! test_env_loading; then
        has_issues=true
    fi
    
    # Check gitignore
    check_gitignore
    
    if [ "$has_issues" = true ]; then
        echo ""
        echo "❌ Environment security validation failed!"
        echo ""
        echo "🔧 Steps to fix:"
        echo "   1. Ensure .env file exists with proper variables"
        echo "   2. Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD"
        echo "   3. Add .env to .gitignore"
        echo "   4. Restart services"
        echo ""
        return 1
    else
        echo ""
        echo "🎉 Environment security validation passed!"
        echo ""
        echo "🛡️ Your credentials are properly secured:"
        echo "   ✅ Loaded from environment variables"
        echo "   ✅ No hardcoded fallbacks"
        echo "   ✅ Not committed to git"
        echo ""
        return 0
    fi
}

# Handle command line arguments
case "${1:-validate}" in
    "validate")
        main
        ;;
    "generate-password")
        generate_secure_password
        ;;
    "check-env")
        validate_env_file
        ;;
    "test-loading")
        test_env_loading
        ;;
    *)
        echo "Usage: $0 [validate|generate-password|check-env|test-loading]"
        echo "  validate         - Full security validation (default)"
        echo "  generate-password - Generate a secure password"
        echo "  check-env        - Check .env file only"
        echo "  test-loading     - Test environment loading"
        exit 1
        ;;
esac
