/**
 * Why `target` does not hold every top-level key of `expected` with the same value, or undefined when it does.
 * Both texts are YAML (JSON is YAML too). Keys only `target` has are ignored, so a tool may add its own defaults.
 */
export function differentKeys({ expected, target }: { expected: string; target: string }): string | undefined {
  const expectedValue = parseRecord(expected);
  const targetValue = parseRecord(target);

  if (!expectedValue) {
    return "the repo file is not a YAML mapping";
  }

  if (!targetValue) {
    return "not a YAML mapping";
  }

  for (const [key, value] of Object.entries(expectedValue)) {
    if (JSON.stringify(targetValue[key] ?? null) !== JSON.stringify(value ?? null)) {
      return `${key} differs`;
    }
  }

  return undefined;
}

function parseRecord(text: string): Record<string, unknown> | undefined {
  let parsed: unknown;

  try {
    parsed = Bun.YAML.parse(text);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  return parsed as Record<string, unknown>;
}
