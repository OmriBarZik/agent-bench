/** What one runner invocation of the matrix produced. */
export type CellRun = {
  /** The run id the runner printed, or null when it stopped before starting a run. */
  runId: string | null;
  /** True when the output showed the Cloudflare 403 and the matrix stopped the runner. */
  cloudflare403: boolean;
  exitCode: number | null;
};
