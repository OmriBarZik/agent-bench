/** One command a build runs on this Mac (git push, ssh, rsync, or a local autoninja). */
export type StepCommand = {
  command: string[];
  /** Working directory. Omitted keeps the server's directory. */
  cwd?: string;
  /** Extra environment on top of this process's, such as a PATH that reaches depot_tools and ccache. */
  env?: Record<string, string>;
  /** Script fed to the command's stdin. */
  stdin?: string;
  /** Build log that receives the command line and its output. */
  logPath: string;
  signal: AbortSignal;
};

/** How one build command ended. */
export type CapturedStep = {
  exitCode: number;
  /** stdout and stderr, interleaved in the order they arrived. */
  output: string;
};
