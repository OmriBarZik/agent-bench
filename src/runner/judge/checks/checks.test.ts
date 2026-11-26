import { expect, test } from "bun:test";
import type { GameWatch } from "./bench-checks.types";
import { gitBlobId } from "./copies-check";
import { forkFindings } from "./fork-check";
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

test("auto-play fails when the game does not restart after the bench ends it", () => {
  const clean = { ...PLAYED, crashes: 0, restarts: 0 };

  expect(autoPlayOutcome({ ...clean, forcedCrash: { restarted: false } }).status).toBe("fail");
  expect(autoPlayOutcome({ ...clean, forcedCrash: { restarted: true } }).reason).toContain("restarted by itself");
});

const SOURCES = ["trex.ts", "horizon.ts", "obstacle.ts", "constants.ts"].map((name) => ({
  path: `components/neterror/resources/dino_game/${name}`,
  blobId: `blob-${name}`,
  text: "",
}));

test("a byte-identical copy of a game source is a fork", () => {
  const files = [{ path: "front_end/panels/dino/trex.ts", blobId: "blob-trex.ts", text: "" }];

  expect(forkFindings({ sources: SOURCES, files }).map((finding) => finding.why)).toEqual([
    "byte-identical to components/neterror/resources/dino_game/trex.ts",
  ]);
});

test("several edited copies named like game sources are a fork, one shared name is not", () => {
  const edited = (name: string) => ({
    path: `front_end/dino_frame/dino_game/${name}`,
    blobId: `edited-${name}`,
    text: "",
  });

  expect(forkFindings({ sources: SOURCES, files: [edited("constants.ts")] })).toEqual([]);
  expect(forkFindings({ sources: SOURCES, files: ["trex.ts", "horizon.ts", "obstacle.ts"].map(edited) })).toHaveLength(
    3,
  );
});

test("a committed bundle that defines the game's classes is a fork, an entry file that imports them is not", () => {
  const bundle = { path: "front_end/panels/dino/dino.js", blobId: "x", text: "class Trex {}\nclass Horizon {}" };
  const entry = { path: "front_end/panels/dino/entry.ts", blobId: "y", text: "import {Runner} from './offline.js';" };

  expect(forkFindings({ sources: SOURCES, files: [bundle, entry] }).map((finding) => finding.path)).toEqual([
    "front_end/panels/dino/dino.js",
  ]);
});
