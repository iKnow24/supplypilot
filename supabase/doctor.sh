#!/bin/sh
# Checks the Docker VM clock against this machine. If it drifts (common after a Mac sleeps),
# Supabase Auth issues tokens that are already expired and every page looks "signed out".
host=$(date -u +%s)
vm=$(docker exec supabase_db_supplypilot date -u +%s) || { echo "Supabase isn't running: make db-start"; exit 1; }
drift=$(awk -v a="$host" -v b="$vm" 'BEGIN { d = a - b; if (d < 0) d = -d; print d }')
if [ "$drift" -gt 60 ]; then
  echo "Docker VM clock is off by ${drift}s, so sign-in tokens arrive already expired."
  echo "Fix: quit and reopen OrbStack, e.g.  osascript -e 'quit app \"OrbStack\"' && open -a OrbStack"
  exit 1
fi
echo "Clock OK (drift ${drift}s)"
