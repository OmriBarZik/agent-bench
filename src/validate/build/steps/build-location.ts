import type { BuildLocation } from "./steps.types";

const LOCATIONS: BuildLocation[] = ["remote", "local"];

/** Reads `BENCH_BUILD_LOCATION` from the environment. Missing or empty means the build Mac. */
export function readBuildLocation(env: NodeJS.ProcessEnv = process.env): BuildLocation {
  const raw = env.BENCH_BUILD_LOCATION?.trim();

  if (raw == null || raw === "") {
    return "remote";
  }

  return parseBuildLocation({ value: raw, source: "BENCH_BUILD_LOCATION" });
}

/** Checks a build location from a flag or the environment. `source` names it in the error. */
export function parseBuildLocation({ value, source }: { value: string; source: string }): BuildLocation {
  if (!LOCATIONS.includes(value as BuildLocation)) {
    throw new Error(`${source} must be one of ${LOCATIONS.join(", ")}; got ${value}`);
  }

  return value as BuildLocation;
}
