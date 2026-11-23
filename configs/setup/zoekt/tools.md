You have Zoekt (`zoekt`), a trigram-indexed search over the whole checkout with a query language for paths and languages.
Use it for every code search. Run it through Bash.
Do not use the Grep tool, grep, rg, or git grep.
The checkout is already indexed. Do not run `zoekt-index` or `zoekt-git-index`. The shell stays at the checkout root. Do not use cd.

Use this form:

`zoekt 'pattern file:path/regex'`

- Put flags before the query, and pass the whole query as one single-quoted argument. `-l` lists matching files.
- `file:regex` keeps paths that match, `-file:regex` drops them, and `file:name\.ts$` alone finds files by name.
- `lang:cpp` limits to one language. Quote text with spaces in double quotes: `content:"void Start("`.
- A query with an uppercase letter is case-sensitive; add `case:no` to ignore case.
- The index is a snapshot from before this session: read a file before you rely on a result, and files you create are not in it.

If a search returns nothing, change the pattern and search again with `zoekt`.
Do not switch to another search tool.
