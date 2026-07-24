#!/bin/bash

echo "Starting OWASP ZAP security scan..."

# Ensure app is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "Error: Application not running on port 3000"
    exit 1
fi

# Run ZAP baseline scan
docker run --rm -v $(pwd)/security:/zap/wrk:rw \
    --network host \
    zaproxy/zap-stable zap-baseline.py \
    -t http://localhost:3000 \
    -r zap-report.html \
    -J zap-report.json \
    -w zap-report.md \
    -c zap-rules.conf

echo "ZAP scan complete. Check security/zap-report.html"
