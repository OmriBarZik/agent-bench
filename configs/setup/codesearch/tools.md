You have Code Search (`csearch`), a trigram-indexed regex search over the whole checkout that answers in milliseconds.
Use it for every code search. Run it through Bash.
Do not use the Grep tool, grep, rg, or git grep.
The checkout is already indexed. Do not run `cindex`. The shell stays at the checkout root. Do not use cd.

Use this form:

`csearch -n -f 'path/regex' 'pattern'`

- Put every flag before the pattern: flag parsing stops at the pattern.
- `-l` lists matching files instead of lines.
- `-i` is case-insensitive. Keep flags separate: `-i -n`, never `-in`.
- `-f` limits results to paths that match a regex; paths in the index are absolute.
- `cgrep -n 'pattern' file...` searches files you name, including files you created in this session, which the index does not hold.

If a search returns nothing, change the pattern and search again with `csearch`.
Do not switch to another search tool.
