import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH_DIR } from "../paths";
import type { PlannedRun } from "./matrix-plan.types";
import type { CellRun } from "./run-cell.types";

const RUN_ID_PATTERN = /runs\/([^/\s]+)\/agent-live\.log/;
const CLOUDFLARE_PATTERN = /403[^\n]*Attention Required|Attention Required! \| Cloudflare/;

/**
 * Runs one planned run through the normal runner (`bun src/main.ts --cli`, one task, one config, one repeat) and
 * copies its output into `logPath`. When the output shows the Cloudflare 403, it stops the runner with SIGINT, as
 * Ctrl-C would, so the open run is stored as cancelled instead of crashing every run after it.
 */
export async function runCell({
  run,
  extraArgs,
  logPath,
}: {
  run: PlannedRun;
  extraArgs: string[];
  logPath: string;
}): Promise<CellRun> {
  const command = [
    "bun",
    join(BENCH_DIR, "src/main.ts"),
    ...["--only-task", run.taskId, "--only-config", run.configId, "--repeats", "1", "--cli", ...extraArgs],
  ];
  const proc = Bun.spawn(command, { cwd: BENCH_DIR, stdout: "pipe", stderr: "pipe" });
  const cell: CellRun = { runId: null, cloudflare403: false, exitCode: null };
  const onLine = (line: string) => {
    appendFileSync(logPath, `${line}\n`);
    cell.runId ??= RUN_ID_PATTERN.exec(line)?.[1] ?? null;

    if (!cell.cloudflare403 && CLOUDFLARE_PATTERN.test(line)) {
      cell.cloudflare403 = true;
      appendFileSync(logPath, "matrix: Cloudflare 403 seen, stopping the runner\n");
      proc.kill("SIGINT");
    }
  };

  await Promise.all([readLines({ stream: proc.stdout, onLine }), readLines({ stream: proc.stderr, onLine })]);
  cell.exitCode = await proc.exited;

  return cell;
}

async function readLines({ stream, onLine }: { stream: ReadableStream<Uint8Array>; onLine: (line: string) => void }) {
  const decoder = new TextDecoder();
  let pending = "";

  for await (const chunk of stream) {
    pending += decoder.decode(chunk, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";

    for (const line of lines) {
      onLine(line);
    }
  }

  if (pending !== "") {
    onLine(pending);
  }
}
