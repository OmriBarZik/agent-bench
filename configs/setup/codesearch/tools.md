You have the Code Search commands `csearch`, `cgrep`, and `cindex` on `PATH`. Call them with Bash. The Chromium checkout is already indexed. Do not run `cindex`.

Prefer `csearch` over Grep for a regular expression across the tree. It only returns files that were indexed. A file you created is missing until the index is rebuilt, so use Grep for those. `csearch` reads the current contents of indexed files.

`csearch` takes flags and one regular expression. It does not take a directory. Limit paths with `-f`.

- `csearch -n regexp` prints matching lines with file names and line numbers.
- `csearch -l regexp` lists the matching files.
- `csearch -i -n regexp` is case-insensitive. Flags stay separate: `csearch -i -n`, never `csearch -in`.
- `csearch -n -f 'chrome/' regexp` keeps paths matching that regular expression. Paths in the index are absolute.
- The pattern is one RE2 expression. It has no backreferences.

Exit status 1 means there was no match. Do not pass `-brute`.

Use `cgrep` for a regular expression in files you name: `cgrep -n regexp path`. It does not walk a directory. Use Grep when `csearch` has no hit and the text may be in a new file, or in `out/`.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
