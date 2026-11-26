import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BENCH_DIR, CHROMIUM_SRC } from "../../paths";
import { indexStampProblem } from "../index-stamp/pristine-index";
import { differentKeys } from "./same-keys";
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
  const detail = checkProblem({ spec, target });

  return {
    label: spec.label,
    ok: detail === undefined,
    target,
    fix: spec.fix,
    detail: detail === "" ? undefined : detail,
  };
}

/** Undefined when the check passes, "" when it fails for the plain reason (missing), otherwise why it fails. */
function checkProblem({ spec, target }: { spec: SetupCheckSpec; target: string }): string | undefined {
  if (spec.kind === "index-stamp") {
    return indexStampProblem(target);
  }

  if (!targetExists({ kind: spec.kind, target, nonEmpty: spec.nonEmpty })) {
    return "";
  }

  if (spec.sameAs) {
    return sameAsProblem({ target, sameAs: spec.sameAs });
  }

  return undefined;
}

function sameAsProblem({ target, sameAs }: { target: string; sameAs: string }): string | undefined {
  const expectedPath = join(BENCH_DIR, sameAs);

  if (!existsSync(expectedPath)) {
    return `${sameAs} is missing`;
  }

  const difference = differentKeys({
    expected: readFileSync(expectedPath, "utf8"),
    target: readFileSync(target, "utf8"),
  });

  return difference ? `${difference} from ${sameAs}` : undefined;
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
