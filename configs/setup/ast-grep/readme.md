# ast-grep

[baseline](../baseline/readme.md) plus [ast-grep](https://ast-grep.github.io), a search that matches code by its syntax tree. It is an ordinary command. The agent runs `ast-grep` through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(ast-grep *)`, so a headless session can run those searches without a permission prompt.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must use `ast-grep run` for a search about code structure, and how to write a pattern. The baseline `grep` rule stays for plain text. Each search parses the files under the path it names, so there is nothing to build beforehand.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config ast-grep
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS:

```sh
brew install ast-grep
```

On Linux, run `cargo install ast-grep --locked` or `npm install --global @ast-grep/cli`. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `ast-grep` with no directory prefix, so the command has to resolve there.

## Limits

- `ast-grep` maps `.h` to C, so `-l cpp` does not read Chromium's C++ headers. The session prompt sends header searches to `grep`. A `languageGlobs` entry in an `sgconfig.yml` would map `.h` to C++, but the checkout has no such file, and the runner's `git clean` removes one that is not committed.
- `ast-grep run -r ... -U` rewrites files. The session prompt forbids it. The baseline guard does not parse `ast-grep` flags, so that rule is not enforced.
