You have Serena's language-server tools, named `mcp__serena__*`. They are already allowed. If they are not in your tool list yet, load them with tool search before you explore the tree. Read a tool's schema before you call it.

Serena is started on this checkout. Do not switch projects.

Prefer Serena when the question is about symbols:

- `get_symbols_overview` to see what a file defines.
- `find_symbol` to locate a symbol and read its body.
- `find_referencing_symbols` to see what references a symbol.
- `replace_symbol_body`, `insert_before_symbol`, and `insert_after_symbol` to change a symbol you found with Serena.

The baseline rule about Edit and Write applies to the shell: do not create or edit files from Bash. Serena's symbol edits are allowed. Use Edit or Write when the change is not a whole symbol, or when Serena has no symbols for that file.

Use Grep and Glob to discover text and paths. Follow a hit on a code file with Serena instead of reading the whole file. If a Serena tool is still indexing or returns nothing useful, use Read and continue. Do not wait out the session for the language server.
