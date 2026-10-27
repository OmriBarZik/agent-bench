import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseRemoteBuildFile } from "../../builder/remote-file";
import type { RemoteBuildFile } from "../../builder/remote-file.types";
import { REMOTE_BUILD_FILE } from "../../paths";
import type { BuilderConfig } from "./builder-config.types";

/** The build Mac from configs/builder/remote.yaml, or null when that file has not been created yet. */
export function builderConfig(filePath: string = REMOTE_BUILD_FILE): BuilderConfig | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const file = parseRemoteBuildFile(readFileSync(filePath, "utf8"));

  return toBuilderConfig({ file, homeBuilds: join(homedir(), "chrome-builds") });
}

/** The fields the build uses. `homeBuilds` is the local app directory when the file omits one. */
export function toBuilderConfig({ file, homeBuilds }: { file: RemoteBuildFile; homeBuilds: string }): BuilderConfig {
  return {
    host: file.host,
    source: file.source,
    buildDirectory: file.buildDirectory ?? homeBuilds,
    depotTools: file.depotTools,
  };
}
