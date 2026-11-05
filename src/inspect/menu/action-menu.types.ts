/** Which page of the Enter menu is showing: the actions, or one of their submenus. */
export type MenuScreen = "actions" | "build" | "remove";

/**
 * Which selections show a menu row.
 * `one` is a single run, `many` is two or more, and `any` is both.
 * A multi selection keeps only `many` and `any`, so a later multi action is another row with one of those.
 */
export type MenuScope = "one" | "many" | "any";

/** What choosing a menu item asks the run list to do for the highlighted run. */
export type MenuCommand =
  "transcript" | "judge" | "checkout" | "decide" | "build-local" | "build-remote" | "open-chromium" | "remove";

/** One row of a menu page. It either opens a submenu or runs a command. */
export type MenuItem = {
  label: string;
  /** The list shortcut that does the same thing, shown so it can be learned. */
  shortcut: string;
  /** Why the item can't be used for this selection, or null when it can. */
  unavailable: string | null;
  /** Left out when this row does not apply to the current selection. */
  scope: MenuScope;
  target: MenuTarget;
};

/** Where choosing a menu item leads: a submenu, a command, or back to the page before. */
export type MenuTarget =
  { kind: "screen"; screen: MenuScreen } | { kind: "command"; command: MenuCommand } | { kind: "back" };

/** One open menu page and its highlighted row. */
export type MenuPage = {
  screen: MenuScreen;
  selected: number;
};

/** The Enter menu for the current selection. The last page is the one showing; earlier pages are where esc goes back to. */
export type ActionMenu = {
  /** Runs this menu acts on, in check order. Two or more narrow the rows to multi actions. */
  runIds: string[];
  pages: MenuPage[];
};

/** What one keypress did inside the menu. */
export type MenuKeyResult =
  { kind: "stay"; menu: ActionMenu } | { kind: "close" } | { kind: "run"; command: MenuCommand };
