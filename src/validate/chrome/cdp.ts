import type { CdpEventHandler, CdpMessage, CdpSession, PendingCall } from "./cdp.types";

const CALL_TIMEOUT_MS = 60_000;

/** Opens a DevTools protocol connection to one target's WebSocket URL. */
export async function connectCdp(url: string): Promise<CdpSession> {
  const socket = new WebSocket(url);
  const pending = new Map<number, PendingCall>();
  const handlers = new Map<string, CdpEventHandler[]>();
  let nextId = 1;

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error(`could not connect to ${url}`)), { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as CdpMessage;

    if (message.id != null) {
      const call = pending.get(message.id);
      pending.delete(message.id);
      call?.settle(message);

      return;
    }

    for (const handler of handlers.get(message.method ?? "") ?? []) {
      handler(message.params ?? {});
    }
  });

  return {
    send: (method, params = {}) => {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} timed out`));
        }, CALL_TIMEOUT_MS);
        pending.set(id, {
          settle: (message) => {
            clearTimeout(timer);

            if (message.error) {
              reject(new Error(`${method}: ${message.error.message}`));
            } else {
              resolve(message.result ?? {});
            }
          },
        });
      });
    },
    on: (method, handler) => {
      handlers.set(method, [...(handlers.get(method) ?? []), handler]);
    },
    close: () => socket.close(),
  };
}
