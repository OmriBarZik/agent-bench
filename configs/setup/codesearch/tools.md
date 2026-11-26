You have Code Search (`csearch`) in this session, with `cgrep` beside it: a trigram-indexed regex search over the whole checkout. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories.

- It answers a search over the whole checkout in well under a second. `grep -r` from the checkout root does not finish in useful time, so with `grep` you have to guess a directory first; with `csearch` you do not.
- That makes it the tool for "where in Chromium is this?": a name you have not located yet, every directory that mentions it, every file with a certain name.
- `-f` narrows by a path regex, so one command covers several directories and file types.

**When it does not.** The index is a snapshot from before this session, so `csearch` never returns a file you created. Search those, and any file you name yourself, with `cgrep -n 'pattern' file...`, which reads the files directly and needs no index.

**Start with it.** Before your first search, decide what you will use `csearch` for in this task and say so in one sentence. Make your first code search with `csearch`. You must search with `csearch`, or with `cgrep` when you already have the file names. Use it for every code search. The baseline rule that sends a search to `grep` through Bash does not apply here: `cgrep` covers that case. Do not use the Grep tool, `grep`, `rg`, or `git grep`.

**Three questions a Chromium task asks, and how `csearch` answers them.**

- Where does a web UI dialog element open and cancel? `csearch -n -f 'ui/webui/resources/cr_elements/cr_dialog/' 'showModal|cancel\('`
- Which view sources add child views? `csearch -l -f '/ui/views/controls/.*_view\.cc$' 'AddChildView'`
- Where is a command-line switch declared and read, anywhere in the checkout? `csearch -l -f '\.(h|cc)$' 'kHostResolverRules'`

**How to call it.** Use this form:

`csearch -n -f 'path/regex' 'pattern'`

- Put every flag before the pattern: flag parsing stops at the pattern.
- `-l` lists matching files instead of lines.
- `-i` is case-insensitive. Keep flags separate: `-i -n`, never `-in`.
- `-f` limits results to paths that match a regex; paths in the index are absolute.
- `cgrep -n 'pattern' file...` searches files you name, including files you created in this session, which the index does not hold.

The checkout is already indexed. Do not run `cindex`. If a search returns nothing, change the pattern and search again with `csearch`. Do not switch to another search tool.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
