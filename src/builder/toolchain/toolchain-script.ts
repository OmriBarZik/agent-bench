/** Where the build Mac keeps the toolchain its last finished chrome build used, relative to the checkout. */
export const TOOLCHAIN_STAMP = "out/Default/.agent-bench-toolchain";

/** Line that starts the build Mac's current toolchain in the status script output. */
export const CURRENT_MARKER = "--current";

/** Line that starts the recorded toolchain in the status script output. */
export const BUILT_MARKER = "--built";

/**
 * Shell function `toolchain_fingerprint`, run from the checkout. Prints one `part=value` line each for Xcode,
 * the macOS SDK, and Chromium's clang. Every object file depends on all three, so a change recompiles everything.
 */
const FINGERPRINT_FUNCTION = `toolchain_fingerprint() {
  printf 'xcode=%s\\n' "$(xcodebuild -version 2>/dev/null | tr '\\n' ' ' | sed 's/ *$//')"
  printf 'sdk=%s\\n' "$(xcrun --show-sdk-version 2>/dev/null || true) $(xcrun --show-sdk-build-version 2>/dev/null || true)"
  printf 'clang=%s\\n' "$(cat 'third_party/llvm-build/Release+Asserts/cr_build_revision' 2>/dev/null || true)"
}`;

/**
 * Build script lines, run from the checkout before autoninja. Sets `toolchain_now`, and says in the build log
 * when it differs from the last chrome build, because that build is the slow one.
 */
export function toolchainGuardScript(): string {
  return `${FINGERPRINT_FUNCTION}
toolchain_now=$(toolchain_fingerprint)
if [ -f ${TOOLCHAIN_STAMP} ] && [ "$toolchain_now" != "$(cat ${TOOLCHAIN_STAMP})" ]; then
  printf '%s\\n' "The build Mac's toolchain changed since the last chrome build. Every file recompiles and ccache cannot reuse its old entries, so this build takes over an hour."
  printf '%s\\n' "last chrome build:"
  sed 's/^/  /' ${TOOLCHAIN_STAMP}
  printf '%s\\n' "now:"
  printf '%s\\n' "$toolchain_now" | sed 's/^/  /'
fi
`;
}

/**
 * Build script line for after autoninja succeeds. Only a full chrome build records the toolchain:
 * a light target finishes in seconds and leaves the object files stale.
 */
export function recordToolchainScript(ninjaTarget: string): string {
  if (ninjaTarget !== "chrome") {
    return "";
  }

  return `printf '%s\\n' "$toolchain_now" > ${TOOLCHAIN_STAMP}\n`;
}

/** Shell that prints the build Mac's toolchain now and the one its last chrome build recorded. The argument is the checkout. */
export function toolchainStatusScript(): string {
  return `set -u
cd "$1" || exit 3
${FINGERPRINT_FUNCTION}
printf '%s\\n' '${CURRENT_MARKER}'
toolchain_fingerprint
printf '%s\\n' '${BUILT_MARKER}'
cat ${TOOLCHAIN_STAMP} 2>/dev/null || true
`;
}
