You must search with `ugrep`. Call it with Bash. Do not use the Grep tool, and do not run `grep`, `rg`, or `git grep`. This replaces the baseline rule that sends a search to `grep` through Bash. The shell stays at the checkout root, and `ugrep` searches from there. Do not use `cd`.

`ugrep [options] pattern [path...]` searches `pattern` in each path.

Use this form:

`ugrep -rnI --ignore-files --no-config pattern path`

- `-r` searches a directory recursively. Without it, `ugrep` reads only the files directly inside a directory you name.
- `-n` prints line numbers.
- `-I` skips binary files.
- `--ignore-files` skips files that `.gitignore` ignores, including `out/`.
- `--no-config` keeps a `.ugrep` config file out of the run. Run `ugrep`, not `ug`: `ug` loads that file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-l` lists matching files. `-c` counts matching lines per file.
- `-t cpp` limits the search to C++ files. Other types come from `ugrep -t list`. `-O cc,h` limits it to those extensions.
- `-g '*.mojom'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-A 3`, `-B 3`, and `-C 3` print lines after, before, and around a match.

The pattern is a POSIX extended regular expression. `-P` switches to Perl syntax when you need lookaround or a backreference. Quote the pattern in single quotes.

Exit status 1 means there was no match. Do not pass `-Q`, `-z`, `-Z`, `--index`, `--hidden`, `--replace`, or `--save-config`. Do not repeat that search with Grep or `grep`.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
