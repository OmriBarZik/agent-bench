/** The build Mac, as written in configs/builder/remote.yaml. That file is not committed. */
export type RemoteBuildFile = {
  /** SSH host alias, as in `ssh <host>`. */
  host: string;
  /** Address SSH uses for the build Mac: its current IP, or its .local name. With `connection` too, this is the address used when that connection has no build Mac on it. */
  hostName?: string;
  /**
   * Network connection that reaches only the build Mac, such as "Thunderbolt Bridge" or bridge0.
   * SSH finds the build Mac's address on it each time it connects. Set this, `hostName`, or both.
   */
  connection?: string;
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
