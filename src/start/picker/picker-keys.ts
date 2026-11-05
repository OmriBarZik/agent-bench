export function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

export function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

export function isHome(key: string): boolean {
  return key === "\x1b[H" || key === "\x1b[1~" || key === "\x1bOH";
}

export function isEnd(key: string): boolean {
  return key === "\x1b[F" || key === "\x1b[4~" || key === "\x1bOF";
}
