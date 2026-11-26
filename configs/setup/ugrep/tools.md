You have `ugrep` in this session: a recursive regex search that can also match approximately (fuzzy search). It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash. Run `ugrep`, not `ug`.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories.

- With `--ignore-files` it skips what `.gitignore` ignores, so `out/` and generated files stay out of the results, and `-I` skips binaries.
- One command can limit the search to the file types that matter with `-g`, which is how you find every kind of file that mentions a name.
- `-Z2` finds a name when you only know roughly how it is spelled: it allows up to two wrong, missing or extra characters. Chromium names the same thing differently from place to place (`HostResolver`, `host_resolver`, `kHostResolverRules`), and a guessed name that `grep` misses is often one or two characters off.

**When it does not.** Never in this task. `ugrep` does every search `grep` does, so no search falls back to `grep`.

**Start with it.** Before your first search, decide what you will use `ugrep` for in this task and say so in one sentence. Make your first code search with `ugrep`. You must search with `ugrep`. Use it for every code search. The baseline rule that sends a search to `grep` through Bash does not apply here: do not use the Grep tool, `grep`, `rg`, or `git grep`.

**Three questions a Chromium task asks, and how `ugrep` answers them.**

- Where does a web UI dialog element open and cancel? `ugrep -rnI --ignore-files --no-config 'showModal|cancel\(' ui/webui/resources/cr_elements/cr_dialog`
- How does the preference registry register a boolean preference, when you are not sure of the method's name? `ugrep -rnI --ignore-files --no-config -Z2 'RegisterBoolenPrefs' components/prefs`
- Which headers and build files of two directories mention the host resolver? `ugrep -rlI --ignore-files --no-config -g '*.h,*.gn,*.gni' 'HostResolver' net/dns services/network/public/cpp`

**How to call it.** Use this form:

`ugrep -rnI --ignore-files --no-config 'pattern' path`

- `-l` lists matching files. `-c` counts matches per file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-g '*.ts'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-C 3` prints 3 lines around each match.
- `-Z2` allows up to two wrong, missing or extra characters in a match.

If an exact search finds nothing, search again with -Z2 before you try a different name. If that finds nothing either, change the pattern and search again with `ugrep`. Do not switch to another search tool.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
