import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RemoteBuildFile } from "./remote-file.types";
import { renderSshConfig, withSshInclude } from "./ssh";
import type { SshInstall } from "./ssh.types";

/**
 * Writes the SSH fragment and includes it from the user SSH config.
 * The fragment is replaced on every run so it matches `file`. The Include line is added once.
 */
export function installSshInclude({
  file,
  fragmentPath,
  userSshConfigPath,
}: {
  file: RemoteBuildFile;
  fragmentPath: string;
  userSshConfigPath: string;
}): SshInstall {
  if (fragmentPath.includes(" ")) {
    throw new Error(`SSH cannot Include ${fragmentPath} because the path has a space`);
  }

  writeFileSync(fragmentPath, renderSshConfig(file));
  mkdirSync(dirname(userSshConfigPath), { recursive: true, mode: 0o700 });
  const existing = readIfPresent(userSshConfigPath);
  const included = withSshInclude({ existing, includePath: fragmentPath });
  writeFileSync(userSshConfigPath, included.text, { mode: 0o600 });

  return { addedInclude: included.added, fragmentPath, userSshConfigPath };
}

function readIfPresent(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissing(error)) {
      return "";
    }

    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error != null && "code" in error && error.code === "ENOENT";
}
