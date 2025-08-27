#!/bin/bash

# Frontend Line Count Checker
# Generates reports on file sizes and refactoring progress

echo "🔍 Frontend Line Count Analysis"
echo "================================"
echo ""

# Set the line limit
LINE_LIMIT=350

# Find all TypeScript/React files
echo "📊 Analyzing all .ts and .tsx files..."
echo ""

# Create temporary files for analysis
TEMP_DIR=$(mktemp -d)
ALL_FILES="$TEMP_DIR/all_files.txt"
OVER_LIMIT="$TEMP_DIR/over_limit.txt"
UNDER_LIMIT="$TEMP_DIR/under_limit.txt"

# Get all files with line counts
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | head -n -1 | sort -nr > "$ALL_FILES"

# Split into over/under limit
awk -v limit=$LINE_LIMIT '$1 > limit' "$ALL_FILES" > "$OVER_LIMIT"
awk -v limit=$LINE_LIMIT '$1 <= limit' "$ALL_FILES" > "$UNDER_LIMIT"

# Count files
TOTAL_FILES=$(wc -l < "$ALL_FILES")
OVER_COUNT=$(wc -l < "$OVER_LIMIT")
UNDER_COUNT=$(wc -l < "$UNDER_LIMIT")

# Calculate percentages
OVER_PERCENT=$(( (OVER_COUNT * 100) / TOTAL_FILES ))
UNDER_PERCENT=$(( (UNDER_COUNT * 100) / TOTAL_FILES ))

echo "📈 SUMMARY REPORT"
echo "=================="
echo "Total files analyzed: $TOTAL_FILES"
echo "Files over $LINE_LIMIT lines: $OVER_COUNT ($OVER_PERCENT%)"
echo "Files under $LINE_LIMIT lines: $UNDER_COUNT ($UNDER_PERCENT%)"
echo ""

if [ $OVER_COUNT -gt 0 ]; then
    echo "🔴 FILES EXCEEDING $LINE_LIMIT LINES:"
    echo "====================================="
    while read -r lines file; do
        excess=$((lines - LINE_LIMIT))
        echo "  📄 $file: $lines lines (+$excess over limit)"
    done < "$OVER_LIMIT"
    echo ""
    
    echo "🎯 REFACTORING PRIORITIES:"
    echo "========================="
    echo "🔥 CRITICAL (>1000 lines):"
    awk '$1 > 1000 { printf "  📄 %s: %d lines\n", $2, $1 }' "$OVER_LIMIT"
    echo ""
    echo "🟡 HIGH (700-1000 lines):"
    awk '$1 >= 700 && $1 <= 1000 { printf "  📄 %s: %d lines\n", $2, $1 }' "$OVER_LIMIT"
    echo ""
    echo "🟠 MEDIUM (350-700 lines):"
    awk '$1 > 350 && $1 < 700 { printf "  📄 %s: %d lines\n", $2, $1 }' "$OVER_LIMIT"
    echo ""
else
    echo "🎉 ALL FILES ARE WITHIN THE $LINE_LIMIT LINE LIMIT!"
    echo "✅ Refactoring goal achieved!"
    echo ""
fi

echo "📊 TOP 10 LARGEST FILES:"
echo "========================"
head -10 "$ALL_FILES" | while read -r lines file; do
    if [ $lines -gt $LINE_LIMIT ]; then
        status="❌"
        excess=$((lines - LINE_LIMIT))
        extra=" (+$excess)"
    else
        status="✅"
        extra=""
    fi
    echo "  $status $file: $lines lines$extra"
done
echo ""

echo "📂 BREAKDOWN BY DIRECTORY:"
echo "=========================="
for dir in $(find src -type d | sort); do
    if [ "$dir" != "src" ]; then
        count=$(find "$dir" -maxdepth 1 -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
        if [ $count -gt 0 ]; then
            avg_lines=$(find "$dir" -maxdepth 1 -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print int($1/'$count')}')
            over_in_dir=$(find "$dir" -maxdepth 1 -name "*.ts" -o -name "*.tsx" 2>/dev/null | xargs wc -l 2>/dev/null | awk -v limit=$LINE_LIMIT '$1 > limit' | wc -l)
            if [ $over_in_dir -gt 0 ]; then
                status="❌"
            else
                status="✅"
            fi
            echo "  $status $dir: $count files, avg $avg_lines lines, $over_in_dir over limit"
        fi
    fi
done
echo ""

echo "💡 RECOMMENDATIONS:"
echo "==================="
if [ $OVER_COUNT -gt 0 ]; then
    echo "1. 🎯 Focus on files >1000 lines first (highest impact)"
    echo "2. 🔧 Split large components into smaller, focused components"
    echo "3. 📦 Extract reusable logic into custom hooks"
    echo "4. 🗂️ Move utilities to shared lib/ directory"
    echo "5. 🏗️ Use feature-based organization for better maintainability"
    echo ""
    echo "🚀 NEXT STEPS:"
    echo "=============="
    echo "Run this script after each refactoring to track progress:"
    echo "  bash check-lines.sh"
    echo ""
    echo "Target: All files ≤ $LINE_LIMIT lines for optimal maintainability"
else
    echo "🎊 Congratulations! Your codebase is well-organized with all files"
    echo "   under the $LINE_LIMIT line limit. This promotes:"
    echo "   • Better maintainability"
    echo "   • Easier testing"
    echo "   • Improved readability"
    echo "   • Faster development"
fi

# Generate timestamped report
REPORT_FILE="line-count-report-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "Frontend Line Count Report - $(date)"
    echo "====================================="
    echo ""
    echo "Total files: $TOTAL_FILES"
    echo "Over limit: $OVER_COUNT"
    echo "Under limit: $UNDER_COUNT"
    echo ""
    echo "Files over $LINE_LIMIT lines:"
    cat "$OVER_LIMIT"
} > "$REPORT_FILE"

echo ""
echo "📋 Detailed report saved to: $REPORT_FILE"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✨ Analysis complete!"
