import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connectCdp } from "../../../../validate/chrome/cdp";
import { startChrome } from "../../../../validate/chrome/launch";
import { evaluate } from "../../../../validate/chrome/page/evaluate";
import type { BenchCheck, BenchCheckInput } from "../bench-checks.types";
import { findFinalBuild } from "../build-check";
import { compareAnswers } from "./compare-answers";
import type { ApiAnswer, ApiState } from "./model-check.types";
import { parseSpecVectors, vectorState } from "./spec-vectors";

const NAME = "supplied model runs";
const GAME_URL = "chrome://dino";
const START_TIMEOUT_MS = 60_000;
const API_WAIT_MS = 20_000;

/**
 * Proves the browser runs the supplied model, not a stand-in: on chrome://dino in the final build, with no
 * switches, it calls `DinoDecisionModel.create()` and `decide()` with states built from SPEC.md's test vectors and
 * requires every probability within 1e-3 of SPEC.md. Also notes where the supplied .tflite bytes sit in the tree.
 * A Chromium failure is `not-run`; a missing API or a wrong answer is `fail`.
 */
export async function checkSuppliedModel(input: BenchCheckInput): Promise<BenchCheck> {
  const specPath = input.task.inputFiles?.find((file) => file.to.endsWith("SPEC.md"))?.from;

  if (!specPath || !existsSync(specPath)) {
    return { name: NAME, status: "not-run", detail: "The task supplies no SPEC.md with test vectors." };
  }

  const vectors = parseSpecVectors(readFileSync(specPath, "utf8"));
  const found = await findFinalBuild(input);

  if (typeof found === "string" || found.differences.length > 0) {
    return { name: NAME, status: "not-run", detail: "The final tree has no successful build to call the model in." };
  }

  try {
    const answers = await askBrowser({
      appPath: join(found.outputDir, "Chromium.app"),
      states: vectors.map((vector) => vectorState(vector.features)),
    });
    const verdict = compareAnswers({ vectors, answers });

    return { name: NAME, status: verdict.status, detail: verdict.detail };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);

    return { name: NAME, status: "not-run", detail: `Chromium could not be driven: ${message}` };
  }
}

/** Opens chrome://dino in the built Chromium and returns `decide()`'s answer per state, or one error for all. */
async function askBrowser({ appPath, states }: { appPath: string; states: ApiState[] }): Promise<ApiAnswer[]> {
  const chrome = await startChrome({ appPath, switches: [], timeoutMs: START_TIMEOUT_MS });
  const page = await connectCdp(chrome.pageUrl);

  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Page.navigate", { url: GAME_URL });
    const deadline = Date.now() + API_WAIT_MS;

    while (Date.now() < deadline && (await evaluate({ page, code: "typeof DinoDecisionModel" })) !== '"function"') {
      await Bun.sleep(500);
    }

    const code = `
      if (typeof DinoDecisionModel !== "function") {
        return { error: "chrome://dino has no DinoDecisionModel interface" };
      }
      const model = await DinoDecisionModel.create();
      const answers = [];
      for (const state of ${JSON.stringify(states)}) {
        try {
          answers.push(await model.decide(state));
        } catch (error) {
          answers.push({ error: String(error) });
        }
      }
      return { answers };`;
    const result = await evaluate({ page, code });

    return answersFrom({ result, count: states.length });
  } finally {
    page.close();
    await chrome.stop();
  }
}

function answersFrom({ result, count }: { result: string; count: number }): ApiAnswer[] {
  if (result.startsWith("threw ")) {
    return Array.from({ length: count }, () => ({ error: result }));
  }

  const parsed = JSON.parse(result) as { answers?: ApiAnswer[]; error?: string };

  return parsed.answers ?? Array.from({ length: count }, () => ({ error: parsed.error ?? "no answer" }));
}
