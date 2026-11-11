import { $ } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builderConfig } from "../../../inspect/build/builder-config";
import { parseGitlinkDiff } from "../../../inspect/gitlink/gitlink-diff";
import type { BuildStamp } from "../../../validate/build/build-job.types";
import type { BenchCheck, BenchCheckInput, FinalBuild } from "./bench-checks.types";

const MAX_LISTED = 10;

/** The final tree must be exactly what the newest successful build compiled; a later edit was never built. */
export async function checkFinalBuild(input: BenchCheckInput): Promise<BenchCheck> {
  const found = await findFinalBuild(input);

  if (typeof found === "string") {
    return { name: "final build", status: found.startsWith("not-run:") ? "not-run" : "fail", detail: clean(found) };
  }

  if (found.differences.length > 0) {
    const listed = found.differences.slice(0, MAX_LISTED).join(", ");

    return {
      name: "final build",
      status: "fail",
      detail: `The final tree was changed after build ${found.buildNumber}, the newest that succeeded, and never built: ${listed}.`,
    };
  }

  return {
    name: "final build",
    status: "pass",
    detail: `Build ${found.buildNumber} succeeded on exactly the final tree.`,
  };
}

/**
 * The newest successful build copied back for this run, compared with the final tree. Returns a sentence instead
 * when there is none; a sentence that starts with `not-run:` means the bench could not look.
 */
export async function findFinalBuild(input: BenchCheckInput): Promise<FinalBuild | string> {
  const builder = builderConfig();

  if (builder == null) {
    return "not-run: the build Mac is not configured, so there is no build output to compare.";
  }

  const outputDir = join(builder.buildDirectory, input.runId);
  const stampPath = join(outputDir, "bench-build.json");

  if (!existsSync(stampPath)) {
    return "No build succeeded, so the final tree was never built.";
  }

  const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as BuildStamp;
  const finalSha = input.commitSha ?? input.task.chromiumSha;
  const differences = await treeDifferences({ repo: input.chromiumSrc, left: stamp.snapshotSha, right: finalSha });

  return { buildNumber: stamp.build, snapshotSha: stamp.snapshotSha, outputDir, differences };
}

/**
 * Paths whose content differs between two commits, descending into submodules. The runner and the build snapshot
 * make different submodule commits for the same files, so gitlinks are compared by their trees, not their shas.
 */
async function treeDifferences({
  repo,
  left,
  right,
  prefix = "",
}: {
  repo: string;
  left: string;
  right: string;
  prefix?: string;
}): Promise<string[]> {
  const files = await $`git diff --name-only --no-renames --ignore-submodules=all ${left} ${right}`.cwd(repo).text();
  const raw = await $`git -c core.abbrev=40 diff --raw -z --no-renames ${left} ${right}`.cwd(repo).text();
  const differences = files
    .split("\n")
    .filter((path) => path !== "")
    .map((path) => `${prefix}${path}`);

  for (const change of parseGitlinkDiff(raw)) {
    if (change.previousSha == null || change.sha == null) {
      differences.push(`${prefix}${change.path}`);
      continue;
    }

    differences.push(
      ...(await treeDifferences({
        repo: join(repo, change.path),
        left: change.previousSha,
        right: change.sha,
        prefix: `${prefix}${change.path}/`,
      })),
    );
  }

  return differences;
}

function clean(sentence: string): string {
  return sentence.replace(/^not-run: /, "");
}
