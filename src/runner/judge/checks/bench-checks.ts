import { join } from "node:path";
import type { BenchCheck, BenchCheckInput, BenchCheckRun, NamedBenchCheck } from "./bench-checks.types";
import { checkFinalBuild } from "./build-check";
import { checkAssetCopies, checkGameSources } from "./copies-check";
import { checkAutoPlay } from "./play/auto-play-check";
import { checkPlayInDevtools } from "./play/play-check";
import { checkBuildWiring } from "./wiring-check";

const DEVTOOLS_CHECKS: NamedBenchCheck[] = [
  { name: "asset copies", run: checkAssetCopies },
  { name: "game sources", run: checkGameSources },
  { name: "build wiring", run: checkBuildWiring },
  { name: "final build", run: checkFinalBuild },
  { name: "play in DevTools", run: checkPlayInDevtools },
];

/** A full chrome task today is the built-in model that plays the dino game, so these check exactly that. */
const CHROME_CHECKS: NamedBenchCheck[] = [
  { name: "final build", run: checkFinalBuild },
  { name: "plays by itself", run: checkAutoPlay },
];

/**
 * Deterministic checks the runner makes on the final tree before the judge reads it, for tasks that have them:
 * tasks whose `validate` is `devtools` or `chrome`. A task with no `validate`, or `dino`, has none. Writes bench-checks.json next to the run's artifacts. Never throws: a check that errors
 * is reported as `not-run`, which proves nothing either way.
 */
export async function runBenchChecks({
  input,
  outDir,
}: {
  input: BenchCheckInput;
  outDir: string;
}): Promise<BenchCheck[]> {
  const checks = checksFor(input);

  if (checks.length === 0) {
    return [];
  }

  const results: BenchCheck[] = [];

  for (const check of checks) {
    results.push(await safely({ input, name: check.name, run: check.run }));
  }

  await Bun.write(join(outDir, "bench-checks.json"), `${JSON.stringify(results, null, 2)}\n`);

  return results;
}

function checksFor(input: BenchCheckInput): NamedBenchCheck[] {
  if (input.task.validate === "devtools") {
    return DEVTOOLS_CHECKS;
  }

  if (input.task.validate === "chrome") {
    return CHROME_CHECKS;
  }

  return [];
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
