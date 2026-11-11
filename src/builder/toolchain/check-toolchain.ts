import { sshCommand } from "../ssh";
import { toolchainStatusScript } from "./toolchain-script";
import { parseToolchainStatus } from "./toolchain-status";
import type { ToolchainStatus } from "./toolchain-status.types";

/** A build Mac that is off should not hold the Setups tab for long. */
const CHECK_TIMEOUT_MS = 15_000;

/**
 * Asks the build Mac for its toolchain now and the one its last chrome build recorded.
 * Never throws: a host that does not answer, or answers with something else, is `unreachable`.
 */
export async function checkBuilderToolchain({
  host,
  source,
}: {
  host: string;
  source: string;
}): Promise<ToolchainStatus> {
  try {
    const subprocess = Bun.spawn(sshCommand({ host, remoteArgs: ["bash", "-s", "--", source] }), {
      stdin: new Blob([toolchainStatusScript()]),
      stdout: "pipe",
      stderr: "ignore",
      timeout: CHECK_TIMEOUT_MS,
    });
    const [output, exitCode] = await Promise.all([new Response(subprocess.stdout).text(), subprocess.exited]);

    if (exitCode !== 0) {
      return { state: "unreachable", changes: [] };
    }

    return parseToolchainStatus(output);
  } catch {
    // ssh could not start. The Setups tab reports that the same way as a host that is off.
    return { state: "unreachable", changes: [] };
  }
}
