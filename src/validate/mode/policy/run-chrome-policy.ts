import type { ChromeAction } from "../../chrome/chrome-check.types";
import type { ValidateMode } from "../validate-mode.types";
import { devtoolsRefusal } from "./devtools-policy";
import { dinoRefusal } from "./dino-policy";

/** Why this mode refuses a run_chrome request, or null when it may run. Full chrome tasks allow everything. */
export function runChromeRefusal({
  mode,
  url,
  actions,
}: {
  mode: ValidateMode;
  url: string;
  actions: ChromeAction[];
}): string | null {
  if (mode === "dino") {
    return dinoRefusal({ url, actions });
  }

  if (mode === "devtools") {
    return devtoolsRefusal({ url, actions });
  }

  return null;
}
