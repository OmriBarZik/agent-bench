import type { DiagnosticsFinding } from "../../db/db.types";
import type { DiagnosticsAttachment } from "./find-files.types";

/**
 * Counts the language-server diagnostics Claude Code attached to the session after the agent's edits. They are not
 * tool calls, so `setup_tool_calls` misses them, yet they are what an LSP config adds. `deliveries` is how many
 * times diagnostics arrived and `errors` how many error-severity entries they held.
 */
export function countDiagnostics(lines: string[]): DiagnosticsFinding {
  const found: DiagnosticsFinding = { diagnosticsDeliveries: 0, diagnosticsErrors: 0 };

  for (const line of lines) {
    const attachment = attachmentOf(line);

    if (attachment?.type !== "diagnostics") {
      continue;
    }

    found.diagnosticsDeliveries += 1;
    const entries = (attachment.files ?? []).flatMap((file) => file.diagnostics ?? []);
    found.diagnosticsErrors += entries.filter((entry) => entry.severity === "Error").length;
  }

  return found;
}

function attachmentOf(line: string): DiagnosticsAttachment | null {
  if (!line.includes('"diagnostics"')) {
    return null;
  }

  try {
    return (JSON.parse(line) as { attachment?: DiagnosticsAttachment }).attachment ?? null;
  } catch {
    // A torn line of a transcript still being written carries nothing to count.
    return null;
  }
}
