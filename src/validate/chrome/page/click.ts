import type { CdpSession } from "../cdp.types";
import type { PagePoint } from "../chrome-check.types";

/** Moves the mouse to `point` and clicks the left button there, the way a user focuses an element. */
export async function clickAt({ page, point }: { page: CdpSession; point: PagePoint }) {
  const position = { x: point.x, y: point.y };
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...position });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...position, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...position, button: "left", clickCount: 1 });
}
