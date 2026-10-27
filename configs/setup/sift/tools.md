You have `sift` on `PATH`. Call it with Bash. The shell stays at the checkout root, and `sift` searches from there. Do not use `cd`.

Prefer `sift` over Grep for a regular expression or a literal string in the tree or in files you name.

`sift [options] pattern [path...]` searches `pattern` under each path. With no path, it searches the checkout recursively.

Use this form:

`sift -n --git --binary-skip --no-color --no-conf pattern path`

- `-n` prints line numbers.
- `--git` skips ignored files, including `out/`.
- `--binary-skip` skips binary files.
- `--no-conf` ignores `~/.sift.conf` and `.sift.conf`. Do not pass `--write-config`, and do not create a sift config.
- `-i` is case-insensitive. `-Q` treats the pattern as literal text.
- `-l` lists matching files. `-c` counts matches per file.
- `-t cpp` limits the search to C++ files. Other types come from `sift --list-types`. `-x cc,h` limits it to those extensions.
- `--exclude-dirs glob` skips directories. `--path pattern` keeps paths that match.

Exit status 1 means there was no match. Do not pass `--output` or `-o`.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
