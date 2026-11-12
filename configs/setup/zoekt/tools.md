You must search this checkout with Zoekt. Run `zoekt` through Bash. Do not use the Grep tool, and do not run `grep`, `rg`, or `git grep`. This replaces the baseline rule that sends a search to `grep` through Bash. Zoekt is not an MCP server. This command is how you search, and a search that skips it does not count.

The Chromium checkout is already indexed. Do not run `zoekt-index` or `zoekt-git-index`.

`zoekt [options] 'query'` searches the index. It does not take a directory. Put every flag before the query, and pass the whole query as one single-quoted argument. Each result line is `path:line:text`, and the path is relative to the checkout root.

- `zoekt 'TrexRunner'` prints matching lines.
- `zoekt -l 'TrexRunner'` lists the matching files.
- `zoekt 'TrexRunner file:components/neterror'` limits the search to paths that match. `file:` is a regular expression over the path, so `file:\.mojom$` keeps one extension.
- `zoekt 'TrexRunner -file:test'` drops paths that match. `-` in front of any expression negates it.
- `zoekt 'file:offline\.ts$'` finds files by name.
- `zoekt 'lang:cpp content:"void Start("'` limits the search to one language. Quote text that has a space with double quotes.

Expressions separated by a space must all match in the same file. `or` between two expressions matches either, and parentheses group them: `'(GameOver or gameOver) file:\.ts$'`. The word `and` is not an operator.

Text is a Go regular expression (RE2), with no backreferences. Escape `(`, `)`, `.`, `[`, `*`, and `+` with a backslash when you mean the character. A query with an uppercase letter is case-sensitive, and an all-lowercase query is not. Add `case:yes` or `case:no` to choose.

Do not use `sym:` or `-sym`. The index has no symbol data. Do not pass `-index_dir` or `-shard`.

The index is a snapshot of the whole checkout, submodules such as `v8/` and `third_party/skia/` included. It was built once, before this session, and it is not updated. It can come from another commit than the one checked out now. Treat a result as a pointer, not as the file's contents:

- A line number or a line of text can be out of date. Read the file before you rely on it or edit it.
- A result can name a file that has since moved or been deleted. When the path does not exist, search for the file name with `file:`.
- A file added after the snapshot, and a file you created, is missing from the index. A file you edited is searched as it was at the snapshot.
- `out/` is not indexed, and neither is a file larger than 2 MiB.

An empty result means the index had no match. Do not repeat that search with Grep or `grep`. Use `grep` through Bash only for the cases in the list above: a named file or directory the index does not hold or holds out of date.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
