import { existsSync } from "node:fs";
import { join } from "node:path";
import { countRunsByConfig, openDb } from "../../db/db";
import { BENCH_DIR, CHROMIUM_SRC } from "../../paths";
import { checkSetup } from "../../setup/status/check-setup";
import { readSetupFile } from "../../setup/status/read-setup";
import type { SetupCheckResult, SetupFileProblem } from "../../setup/status/status.types";
import type { ConfigSetup, SetupConfigRef, SetupReport, SetupStatus } from "./load-setups.types";

const CONFIG_ID = /^[a-z0-9-]+$/;

/**
 * Checks every config's setup.json and counts its runs.
 * A config with no setup.json is undeclared, so a new config shows up here until its checks are declared.
 */
export function loadSetups({ configs, dbPath }: { configs: SetupConfigRef[]; dbPath?: string }): SetupReport {
  const db = openDb(dbPath);

  try {
    const runsByConfig = new Map(countRunsByConfig(db).map((count) => [count.configId, count.runs]));

    return {
      shared: sharedChecks(),
      configs: configs.map((config) => configSetup({ config, runs: runsByConfig.get(config.configId) ?? 0 })),
    };
  } finally {
    db.close();
  }
}

function sharedChecks(): SetupReport["shared"] {
  return [
    { label: "bun", ok: Bun.which("bun") !== null },
    { label: "claude", ok: Bun.which("claude") !== null },
    { label: "checkout", ok: existsSync(CHROMIUM_SRC) },
  ];
}

function configSetup({ config, runs }: { config: SetupConfigRef; runs: number }): ConfigSetup {
  const relativePath = join("configs/setup", config.configId, "setup.json");

  if (!CONFIG_ID.test(config.configId)) {
    return row({
      config,
      runs,
      status: "invalid",
      checks: [],
      detail: `${config.configId} is not a safe config id`,
    });
  }

  const loaded = readSetupFile(join(BENCH_DIR, relativePath));
  const checks = loaded.checks.map((spec) => checkSetup(spec));

  return row({
    config,
    runs,
    status: statusOf({ problem: loaded.problem, checks }),
    checks,
    detail: loaded.problem?.kind === "missing-file" ? relativePath : loaded.problem?.detail,
  });
}

function statusOf({ problem, checks }: { problem?: SetupFileProblem; checks: SetupCheckResult[] }): SetupStatus {
  if (problem?.kind === "missing-file") {
    return "undeclared";
  }

  if (problem) {
    return "invalid";
  }

  if (checks.some((check) => !check.ok)) {
    return "missing";
  }

  return "ready";
}

function row({
  config,
  runs,
  status,
  checks,
  detail,
}: {
  config: SetupConfigRef;
  runs: number;
  status: SetupStatus;
  checks: SetupCheckResult[];
  detail?: string;
}): ConfigSetup {
  return {
    configId: config.configId,
    description: config.description,
    status,
    runs,
    checks,
    detail,
  };
}
