You have `sift` in this session: a fast recursive regex search that can skip ignored and binary files and filter by file type. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories.

- It searches a large directory such as `content/browser` or `net` in parallel, where `grep -r` reads one file at a time and also walks build output and binaries.
- With `--git` it skips what `.gitignore` ignores, so `out/` and generated files stay out of the results.
- One command can limit the search to the file types that matter with `-x` or `--path`, which is how you find every kind of file that mentions a name.

**When it does not.** Never in this task. `sift` does every search `grep` does, so no search falls back to `grep`.

**Start with it.** Before your first search, decide what you will use `sift` for in this task and say so in one sentence. Make your first code search with `sift`. You must search with `sift`. Use it for every code search. The baseline rule that sends a search to `grep` through Bash does not apply here: do not use the Grep tool, `grep`, `rg`, or `git grep`.

**Three questions a Chromium task asks, and how `sift` answers them.**

- Where does a web UI dialog element open and cancel? `sift -n --git --binary-skip --no-color --no-conf 'showModal|cancel\(' ui/webui/resources/cr_elements/cr_dialog`
- Which view sources add child views? `sift -l --git --binary-skip --no-color --no-conf --path '_view\.cc$' 'AddChildView' ui/views/controls`
- Which headers and build files of two directories mention the host resolver? `sift -l --git --binary-skip --no-color --no-conf -x h,gn,gni 'HostResolver' net/dns services/network/public/cpp`

**How to call it.** `sift [options] pattern [path...]` searches `pattern` under each path. With no path, it searches the checkout recursively, which is slow: name a path. Use this form:

`sift -n --git --binary-skip --no-color --no-conf pattern path`

- `-n` prints line numbers.
- `--git` skips ignored files, including `out/`.
- `--binary-skip` skips binary files.
- `--no-conf` ignores `~/.sift.conf` and `.sift.conf`. Do not pass `--write-config`, and do not create a sift config.
- `-i` is case-insensitive. `-Q` treats the pattern as literal text.
- `-l` lists matching files. `-c` counts matches per file.
- `-t cpp` limits the search to C++ files. Other types come from `sift --list-types`. `-x cc,h` limits it to those extensions.
- `--exclude-dirs glob` skips directories. `--path pattern` keeps paths that match a regex.

Exit status 1 means there was no match. Do not pass `--output` or `-o`. If a search returns nothing, change the pattern and search again with `sift`. Do not switch to another search tool.

**Rules.** The shell stays at the checkout root, and `sift` searches from there. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
