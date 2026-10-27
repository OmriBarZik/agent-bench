import type { GitlinkChange } from "./gitlink-diff.types";

const ZERO_SHA = /^0+$/;

/**
 * Gitlink rows in a `git diff --raw -z` buffer. File rows are skipped.
 * A rename keeps the new path. An all-zero sha is reported as null.
 */
export function parseGitlinkDiff(raw: string): GitlinkChange[] {
  const changes: GitlinkChange[] = [];
  let rest = raw;

  const takeField = (): string => {
    const fieldEnd = rest.indexOf("\0");
    const value = fieldEnd === -1 ? rest : rest.slice(0, fieldEnd);
    rest = fieldEnd === -1 ? "" : rest.slice(fieldEnd + 1);

    return value;
  };

  while (rest.startsWith(":")) {
    const headerEnd = rest.indexOf("\0");

    if (headerEnd === -1) {
      break;
    }

    const header = rest.slice(1, headerEnd).split(" ");
    rest = rest.slice(headerEnd + 1);
    const status = header[4] ?? "";
    const path = takeField();
    const renamed = status.startsWith("R") || status.startsWith("C");
    const newPath = renamed ? takeField() : path;
    const oldMode = header[0];
    const newMode = header[1];

    if (oldMode === "160000" || newMode === "160000") {
      changes.push({
        path: newPath,
        previousSha: shaOrNull(header[2] ?? ""),
        sha: shaOrNull(header[3] ?? ""),
      });
    }
  }

  return changes;
}

function shaOrNull(sha: string): string | null {
  if (sha === "" || ZERO_SHA.test(sha)) {
    return null;
  }

  return sha;
}
