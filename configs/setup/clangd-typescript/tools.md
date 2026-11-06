You have two language servers on this checkout. clangd covers `.c`, `.cc`, `.cpp`, `.h`, `.hh`, `.m`, and `.mm`. The TypeScript language server covers `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, and `.tsx`. They are not MCP servers. The tool is named `LSP`. It is already allowed. If it is not in your tool list yet, load it with tool search and then call it. Read its schema before you call it.

After every Edit or Write on a file one of those servers covers, read the diagnostics that come back. Those diagnostics are the check for that file. Fix an error your edit introduced before you move on. Do not finish while a file you changed still has a diagnostic your edit caused.

Use `LSP` before `grep` through Bash when you need the definition, the references, or the type of a symbol in one of those languages. A symbol lookup that skips it does not count.

clangd only knows files you open. Do not wait for it to index the tree. These diagnostics are not a compile result, so do not rewrite the file because of them: the file has no compile command, the server failed to start, the message names a generated header that was already missing, or a JavaScript diagnostic names a symbol you did not touch. `BUILD.gn`, `.idl`, `.mojom`, and `.grd` files have no language server here. Silence on those files is not a compile result either.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
