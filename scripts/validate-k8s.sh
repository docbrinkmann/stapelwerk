#!/usr/bin/env bash
set -euo pipefail

if ! command -v kubeconform >/dev/null 2>&1; then
  echo "kubeconform not installed; skipping validation." >&2
  exit 0
fi

FILE=${1:-}
if [ -z "$FILE" ]; then
  echo "Usage: $0 <manifest.yaml>" >&2
  exit 1
fi

kubeconform -strict -summary "$FILE"
