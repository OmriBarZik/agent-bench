import type { LineKind } from "../../inspect/render/terminal-text.types";
import type { SetupCheckResult } from "../../setup/status/status.types";

/** ready: every check passed. missing: a check failed. undeclared: no setup.json. invalid: the file does not match the shape. */
export type SetupStatus = "ready" | "missing" | "undeclared" | "invalid";

/** A config from benchmark-setup.json, the only fields the Setups tab needs. */
export type SetupConfigRef = {
  configId: string;
  description?: string;
};

/** One config on the Setups tab: its checks, and how many runs the database has for it. */
export type ConfigSetup = {
  configId: string;
  description?: string;
  status: SetupStatus;
  /** Benchmark runs stored for this config. Zero means it has not been run. */
  runs: number;
  checks: SetupCheckResult[];
  /** Why setup.json is missing or invalid. Absent when the file loaded. */
  detail?: string;
};

/** A tool every config needs, checked once above the list. */
export type SharedCheck = {
  label: string;
  ok: boolean;
  /** Shown after the label instead of `ok` or `missing`. */
  word?: string;
};

/** What the Setups tab draws. */
export type SetupReport = {
  shared: SharedCheck[];
  configs: ConfigSetup[];
};

/** The rendered Setups tab, and the list scroll the next paint should keep. */
export type SetupsFrame = {
  body: string;
  scroll: number;
};

/** One painted line in the Setups tab detail. */
export type SetupLine = {
  text: string;
  kind: LineKind;
};
