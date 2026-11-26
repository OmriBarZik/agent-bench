You have Zoekt (`zoekt`) in this session: a trigram-indexed search over the whole checkout, with a query language for paths and languages. It was added to help you with this task. Use it wherever it fits, starting with your first code search. Run it through Bash.

**When it beats `grep` in this checkout.** Chromium has hundreds of thousands of files, and a Chromium task makes you follow one name across TypeScript, C++ and build files in several directories.

- It answers a search over the whole checkout in well under a second. `grep -r` from the checkout root does not finish in useful time, so with `grep` you have to guess a directory first; with `zoekt` you do not.
- That makes it the tool for "where in Chromium is this?": a name you have not located yet, every directory that mentions it, every file with a certain name.
- `file:` and `lang:` narrow by path and language inside the query, so one query covers several directories and file types.

**When it does not.** The index is a snapshot from before this session. It does not contain the files you create, and for a file you have edited its matches and line numbers are out of date. For those files, and to print lines from one file you already have open, use `grep` through Bash on that file.

**Start with it.** Before your first search, decide what you will use `zoekt` for in this task and say so in one sentence. Make your first code search with `zoekt`. You must use `zoekt` for every search for something you have not located yet, and for every search across more than one directory. The baseline rule that sends a search to `grep` through Bash is the fallback for the two cases above. It is not where a search starts. Do not use the Grep tool, `rg`, `git grep`, or `grep -r` over a directory.

**Three questions a Chromium task asks, and how `zoekt` answers them.**

- Where does a web UI dialog element open and cancel? `zoekt 'showModal|cancel\( file:ui/webui/resources/cr_elements/cr_dialog'`
- Which view sources add child views? `zoekt -l 'AddChildView file:ui/views/controls/.*_view\.cc$'`
- Where is a command-line switch declared and read, anywhere in the checkout? `zoekt -l 'kHostResolverRules file:\.(h|cc)$ -file:test'`, then `zoekt 'kHostResolverRules file:\.(h|cc)$ -file:test'` to read the matching lines.

**How to call it.** Use this form:

`zoekt 'pattern file:path/regex'`

- Put flags before the query, and pass the whole query as one single-quoted argument. `-l` lists matching files.
- `file:regex` keeps paths that match, `-file:regex` drops them, and `file:name\.ts$` alone finds files by name.
- `lang:cpp` limits to one language. Quote text with spaces in double quotes: `content:"void Start("`.
- A query with an uppercase letter is case-sensitive; add `case:no` to ignore case.
- Read a file before you rely on a result: the index is older than your edits.

The checkout is already indexed. Do not run `zoekt-index` or `zoekt-git-index`. If a search returns nothing, change the query and search again with `zoekt`.

**Rules.** The shell stays at the checkout root. Do not use `cd`. Edit and Write remain the way to change a file. The baseline shell rules still apply.
