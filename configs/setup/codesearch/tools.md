You must search this checkout with Code Search. Run `csearch` or `cgrep` through Bash. Do not use the Grep tool, and do not run `grep`, `rg`, or `git grep`. Code Search is not an MCP server. These two commands are how you search, and a search that skips them does not count.

The Chromium checkout is already indexed. Do not run `cindex`.

Put every flag before the pattern. `csearch -l -f 'chrome/' Trex` is valid. `csearch -l Trex -f 'chrome/'` is not: flag parsing stops at the pattern, `csearch` prints its usage, and the exit status is 2. Fix that command. Do not switch to another search tool.

`csearch` searches the index. It does not take a directory. Limit paths with `-f`. The file-name pattern is a regular expression, and paths in the index are absolute, so `-f 'chrome/'` matches a path that contains `chrome/`.

- `csearch -n pattern` prints matching lines with file names and line numbers.
- `csearch -l pattern` lists the matching files.
- `csearch -i -n pattern` is case-insensitive. Flags stay separate: `csearch -i -n`, never `csearch -in`.
- The pattern is one RE2 expression. It has no backreferences.

Exit status 1 means the index had no match. Do not pass `-brute`. Do not repeat that search with Grep or `grep`. A file you created in this session is missing until the index is rebuilt, and `out/` is not indexed. Use `grep` through Bash only for those files.

Use `cgrep` for a regular expression in files you already name: `cgrep -n pattern path`. It does not walk a directory. Name each file. Do not use `grep` on a file `cgrep` can read.

`csearch` and `cgrep` read the current contents of indexed files.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
