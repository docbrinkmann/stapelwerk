#!/bin/bash

echo "Checking security headers..."

URL="http://localhost:3000"

# Check each required header
headers=(
    "X-Frame-Options"
    "Content-Security-Policy"
    "Strict-Transport-Security"
    "X-Content-Type-Options"
    "Referrer-Policy"
    "Permissions-Policy"
)

for header in "${headers[@]}"; do
    value=$(curl -sI "$URL" | grep -i "^$header:")
    if [ -n "$value" ]; then
        echo "✓ $value"
    else
        echo "✗ Missing: $header"
    fi
done

echo ""
echo "Full headers:"
curl -I "$URL" 2>&1 | grep -E "^(X-|Content-Security|Strict-Transport|Referrer|Permissions)"
