import { JUDGE_BLOCKER_KINDS, JUDGE_BLOCKER_MEANING } from "../../db/judge-blocker";
import { JUDGE_DECISION_MEANING, JUDGE_DECISIONS } from "../../db/judge-decision";

/**
 * Structured output the judge session must return, as JSON text. The schema is enforced; the prompt does not
 * describe it. `checkNames` are the task's scoring checks: the judge returns one pass / fail verdict for each.
 */
export function judgeSchema(checkNames: string[]): string {
  return JSON.stringify({
    type: "object",
    additionalProperties: false,
    properties: {
      decision: {
        type: "string",
        enum: [...JUDGE_DECISIONS],
        description: JUDGE_DECISIONS.map((decision) => `${decision}: ${JUDGE_DECISION_MEANING[decision]}`).join(" "),
      },
      reason: {
        type: "string",
        description: "What is present and what is missing.",
      },
      checks: checksProperty(checkNames),
      blocked: {
        type: "boolean",
        description:
          "True when the agent got stuck or gave up on part of the task because a tool, MCP tool, or program it needed was missing, denied, or kept failing. False when there was no such problem or it worked around every one.",
      },
      blockers: {
        type: "array",
        description: "One entry per tool problem that stopped the agent. Empty when blocked is false.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: {
              type: "string",
              enum: [...JUDGE_BLOCKER_KINDS],
              description: JUDGE_BLOCKER_KINDS.map((kind) => `${kind}: ${JUDGE_BLOCKER_MEANING[kind]}`).join(" "),
            },
            tool: {
              type: "string",
              description: "The tool, MCP tool, or program, e.g. 'Bash: autoninja' or 'mcp__serena__find_symbol'.",
            },
            detail: {
              type: "string",
              description:
                "One or two plain sentences for a human: what the agent tried, what happened, and what part of the task it could not do because of it.",
            },
          },
          required: ["kind", "tool", "detail"],
        },
      },
    },
    required: ["decision", "reason", "checks", "blocked", "blockers"],
  });
}

function checksProperty(checkNames: string[]) {
  const check =
    checkNames.length === 0
      ? { type: "string", description: "The requirement this verdict is about, in a few words." }
      : { type: "string", enum: checkNames, description: "The scoring check, copied exactly." };

  return {
    type: "array",
    description:
      checkNames.length === 0
        ? "One verdict per requirement."
        : `Exactly one verdict for each of these ${checkNames.length} checks, in this order: ${checkNames.join(" | ")}.`,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        check,
        verdict: { type: "string", enum: ["pass", "fail"] },
        evidence: { type: "string", description: "One line: the file, code, or bench check that decides it." },
      },
      required: ["check", "verdict", "evidence"],
    },
  };
}
