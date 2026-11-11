import type { CdpParams, CdpSession } from "../cdp.types";

const MAX_TEXT_LENGTH = 2000;

/** Statements that `return` stay a function body. An expression, including a word like `data-return`, is returned. */
export function evaluationBody(code: string): string {
  if (/(^|[^-\w])return\b/.test(code)) {
    return code;
  }

  return `return (${code});`;
}

/** Statements that `return` run inside an async function; anything else is evaluated as an expression. */
export async function evaluate({ page, code }: { page: CdpSession; code: string }): Promise<string> {
  const body = evaluationBody(code);
  const result = await page.send("Runtime.evaluate", {
    expression: `(async () => { ${body} })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  return describeResult(result);
}

/** A Runtime.evaluate or Runtime.callFunctionOn result as the agent reads it: JSON, `undefined`, or `threw …`. */
export function describeResult(result: CdpParams): string {
  const exception = result.exceptionDetails as CdpParams | undefined;

  if (exception) {
    return `threw ${describeException(exception)}`;
  }

  const value = (result.result as CdpParams | undefined)?.value;

  return value === undefined ? "undefined" : truncate(JSON.stringify(value));
}

/** The message of a page exception. */
export function describeException(details: CdpParams): string {
  const exception = details.exception as CdpParams | undefined;

  return String(exception?.description ?? details.text ?? "an exception");
}

/** Caps a text sent back to the agent. */
export function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}
