import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withRemoteBuildLock } from "./remote-build-lock";

test("the next build waits until the locked work, including a copy, finishes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "remote-build-lock-"));

  try {
    let release = () => {};
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = withRemoteBuildLock({ directory, body: () => holding });
    let secondStarted = false;
    const second = withRemoteBuildLock({
      directory,
      body: async () => {
        secondStarted = true;
      },
    });
    await Bun.sleep(50);

    expect(secondStarted).toBe(false);
    release();
    await first;
    await second;
    expect(secondStarted).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a lock left by a dead process does not block the next build", async () => {
  const directory = mkdtempSync(join(tmpdir(), "remote-build-lock-"));

  try {
    writeFileSync(join(directory, ".remote-build-lock"), "2147483646\n");
    let ran = false;
    await withRemoteBuildLock({
      directory,
      body: async () => {
        ran = true;
      },
    });

    expect(ran).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
