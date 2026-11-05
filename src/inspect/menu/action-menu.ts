import type { RunChoice } from "../list/select-state.types";
import type { ActionMenu, MenuItem, MenuKeyResult, MenuPage } from "./action-menu.types";
import { menuItems } from "./menu-items";

/** Opens the Enter menu on its first page for this run. */
export function openActionMenu(runId: string): ActionMenu {
  return { runId, pages: [{ screen: "actions", selected: 0 }] };
}

/** The page that is showing. */
export function currentPage(menu: ActionMenu): MenuPage {
  return menu.pages[menu.pages.length - 1] ?? { screen: "actions", selected: 0 };
}

/** Goes back one page, or returns null when the first page closes. */
export function backMenu(menu: ActionMenu): ActionMenu | null {
  if (menu.pages.length <= 1) {
    return null;
  }

  return { runId: menu.runId, pages: menu.pages.slice(0, -1) };
}

/**
 * Arrow keys move the highlight. Enter or → chooses it, and 1–9 choose that row.
 * ← goes back a page and closes the menu from the first page. A row the run can't use stays put.
 * Esc is handled by the caller, which calls backMenu, because a lone escape needs a timer.
 */
export function applyMenuKey({
  menu,
  key,
  choice,
}: {
  menu: ActionMenu;
  key: string;
  choice: RunChoice;
}): MenuKeyResult {
  const page = currentPage(menu);
  const items = menuItems({ screen: page.screen, choice });

  if (isUp(key) || isDown(key)) {
    const delta = isUp(key) ? -1 : 1;
    const selected = Math.min(items.length - 1, Math.max(0, page.selected + delta));

    return { kind: "stay", menu: withSelected({ menu, selected }) };
  }

  if (isLeft(key)) {
    const previous = backMenu(menu);

    return previous ? { kind: "stay", menu: previous } : { kind: "close" };
  }

  const index = chosenIndex({ key, selected: page.selected });
  const item = index == null ? undefined : items[index];

  if (index == null || !item) {
    return { kind: "stay", menu };
  }

  return choose({ menu: withSelected({ menu, selected: index }), item });
}

function choose({ menu, item }: { menu: ActionMenu; item: MenuItem }): MenuKeyResult {
  if (item.unavailable) {
    return { kind: "stay", menu };
  }

  if (item.target.kind === "command") {
    return { kind: "run", command: item.target.command };
  }

  if (item.target.kind === "back") {
    const previous = backMenu(menu);

    return previous ? { kind: "stay", menu: previous } : { kind: "close" };
  }

  return {
    kind: "stay",
    menu: { runId: menu.runId, pages: [...menu.pages, { screen: item.target.screen, selected: 0 }] },
  };
}

function chosenIndex({ key, selected }: { key: string; selected: number }): number | null {
  if (key === "\r" || key === "\n" || isRight(key)) {
    return selected;
  }

  if (key.length === 1 && key >= "1" && key <= "9") {
    return Number(key) - 1;
  }

  return null;
}

function withSelected({ menu, selected }: { menu: ActionMenu; selected: number }): ActionMenu {
  const pages = menu.pages.slice(0, -1);
  pages.push({ screen: currentPage(menu).screen, selected });

  return { runId: menu.runId, pages };
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

function isRight(key: string): boolean {
  return key === "\x1b[C" || key === "\x1bOC";
}

function isLeft(key: string): boolean {
  return key === "\x1b[D" || key === "\x1bOD";
}
