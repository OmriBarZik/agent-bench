import { BUILT_MARKER, CURRENT_MARKER } from "./toolchain-script";
import type { ToolchainChange, ToolchainStatus, ToolchainSummary } from "./toolchain-status.types";

/** Compares the two sections the status script printed. A missing recorded section is never-built. */
export function parseToolchainStatus(output: string): ToolchainStatus {
  const lines = output.split("\n").map((line) => line.trim());
  const currentStart = lines.indexOf(CURRENT_MARKER);
  const builtStart = lines.indexOf(BUILT_MARKER);

  if (currentStart === -1 || builtStart < currentStart) {
    return { state: "unreachable", changes: [] };
  }

  const current = toParts(lines.slice(currentStart + 1, builtStart));
  const built = toParts(lines.slice(builtStart + 1));

  if (built.size === 0) {
    return { state: "never-built", changes: [] };
  }

  const changes: ToolchainChange[] = [];

  for (const [part, value] of current) {
    const builtValue = built.get(part) ?? "";

    if (builtValue !== value) {
      changes.push({ part, built: builtValue, current: value });
    }
  }

  return { state: changes.length > 0 ? "changed" : "same", changes };
}

/** The words the Setups tab shows after `build mac`. Only a changed toolchain is a warning. */
export function toolchainSummary(status: ToolchainStatus): ToolchainSummary {
  if (status.state === "changed") {
    const changes = status.changes.map((change) => `${change.part} ${change.built || "none"} → ${change.current}`);

    return { ok: false, word: `toolchain changed, next chrome build recompiles everything (${changes.join(", ")})` };
  }

  if (status.state === "same") {
    return { ok: true, word: "toolchain unchanged" };
  }

  if (status.state === "never-built") {
    return { ok: true, word: "no chrome build recorded" };
  }

  return { ok: true, word: status.state === "unreachable" ? "unreachable" : "not configured" };
}

function toParts(lines: string[]): Map<string, string> {
  const parts = new Map<string, string>();

  for (const line of lines) {
    const separator = line.indexOf("=");

    if (separator > 0) {
      parts.set(line.slice(0, separator), line.slice(separator + 1).trim());
    }
  }

  return parts;
}
