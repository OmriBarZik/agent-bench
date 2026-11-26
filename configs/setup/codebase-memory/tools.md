You have codebase-memory in this session: a graph index of the whole checkout that knows symbols (classes, methods, functions) and the calls between them. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Its MCP tools are named `mcp__codebase-memory-mcp__*` and are already allowed. If they are not in your tool list yet, load them with tool search and then call one. Loading them is not using them.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you find a feature you have not located yet and follow it across TypeScript, C++ and several directories.

- `search_graph` finds a class, method or function by name or by a description, over the whole checkout at once. `grep -r` from the checkout root does not finish in useful time, so with `grep` you have to guess a directory first.
- `trace_path` returns the callers and callees of a function, several hops deep. With `grep` that is one search per hop, each returning comments, strings and longer names too.
- `get_code_snippet` returns one symbol's source and nothing else, so you read forty lines of an 1800-line file instead of all of it.
- `get_architecture` with a `path` gives a map of a directory you do not know yet.

**When it does not.** The index is a snapshot from before this session. It does not contain the files you create, and for a file you have edited its line numbers are out of date: read the file before you rely on them. The graph has symbols for source code, not for `BUILD.gn`, `.gni`, `.idl`, `.mojom`, `.json5` or `.grd` files: search those with `search_code`, or with `grep` through Bash when `search_code` has no hit. A missing graph hit is not proof the code is absent until `check_index_coverage` says the path is indexed.

**Start with it.** Before your first search, decide what you will use codebase-memory for in this task and say so in one sentence. Call `list_projects` first, keep the project whose root is this checkout, and pass that project name on every later call. Then make your first code search with `search_graph`. You must use the codebase-memory-mcp tools, named `mcp__codebase-memory-mcp__*`, for every search for a symbol, its callers or callees, or a feature you have not located yet. The baseline rule that sends a search to `grep` through Bash is the fallback for the searches codebase-memory cannot do. It is not where a search starts. When it cannot do a search, use `grep` for that one search, and come back to codebase-memory for the next one that fits. `list_projects` alone is not a search.

**Three questions a Chromium task asks, and how codebase-memory answers them.**

- Where does a web UI dialog open and cancel, and what does that code do? `search_graph` with `name_pattern: "showModal|cancel"` and `file_pattern: "*ui/webui/resources/cr_elements/cr_dialog*"`, then `get_code_snippet` with a qualified name from the result.
- Who calls a URL canonicalization function, anywhere in the checkout? `trace_path` with `function_name: "CanonicalizeHostVerbose"`, `direction: "inbound"` and `depth: 1`. When `trace_path` answers `ambiguous`, pick one of the qualified names it suggests.
- What is in a directory you do not know, and where is one of its methods? `get_architecture` with `path: "components/prefs"`, then `search_graph` with `query: "RegisterBooleanPref"` and `file_pattern: "*components/prefs*"`. For a name in build or interface-definition files, use `search_code` with a `pattern` and a `file_pattern`.

**How to call it.**

- `search_graph` finds a symbol: `query` for words, `name_pattern` for a regex on the name, `file_pattern` to narrow by path, `limit` to cap the rows.
- `trace_path` follows calls from `function_name`: `direction` is `inbound`, `outbound` or `both`, and `depth` is the number of hops.
- `get_code_snippet` reads a symbol by the qualified name `search_graph` returned. Use Read when the snippet is missing, or when you need lines that are not a symbol.
- `get_architecture` once, with a `path`, when you need a map of an unfamiliar directory.
- `search_code` for a literal string, config key, error message, or comment.

The checkout is already indexed. Do not index it again.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
