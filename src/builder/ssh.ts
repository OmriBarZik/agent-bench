import type { SshHost, SshIncludeUpdate } from "./ssh.types";

/** Options every SSH and rsync call to the build Mac uses. No password prompt, and a dead cable fails quickly. */
export const SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];

/** The rsync `-e` value. Same options as SSH_OPTIONS. */
export const RSYNC_SSH = `ssh ${SSH_OPTIONS.join(" ")}`;

/** One SSH command to the build Mac. `remoteArgs` are the program to run there. */
export function sshCommand({ host, remoteArgs }: { host: string; remoteArgs: string[] }): string[] {
  return ["ssh", ...SSH_OPTIONS, host, ...remoteArgs];
}

/**
 * The fragment ~/.ssh/config includes. One Host block, nothing else.
 * With `proxyCommand`, ssh reaches the host through it and keys known_hosts on the alias.
 */
export function renderSshConfig({ file, proxyCommand }: SshHost): string {
  const lines = [`Host ${file.host}`];

  if (proxyCommand) {
    lines.push(`  ProxyCommand ${proxyCommand}`);
  } else {
    lines.push(`  HostName ${file.hostName}`);
  }

  lines.push(`  User ${file.user}`);

  if (file.identityFile) {
    lines.push(`  IdentityFile ${file.identityFile}`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Puts `Include <path>` at the top of an SSH config when it is not already there.
 * An existing file that already includes that exact path is returned unchanged, aside from a trailing newline.
 */
export function withSshInclude({ existing, includePath }: { existing: string; includePath: string }): SshIncludeUpdate {
  const line = `Include ${includePath}`;
  const present = existing.split("\n").some((entry) => entry.trim() === line);

  if (present) {
    return { text: existing.endsWith("\n") || existing === "" ? existing : `${existing}\n`, added: false };
  }

  if (existing.trim() === "") {
    return { text: `${line}\n`, added: true };
  }

  const body = existing.endsWith("\n") ? existing : `${existing}\n`;

  return { text: `${line}\n${body}`, added: true };
}
