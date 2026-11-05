import type { McpServer, RpcError, RpcRequest, ToolArguments } from "./protocol.types";

const DEFAULT_PROTOCOL = "2025-06-18";

/**
 * Serves MCP over stdio: one JSON-RPC message per line. Requests run concurrently, so a tool that waits
 * for a build does not hold up the others. Resolves when stdin closes (the client went away).
 */
export async function serveStdio(server: McpServer) {
  const decoder = new TextDecoder();
  let buffered = "";

  for await (const chunk of Bun.stdin.stream()) {
    buffered += decoder.decode(chunk, { stream: true });
    let newline = buffered.indexOf("\n");

    while (newline >= 0) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      newline = buffered.indexOf("\n");

      if (line !== "") {
        void handleLine({ server, line });
      }
    }
  }
}

async function handleLine({ server, line }: { server: McpServer; line: string }) {
  let request: RpcRequest;

  try {
    request = JSON.parse(line) as RpcRequest;
  } catch {
    reply({ id: null, error: { code: -32700, message: "parse error" } });

    return;
  }

  if (request.id == null) {
    return;
  }

  try {
    reply({ id: request.id, result: await dispatch({ server, request }) });
  } catch (error) {
    reply({ id: request.id, error: { code: -32601, message: error instanceof Error ? error.message : String(error) } });
  }
}

async function dispatch({ server, request }: { server: McpServer; request: RpcRequest }): Promise<unknown> {
  if (request.method === "initialize") {
    return {
      protocolVersion:
        typeof request.params?.protocolVersion === "string" ? request.params.protocolVersion : DEFAULT_PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: server.name, version: server.version },
    };
  }

  if (request.method === "ping") {
    return {};
  }

  if (request.method === "tools/list") {
    return { tools: server.tools };
  }

  if (request.method === "tools/call") {
    const name = String(request.params?.name ?? "");
    const args = (request.params?.arguments ?? {}) as ToolArguments;

    return server.callTool(name, args);
  }

  throw new Error(`method ${request.method} is not supported`);
}

function reply({ id, result, error }: { id: number | string | null; result?: unknown; error?: RpcError }) {
  const message = error ? { jsonrpc: "2.0", id, error } : { jsonrpc: "2.0", id, result };
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
