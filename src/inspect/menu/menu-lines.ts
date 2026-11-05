import type { RunChoice } from "../list/select-state.types";
import { colorLine, fit } from "../render/terminal-text";
import { currentPage } from "./action-menu";
import type { ActionMenu, MenuItem } from "./action-menu.types";
import { menuItems, menuTitle } from "./menu-items";

const FOOTER = "↑↓ move  enter choose  1-9 pick  esc back";

/**
 * The menu pane: a title, one row per item with its shortcut on the right, and a key hint.
 * When the pane is short, the rows scroll so the highlight stays visible.
 */
export function actionMenuLines({
  menu,
  choices,
  height,
  columns,
}: {
  menu: ActionMenu;
  choices: RunChoice[];
  height: number;
  columns: number;
}): string[] {
  const page = currentPage(menu);
  const items = menuItems({ screen: page.screen, choices });
  const title = colorLine({
    text: fit({ text: `  ${menuTitle({ screen: page.screen, choices })}`, width: columns }),
    kind: "title",
  });
  const footer = colorLine({ text: fit({ text: `  ${FOOTER}`, width: columns }), kind: "hint" });
  const room = Math.max(height - 2, 1);
  const first = Math.min(Math.max(page.selected - room + 1, 0), Math.max(items.length - room, 0));
  const rows = items.slice(first, first + room).map((item, offset) => {
    const index = first + offset;

    return itemLine({ item, index, selected: index === page.selected, columns });
  });

  return [title, ...rows, footer].slice(0, Math.max(height, 0));
}

function itemLine({
  item,
  index,
  selected,
  columns,
}: {
  item: MenuItem;
  index: number;
  selected: boolean;
  columns: number;
}): string {
  const marker = selected ? "›" : " ";
  const left = `  ${marker} ${index + 1}  ${item.label}`;
  const right = item.unavailable ? `(${item.unavailable})` : item.shortcut;
  const gap = Math.max(columns - left.length - right.length - 2, 2);
  const text = fit({ text: `${left}${" ".repeat(gap)}${right}`, width: columns });

  if (selected) {
    return colorLine({ text, kind: "selected" });
  }

  return colorLine({ text, kind: item.unavailable ? "dim" : "plain" });
}
