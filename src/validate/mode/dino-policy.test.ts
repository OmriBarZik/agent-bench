import { expect, test } from "bun:test";
import { rewriteResourceImports } from "./dino-harness";
import { dinoRefusal } from "./dino-policy";

test("a dino check may play the harness, but not eval or open another page", () => {
  expect(dinoRefusal({ url: "dino", actions: [{ key: "Space" }, { state: true }, { screenshot: true }] })).toBeNull();
  expect(dinoRefusal({ url: "chrome://dino", actions: [] })).toBeNull();
  expect(dinoRefusal({ url: "dino", actions: [{ eval: "Runner.getInstance()" }] })).toContain("eval is off");
  expect(dinoRefusal({ url: "http://127.0.0.1:1234/", actions: [] })).toContain("only the dino harness");
});

test("chrome://resources imports are served from the harness", () => {
  const source = [
    "import { assert } from 'chrome://resources/js/assert.js';",
    'import { html } from "//resources/lit/v3_0/lit.rollup.js";',
    "import { HIDDEN_CLASS } from '../constants.js';",
  ].join("\n");

  expect(rewriteResourceImports(source)).toBe(
    [
      "import { assert } from '/chrome-resources/js/assert.js';",
      'import { html } from "/lit/lit.rollup.js";',
      "import { HIDDEN_CLASS } from '../constants.js';",
    ].join("\n"),
  );
});
