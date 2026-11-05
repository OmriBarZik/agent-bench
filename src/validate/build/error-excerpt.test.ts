import { expect, test } from "bun:test";
import { errorExcerpt } from "./error-excerpt";

test("keeps the FAILED block and the compiler errors, drops progress and the command line", () => {
  const command = `../../third_party/llvm-build/Release+Asserts/bin/clang++ ${"-Dflag ".repeat(100)} -c dino.cc`;
  const output = [
    "[1/40] CXX obj/a.o",
    "[2/40] CXX obj/b.o",
    "FAILED: obj/dino.o",
    command,
    "../../components/dino.cc:12:3: error: use of undeclared identifier 'hat'",
    "1 error generated.",
    "[3/40] CXX obj/c.o",
    "ninja: build stopped: subcommand failed.",
  ].join("\n");

  expect(errorExcerpt(output)).toBe(
    [
      "FAILED: obj/dino.o",
      "../../components/dino.cc:12:3: error: use of undeclared identifier 'hat'",
      "1 error generated.",
    ].join("\n"),
  );
});

test("falls back to the end of the log when nothing says FAILED", () => {
  const output = ["Sending…", "", "fatal: could not read from remote repository"].join("\n");

  expect(errorExcerpt(output)).toBe("Sending…\nfatal: could not read from remote repository");
});

test("caps a long excerpt and says how much was left out", () => {
  const output = ["FAILED: obj/x.o", ...Array.from({ length: 200 }, (_, index) => `error ${index}`)].join("\n");
  const lines = errorExcerpt(output).split("\n");

  expect(lines).toHaveLength(151);
  expect(lines.at(-1)).toBe("… 51 more lines in the build log");
});
