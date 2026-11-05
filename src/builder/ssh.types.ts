import type { RemoteBuildFile } from "./remote-file.types";

/** What the ssh_config fragment is written from. */
export type SshHost = {
  /** The parsed remote.yaml. */
  file: RemoteBuildFile;
  /** ProxyCommand that finds the build Mac. Set when remote.yaml names a connection instead of hostName. */
  proxyCommand?: string;
};

/** An SSH config after ensuring it includes one path. */
export type SshIncludeUpdate = {
  /** The config text to write. */
  text: string;
  /** True when `text` gained an Include line that `existing` did not have. */
  added: boolean;
};

/** What setup:remote-build changed in the SSH config. */
export type SshInstall = {
  /** True when this run added the Include line. */
  addedInclude: boolean;
  /** Absolute path of the fragment ~/.ssh/config includes. */
  fragmentPath: string;
  /** Absolute path of the user SSH config that was updated. */
  userSshConfigPath: string;
};
