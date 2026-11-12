You must search with `rg` (ripgrep). Call it with Bash. Do not use the Grep tool, and do not run `grep` or `git grep`. This replaces the baseline rule that sends a search to `grep` through Bash. The shell stays at the checkout root, and `rg` searches from there. Do not use `cd`.

`rg [options] pattern [path...]` searches `pattern` under each path. With no path, it searches the checkout recursively.

Use this form:

`rg -n --no-config pattern path`

- `-n` prints line numbers.
- `--no-config` ignores `RIPGREP_CONFIG_PATH`, so a personal config does not change the run.
- `rg` already skips files that `.gitignore` ignores, including `out/`, and it skips hidden and binary files. Do not pass `--no-ignore`, `-u`, `--hidden`, or `-a`.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-l` lists matching files. `-c` counts matching lines per file.
- `-t cpp` limits the search to C++ files. Other types come from `rg --type-list`. `-g '*.mojom'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-A 3`, `-B 3`, and `-C 3` print lines after, before, and around a match.
- `-U` lets a pattern match across lines.
- `rg --files -g '*name*' path` lists files by name without searching their contents.

The pattern is a Rust regular expression. It has no backreferences and no lookaround. Quote it in single quotes.

Exit status 1 means there was no match. Do not pass `--pre`. Do not repeat that search with Grep or `grep`.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
