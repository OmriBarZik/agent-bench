You have `rg` (ripgrep), a fast recursive regex search that skips ignored and binary files.
Use it for every code search. Run it through Bash.
Do not use the Grep tool, grep, or git grep.
The shell stays at the checkout root. Do not use cd.

Use this form:

`rg -n --no-config 'pattern' path`

- `-l` lists matching files. `-c` counts matches per file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-g '*.ts'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-C 3` prints 3 lines around each match.
- `rg --files -g '*name*' path` lists files by name.

If a search returns nothing, change the pattern and search again with `rg`.
Do not switch to another search tool.
