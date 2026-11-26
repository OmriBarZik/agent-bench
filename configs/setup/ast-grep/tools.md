You have `ast-grep` in this session: a search that matches code by its syntax tree instead of by its text. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** A Chromium task has you reading TypeScript and JavaScript (web UI) and C++ (browser and renderer code) to find how existing code calls, defines and registers things, so you can add yours the same way.

- It finds the calls to a function or method and nothing else. `grep 'SetValue'` also returns comments, strings, the definition and longer names such as `SetValueSilently`; a call pattern returns only calls.
- It returns a whole construct as one match, however many lines it spans. A call whose arguments run over six lines comes back complete, where `grep` prints the first line.
- It matches by shape when you do not know the names: every method called on an object, every class that implements an interface, every call with a given argument.

**When it does not.** It has no parser for `.idl`, `.mojom`, `BUILD.gn`, `.gni`, `.json5` or `.grd` files, it reads `.h` files as C and not C++, and it does not find a file by name or search text inside strings and comments. For those, use `grep` through Bash. In C++ a macro can hide a match: member-call patterns like `$OBJ->Method($$$ARGS)` work well, patterns for whole class or function definitions often do not.

**Start with it.** Before your first search, decide what you will use `ast-grep` for in this task and say so in one sentence. Make your first code search with `ast-grep`. You must use `ast-grep` for every search for calls, definitions or other code structure in a TypeScript, JavaScript or C++ source file. The baseline rule that sends a search to `grep` through Bash is the fallback for the searches `ast-grep` cannot do. It is not where a search starts. When `ast-grep` cannot do a search, use `grep` for that one search, and come back to `ast-grep` for the next one that fits.

**Three questions a Chromium task asks, and how `ast-grep` answers them.**

- What does a web UI element call on the dialog it wraps, and who opens a dialog? `ast-grep run -p 'this.$.dialog.$METHOD($$$ARGS)' -l ts --color never --heading never ui/webui/resources/cr_elements/cr_dialog`, then `ast-grep run -p '$OBJ.showModal($$$ARGS)' -l ts --color never --heading never ui/webui/resources/cr_elements`
- Where does a view add its child views? `ast-grep run -p '$OBJ->AddChildView($$$ARGS)' -l cpp --color never --heading never ui/views/bubble` prints each call whole, however many lines its arguments take.
- Who writes a value to a preference store? `ast-grep run -p '$STORE->SetValue($$$ARGS)' -l cpp --color never --heading never components/prefs` returns the calls, without `SetValueSilently` and without the definitions. Which build target compiles a file is a text question: use `grep` for it.

**How to call it.** Use this form:

`ast-grep run -p 'pattern' -l ts --color never --heading never path`

- `-p` is the pattern. It is a piece of valid code in the language named by `-l`, not a regular expression. Quote it in single quotes so the shell leaves `$` alone.
- `$NAME` matches one syntax node, and the same name used twice has to match the same code. `$$$ARGS` matches zero or more nodes, such as an argument list. `$_` matches one node you do not need.
- `-l` names the language: `ts`, `tsx`, `js`, `cpp`, `c`, `py`, `html`, `css`, or `json`. Always pass it. `-l cpp` reads `.cc`, `.cpp`, `.cxx`, `.hh`, and `.hpp`.
- Always name a path, a directory or a file. A whole-checkout search parses every file of that language and can run out the session.
- `--globs '*_unittest.cc'` keeps paths that match a glob, and `--globs '!*test*'` drops them.
- `-A 3`, `-B 3`, and `-C 3` print lines after, before, and around a match.
- `--json=stream` prints one JSON object per match, with the file, the range, and each captured variable.

Exit status 1 means there was no match. When a pattern you expect to match finds nothing, try a smaller pattern, then `grep`. `ast-grep` skips files that `.gitignore` ignores, including `out/`. Do not pass `--no-ignore`.

**Rules.** Do not pass `-r`, `--rewrite`, `-U`, `--update-all`, `-i`, or `--interactive`: those change files. Do not run `ast-grep scan`, `ast-grep new`, or `ast-grep lsp`, and do not create an `sgconfig.yml`. The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
