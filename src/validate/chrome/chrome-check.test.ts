import { expect, test } from "bun:test";
import { evaluationBody } from "./chrome-check";

test("an expression is returned, and a return statement stays the function body", () => {
  expect(evaluationBody("document.title")).toBe("return (document.title);");
  expect(evaluationBody("const value = 1; return value")).toBe("const value = 1; return value");
  expect(evaluationBody("document.querySelector('[data-return]')")).toBe(
    "return (document.querySelector('[data-return]'));",
  );
});
