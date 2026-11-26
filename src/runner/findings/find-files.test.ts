import { expect, test } from "bun:test";
import { countDiagnostics } from "./count-diagnostics";
import { findFirstFiles } from "./find-files";

function call({ id, name, input }: { id: string; name: string; input: unknown }): string {
  return JSON.stringify({
    type: "assistant",
    message: { id, usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "tool_use", name, input }] },
  });
}

test("finds the first opened game source and panel registration, ignoring searches", () => {
  const lines = [
    call({ id: "a", name: "Grep", input: { path: "components/neterror/resources/dino_game/offline.ts" } }),
    call({ id: "b", name: "Read", input: { file_path: "/x/src/components/neterror/resources/dino_game/offline.ts" } }),
    call({ id: "b", name: "Read", input: { file_path: "/x/src/README.md" } }),
    call({ id: "c", name: "Bash", input: { command: "cat front_end/panels/animation/animation-meta.ts" } }),
  ];

  expect(findFirstFiles(lines)).toEqual({
    firstGameSource: { turn: 2, tokens: 30 },
    firstPanelRegistration: { turn: 3, tokens: 45 },
  });
});

test("countDiagnostics counts diagnostics attachments and their errors", () => {
  const attachment = (severities: string[]) =>
    JSON.stringify({
      attachment: {
        type: "diagnostics",
        files: [{ uri: "a.cc", diagnostics: severities.map((severity) => ({ severity })) }],
      },
    });
  const lines = [attachment(["Error", "Warning"]), attachment(["Error"]), '{"attachment":{"type":"date"}}', "{torn"];

  expect(countDiagnostics(lines)).toEqual({ diagnosticsDeliveries: 2, diagnosticsErrors: 2 });
});
