import { expect, test } from "bun:test";
import { diffPageHtml } from "./diff-page";

test("diffPageHtml embeds the patch so a closing script tag in it cannot end the page's script", () => {
  const html = diffPageHtml({ title: "dino × <baseline>", subtitle: "a..b", patch: '+const tag = "</script>";\n' });

  expect(html).toContain("<title>dino × &lt;baseline&gt;</title>");
  expect(html).not.toContain('"</script>"');
  expect(html).toContain("\\u003c/script>");
  expect(html.match(/<\/script>/g)).toHaveLength(2);
});
