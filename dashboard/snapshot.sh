#!/bin/sh
# Copies data/bench.sqlite to dashboard/snapshot/bench.sqlite every few seconds, atomically, for Grafana to read.
# Grafana runs in Docker, which can't share SQLite's WAL index with the host reliably ("database is locked").
cd "$(dirname "$0")/.." || exit 1
mkdir -p dashboard/snapshot
while true; do
  rm -f dashboard/snapshot/bench.tmp
  if sqlite3 -readonly data/bench.sqlite ".backup dashboard/snapshot/bench.tmp" 2>/dev/null; then
    mv dashboard/snapshot/bench.tmp dashboard/snapshot/bench.sqlite
  fi
  sleep "${SNAPSHOT_SECONDS:-5}"
done
