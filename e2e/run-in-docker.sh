#!/bin/sh
# Entry point for the compose `e2e` service.
set -e
cd /e2e
npm ci --no-audit --no-fund
node forward.mjs &
sleep 1
exec npx playwright test "$@"
