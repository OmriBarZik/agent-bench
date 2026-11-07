import { existsSync } from "node:fs";
import { join } from "node:path";
import { bootScript, harnessHtml } from "./dino-harness-page";
import type { DinoHarness, DinoHarnessPaths, HarnessRoute, HarnessSounds } from "./dino-harness.types";

const NETERROR_RESOURCES = "components/neterror/resources";

/**
 * Serves a page that loads the agent's rebuilt dino TypeScript against the real sprites and sounds.
 * The game boots the same way chrome://dino does, without packing resources into Chromium.
 */
export async function startDinoHarness(paths: DinoHarnessPaths): Promise<DinoHarness> {
  for (const path of [paths.dinoTsc, paths.chromeResources]) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing; the dino build did not copy its TypeScript output`);
    }
  }

  const page = harnessHtml(await loadSounds(paths.chromiumSrc));
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      return handleRequest({ request, paths, page });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}/`,
    stop: () => server.stop(true),
  };
}

/**
 * Points `chrome://resources/` and `//resources/` imports at this server. An http page cannot load
 * chrome:// modules, and Chromium does not apply an import map to them, so the source is rewritten instead.
 */
export function rewriteResourceImports(source: string): string {
  return source.replace(
    /(["'])(?:chrome:)?\/\/resources\/(lit\/v3_0\/)?/g,
    (_match, quote: string, lit: string | undefined) => `${quote}/${lit == null ? "chrome-resources" : "lit"}/`,
  );
}

async function loadSounds(chromiumSrc: string): Promise<HarnessSounds> {
  const sound = async (name: string) => {
    const bytes = await Bun.file(join(chromiumSrc, NETERROR_RESOURCES, "sounds", name)).arrayBuffer();

    return `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}`;
  };

  return {
    press: await sound("button-press.mp3"),
    hit: await sound("hit.mp3"),
    reached: await sound("score-reached.mp3"),
  };
}

function handleRequest({
  request,
  paths,
  page,
}: {
  request: Request;
  paths: DinoHarnessPaths;
  page: string;
}): Response | Promise<Response> {
  const path = new URL(request.url).pathname;

  if (path === "/" || path === "/index.html") {
    return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (path === "/boot.js") {
    return javascript(bootScript());
  }

  const root = routeRoot({ path, paths });

  if (root == null) {
    return new Response("not found", { status: 404 });
  }

  return fileResponse({ root: root.directory, relative: path.slice(root.prefix.length) });
}

function routeRoot({ path, paths }: { path: string; paths: DinoHarnessPaths }): HarnessRoute | null {
  const routes: HarnessRoute[] = [
    { prefix: "/dino/", directory: paths.dinoTsc },
    { prefix: "/chrome-resources/", directory: paths.chromeResources },
    ...(paths.litMinified == null ? [] : [{ prefix: "/lit/", directory: paths.litMinified }]),
    { prefix: "/neterror/", directory: join(paths.chromiumSrc, NETERROR_RESOURCES) },
    {
      prefix: "/interstitial/",
      directory: join(paths.chromiumSrc, "components/security_interstitials/core/common/resources"),
    },
  ];

  return routes.find((route) => path.startsWith(route.prefix)) ?? null;
}

async function fileResponse({ root, relative }: { root: string; relative: string }): Promise<Response> {
  if (relative.includes("..")) {
    return new Response("not found", { status: 404 });
  }

  const path = join(root, relative);

  if (!existsSync(path)) {
    return new Response("not found", { status: 404 });
  }

  if (path.endsWith(".js")) {
    return javascript(rewriteResourceImports(await Bun.file(path).text()));
  }

  return new Response(Bun.file(path));
}

function javascript(source: string): Response {
  return new Response(source, { headers: { "content-type": "text/javascript; charset=utf-8" } });
}
