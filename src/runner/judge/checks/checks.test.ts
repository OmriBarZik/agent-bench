import { expect, test } from "bun:test";
import { gitBlobId } from "./copies-check";
import { isPanel, viewsInSource } from "./devtools-panel";

test("gitBlobId matches git hash-object", () => {
  // `printf 'hello\n' | git hash-object --stdin`
  expect(gitBlobId(new TextEncoder().encode("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
});

test("registered views are read from registerViewExtension calls", () => {
  const source = `
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.PANEL,
  id: 'dino',
  title: i18nLazyString(UIStrings.dino),
});
UI.ViewManager.registerViewExtension({
  location: UI.ViewManager.ViewLocationValues.DRAWER_VIEW,
  id: "dino-drawer",
});`;
  const views = viewsInSource({ source, file: "front_end/panels/dino/dino-meta.ts" });

  expect(views.map((view) => view.id)).toEqual(["dino", "dino-drawer"]);
  expect(views.map((view) => isPanel(view))).toEqual([true, false]);
});
