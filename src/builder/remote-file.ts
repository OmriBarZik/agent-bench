import type { RemoteBuildFile } from "./remote-file.types";

const HOST = /^[\w.@:-]+$/;
const ADDRESS = /^[A-Za-z0-9.:-]+$/;
const PLACEHOLDER_USER = "your-user";
const FILE = "configs/builder/remote.yaml";

/** Parses configs/builder/remote.yaml. Throws when a required field is missing or unsafe to write into SSH config. */
export function parseRemoteBuildFile(raw: string): RemoteBuildFile {
  let parsed: unknown;

  try {
    parsed = Bun.YAML.parse(raw);
  } catch {
    throw new Error(`${FILE} is not valid YAML`);
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${FILE} must be an object`);
  }

  const record = parsed as Record<string, unknown>;
  const host = requiredToken({ record, key: "host", pattern: HOST });
  const hostName = requiredToken({ record, key: "hostName", pattern: ADDRESS });
  const user = requiredToken({ record, key: "user", pattern: HOST });
  const source = requiredPath({ record, key: "source" });
  const identityFile = optionalToken({ record, key: "identityFile" });
  const buildDirectory = optionalPath({ record, key: "buildDirectory" });
  const depotTools = requiredPath({ record, key: "depotTools" });

  if (user === PLACEHOLDER_USER) {
    throw new Error(`${FILE} still has the example user; put the build Mac's account there`);
  }

  if (identityFile != null && !identityFile.startsWith("/") && !identityFile.startsWith("~/")) {
    throw new Error("identityFile must be an absolute path or start with ~/");
  }

  return { host, hostName, user, source, identityFile, buildDirectory, depotTools };
}

function requiredToken({
  record,
  key,
  pattern,
}: {
  record: Record<string, unknown>;
  key: string;
  pattern: RegExp;
}): string {
  const value = stringField({ record, key });

  if (value == null || value === "") {
    throw new Error(`${FILE} needs a ${key}`);
  }

  if (!pattern.test(value)) {
    throw new Error(`${FILE} ${key} has characters that cannot go in SSH config`);
  }

  return value;
}

function optionalToken({ record, key }: { record: Record<string, unknown>; key: string }): string | undefined {
  const value = stringField({ record, key });

  if (value == null || value === "") {
    return undefined;
  }

  if (value.includes(" ") || value.includes("\n")) {
    throw new Error(`${FILE} ${key} cannot contain spaces`);
  }

  return value;
}

function requiredPath({ record, key }: { record: Record<string, unknown>; key: string }): string {
  const value = optionalPath({ record, key });

  if (value == null) {
    throw new Error(`${FILE} needs a ${key}`);
  }

  return value;
}

function optionalPath({ record, key }: { record: Record<string, unknown>; key: string }): string | undefined {
  const value = stringField({ record, key });

  if (value == null || value === "") {
    return undefined;
  }

  if (!value.startsWith("/") || value.includes(" ")) {
    throw new Error(`${FILE} ${key} must be an absolute path without spaces`);
  }

  return value;
}

function stringField({ record, key }: { record: Record<string, unknown>; key: string }): string | null {
  const value = record[key];

  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${FILE} ${key} must be a string`);
  }

  return value.trim();
}
