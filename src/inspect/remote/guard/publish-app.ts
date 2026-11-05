import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

/**
 * Copies a tree into a sibling staging directory, then swaps that directory into `destination`.
 * A copy that throws leaves the previous tree where it was.
 */
export async function publishCopiedTree({
  destination,
  copy,
}: {
  destination: string;
  copy: (staging: string) => Promise<void>;
}): Promise<void> {
  const staging = `${destination}.incoming`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  try {
    await copy(staging);
    swapIn({ staging, destination });
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });

    throw error;
  }
}

function swapIn({ staging, destination }: { staging: string; destination: string }) {
  const previous = `${destination}.previous`;
  rmSync(previous, { recursive: true, force: true });

  if (existsSync(destination)) {
    renameSync(destination, previous);
  }

  try {
    renameSync(staging, destination);
  } catch (error) {
    if (!existsSync(destination) && existsSync(previous)) {
      renameSync(previous, destination);
    }

    throw error;
  }

  rmSync(previous, { recursive: true, force: true });
}
