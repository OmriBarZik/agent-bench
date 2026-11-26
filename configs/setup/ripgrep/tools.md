You have `rg` (ripgrep) in this session: a fast recursive regex search that skips ignored and binary files. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories.

- It searches a large directory such as `content/browser` or `net` in about a second, where `grep -r` takes much longer and also walks build output and binaries.
- It skips what `.gitignore` ignores, so `out/` and generated files stay out of the results without extra flags.
- One command can limit the search to the file types that matter with `-g`, which is how you find every kind of file that mentions a name.

**When it does not.** Never in this task. `rg` does every search `grep` does, so no search falls back to `grep`.

**Start with it.** Before your first search, decide what you will use `rg` for in this task and say so in one sentence. Make your first code search with `rg`. You must search with `rg`. Use it for every code search. The baseline rule that sends a search to `grep` through Bash does not apply here: do not use the Grep tool, `grep`, or `git grep`.

**Three questions a Chromium task asks, and how `rg` answers them.**

- Where does a web UI dialog element open and cancel? `rg -n --no-config 'showModal|cancel\(' ui/webui/resources/cr_elements/cr_dialog`
- Which view sources add child views, tests left out? `rg -l --no-config 'AddChildView' -g '*.cc' -g '!*test*' ui/views/controls`
- Which headers and build files of two directories mention the host resolver? `rg -l --no-config 'HostResolver' -g '*.{h,gn,gni}' net/dns services/network/public/cpp`

**How to call it.** Use this form:

`rg -n --no-config 'pattern' path`

- `-l` lists matching files. `-c` counts matches per file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-g '*.ts'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-C 3` prints 3 lines around each match.
- `rg --files -g '*name*' path` lists files by name.

If a search returns nothing, change the pattern and search again with `rg`. Do not switch to another search tool.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
