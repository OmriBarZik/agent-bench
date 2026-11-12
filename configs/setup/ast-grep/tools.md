You have `ast-grep`, a search that matches code by its syntax tree. Call it with Bash. You must use it when a search is about code structure: the calls to a function, the definitions of a method, a class that derives from another, an argument at a known position. A text search for the same thing also matches comments, strings, and longer names. Search plain text, such as a string, a comment, or a file type `ast-grep` does not parse, with `grep` through Bash as the baseline says. The shell stays at the checkout root. Do not use `cd`.

Use this form:

`ast-grep run -p 'pattern' -l cpp --color never --heading never path`

- `-p` is the pattern. It is a piece of valid code in the language named by `-l`, not a regular expression. Quote it in single quotes so the shell leaves `$` alone.
- `$NAME` matches one syntax node, and the same name used twice has to match the same code. `$$$ARGS` matches zero or more nodes, such as an argument list. `$_` matches one node you do not need.
- `-l` names the language. Use `cpp`, `c`, `js`, `ts`, `tsx`, `py`, `java`, `kotlin`, `rust`, `swift`, `html`, `css`, or `json`. Always pass it.
- Always name a path. A whole-checkout search parses every file of that language and can run out the session.
- `--globs '*_unittest.cc'` keeps paths that match a glob, and `--globs '!*test*'` drops them.
- `-A 3`, `-B 3`, and `-C 3` print lines after, before, and around a match.
- `--json=stream` prints one JSON object per match, with the file, the range, and each captured variable.

Examples:

- `ast-grep run -p 'base::BindOnce($$$ARGS)' -l cpp --color never --heading never chrome/browser/ui` finds each call.
- `ast-grep run -p 'class $NAME : public content::WebContentsObserver { $$$BODY }' -l cpp --color never --heading never chrome/browser` finds each subclass.
- `ast-grep run -p 'chrome.send($MESSAGE, $$$REST)' -l ts --color never --heading never chrome/browser/resources` finds each call in TypeScript.

`-l cpp` reads `.cc`, `.cpp`, `.cxx`, `.hh`, and `.hpp` files. It does not read `.h` files, because `ast-grep` treats `.h` as C. Search a C++ header with `grep`. A macro the parser cannot read, such as an export macro in a class declaration, can hide a match. When a pattern you expect to match finds nothing, try a smaller pattern, then `grep`.

`ast-grep` skips files that `.gitignore` ignores, including `out/`. Do not pass `--no-ignore`.

Exit status 1 means there was no match. Do not pass `-r`, `--rewrite`, `-U`, `--update-all`, `-i`, or `--interactive`: those change files. Do not run `ast-grep scan`, `ast-grep new`, or `ast-grep lsp`, and do not create an `sgconfig.yml`.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
