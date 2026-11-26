/**
 * How a setup.json check looks at the machine. `index-stamp` reads the stamp an index script wrote and fails
 * when the index was built from a dirty tree or at a commit other than the tasks' chromiumSha.
 */
export type SetupCheckKind = "command" | "file" | "directory" | "index-stamp";

/** One check declared in configs/setup/<configId>/setup.json. */
export type SetupCheckSpec = {
  /** Short name shown in the Setups tab. */
  label: string;
  kind: SetupCheckKind;
  /** A command name, or a path. ${CHROMIUM_SRC}, ${HOME}, ${CSEARCHINDEX}, and ${CBM_CACHE_DIR} expand. */
  target: string;
  /** What to run when the check fails. */
  fix?: string;
  /** A directory check fails when the directory is empty. */
  nonEmpty?: boolean;
  /**
   * A file check fails unless every top-level key of this YAML or JSON file (relative to the agent-bench root)
   * has the same value in the target. Comments, layout and keys only the target has do not count.
   */
  sameAs?: string;
};

/** Why a config's setup.json could not be used. */
export type SetupFileProblem = {
  kind: "missing-file" | "invalid";
  detail: string;
};

/** A setup.json check after its target was expanded and looked up. */
export type SetupCheckResult = {
  label: string;
  ok: boolean;
  /** The command name, or the path after variable expansion. */
  target: string;
  fix?: string;
  /** Why the check failed, when the path alone does not say. */
  detail?: string;
};
