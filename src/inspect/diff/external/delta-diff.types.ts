/** A delta run ready to start: the binary, the patch to pipe in, and the repo it runs in. */
export type DeltaRun = {
  delta: string;
  patch: string;
  repo: string;
};
