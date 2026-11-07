import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS_DIR } from "../../paths";
import type { MatrixLog } from "./matrix-log.types";

const MATRIX_LOG_DIR = join(RUNS_DIR, "_matrix");
const MAX_RECENT = 200;

/** Opens a new matrix log under runs/_matrix/ and keeps recent lines for the Start tab. */
export function openMatrixLog(): MatrixLog {
  mkdirSync(MATRIX_LOG_DIR, { recursive: true });
  const path = join(MATRIX_LOG_DIR, `matrix-${Date.now().toString(36)}.log`);
  writeFileSync(path, "");
  const lines: string[] = [];

  return {
    path,
    append: (line: string) => {
      const stamped = `${new Date().toISOString()}  ${line}`;
      lines.push(stamped);

      if (lines.length > MAX_RECENT) {
        lines.splice(0, lines.length - MAX_RECENT);
      }

      try {
        appendFileSync(path, `${stamped}\n`);
      } catch {
        // The in-memory panel still works when the disk write fails.
      }
    },
    recent: (limit: number) => lines.slice(-Math.max(limit, 0)),
  };
}
