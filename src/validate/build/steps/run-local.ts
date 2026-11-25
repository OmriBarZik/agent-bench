import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { extendPathForCcache } from "../../../inspect/build/ccache";
import { publishCopiedTree } from "../../../inspect/remote/guard/publish-app";
import { withRemoteBuildLock } from "../../../inspect/remote/guard/remote-build-lock";
import { runCaptured } from "../captured-step";
import { errorExcerpt } from "../error-excerpt";
import { BuildStepError } from "../remote-steps";
import { writeBuildStamp } from "./build-stamp";
import type { StepRun } from "./steps.types";

/**
 * Builds the plan's target in this Mac's `out/Default`, straight from the agent's working tree, then copies
 * the light-mode output into `destination`. A full chrome plan leaves Chromium.app in `out/Default`.
 * `out/Default` keeps its own args.gn: rewriting it would force a full rebuild.
 */
export async function runLocalSteps({ job, context, plan, destination, logPath, times, progress }: StepRun) {
  const signal = job.controller.signal;
  const commandPath = extendPathForCcache(process.env.PATH ?? "");
  const autoninja = Bun.which("autoninja", { PATH: commandPath });

  if (autoninja == null) {
    throw new BuildStepError({
      step: "build",
      excerpt: "autoninja is not on PATH on this Mac. Put depot_tools on PATH before starting the benchmark.",
    });
  }

  await withRemoteBuildLock({
    directory: context.buildDirectory,
    signal,
    body: async () => {
      progress.step = "build";
      let mark = Date.now();
      const captured = await runCaptured({
        command: [autoninja, "-C", "out/Default", plan.ninjaTarget],
        cwd: context.chromiumSrc,
        env: { PATH: commandPath },
        logPath,
        signal,
      });

      if (captured.exitCode !== 0) {
        throw new BuildStepError({ step: "build", excerpt: errorExcerpt(captured.output) });
      }

      times.buildMs = Date.now() - mark;
      progress.step = "copy";
      mark = Date.now();
      await copyLocalOutput({ outDir: join(context.chromiumSrc, "out/Default"), destination, paths: plan.copyPaths });
      times.copyMs = Date.now() - mark;
      writeBuildStamp({ job, destination });
    },
  });
}

/** Copies the listed `out/Default` paths into `destination` via a staging folder. Null copies nothing. */
async function copyLocalOutput({
  outDir,
  destination,
  paths,
}: {
  outDir: string;
  destination: string;
  paths: string[] | null;
}) {
  await publishCopiedTree({
    destination,
    copy: async (staging) => {
      for (const relativePath of paths ?? []) {
        const source = join(outDir, relativePath);

        if (!existsSync(source)) {
          throw new BuildStepError({ step: "copy", excerpt: `${source} is missing after the build` });
        }

        const target = join(staging, relativePath);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(source, target, { recursive: true });
      }
    },
  });
}
