import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BenchCheckInput, RegisteredView } from "../bench-checks.types";

const DEVTOOLS_FRONT_END = "third_party/devtools-frontend/src/front_end/";
const CALL = "registerViewExtension(";
/** How far after the call its `location` and `id` are looked for: one object literal. */
const CALL_WINDOW = 1_500;

/** The views registered in the DevTools frontend files the agent added or changed. */
export function registeredViews(input: BenchCheckInput): RegisteredView[] {
  return input.changedFiles
    .filter((file) => file.status !== "D" && file.path.startsWith(DEVTOOLS_FRONT_END) && file.path.endsWith(".ts"))
    .filter((file) => existsSync(join(input.chromiumSrc, file.path)))
    .flatMap((file) =>
      viewsInSource({ source: readFileSync(join(input.chromiumSrc, file.path), "utf8"), file: file.path }),
    );
}

/** The registerViewExtension calls in one source file, read from their object literal. */
export function viewsInSource({ source, file }: { source: string; file: string }): RegisteredView[] {
  const views: RegisteredView[] = [];
  let from = source.indexOf(CALL);

  while (from !== -1) {
    const literal = source.slice(from, from + CALL_WINDOW);
    const id = /\bid:\s*['"`]([^'"`]+)['"`]/.exec(literal)?.[1];
    const location = /\blocation:\s*([^,\n]+)/.exec(literal)?.[1]?.trim();

    if (id && location) {
      views.push({ id, location, file });
    }

    from = source.indexOf(CALL, from + CALL.length);
  }

  return views;
}

/** True for a main-panel view, whose tab (`tab-<id>`) sits in the DevTools tab strip. Drawer views are not there. */
export function isPanel(view: RegisteredView): boolean {
  return /\bPANEL\b|['"]panel['"]/.test(view.location);
}
