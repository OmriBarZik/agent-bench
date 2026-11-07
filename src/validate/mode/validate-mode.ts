import { join } from "node:path";
import type { ValidateBuildPlan, ValidateMode } from "./validate-mode.types";

const MODES: ValidateMode[] = ["chrome", "dino", "devtools"];

/** Reads `BENCH_VALIDATE_MODE` from the environment. Missing or empty means a full chrome build. */
export function readValidateMode(env: NodeJS.ProcessEnv = process.env): ValidateMode {
  const raw = env.BENCH_VALIDATE_MODE?.trim();

  if (raw == null || raw === "") {
    return "chrome";
  }

  if (!MODES.includes(raw as ValidateMode)) {
    throw new Error(`BENCH_VALIDATE_MODE must be one of ${MODES.join(", ")}; got ${raw}`);
  }

  return raw as ValidateMode;
}

/** The ninja target and copy-back paths for this mode. */
export function validateBuildPlan(mode: ValidateMode): ValidateBuildPlan {
  if (mode === "dino") {
    return {
      mode,
      ninjaTarget: "components/neterror/resources:build_ts",
      copyPaths: [
        "gen/components/neterror/resources/tsc",
        "gen/ui/webui/resources/tsc",
        "gen/third_party/lit/v3_0/minified",
      ],
      artifactRelativePath: "gen/components/neterror/resources/tsc",
    };
  }

  if (mode === "devtools") {
    return {
      mode,
      ninjaTarget: "third_party/devtools-frontend/src:devtools_frontend_resources",
      copyPaths: ["gen/third_party/devtools-frontend/src/front_end"],
      artifactRelativePath: "gen/third_party/devtools-frontend/src/front_end",
    };
  }

  return {
    mode: "chrome",
    ninjaTarget: "chrome",
    copyPaths: null,
    artifactRelativePath: null,
  };
}

/**
 * Chromium.app that light modes launch without rebuilding. A prior full chrome build into
 * `out/Default` on this Mac has to leave that app in place.
 */
export function stockChromiumApp(chromiumSrc: string): string {
  return join(chromiumSrc, "out/Default/Chromium.app");
}
