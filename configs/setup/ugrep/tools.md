You have `ugrep`, a recursive regex search that can also match approximately (fuzzy search).
Use it for every code search. Run it through Bash.
Do not use the Grep tool, grep, rg, or git grep.
The shell stays at the checkout root. Do not use cd. Run `ugrep`, not `ug`.

Use this form:

`ugrep -rnI --ignore-files --no-config 'pattern' path`

- `-l` lists matching files. `-c` counts matches per file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-g '*.ts'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-C 3` prints 3 lines around each match.
- `-Z2` allows up to two wrong, missing or extra characters in a match.

If an exact search finds nothing, search again with -Z2 to allow up to
two wrong, missing or extra characters before you try a different name.

If a search returns nothing, change the pattern and search again with `ugrep`.
Do not switch to another search tool.
