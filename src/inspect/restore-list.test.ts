import { expect, test } from "bun:test";
import { RESTORE_LIST } from "./restore-list";

test("restoring the list turns off modes a crashed progress leaves on, then enters its screen", () => {
  expect(RESTORE_LIST.startsWith("\x1b[?2026l")).toBe(true);
  expect(RESTORE_LIST).toContain("\x1b[?2004l");
  expect(RESTORE_LIST.endsWith("\x1b[?1049l\x1b[?1049h\x1b[?25l")).toBe(true);
});
