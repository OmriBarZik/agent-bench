#!/usr/bin/env bun
import { $ } from "bun";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CHECKOUT = process.env.CHROMIUM_SRC ?? resolve(REPO_ROOT, "../src");
const PROJECT_TEMPLATE = join(import.meta.dir, "project.yml");
const GLOBAL_CONFIG = join(homedir(), ".serena", "serena_config.yml");

/**
 * Installs Serena's project config into the Chromium checkout.
 *
 *   bun run setup:serena
 *
 * Copies configs/setup/serena/project.yml to CHROMIUM_SRC/.serena/project.yml (default ../src) and adds
 * /.serena/ to the checkout's info/exclude, so the runner's git clean keeps it. Fails unless
 * ~/.serena/serena_config.yml trusts the checkout: Serena ignores a project's ls_specific_settings (the
 * Chromium clangd and its flags) for an untrusted project.
 */
async function main(): Promise<void> {
  if (!existsSync(CHECKOUT)) {
    throw new Error(`Chromium checkout not found at ${CHECKOUT}; set CHROMIUM_SRC`);
  }

  const serenaDir = join(CHECKOUT, ".serena");
  mkdirSync(serenaDir, { recursive: true });
  copyFileSync(PROJECT_TEMPLATE, join(serenaDir, "project.yml"));
  console.log(`wrote ${join(serenaDir, "project.yml")}`);

  const exclude = (await $`git rev-parse --git-path info/exclude`.cwd(CHECKOUT).text()).trim();
  const excludePath = resolve(CHECKOUT, exclude);
  const excludeText = existsSync(excludePath) ? readFileSync(excludePath, "utf8") : "";

  if (!excludeText.split("\n").includes("/.serena/")) {
    await Bun.write(
      excludePath,
      `${excludeText}${excludeText.endsWith("\n") || excludeText === "" ? "" : "\n"}/.serena/\n`,
    );
    console.log(`added /.serena/ to ${excludePath}`);
  }

  if (!isTrusted(CHECKOUT)) {
    throw new Error(
      `${GLOBAL_CONFIG} does not trust ${CHECKOUT}. Run serena init if the file is missing, then list the checkout under trusted_project_path_patterns:\ntrusted_project_path_patterns:\n- ${CHECKOUT}`,
    );
  }

  console.log(`${CHECKOUT} is trusted in ${GLOBAL_CONFIG}`);
}

/** True when a trusted_project_path_patterns entry is the checkout path, or a `**` pattern. */
function isTrusted(checkout: string): boolean {
  if (!existsSync(GLOBAL_CONFIG)) {
    return false;
  }

  const lines = readFileSync(GLOBAL_CONFIG, "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith("trusted_project_path_patterns:"));

  if (start === -1) {
    return false;
  }

  for (const line of lines.slice(start + 1)) {
    const entry = /^\s*-\s*"?([^"]+?)"?\s*$/.exec(line);

    if (!entry?.[1]) {
      break;
    }

    if (entry[1] === checkout || entry[1] === "**") {
      return true;
    }
  }

  return false;
}

if (import.meta.main) {
  await main();
}
