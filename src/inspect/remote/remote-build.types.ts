/** One local command in a remote build. */
export type RunStep = {
  command: string[];
  signal: AbortSignal;
  /** Shown when the command exits non-zero, for example `send branch`. */
  label: string;
  /** Script fed to the command's stdin, when the command reads one. */
  stdin?: string;
  /** Working directory. Omitted keeps the inspect process's directory. */
  cwd?: string;
  /** Environment variables merged over the inspect process's environment. */
  env?: Record<string, string>;
  /** When set, append stdout and stderr here instead of inheriting the terminal. */
  logPath?: string;
};

/** What the run list shows after a remote build finishes or is cancelled. */
export type BuildResult = {
  notice: string;
};
