#!/usr/bin/env bash
set -euo pipefail

for fn in presign ml_classify anomaly; do
  echo "Building lambda/${fn}..."
  cd "lambda/${fn}"
  pip3 install -r requirements.txt -t package/ --quiet
  cp handler.py package/
  cd package
  zip -r9 "../${fn}.zip" . --quiet
  cd ../..
  echo "  -> lambda/${fn}/${fn}.zip"
done
echo "All Lambda packages built."
