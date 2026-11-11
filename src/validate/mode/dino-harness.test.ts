import { expect, test } from "bun:test";
import { rewriteResourceImports } from "./dino-harness";

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
