import { delimiter, join, resolve } from "node:path";
import { BENCH_DIR, CHROMIUM_SRC, CLANGD_PLUGIN_DIR } from "../../paths";

/** Checkout clangd, preferred over a system clangd so diagnostics match Chromium's compiler. */
const CHECKOUT_CLANGD_BIN = join(CHROMIUM_SRC, "third_party/llvm-build/Release+Asserts/bin");

/** Directories to prepend to PATH. A clangd config gets the checkout binary ahead of any other clangd. */
export function languageServerPathEntries({ pluginDirs }: { pluginDirs?: string[] }): string[] {
  const usesClangd = (pluginDirs ?? []).some((pluginDir) => resolve(BENCH_DIR, pluginDir) === CLANGD_PLUGIN_DIR);

  if (!usesClangd) {
    return [];
  }

  return [CHECKOUT_CLANGD_BIN];
}

/** PATH for one session. The checkout clangd is prepended when this config loads that plugin. */
export function sessionPath({ pathEntries }: { pathEntries: string[] }): string | undefined {
  if (pathEntries.length === 0) {
    return undefined;
  }

  const inherited = process.env.PATH ?? "";

  if (inherited === "") {
    return pathEntries.join(delimiter);
  }

  return [...pathEntries, inherited].join(delimiter);
}
