import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WAIT_MS = 200;
const LOCK_NAME = ".remote-build-lock";

/**
 * Runs `body` while this Mac holds the lock for the build Mac's `out/Default`.
 * The next build waits until `body` finishes, so a copy back is not read while the next compile rewrites that tree.
 * A lock whose process is gone is taken over.
 */
export async function withRemoteBuildLock<Result>({
  directory,
  signal,
  body,
}: {
  /** Folder on this Mac that receives copied Chromium apps. The lock file lives here. */
  directory: string;
  signal?: AbortSignal;
  body: () => Promise<Result>;
}): Promise<Result> {
  const lockFile = join(directory, LOCK_NAME);
  await acquire({ lockFile, signal });

  try {
    return await body();
  } finally {
    rmSync(lockFile, { force: true });
  }
}

async function acquire({ lockFile, signal }: { lockFile: string; signal?: AbortSignal }) {
  mkdirSync(dirname(lockFile), { recursive: true });

  for (;;) {
    if (signal?.aborted) {
      throw new Error("build cancelled");
    }

    if (tryCreate(lockFile)) {
      return;
    }

    if (ownerIsGone(lockFile)) {
      rmSync(lockFile, { force: true });

      continue;
    }

    await Bun.sleep(WAIT_MS);
  }
}

function tryCreate(lockFile: string): boolean {
  try {
    writeFileSync(lockFile, `${process.pid}\n`, { flag: "wx" });

    return true;
  } catch (error) {
    if (isAlreadyThere(error)) {
      return false;
    }

    throw error;
  }
}

function ownerIsGone(lockFile: string): boolean {
  let pid: number;

  try {
    pid = Number(readFileSync(lockFile, "utf8"));
  } catch {
    return true;
  }

  if (!Number.isInteger(pid) || pid <= 0) {
    return true;
  }

  try {
    process.kill(pid, 0);

    return false;
  } catch {
    return true;
  }
}

function isAlreadyThere(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}
