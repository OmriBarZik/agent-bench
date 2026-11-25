/** The inline --mcp-config JSON the runner passes for chrome-validate, as far as the setup hash reads it. */
export type McpConfigJson = {
  mcpServers?: Record<string, McpServerJson>;
};

/** One MCP server in an --mcp-config JSON. */
export type McpServerJson = {
  env?: Record<string, string>;
};
