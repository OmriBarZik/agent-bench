/** The other Mac that builds Chrome, and where the finished app is copied back. */
export type BuilderConfig = {
  /** SSH host alias from configs/builder/remote.yaml. */
  host: string;
  /** Chromium checkout on that host. */
  source: string;
  /** Local directory that receives one folder per run. */
  buildDirectory: string;
  /** Absolute path of depot_tools on the build Mac. */
  depotTools: string;
};
