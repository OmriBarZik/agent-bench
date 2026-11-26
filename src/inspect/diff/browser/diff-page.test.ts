import { expect, test } from "bun:test";
import { splitPatch } from "../split-patch";
import { diffPageHtml } from "./diff-page";

const PATCH = 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-x\n+const tag = "</script>";\n';

test("diffPageHtml embeds the patch so a closing script tag in it cannot end the page's script", () => {
  const html = diffPageHtml({
    input: {
      title: "dino × <baseline>",
      subtitle: "a..b",
      patch: PATCH,
      files: splitPatch(PATCH),
      storageKey: "run:b",
    },
    assets: { css: "", script: "" },
  });

  expect(html).toContain("<title>dino × &lt;baseline&gt;</title>");
  expect(html).not.toContain('"</script>"');
  expect(html).toContain("\\u003c/script>");
  expect(html.match(/<\/script>/g)).toHaveLength(2);
  expect(html).toContain('"path":"a.ts","status":"M","added":1,"removed":1');
});

test("readAssets finds the page's CSS and script next to diff-page.ts", () => {
  const html = diffPageHtml({ input: { title: "t", subtitle: "s", patch: "", files: [], storageKey: "k" } });

  expect(html).toContain("--tree-width");
  expect(html).toContain("Diff2HtmlUI");
});
