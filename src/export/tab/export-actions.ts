import { readFileSync } from "node:fs";

/** Puts a file's text on the macOS clipboard with pbcopy. Resolves false when pbcopy fails. */
export async function copyFileToClipboard(path: string): Promise<boolean> {
  const child = Bun.spawn(["pbcopy"], { stdin: new Blob([readFileSync(path)]), stdout: "ignore", stderr: "ignore" });

  return (await child.exited) === 0;
}

/** Opens a folder in Finder. */
export async function openFolder(path: string): Promise<boolean> {
  const child = Bun.spawn(["open", path], { stdout: "ignore", stderr: "ignore" });

  return (await child.exited) === 0;
}
