You have `agrep`, the approximate-match search from the TRE library. Call it with Bash. It finds lines that are within a few character errors of a pattern, so it finds a name when you do not know its exact spelling, casing, or word order. You must use it before you give up on a name that `grep` did not find. The shell stays at the checkout root. Do not use `cd`.

`agrep` reads only the files you name. It does not walk a directory and it has no `-r`. Name each file, or let the shell expand a glob. Find the directory first with `grep` through Bash, as the baseline says.

Use this form:

`agrep -n -H -2 pattern path/to/dir/*.cc`

- `-2` allows up to two errors. An error is one missing, extra, or wrong character. `-0` to `-9` set the limit, and `-E 12` sets a larger one. Without a limit, only an exact match counts.
- `-n` prints line numbers. `-H` prints the file name, which `agrep` leaves out when you name one file.
- `-B` prints only the closest matches in each file. Use it when you do not know how many errors to allow.
- `-s` prints the number of errors of each match.
- `-i` is case-insensitive. `-k` treats the pattern as literal text. `-w` matches whole words.
- `-l` lists matching files. `-c` counts matching lines per file.

`-E` is the error limit here, not the extended-regexp switch it is in `grep`. The pattern is already a POSIX extended regular expression. Quote it in single quotes.

Start with one or two errors. A short pattern with a high limit matches almost every line. When `agrep` shows the exact spelling, go back to `grep` with that spelling to find the other uses.

Exit status 1 means there was no match. Do not pass a directory as a file.

Edit and Write remain the way to change a file. The baseline shell rules still apply.
