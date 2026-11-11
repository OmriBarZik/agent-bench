import { join } from "node:path";
import type { BenchCheck, BenchCheckInput, BenchCheckRun, NamedBenchCheck } from "./bench-checks.types";
import { checkFinalBuild } from "./build-check";
import { checkAssetCopies, checkGameSources } from "./copies-check";
import { checkPlayInDevtools } from "./play/play-check";
import { checkBuildWiring } from "./wiring-check";

const CHECKS: NamedBenchCheck[] = [
  { name: "asset copies", run: checkAssetCopies },
  { name: "game sources", run: checkGameSources },
  { name: "build wiring", run: checkBuildWiring },
  { name: "final build", run: checkFinalBuild },
  { name: "play in DevTools", run: checkPlayInDevtools },
];

/**
 * Deterministic checks the runner makes on the final tree before the judge reads it, for tasks that have them
 * (DevTools tasks today). Writes bench-checks.json next to the run's artifacts. Never throws: a check that errors
 * is reported as `not-run`, which proves nothing either way.
 */
export async function runBenchChecks({
  input,
  outDir,
}: {
  input: BenchCheckInput;
  outDir: string;
}): Promise<BenchCheck[]> {
  if (input.task.validate !== "devtools") {
    return [];
  }

  const results: BenchCheck[] = [];

  for (const check of CHECKS) {
    results.push(await safely({ input, name: check.name, run: check.run }));
  }

  await Bun.write(join(outDir, "bench-checks.json"), `${JSON.stringify(results, null, 2)}\n`);

  return results;
}

async function safely({
  input,
  name,
  run,
}: {
  input: BenchCheckInput;
  name: string;
  run: BenchCheckRun;
}): Promise<BenchCheck> {
  try {
    return await run(input);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);

    return { name, status: "not-run", detail: `The check could not run: ${message}` };
  }
}
