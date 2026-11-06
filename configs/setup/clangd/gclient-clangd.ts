import type { SourceSpan } from "./gclient-clangd.types";
import { lineIndent, matchingClose, srcSolutionSpan } from "./gclient-scan";

const CLANGD_TRUE = /["']checkout_clangd["']\s*:\s*True\b/;
const CLANGD_FALSE = /(["']checkout_clangd["']\s*:\s*)False\b/;
const CLANGD_KEY = /["']checkout_clangd["']/;

/** Whether the src solution's `custom_vars` sets `checkout_clangd` to `True`. */
export function gclientChecksOutClangd(source: string): boolean {
  const vars = customVarsSpan(source);

  if (vars == null) {
    return false;
  }

  return CLANGD_TRUE.test(source.slice(vars.start, vars.end));
}

/**
 * Sets `checkout_clangd` to `True` on the src solution.
 * Leaves every other line as it was. Throws when the file has no src solution or the value is not `True` or `False`.
 */
export function enableCheckoutClangd(source: string): string {
  const solution = srcSolutionSpan(source);

  if (solution == null) {
    throw new Error(".gclient has no src solution, so checkout_clangd was not added.");
  }

  const vars = customVarsSpanIn({ source, solution });

  if (vars == null) {
    if (hasCustomVarsKey({ source, solution })) {
      throw new Error(".gclient sets custom_vars to something other than a dict.");
    }

    return insertCustomVars({ source, solution });
  }

  const body = source.slice(vars.start, vars.end);

  if (CLANGD_TRUE.test(body)) {
    return source;
  }

  if (CLANGD_FALSE.test(body)) {
    return source.slice(0, vars.start) + body.replace(CLANGD_FALSE, "$1True") + source.slice(vars.end);
  }

  if (CLANGD_KEY.test(body)) {
    throw new Error(".gclient sets checkout_clangd to a value other than True or False.");
  }

  return insertClangdKey({ source, vars });
}

function customVarsSpan(source: string): SourceSpan | null {
  const solution = srcSolutionSpan(source);

  if (solution == null) {
    return null;
  }

  return customVarsSpanIn({ source, solution });
}

function customVarsSpanIn({ source, solution }: { source: string; solution: SourceSpan }): SourceSpan | null {
  const body = source.slice(solution.start, solution.end);
  const match = /["']custom_vars["']\s*:\s*/.exec(body);
  const start = solution.start + (match?.index ?? 0) + (match?.[0].length ?? 0);

  if (match == null || source[start] !== "{") {
    return null;
  }

  return { start, end: matchingClose({ source, openIndex: start, open: "{", close: "}" }) };
}

function hasCustomVarsKey({ source, solution }: { source: string; solution: SourceSpan }): boolean {
  return /["']custom_vars["']/.test(source.slice(solution.start, solution.end));
}

function insertCustomVars({ source, solution }: { source: string; solution: SourceSpan }): string {
  const close = solution.end - 1;
  const before = source.slice(solution.start, close).trimEnd();
  const needsComma = !before.endsWith(",") && !before.endsWith("{");
  const comma = needsComma ? "," : "";
  const propertyIndent = `${lineIndent({ source, index: solution.start })}  `;
  const line = `\n${propertyIndent}"custom_vars": {"checkout_clangd": True},`;
  const closingIndent = lineIndent({ source, index: solution.start });

  return `${source.slice(0, solution.start)}${before}${comma}${line}\n${closingIndent}${source.slice(close)}`;
}

function insertClangdKey({ source, vars }: { source: string; vars: SourceSpan }): string {
  const inner = source.slice(vars.start + 1, vars.end - 1);

  if (inner.trim() === "") {
    const indent = lineIndent({ source, index: vars.start });
    const block = `{\n${indent}  "checkout_clangd": True,\n${indent}}`;

    return source.slice(0, vars.start) + block + source.slice(vars.end);
  }

  const key = `\n${lineIndent({ source, index: vars.start })}  "checkout_clangd": True,`;

  return source.slice(0, vars.start + 1) + key + source.slice(vars.start + 1);
}
