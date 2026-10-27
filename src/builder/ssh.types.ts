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
