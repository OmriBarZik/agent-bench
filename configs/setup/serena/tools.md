You must use Serena's language-server tools, named `mcp__serena__*`, before `grep` through Bash, Glob, or Read. They are already allowed. If they are not in your tool list yet, load them with tool search and then call one. Read a tool's schema before you call it. A search that skips them does not count.

Serena is started on this checkout. Do not switch projects.

Use these tools for symbols:

- `get_symbols_overview` to see what a file defines.
- `find_symbol` to locate a symbol and read its body.
- `find_referencing_symbols` to see what references a symbol.
- `replace_symbol_body`, `insert_before_symbol`, and `insert_after_symbol` to change a symbol you found with Serena.

The baseline rule about Edit and Write applies to the shell: do not create or edit files from Bash. Serena's symbol edits are allowed. Use Edit or Write when the change is not a whole symbol, or when Serena has no symbols for that file.

Use `grep` through Bash, and Glob, only after a Serena tool returns nothing useful, or for text that is not a symbol. Follow a hit on a code file with Serena instead of reading the whole file. If a Serena tool is still indexing or returns nothing useful, use Read and continue. Do not wait out the session for the language server.
