import { expect, test } from "bun:test";
import { withQuietSwitches } from "./chromium-flags";

test("every launch gets the mock keychain, and an extra --disable-features list is merged, not replaced", () => {
  const switches = withQuietSwitches(["--window-size=800,600", "--disable-features=Foo,DialMediaRouteProvider"]);

  expect(switches).toContain("--use-mock-keychain");
  expect(switches).toContain("--window-size=800,600");
  expect(switches.filter((value) => value.startsWith("--disable-features="))).toEqual([
    "--disable-features=DialMediaRouteProvider,Foo",
  ]);
});
