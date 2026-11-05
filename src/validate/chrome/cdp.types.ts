/** A loosely typed DevTools protocol payload. */
export type CdpParams = Record<string, unknown>;

/** Called with an event's params. */
export type CdpEventHandler = (params: CdpParams) => void;

/** The error a DevTools protocol call returns. */
export type CdpError = {
  message: string;
};

/** One message from the DevTools WebSocket: a reply (`id`) or an event (`method`). */
export type CdpMessage = {
  id?: number;
  method?: string;
  params?: CdpParams;
  result?: CdpParams;
  error?: CdpError;
};

/** A call waiting for its reply. */
export type PendingCall = {
  settle: (message: CdpMessage) => void;
};

/** A connection to one DevTools target. */
export type CdpSession = {
  /** Sends a command and resolves with its result. Rejects on a protocol error or after a minute. */
  send: (method: string, params?: CdpParams) => Promise<CdpParams>;
  /** Registers a handler for an event such as `Runtime.consoleAPICalled`. */
  on: (method: string, handler: CdpEventHandler) => void;
  close: () => void;
};
