import { existsSync, readFileSync } from "node:fs";
import type { SetupCheckKind, SetupCheckSpec, SetupFileProblem } from "./status.types";

const KINDS = new Set<SetupCheckKind>(["command", "file", "directory"]);
const CHECK_KEYS = new Set(["label", "kind", "target", "fix", "nonEmpty"]);

/** Reads setup.json. A missing file and a file that does not match the check shape come back as `problem`. */
export function readSetupFile(path: string): { checks: SetupCheckSpec[]; problem?: SetupFileProblem } {
  if (!existsSync(path)) {
    return { checks: [], problem: { kind: "missing-file", detail: path } };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { checks: [], problem: { kind: "invalid", detail: "setup.json is not JSON" } };
  }

  const validated = validateSetup(parsed);

  if (validated.detail) {
    return { checks: [], problem: { kind: "invalid", detail: validated.detail } };
  }

  return { checks: validated.checks };
}

function validateSetup(value: unknown): { checks: SetupCheckSpec[]; detail?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { checks: [], detail: "setup.json must be an object with a checks array" };
  }

  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => key !== "checks");

  if (extra.length > 0) {
    return { checks: [], detail: `setup.json has unknown key ${extra[0]}` };
  }

  if (!Array.isArray(record.checks)) {
    return { checks: [], detail: "setup.json needs a checks array" };
  }

  const checks: SetupCheckSpec[] = [];

  for (const [index, entry] of record.checks.entries()) {
    const parsed = validateCheck({ entry, index });

    if (typeof parsed === "string") {
      return { checks: [], detail: parsed };
    }

    checks.push(parsed);
  }

  return { checks };
}

function validateCheck({ entry, index }: { entry: unknown; index: number }): SetupCheckSpec | string {
  const where = `checks[${index}]`;

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return `${where} must be an object`;
  }

  const record = entry as Record<string, unknown>;
  const extra = Object.keys(record).filter((key) => !CHECK_KEYS.has(key));

  if (extra.length > 0) {
    return `${where} has unknown key ${extra[0]}`;
  }

  if (typeof record.label !== "string" || record.label === "") {
    return `${where}.label must be a non-empty string`;
  }

  if (typeof record.kind !== "string" || !KINDS.has(record.kind as SetupCheckKind)) {
    return `${where}.kind must be command, file, or directory`;
  }

  if (typeof record.target !== "string" || record.target === "") {
    return `${where}.target must be a non-empty string`;
  }

  const kind = record.kind as SetupCheckKind;

  if (kind === "command" && /[/$\s]/.test(record.target)) {
    return `${where}.target must be a command name`;
  }

  if (record.fix !== undefined && (typeof record.fix !== "string" || record.fix === "")) {
    return `${where}.fix must be a non-empty string`;
  }

  if (record.nonEmpty !== undefined && typeof record.nonEmpty !== "boolean") {
    return `${where}.nonEmpty must be a boolean`;
  }

  if (record.nonEmpty !== undefined && kind !== "directory") {
    return `${where}.nonEmpty is only for a directory check`;
  }

  return {
    label: record.label,
    kind,
    target: record.target,
    fix: typeof record.fix === "string" ? record.fix : undefined,
    nonEmpty: record.nonEmpty === true ? true : undefined,
  };
}
