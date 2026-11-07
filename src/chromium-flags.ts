const DISABLE_FEATURES = "--disable-features=";

/**
 * Switches every Chromium this repo starts gets, headless or opened for a person: a mock keychain so macOS never
 * asks for the "Chromium Safe Storage" password, no Cast device scan (it asks for local network access), and no
 * first-run or default-browser dialog.
 */
export const QUIET_CHROMIUM_SWITCHES = [
  "--use-mock-keychain",
  "--no-first-run",
  "--no-default-browser-check",
  `${DISABLE_FEATURES}DialMediaRouteProvider`,
];

/** The quiet switches followed by `extra`, with every --disable-features list merged into one. */
export function withQuietSwitches(extra: string[]): string[] {
  const switches = [...QUIET_CHROMIUM_SWITCHES, ...extra];
  const disabled = switches
    .filter((value) => value.startsWith(DISABLE_FEATURES))
    .flatMap((value) => value.slice(DISABLE_FEATURES.length).split(","))
    .filter((feature) => feature !== "");
  const others = switches.filter((value) => !value.startsWith(DISABLE_FEATURES));

  // Chromium keeps only the last --disable-features it is given, so a second list would drop the first.
  return [...others, `${DISABLE_FEATURES}${[...new Set(disabled)].join(",")}`];
}
