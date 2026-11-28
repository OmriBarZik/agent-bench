#!/bin/sh
# Copies data/bench.sqlite to dashboard/snapshot/bench.sqlite every few seconds, atomically, for Grafana to read.
# Grafana runs in Docker, which can't share SQLite's WAL index with the host reliably ("database is locked").
cd "$(dirname "$0")/.." || exit 1
mkdir -p dashboard/snapshot
while true; do
  rm -f dashboard/snapshot/bench.tmp
  if sqlite3 -readonly data/bench.sqlite ".backup dashboard/snapshot/bench.tmp" 2>/dev/null; then
    # Archived pilot runs (runs.batch, see bun run runs:archive) stay in the real DB but never reach a chart.
    sqlite3 dashboard/snapshot/bench.tmp "
      DELETE FROM tool_calls WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM judge_runs WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM run_phases WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM run_findings WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM run_rounds WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM run_round_results WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM run_round_tools WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM builds WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM chromium_builds WHERE run_id IN (SELECT run_id FROM runs WHERE batch IS NOT NULL);
      DELETE FROM runs WHERE batch IS NOT NULL;" 2>/dev/null
    mv dashboard/snapshot/bench.tmp dashboard/snapshot/bench.sqlite
  fi
  sleep "${SNAPSHOT_SECONDS:-5}"
done
