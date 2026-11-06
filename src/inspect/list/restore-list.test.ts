import { expect, test } from "bun:test";
import { CLEAR_SCREEN, RESTORE_LIST, RETURN_TO_ORIGINAL } from "./restore-list";

test("restoring the list turns off modes a crashed progress leaves on, then clears its screen", () => {
  expect(RESTORE_LIST.startsWith("\x1b[?2026l")).toBe(true);
  expect(RESTORE_LIST).toContain("\x1b[?2004l");
  expect(RESTORE_LIST).toContain("\x1b[?1049l\x1b[?1049h");
  expect(RESTORE_LIST.endsWith("\x1b[H\x1b[2J\x1b[?25l")).toBe(true);
});

test("a build log returns to the original screen before that screen is cleared", () => {
  expect(RETURN_TO_ORIGINAL).toBe("\x1b[?25h\x1b[?1049l");
  expect(CLEAR_SCREEN.endsWith("\x1b[H\x1b[2J\x1b[3J")).toBe(true);
  expect(CLEAR_SCREEN).not.toContain("1049");
});
