You have a TypeScript language server on this checkout. It covers JavaScript and TypeScript. It is not an MCP server. The tool is named `LSP`. It is already allowed. If it is not in your tool list yet, load it with tool search and then call it. Read its schema before you call it.

After every Edit or Write on a `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, or `.tsx` file, read the diagnostics that come back. Those diagnostics are the check for that file. Fix an error your edit introduced before you move on. Do not finish while a file you changed still has a diagnostic your edit caused.

Use `LSP` before Grep when you need the definition, the references, or the type of a JavaScript or TypeScript symbol. A symbol lookup that skips it does not count.

A diagnostic on a symbol you did not touch is not a failure of your edit. A diagnostic that says the file is not part of a project is not a compile result. Do not rewrite the file because of either one. C, C++, `BUILD.gn`, `.idl`, `.mojom`, and `.grd` files have no language server here. Silence on those files is not a compile result either.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
