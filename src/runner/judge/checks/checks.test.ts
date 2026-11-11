import { expect, test } from "bun:test";
import type { GameWatch } from "./bench-checks.types";
import { gitBlobId } from "./copies-check";
import { autoPlayOutcome } from "./play/auto-play-check";
import { isPanel, viewsInSource } from "./play/devtools-panel";

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

const PLAYED = {
  started: true,
  jumps: 20,
  crashes: 1,
  restarts: 1,
  bestDistance: 9000,
  firstCrashDistance: 4000,
  endedCrashed: false,
};

test("auto-play passes when the game plays itself after one Space", () => {
  expect(autoPlayOutcome(PLAYED).status).toBe("pass");
  expect(autoPlayOutcome(null).reason).toContain("no dino game");
});

test("auto-play fails when the T-Rex never jumps, dies early, or stays crashed", () => {
  const reason = (played: GameWatch) => autoPlayOutcome(played).reason;

  expect(autoPlayOutcome({ ...PLAYED, jumps: 0 }).status).toBe("fail");
  expect(reason({ ...PLAYED, jumps: 0 })).toContain("never jumped");
  expect(reason({ ...PLAYED, bestDistance: 3000 })).toContain("did not get past the obstacles");
  expect(reason({ ...PLAYED, endedCrashed: true })).toContain("did not restart");
});
