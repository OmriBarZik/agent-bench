const SHIFT_TAB = "\x1b[Z";
const HINT = "tab / shift-tab switches";

/** How far a key moves along the tabs: tab is +1, shift-tab is -1, and anything else is 0. */
export function tabStep(key: string): number {
  if (key === "\t") {
    return 1;
  }

  if (key === SHIFT_TAB) {
    return -1;
  }

  return 0;
}

/** The top line: every tab label, the active one in reverse video, then the switch hint when it fits. */
export function tabBar({ labels, active, columns }: { labels: string[]; active: number; columns: number }): string {
  const plainTabs = labels.map((label) => ` ${label} `).join(" ");
  const painted = labels
    .map((label, index) => (index === active ? `\x1b[1;7m ${label} \x1b[0m` : `\x1b[2m ${label} \x1b[0m`))
    .join(" ");
  const withHint = `${plainTabs}   ${HINT}`;

  if (withHint.length <= columns) {
    return `${painted}   \x1b[2m${HINT}\x1b[0m\x1b[K`;
  }

  return `${painted}\x1b[K`;
}
