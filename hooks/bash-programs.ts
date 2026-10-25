import { basename } from "node:path";
import { forEachChild, parse, type Command, type SyntaxNode } from "unbash";
import { nestedScripts } from "./nested-scripts";

/** Wrappers whose own name is not the program the script runs, once their body parses. */
const WRAPPERS = new Set([
  "builtin",
  "command",
  "env",
  "exec",
  "nice",
  "nohup",
  "stdbuf",
  "sudo",
  "time",
  "timeout",
  "xargs",
]);

/** Programs a Bash script actually runs. "FOO=1 rg x | head && ./out/mytool y" is ["rg", "head", "mytool"]. */
export function bashPrograms(command: string): string[] {
  try {
    return programsIn({ source: command, depth: 0 });
  } catch {
    // A parser crash must not drop the tool-call row. The command text is still stored.
    return [];
  }
}

function programsIn({ source, depth }: { source: string; depth: number }): string[] {
  if (depth > 20 || source.trim() === "") {
    return [];
  }

  const script = parse(source);
  const programs: string[] = [];
  const nested: string[] = [];
  walk(script, (node) => {
    if (node.type !== "Command") {
      return;
    }

    const program = programName(node);
    const bodies = nestedScripts({ command: node, source }).filter(
      (scriptText) => scriptText.trim() !== "" && scriptText !== source,
    );

    if (program && (!WRAPPERS.has(program) || bodies.length === 0)) {
      programs.push(program);
    }

    nested.push(...bodies);
  });

  for (const scriptText of nested) {
    programs.push(...programsIn({ source: scriptText, depth: depth + 1 }));
  }

  return programs;
}

function programName(command: Command): string | null {
  const value = command.name?.value;

  if (!value) {
    return null;
  }

  return basename(value);
}

function walk(node: SyntaxNode, visit: (node: SyntaxNode) => void) {
  visit(node);
  forEachChild(node, (child) => {
    walk(child, visit);
  });
}
