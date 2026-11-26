You have `agrep` in this session: the approximate-match search from the TRE library. It finds lines that are within a few character errors of a pattern. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** A Chromium task has you looking for names you have not seen yet, in code that names the same thing differently from place to place: `HostResolver` in class names, `host_resolver` in file names, `kHostResolverRules` for the switch, `host-resolver-rules` on the command line.

- It finds a name you can only guess. A guess that is one or two characters off (a different spelling, a missing prefix, `_` against camel case) finds nothing with `grep` and finds the real name with `agrep -2`.
- `-B` returns only the closest matches in each file, so you can ask "what is the nearest thing to this name here?" without knowing how far off you are.
- With no error limit it is an exact regex search, so the same command also does an ordinary search over the files you name.

**When it does not.** `agrep` reads only the files you name. It does not walk a directory and has no `-r`, so it cannot answer "where in the tree is this?". Find the directory with `ls` or with `grep` through Bash, then search its files with `agrep` and a shell glob. Once `agrep` has shown you the exact spelling, `grep -r` with that spelling is the way to find its other uses across directories.

**Start with it.** Before your first search, decide what you will use `agrep` for in this task and say so in one sentence. Make your first code search with `agrep`: once `ls` has shown you a directory to look in, search its files with `agrep`. You must use `agrep` for every search for a name inside a directory you have found, and for every name `grep` did not find, before you give that name up. The baseline rule that sends a search to `grep` through Bash is the fallback for the searches `agrep` cannot do. It is not where a search starts. When `agrep` cannot do a search, use `grep` for that one search, and come back to `agrep` for the next one that fits.

**Three questions a Chromium task asks, and how `agrep` answers them.**

- Where does a web UI dialog element open, when you do not know what the method is called? `agrep -n -H -i -1 'showmodl' ui/webui/resources/cr_elements/cr_dialog/*.ts`
- How does the preference registry register a boolean preference, when you only half remember the method's name? `agrep -l -2 'RegisterBoolenPrefs' components/prefs/*.h`
- What are the URL functions that check a scheme and canonicalize a host really called? `agrep -n -H -2 'IsStandartScheme' url/*.h` and `agrep -n -H -B 'CanonicaliseHost' url/*.h`

**How to call it.** Use this form:

`agrep -n -H -2 'pattern' path/to/dir/*.cc`

- `-2` allows up to two errors. An error is one missing, extra, or wrong character. `-0` to `-9` set the limit, and `-E 12` sets a larger one. Without a limit, only an exact match counts.
- `-n` prints line numbers. `-H` prints the file name, which `agrep` leaves out when you name one file.
- `-B` prints only the closest matches in each file. Use it when you do not know how many errors to allow.
- `-s` prints the number of errors of each match.
- `-i` is case-insensitive. `-k` treats the pattern as literal text. `-w` matches whole words.
- `-l` lists matching files. `-c` counts matching lines per file.

`-E` is the error limit here, not the extended-regexp switch it is in `grep`. The pattern is already a POSIX extended regular expression. Quote it in single quotes. Start with one or two errors: a short pattern with a high limit matches almost every line. Exit status 1 means there was no match. Do not pass a directory as a file.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
