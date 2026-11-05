import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishCopiedTree } from "./publish-app";

test("a finished copy replaces the previous tree, and a failed copy leaves it", async () => {
  const root = mkdtempSync(join(tmpdir(), "publish-app-"));
  const destination = join(root, "Chromium.app");

  try {
    mkdirSync(destination);
    writeFileSync(join(destination, "old.txt"), "old\n");
    await publishCopiedTree({
      destination,
      copy: async (staging) => {
        writeFileSync(join(staging, "new.txt"), "new\n");
      },
    });

    expect(await Bun.file(join(destination, "new.txt")).text()).toBe("new\n");
    expect(existsSync(join(destination, "old.txt"))).toBe(false);
    writeFileSync(join(destination, "keep.txt"), "keep\n");
    await expect(
      publishCopiedTree({
        destination,
        copy: async () => {
          throw new Error("rsync failed");
        },
      }),
    ).rejects.toThrow("rsync failed");
    expect(await Bun.file(join(destination, "keep.txt")).text()).toBe("keep\n");
    expect(existsSync(`${destination}.incoming`)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
