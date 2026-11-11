/** One part of the build Mac's toolchain whose value differs from the last chrome build. */
export type ToolchainChange = {
  /** `xcode`, `sdk`, or `clang`. */
  part: string;
  /** The value the last chrome build recorded. Empty when that build recorded none. */
  built: string;
  /** The value on the build Mac now. */
  current: string;
};

/**
 * How the build Mac's toolchain compares with its last finished chrome build.
 * same: nothing changed. changed: the next build recompiles everything. never-built: no chrome build has recorded one.
 * unreachable: the build Mac did not answer. unconfigured: configs/builder/remote.yaml is missing or invalid.
 */
export type ToolchainStatus = {
  state: "same" | "changed" | "never-built" | "unreachable" | "unconfigured";
  changes: ToolchainChange[];
};

/** A toolchain status as the Setups tab words it. `ok` is false only when the toolchain changed. */
export type ToolchainSummary = {
  ok: boolean;
  word: string;
};
