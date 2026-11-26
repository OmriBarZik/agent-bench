import { expect, test } from "bun:test";
import { listScreenshots, newestBuildScreenshots } from "./final-screenshots";

function line(content: unknown[]): string {
  return JSON.stringify({ message: { content } });
}

function runChromeResult({ id, build, data }: { id: string; build: number; data: string }): string {
  return line([
    {
      type: "tool_result",
      tool_use_id: id,
      content: [
        { type: "text", text: `Running build ${build} (snapshot abc, mode dino).` },
        { type: "image", source: { type: "base64", media_type: "image/png", data } },
      ],
    },
  ]);
}

test("keeps only run_chrome screenshots from the newest build", () => {
  const transcript = [
    line([{ type: "tool_use", id: "a", name: "mcp__chrome-validate__run_chrome" }]),
    runChromeResult({ id: "a", build: 1, data: "b2xk" }),
    line([{ type: "tool_use", id: "other", name: "Read" }]),
    runChromeResult({ id: "other", build: 9, data: "bm9wZQ==" }),
    line([{ type: "tool_use", id: "b", name: "mcp__chrome-validate__run_chrome" }]),
    runChromeResult({ id: "b", build: 2, data: "bmV3" }),
    "{torn",
  ].join("\n");
  const screenshots = listScreenshots(transcript);

  expect(screenshots.map((screenshot) => screenshot.build)).toEqual([1, 2]);
  expect(newestBuildScreenshots(screenshots)).toEqual([{ build: 2, base64: "bmV3" }]);
});

test("falls back to image paths when the transcript has no inline image", () => {
  const transcript = [
    line([{ type: "tool_use", id: "a", name: "mcp__chrome-validate__run_chrome" }]),
    line([
      {
        type: "tool_result",
        tool_use_id: "a",
        content: [
          { type: "text", text: "Running build 3 (snapshot abc, mode devtools)." },
          { type: "text", text: "[Image: source: /tmp/shot-1.png]" },
        ],
      },
    ]),
  ].join("\n");

  expect(listScreenshots(transcript)).toEqual([{ build: 3, sourcePath: "/tmp/shot-1.png" }]);
});
