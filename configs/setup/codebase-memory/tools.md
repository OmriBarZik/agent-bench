You have the codebase-memory-mcp tools, named `mcp__codebase-memory-mcp__*`. They are already allowed. If they are not in your tool list yet, load them with tool search before you explore the tree.

The Chromium checkout is already indexed. Do not index it again. Call `list_projects` first and keep the project whose root is this checkout. Pass that project name on later calls.

Use these tools when the question is about code structure:

- `search_graph` to find a function, class, route, or other symbol.
- `trace_path` to see callers, callees, or data flow.
- `get_code_snippet` to read a symbol you found. Use Read when the snippet is missing, or when you need a few lines that are not a symbol.
- `get_architecture` once, when you need a map of an unfamiliar area.
- `search_code` for a literal string, config key, error message, or comment.

Use Grep, Glob, and Read for text that is not a symbol, for a file you already have open, and when `check_index_coverage` says a path is not indexed. A missing graph hit is not proof the code is absent until you have checked coverage.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
