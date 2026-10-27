/** The build Mac, as written in configs/builder/remote.yaml. That file is not committed. */
export type RemoteBuildFile = {
  /** SSH host alias, as in `ssh <host>`. */
  host: string;
  /** Address SSH uses for the build Mac: its current IP, or its .local name. */
  hostName: string;
  /** Login on the build Mac. */
  user: string;
  /** SSH key. `~` is left for ssh to expand. Omitted to use the default key. */
  identityFile?: string;
  /** Chromium checkout on the build Mac. */
  source: string;
  /** Where this machine stores the copied app. Omitted uses ~/chrome-builds. */
  buildDirectory?: string;
  /** depot_tools on the build Mac. Absolute path of the directory that contains autoninja. */
  depotTools: string;
};
