#!/bin/bash

echo "Running pa11y accessibility audit..."

urls=(
    "http://localhost:3000"
    "http://localhost:3000/services"
    "http://localhost:3000/stack-builder"
)

for url in "${urls[@]}"; do
    echo ""
    echo "Auditing: $url"
    npx pa11y "$url" \
        --standard WCAG2AA \
        --reporter cli \
        --config accessibility/pa11y-config.json
done

echo ""
echo "Generating HTML report..."
npx pa11y-ci --config accessibility/pa11y-config.json --reporter html > accessibility/report.html

echo "✓ Accessibility audit complete. Check accessibility/report.html"
