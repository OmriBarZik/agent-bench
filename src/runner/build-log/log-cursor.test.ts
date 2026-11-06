import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLogText, createLogCursor, linesOfLog, pullLogFile } from "./log-cursor";

test("a carriage return keeps the latest progress segment", () => {
  const cursor = appendLogText({
    cursor: createLogCursor(),
    text: "start\n[1/9] one\r[2/9] two\n[3/9] three\r",
    maxLines: 10,
  });

  expect(linesOfLog(cursor)).toEqual(["start", "[2/9] two", "[3/9] three"]);
});

test("ansi color is not shown, and a sequence split across chunks is held", () => {
  const first = appendLogText({ cursor: createLogCursor(), text: "err \x1b[31", maxLines: 10 });
  const second = appendLogText({ cursor: first, text: "mhat\x1b[0m\n", maxLines: 10 });

  expect(linesOfLog(second)).toEqual(["err hat"]);
});

test("the oldest lines are dropped once the cap is reached", () => {
  const cursor = appendLogText({ cursor: createLogCursor(), text: "a\nb\nc\n", maxLines: 2 });

  expect(cursor.lines).toEqual(["b", "c"]);
});

test("new bytes are appended and a replaced file starts over", () => {
  const directory = mkdtempSync(join(tmpdir(), "build-log-"));
  const path = join(directory, "build.log");
  writeFileSync(path, "one\n");
  const first = pullLogFile({ cursor: createLogCursor(), path, maxLines: 10 });
  writeFileSync(path, "two\n", { flag: "a" });
  const second = pullLogFile({ cursor: first, path, maxLines: 10 });

  expect(linesOfLog(second)).toEqual(["one", "two"]);

  writeFileSync(path, "fresh\n");
  const replaced = pullLogFile({ cursor: second, path, maxLines: 10 });

  expect(linesOfLog(replaced)).toEqual(["fresh"]);
});

test("a missing log leaves the cursor where it was", () => {
  const cursor = appendLogText({ cursor: createLogCursor(), text: "kept\n", maxLines: 10 });

  expect(pullLogFile({ cursor, path: join(tmpdir(), "no-such-build-log"), maxLines: 10 })).toBe(cursor);
});
