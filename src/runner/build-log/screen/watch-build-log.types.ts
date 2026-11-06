/** The runner's log screen. `stop` returns the terminal to the benchmark's normal output. */
export type BuildLogWatch = {
  stop: () => Promise<void>;
};
