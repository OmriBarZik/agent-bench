You have a TypeScript language server in this session, through the tool named `LSP`. It covers `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` files. It was added to help you with this task. Use it wherever it fits, starting with your first look inside a TypeScript file. It is not an MCP server and not a Bash command. It is already allowed. If `LSP` is not in your tool list yet, load it with tool search, read its schema, and then call it. Loading it is not using it.

**When it beats `grep` in this checkout.** Chromium's web UI is TypeScript and JavaScript, often in long files. A Chromium task has you working out what a class offers, who calls a method, and what type a value has, so that your change compiles the first time.

- `documentSymbol` lists every class, method and field of a file with its line. That answers "what does this class have?" without reading the file or guessing names to `grep` for.
- `findReferences` and `incomingCalls` return the real uses of one method or field across files. `grep` for the same name also returns comments, strings and longer names.
- `hover` gives the type of a field, parameter or return value, and `goToDefinition` follows an import to the file that defines the name. Both tell you what you may write before a build tells you what you got wrong.
- After every Edit or Write on a covered file, diagnostics come back by themselves. They show a type error seconds after the edit, where a build shows it minutes later.

**When it does not.** It cannot find a file by name or by text: locate files with `ls` and `grep` through Bash. It knows nothing about C, C++, `BUILD.gn`, `.gni`, `.idl`, `.mojom`, `.json5` or `.grd` files; silence on those is not a compile result. Web UI sources under `components/` are checked with the build's settings and `chrome://resources/...` import mappings (a `tsconfig.json` at the checkout root supplies them), so a diagnostic there is one the build would report too. Other TypeScript directories in the checkout have no `tsconfig.json` next to their sources, so the server checks those files without the build's path mappings: an import such as `chrome://resources/...` is not found, and that one missing import brings `possibly 'null'` and `not assignable` errors on lines nobody changed. Those are noise there; read the diagnostics on the lines you changed. A diagnostic on a symbol you did not touch, or one that says the file is not part of a project, is not a failure of your edit: do not rewrite the file because of either.

**Start with it.** Before your first search, decide what you will use `LSP` for in this task and say so in one sentence. Make your first code search inside a TypeScript or JavaScript file with `LSP`: when `ls` or `grep` has given you the file, call `documentSymbol` on it instead of reading it or grepping it for names. You must use `LSP` for every question about a definition, the references, the callers or the type of a TypeScript or JavaScript symbol. The baseline rule that sends a search to `grep` through Bash is the fallback for the searches `LSP` cannot do. It is not where a search starts. When `LSP` cannot answer, or returns an error or nothing, use `grep` for that one question, and come back to `LSP` for the next one that fits.

**Three questions a Chromium task asks, and how `LSP` answers them.**

- What can a web UI dialog element do, and who cancels it? `{"operation": "documentSymbol", "filePath": "ui/webui/resources/cr_elements/cr_dialog/cr_dialog.ts", "line": 1, "character": 1}` lists the class. Then `findReferences` with the line and character of `cancel` from that list returns its callers.
- What is a name a file imports, and where does it come from? In the same file, call `hover` and `goToDefinition` on `CrInputElement`.
- What does a C++ class offer, or which build target compiles a file? Those are C++ and build files, which this server does not cover: use `grep` through Bash.

**How to call it.** Every call takes `operation`, `filePath`, `line` and `character`; `line` and `character` are 1-based and must point at the symbol's name. Get them from a `documentSymbol` result or from `grep -n`. The operations are `documentSymbol`, `goToDefinition`, `findReferences`, `hover`, `incomingCalls`, `outgoingCalls`, `prepareCallHierarchy`, `goToImplementation`, and `workspaceSymbol` (which also takes `query`).

After every Edit or Write on a covered file, read the diagnostics that come back. Fix an error your edit introduced before you move on, and do not finish while a file you changed still has a diagnostic your edit caused.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
