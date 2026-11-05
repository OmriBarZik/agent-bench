/** A text block in a tool result. */
export type TextPart = { type: "text"; text: string };

/** A base64 image block in a tool result. */
export type ImagePart = { type: "image"; data: string; mimeType: string };

/** One block of a tool result. */
export type ContentPart = TextPart | ImagePart;

/** What a tool call returns. `isError` tells the agent the call did not do what it asked. */
export type ToolResult = {
  content: ContentPart[];
  isError?: boolean;
};

/** A JSON Schema object, as MCP sends it in tools/list. */
export type JsonSchema = Record<string, unknown>;

/** One tool as tools/list describes it. */
export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

/** Tool arguments as the client sent them. */
export type ToolArguments = Record<string, unknown>;

/** What the stdio loop serves. */
export type McpServer = {
  name: string;
  version: string;
  tools: ToolDefinition[];
  callTool: (name: string, args: ToolArguments) => Promise<ToolResult>;
};

/** A JSON-RPC message from the client. Requests have an `id`; notifications do not. */
export type RpcRequest = {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
};

/** A JSON-RPC error object. */
export type RpcError = { code: number; message: string };
