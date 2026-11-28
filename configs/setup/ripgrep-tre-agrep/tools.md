You have two search commands in this session: `rg` (ripgrep), a fast recursive regex search that skips ignored and binary files, and `agrep`, the approximate-match search from the TRE library, which finds lines within a few character errors of a pattern. They were added to help you with this task. Use them wherever they fit, starting with your first code search. Run both through Bash.

**When they beat `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories, in code that names the same thing differently from place to place: `HostResolver` in class names, `host_resolver` in file names, `kHostResolverRules` for the switch, `host-resolver-rules` on the command line.

- `rg` searches a large directory such as `content/browser` or `net` in about a second, where `grep -r` takes much longer and also walks build output and binaries. It skips what `.gitignore` ignores, so `out/` and generated files stay out of the results, and `-g` limits one search to the file types that matter.
- `agrep` finds a name you can only guess. A guess that is one or two characters off (a different spelling, a missing prefix, `_` against camel case) finds nothing with `rg` or `grep` and finds the real name with `agrep -2`. `-B` returns only the closest matches in each file.

**How they split the work.** `rg` answers "where in the tree is this?": every search across directories, and every search for a spelling you know. `agrep` answers "what is the nearest thing to this name here?": it reads only the files you name, does not walk a directory and has no `-r`, so first find the directory with `rg` or `ls`, then search its files with `agrep` and a shell glob. Once `agrep` has shown you the exact spelling, go back to `rg` to find its other uses across directories.

**When they do not.** Never in this task. Between them they do every search `grep` does, so no search falls back to `grep`.

**Start with them.** Before your first search, decide what you will use `rg` and `agrep` for in this task and say so in one sentence. Make your first code search with `rg`. You must search with `rg` for every search across the tree or for a known spelling, and with `agrep` for every search for a name inside a directory you have found when you are guessing its spelling, and for every name `rg` did not find, before you give that name up. The baseline rule that sends a search to `grep` through Bash does not apply here: do not use the Grep tool, `grep`, or `git grep`.

**Three questions a Chromium task asks, and how they answer them.**

- Which view sources add child views, tests left out? `rg -l --no-config 'AddChildView' -g '*.cc' -g '!*test*' ui/views/controls`
- Where does a web UI dialog element open, when you do not know what the method is called? `rg --files --no-config ui/webui/resources/cr_elements/cr_dialog`, then `agrep -n -H -i -1 'showmodl' ui/webui/resources/cr_elements/cr_dialog/*.ts`
- How does the preference registry register a boolean preference, when you only half remember the method's name? `agrep -n -H -2 'RegisterBoolenPref' components/prefs/*.h`, then `rg -n --no-config 'RegisterBooleanPref' components/prefs` for its uses

**How to call `rg`.** Use this form:

`rg -n --no-config 'pattern' path`

- `-l` lists matching files. `-c` counts matches per file.
- `-i` is case-insensitive. `-F` treats the pattern as literal text. `-w` matches whole words.
- `-g '*.ts'` keeps paths that match a glob, and `-g '!*test*'` drops them.
- `-C 3` prints 3 lines around each match.
- `rg --files -g '*name*' path` lists files by name.

**How to call `agrep`.** Use this form:

`agrep -n -H -2 'pattern' path/to/dir/*.cc`

- `-2` allows up to two errors. An error is one missing, extra, or wrong character. `-0` to `-9` set the limit, and `-E 12` sets a larger one. Without a limit, only an exact match counts.
- `-n` prints line numbers. `-H` prints the file name, which `agrep` leaves out when you name one file.
- `-B` prints only the closest matches in each file. Use it when you do not know how many errors to allow. `-s` prints the number of errors of each match.
- `-i` is case-insensitive. `-k` treats the pattern as literal text. `-w` matches whole words. `-l` lists matching files.

`-E` is the error limit in `agrep`, not the extended-regexp switch it is in `grep`. The pattern is already a POSIX extended regular expression. Quote it in single quotes. Start with one or two errors: a short pattern with a high limit matches almost every line. Exit status 1 means there was no match. Do not pass a directory as a file.

If `rg` returns nothing for a name, search the directory's files with `agrep` before you change the pattern or give the name up. Do not switch to another search tool.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
