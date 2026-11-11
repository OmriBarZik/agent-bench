import { checkBuilderToolchain } from "../../builder/toolchain/check-toolchain";
import { toolchainSummary } from "../../builder/toolchain/toolchain-status";
import type { ToolchainStatus } from "../../builder/toolchain/toolchain-status.types";
import { builderConfig } from "../../inspect/build/builder-config";
import type { SharedCheck } from "./load-setups.types";

/**
 * The `build mac` entry on the Setups tab: whether Xcode, the SDK, or clang changed there since its last chrome build.
 * Null when configs/builder/remote.yaml does not exist, so a setup with no build Mac shows nothing. Never throws.
 */
export async function loadBuilderCheck(): Promise<SharedCheck | null> {
  let status: ToolchainStatus;

  try {
    const config = builderConfig();

    if (!config) {
      return null;
    }

    status = await checkBuilderToolchain({ host: config.host, source: config.source });
  } catch {
    // remote.yaml did not parse. setup:remote-build reports why.
    status = { state: "unconfigured", changes: [] };
  }

  return { label: "build mac", ...toolchainSummary(status) };
}
