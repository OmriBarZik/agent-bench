import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CHROMIUM_SRC } from "../../paths";
import type { SetupCheckResult, SetupCheckSpec } from "./status.types";

const VARIABLES: Record<string, () => string> = {
  CHROMIUM_SRC: () => CHROMIUM_SRC,
  HOME: () => homedir(),
  CSEARCHINDEX: () => process.env.CSEARCHINDEX || join(homedir(), ".csearchindex"),
  CBM_CACHE_DIR: () => process.env.CBM_CACHE_DIR || join(homedir(), ".cache", "codebase-memory-mcp"),
};

/** Replaces ${NAME} in a setup.json target. An unknown name stays as written when it is also unset in the environment. */
export function expandTarget(target: string): string {
  return target.replaceAll(/\$\{([A-Z0-9_]+)\}/g, (match, variableName: string) => {
    const known = VARIABLES[variableName];

    if (known) {
      return known();
    }

    return process.env[variableName] ?? match;
  });
}

/** Expands one setup.json check and reports whether it passes on this machine. */
export function checkSetup(spec: SetupCheckSpec): SetupCheckResult {
  const target = expandTarget(spec.target);

  return {
    label: spec.label,
    ok: targetExists({ kind: spec.kind, target, nonEmpty: spec.nonEmpty }),
    target,
    fix: spec.fix,
  };
}

function targetExists({
  kind,
  target,
  nonEmpty,
}: {
  kind: SetupCheckSpec["kind"];
  target: string;
  nonEmpty?: boolean;
}): boolean {
  if (kind === "command") {
    return Bun.which(target) !== null;
  }

  if (!existsSync(target)) {
    return false;
  }

  const info = statSync(target);

  if (kind === "file") {
    return info.isFile();
  }

  if (!info.isDirectory()) {
    return false;
  }

  if (nonEmpty) {
    return readdirSync(target).length > 0;
  }

  return true;
}
